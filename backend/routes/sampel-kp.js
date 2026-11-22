// backend/routes/sampel-kp.js
/**
 * ROUTER SAMPEL — KEMASAN PANGAN (KP)   prefix: /api/sampel-kp
 * ---------------------------------------------------------------------
 * Hanya berisi konfigurasi. Seluruh parsing Excel, aturan impor per tahun,
 * dan CRUD ada di `lib/sampel.js` (`buatRouterSampel`).
 *
 * Berkas Kemasan Pangan tata letaknya SAMA dengan Produk Pangan (54 kolom,
 * header dua tingkat), jadi tidak perlu `kolomPaku`. Yang khas: rincian
 * jenis kemasan (mis. "» Polikarbonat (pc)") ada di kolom `Kategori`,
 * sedangkan `Kategori Sarana` hanya berisi "Pangan".
 * Berkas contoh: 18 baris mentah -> 9 sampel (tahun 2024).
 */
const { buatRouterSampel } = require('../lib/sampel');

module.exports = buatRouterSampel({
  label: 'Sampel Kemasan Pangan',
  tabelImpor: 'sampel_kp_import',
  tabelLaporan: 'sampel_kp_laporan',
});
