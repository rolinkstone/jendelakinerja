// scripts/muat-bulanan.cjs
// Memuat ekspor SAKTI "ADK REALISASI BELANJA ... PER SATKER" ke tabel
// realisasi_bulanan (grafik kumulatif Jan–Des di /realisasi-anggaran).
//
// Jalankan dari folder backend:
//   node scripts/muat-bulanan.cjs "<berkas.csv>"
//
// Berkas "Realisasi FA berdasarkan SP2D" TIDAK bisa dipakai di sini — tidak ada
// kolom tanggal di dalamnya.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { simpanBulanan, kumulatifBulanan } = require('../lib/adk-bulanan');

(async () => {
  const berkas = process.argv[2];
  if (!berkas) {
    console.error('pakai: node scripts/muat-bulanan.cjs "<berkas.csv>"');
    process.exit(1);
  }
  if (!fs.existsSync(berkas)) {
    console.error('berkas tidak ditemukan:', berkas);
    process.exit(1);
  }

  const isi = fs.readFileSync(berkas, 'utf8');
  const hasil = await simpanBulanan({
    isi,
    namaBerkas: path.basename(berkas),
    diunggahOleh: 'pemuatan awal',
  });

  console.log('berkas :', path.basename(berkas));
  console.log('tahun  :', hasil.tahun);
  console.log('baris  :', hasil.barisSah, '| dilewati:', hasil.dilewati);
  console.log('total  :', hasil.total.toLocaleString('id-ID'));
  console.log('\nkumulatif per bulan:');
  const kum = await kumulatifBulanan(hasil.tahun);
  kum.forEach((r) =>
    console.log(`  ${String(r.bulan).padStart(2, '0')} : ${r.nilai.toLocaleString('id-ID').padStart(18)} | kum ${r.kumulatif.toLocaleString('id-ID')}`),
  );
  process.exit(0);
})().catch((e) => {
  console.error('GAGAL:', e.message);
  process.exit(1);
});