// backend/routes/sampel-ok.js
/**
 * ROUTER SAMPEL — OBAT KUASI (OK)   prefix: /api/sampel-ok
 * ---------------------------------------------------------------------
 * Hanya berisi konfigurasi. Seluruh parsing Excel, aturan impor per tahun,
 * dan CRUD ada di `lib/sampel.js` (`buatRouterSampel`).
 *
 * Berkas Obat Kuasi tata letaknya SAMA dengan Produk Pangan (54 kolom,
 * header dua tingkat), jadi tidak perlu `kolomPaku`.
 * Berkas contoh: 54 baris mentah -> 27 sampel (tahun 2024).
 */
const { buatRouterSampel } = require('../lib/sampel');

module.exports = buatRouterSampel({
  label: 'Sampel Obat Kuasi',
  tabelImpor: 'sampel_ok_import',
  tabelLaporan: 'sampel_ok_laporan',
});
