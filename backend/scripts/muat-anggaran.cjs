// scripts/muat-anggaran.cjs
// Memuat satu berkas "Realisasi FA berdasarkan SP2D" ke database memakai jalur
// yang SAMA dengan unggahan lewat layar (lib/anggaran.js -> simpanTahun).
// Dipakai untuk pemuatan awal sebelum halaman /anggaran-realisasi siap, dan
// untuk memuat ulang setelah aturan MAK diperbaiki.
//
// Jalankan dari folder backend:
//   node scripts/muat-anggaran.cjs "<berkas.xlsx>" 2026
//
// Tanpa argumen tahun, tahun diambil dari nama berkas ("..._2026-11-27").
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { simpanTahun, tahunDariNama } = require('../lib/anggaran');

(async () => {
  const berkas = process.argv[2];
  if (!berkas) {
    console.error('pakai: node scripts/muat-anggaran.cjs "<berkas.xlsx>" [tahun]');
    process.exit(1);
  }
  if (!fs.existsSync(berkas)) {
    console.error('berkas tidak ditemukan:', berkas);
    process.exit(1);
  }

  const tahun = Number(process.argv[3]) || tahunDariNama(path.basename(berkas));
  if (!tahun) {
    console.error('tahun anggaran tidak bisa ditentukan; tulis tahunnya di argumen ke-2');
    process.exit(1);
  }

  console.log('berkas :', path.basename(berkas));
  console.log('tahun  :', tahun);

  const hasil = await simpanTahun({
    tahun,
    namaBerkas: path.basename(berkas),
    diunggahOleh: 'pemuatan awal',
    buffer: fs.readFileSync(berkas),
  });

  if (hasil.gagal) {
    console.error('GAGAL:', hasil.gagal);
    console.error('tanpa MAK:', hasil.tanpaMak.slice(0, 5));
    process.exit(1);
  }

  const r = hasil.ringkasan;
  console.log('');
  console.log('baris tersimpan  :', hasil.baris_tersimpan);
  console.log('baris lama dihapus:', hasil.baris_dihapus);
  console.log('baris dilewati   :', hasil.dilewati, '| tanpa MAK:', hasil.jumlah_tanpa_mak);
  console.log('');
  console.log('pagu      :', r.pagu.toLocaleString('id-ID'));
  console.log('realisasi :', r.realisasi.toLocaleString('id-ID'));
  console.log('sisa      :', r.sisa.toLocaleString('id-ID'));
  console.log('serapan   :', r.persen_serapan + '%');
  console.log('MAK unik  :', r.jumlah_mak, '| komponen:', r.jumlah_komponen, '| akun:', r.jumlah_akun);
  process.exit(0);
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});