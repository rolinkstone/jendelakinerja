// backend/routes/sampel-pp.js
/**
 * ROUTER SAMPEL — PRODUK PANGAN (PP)   prefix: /api/sampel-pp
 * ---------------------------------------------------------------------
 * Hanya berisi konfigurasi. Seluruh parsing Excel, aturan impor per tahun,
 * dan CRUD ada di `lib/sampel.js` (`buatRouterSampel`).
 *
 * Berkas Produk Pangan 54 kolom. Yang beda dari komoditi lain:
 * `Jenis Sarana` tidak ada (yang ada `Kategori Sarana` = "Pangan IRT (CPPB -
 * IRT)"), sedangkan `Kategori` (34) dan `Komposisi` (24) sangat panjang
 * (514 & 1.277 karakter) sehingga disimpan sebagai TEXT.
 * Kolom 15 di bawah kelompok "Tujuan Sampling" tidak berjudul dan isinya
 * memang tujuan sampling, jadi engine memetakannya lewat judul kelompok.
 * Berkas contoh: 2.880 baris mentah -> 631 sampel (tahun 2024).
 */
const { buatRouterSampel } = require('../lib/sampel');

module.exports = buatRouterSampel({
  label: 'Sampel Produk Pangan',
  tabelImpor: 'sampel_pp_import',
  tabelLaporan: 'sampel_pp_laporan',
});
