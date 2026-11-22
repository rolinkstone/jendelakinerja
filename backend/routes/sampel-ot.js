// backend/routes/sampel-ot.js
/**
 * ROUTER SAMPEL — OBAT TRADISIONAL (OT)   prefix: /api/sampel-ot
 * -----------------------------------------------------------------
 * Hanya berisi konfigurasi. Seluruh parsing Excel, aturan impor per tahun,
 * dan CRUD ada di `lib/sampel.js` (`buatRouterSampel`) dan dipakai bersama
 * dengan modul Sampel — Suplemen Kesehatan (SK).
 *
 * Tata letak berkas, aturan penggabungan baris, dan deteksi tahun dijelaskan
 * lengkap di kepala lib/sampel.js.
 */
const { buatRouterSampel } = require('../lib/sampel');

module.exports = buatRouterSampel({
  label: 'Sampel Obat Tradisional',
  tabelImpor: 'sampel_ot_import',
  tabelLaporan: 'sampel_ot_laporan',
});
