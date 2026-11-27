// scripts/buat-sesi-uji.cjs
/**
 * PEMBUAT SESI UJI (KHUSUS PENGEMBANGAN LOKAL)
 * -------------------------------------------
 * Membuat cookie sesi NextAuth yang sah supaya halaman ber-SSO bisa diuji
 * otomatis tanpa login manual (Keycloak butuh kredensial yang tidak boleh
 * ditebak dari skrip).
 *
 * Cara pakai:
 *   cd frontend && node scripts/buat-sesi-uji.cjs
 * Hasil: %TEMP%/jk-sesi-uji.json  -> { namaCookie, nilai }
 * Pasang cookie itu di browser (CDP Network.setCookies) sebelum membuka halaman.
 *
 * SYARAT: berkas ini membaca NEXTAUTH_SECRET dari frontend/.env, jadi hanya
 * berguna di mesin pengembangan. JANGAN dipakai di server produksi, dan jangan
 * pernah menjalankan skrip ini di mesin yang .env-nya bisa dibaca orang lain.
 *
 * CATATAN: `session.expires` di aplikasi ini diambil dari `token.expiresAt`
 * (kedaluwarsa token Keycloak). Kalau expiresAt tidak diisi atau sudah lewat,
 * halaman langsung melempar ke /login dengan pesan "token kedaluwarsa" —
 * jadi nilai itu WAJIB di masa depan, bukan sekadar `expires` bawaan NextAuth.
 */
const fs = require('fs');
const path = require('path');
const { encode } = require('next-auth/jwt');

/** Baca .env sederhana (frontend tidak punya paket dotenv). */
function bacaEnv(berkas) {
  if (!fs.existsSync(berkas)) return;
  const isi = fs.readFileSync(berkas, 'utf8');
  isi.split(/\r?\n/).forEach((baris) => {
    const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) return;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

bacaEnv(path.join(__dirname, '..', '.env'));
bacaEnv(path.join(__dirname, '..', '.env.local'));

(async () => {
  const rahasia = process.env.NEXTAUTH_SECRET;
  if (!rahasia) throw new Error('NEXTAUTH_SECRET tidak terbaca dari frontend/.env');

  const berlaku = 8 * 60 * 60; // 8 jam
  const sekarang = Math.floor(Date.now() / 1000);

  const sesi = {
    id: 'uji-lokal',
    name: 'Uji Tampilan',
    email: 'uji@localhost',
    role: 'admin',
    roles: ['admin'],
    // accessToken dipakai proxy /api/<modul>/[...path]. Nilainya tidak sah di
    // mata backend (yang memverifikasi tanda tangan Keycloak), jadi hanya cukup
    // untuk menguji TAMPILAN halaman; endpoint modul tetap akan menolak.
    accessToken: 'sesi-uji-bukan-token-keycloak',
    expiresAt: sekarang + berlaku,
    expires: new Date((sekarang + berlaku) * 1000).toISOString(),
  };

  const nilai = await encode({ token: sesi, secret: rahasia, maxAge: berlaku });
  const hasil = {
    namaCookie: `${process.env.AUTH_COOKIE_PREFIX || 'jk'}.session-token`,
    nilai,
  };
  const tujuan = path.join(process.env.TEMP || process.env.TMPDIR || '.', 'jk-sesi-uji.json');
  fs.writeFileSync(tujuan, JSON.stringify(hasil));
  console.log('sesi ditulis ke', tujuan);
  console.log('nama cookie :', hasil.namaCookie);
  console.log('panjang     :', nilai.length);
  console.log('berlaku     : 8 jam');
  process.exit(0);
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});