// scripts/buat-user-db.cjs
/**
 * Membuat akun MySQL khusus aplikasi (bukan root tanpa sandi).
 *
 * Kenapa: backend/.env memakai DB_USER=root dengan sandi kosong. Meski MySQL
 * sudah hanya mendengarkan 127.0.0.1, akun root tanpa sandi berarti proses APA
 * PUN di mesin ini bisa membaca/menghapus SELURUH database (termasuk database
 * aplikasi lain di server MySQL yang sama).
 *
 * Skrip ini idempoten:
 *   - membuat user `jendela_app`@'127.0.0.1' bila belum ada
 *   - mengganti sandinya bila `--putar` diberikan
 *   - memberi hak HANYA pada database aplikasi
 *   - menulis DB_USER/DB_PASSWORD ke backend/.env (tidak pernah mencetak sandi)
 *
 * Jalankan dari folder backend:
 *   node scripts/buat-user-db.cjs            # buat bila belum ada
 *   node scripts/buat-user-db.cjs --putar    # ganti sandi (user mungkin ada)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const USER = 'jendela_app';
const HOST = '127.0.0.1';
const DB = process.env.DB_NAME || 'jendelakinerja';

/** Sandi acak kuat: 32 karakter base64url tanpa karakter yang menyulitkan .env. */
const sandiBaru = () => crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, '').slice(0, 32);

(async () => {
  const putar = process.argv.includes('--putar');

  // Koneksi administratif: pakai kredensial yang ADA di .env saat ini.
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false,
  });

  try {
    const [ada] = await admin.query('SELECT user, host FROM mysql.user WHERE user = ? AND host = ?', [USER, HOST]);
    const sandi = sandiBaru();

    if (!ada.length) {
      await admin.query(`CREATE USER ?@? IDENTIFIED BY ?`, [USER, HOST, sandi]);
      console.log(`user ${USER}@${HOST} dibuat`);
    } else if (putar) {
      await admin.query(`ALTER USER ?@? IDENTIFIED BY ?`, [USER, HOST, sandi]);
      console.log(`sandi ${USER}@${HOST} diganti`);
    } else {
      console.log(`user ${USER}@${HOST} sudah ada — sandi TIDAK diubah (pakai --putar bila perlu)`);
      return process.exit(0);
    }

    // Hak seminimal mungkin: hanya database aplikasi, tanpa GRANT OPTION.
    await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES, CREATE VIEW, SHOW VIEW ON \`${DB}\`.* TO ?@?`, [USER, HOST]);
    await admin.query('FLUSH PRIVILEGES');
    console.log(`hak diberikan pada database ${DB}`);

    // Uji koneksi dengan akun baru SEBELUM mengubah .env.
    const uji = await mysql.createConnection({
      host: HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: USER,
      password: sandi,
      database: DB,
    });
    const [baris] = await uji.query('SELECT COUNT(*) AS n FROM anggaran_realisasi');
    await uji.end();
    console.log('uji koneksi akun baru: OK, baris anggaran_realisasi =', baris[0].n);

    // Tulis ke .env: ganti DB_USER/DB_PASSWORD, sisanya dibiarkan apa adanya.
    const envPath = path.join(__dirname, '..', '.env');
    const isi = fs.readFileSync(envPath, 'utf8');
    const tanpa = isi
      .split(/\r?\n/)
      .filter((l) => !/^\s*DB_USER\s*=/.test(l) && !/^\s*DB_PASSWORD\s*=/.test(l));
    // Selipkan tepat setelah DB_NAME bila ada, kalau tidak di akhir.
    const idx = tanpa.findIndex((l) => /^\s*DB_NAME\s*=/.test(l));
    const barisBaru = [`DB_USER=${USER}`, `DB_PASSWORD=${sandi}`];
    if (idx >= 0) tanpa.splice(idx + 1, 0, ...barisBaru);
    else tanpa.push(...barisBaru);
    fs.writeFileSync(envPath, tanpa.join('\n').replace(/\n+$/, '') + '\n');

    console.log('backend/.env diperbarui (DB_USER, DB_PASSWORD) — nilai tidak dicetak.');
    console.log('RESTART backend agar kredensial baru dipakai.');
  } finally {
    await admin.end();
  }
  process.exit(0);
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});