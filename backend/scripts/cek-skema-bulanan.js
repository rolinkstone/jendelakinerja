// scripts/cek-skema-bulanan.js
// ---------------------------------------------------------------------------
// PEMERIKSA KESIAPAN PRODUCTION untuk fitur "Isi Realisasi Bulanan".
//
// KENAPA ADA: `CREATE TABLE IF NOT EXISTS` tidak pernah menambah kolom pada
// tabel yang sudah ada. Server production yang tabel `realisasi_bulanan`-nya
// dibuat dari versi lama tetap TANPA kolom `pagu` dan tanpa indeks unik, walau
// kode sudah mendukungnya. Akibatnya PUT /api/anggaran-realisasi/bulanan gagal
// dengan "Unknown column 'pagu'" di production, sementara di lokal jalan
// (karena di lokal skrip ubah-skema sudah pernah dijalankan manual).
//
// Skrip ini TIDAK mengubah apa pun kecuali diminta `--perbaiki`. Tanpa itu,
// hanya melaporkan kondisi sebenarnya.
//
// Jalankan dari folder backend:
//   node scripts/cek-skema-bulanan.js              # laporan saja
//   node scripts/cek-skema-bulanan.js --perbaiki   # tambah kolom/indeks
// ---------------------------------------------------------------------------

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { query } = require('../db');

const PERBAIKI = process.argv.includes('--perbaiki');

async function kolomAda(name) {
  const [r] = await query(
    `SELECT COUNT(*) n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'realisasi_bulanan' AND column_name = ?`,
    [name],
  );
  return Number(r[0].n) === 1;
}

async function indeksAda(name) {
  const [r] = await query(
    `SELECT COUNT(*) n FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'realisasi_bulanan' AND index_name = ?`,
    [name],
  );
  return Number(r[0].n) > 0;
}

async function tabelAda(name) {
  const [r] = await query(
    `SELECT COUNT(*) n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [name],
  );
  return Number(r[0].n) === 1;
}

(async () => {
  const [db] = await query('SELECT DATABASE() AS d');
  console.log('Database :', db[0].d);
  console.log('Mode     :', PERBAIKI ? 'PERBAIKI' : 'laporan saja (tambah --perbaiki untuk mengubah)');
  console.log('');

  let bermasalah = 0;

  // 1) tabel utama harus ada
  const adaTabel = await tabelAda('realisasi_bulanan');
  console.log(`${adaTabel ? 'OK  ' : 'GAGAL'}  tabel realisasi_bulanan`);
  if (!adaTabel) {
    bermasalah += 1;
    console.log('       -> jalankan: node scripts/apply-schema.js');
    console.log('\nRingkasan: tabel belum ada, pemeriksaan lain dilewati.');
    process.exit(0);
  }

  // 2) kolom pagu
  let adaPagu = await kolomAda('pagu');
  if (!adaPagu && PERBAIKI) {
    await query('ALTER TABLE `realisasi_bulanan` ADD COLUMN `pagu` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `nilai`');
    adaPagu = await kolomAda('pagu');
    console.log('      (kolom pagu DITAMBAHKAN)');
  }
  console.log(`${adaPagu ? 'OK  ' : 'GAGAL'}  kolom pagu`);
  if (!adaPagu) {
    bermasalah += 1;
    console.log('       -> form "Isi Realisasi Bulanan" AKAN GAGAL: Unknown column \'pagu\'');
  }

  // 3) indeks unik untuk UPSERT
  let adaIdx = await indeksAda('uq_bulanan');
  if (!adaIdx && PERBAIKI) {
    // Indeks hanya bisa dibuat bila tidak ada duplikat (tahun, bulan, jenis).
    const [dup] = await query(
      `SELECT tahun, bulan, jenis, COUNT(*) n FROM realisasi_bulanan
        GROUP BY tahun, bulan, jenis HAVING n > 1 LIMIT 5`,
    );
    if (dup.length) {
      console.log('GAGAL  indeks uq_bulanan — ada baris duplikat, bersihkan dulu:');
      dup.forEach((d) => console.log(`       tahun ${d.tahun} bulan ${d.bulan} jenis ${d.jenis} -> ${d.n} baris`));
      bermasalah += 1;
    } else {
      await query('ALTER TABLE `realisasi_bulanan` ADD UNIQUE KEY `uq_bulanan` (`tahun`, `bulan`, `jenis`)');
      adaIdx = await indeksAda('uq_bulanan');
      console.log('      (indeks uq_bulanan DITAMBAHKAN)');
    }
  }
  console.log(`${adaIdx ? 'OK  ' : 'GAGAL'}  indeks unik uq_bulanan (tahun, bulan, jenis)`);
  if (!adaIdx) {
    bermasalah += 1;
    console.log('       -> penyimpanan akan MENAMBAH baris ganda, bukan memperbarui');
  }

  // 4) data yang sudah ada
  const [isi] = await query(
    `SELECT tahun, COUNT(DISTINCT bulan) bulan_terisi, COUNT(*) baris,
            COALESCE(SUM(nilai),0) realisasi, COALESCE(SUM(pagu),0) pagu
       FROM realisasi_bulanan WHERE jenis = '00' GROUP BY tahun ORDER BY tahun`,
  );
  console.log('');
  if (!isi.length) {
    console.log('DATA    (kosong) — belum ada realisasi bulanan tersimpan');
  } else {
    isi.forEach((r) => console.log(
      `DATA    ${r.tahun}: ${r.bulan_terisi} bulan, ${r.baris} baris, ` +
      `realisasi ${Number(r.realisasi).toLocaleString('id-ID')}, pagu ${Number(r.pagu).toLocaleString('id-ID')}`,
    ));
  }

  // 5) berkas skema yang wajib ikut terpasang
  const [pend] = await query("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'pendapatan_bulanan'");
  console.log(`${Number(pend[0].n) === 1 ? 'OK  ' : 'INFO'}  tabel pendapatan_bulanan (modul Pendapatan)`);

  console.log('');
  console.log(bermasalah === 0 ? 'Ringkasan: skema SIAP.' : `Ringkasan: ${bermasalah} masalah. Jalankan dengan --perbaiki.`);
  process.exit(bermasalah === 0 ? 0 : 1);
})().catch((err) => {
  console.error('GAGAL:', err.code || '', err.message);
  process.exit(1);
});
