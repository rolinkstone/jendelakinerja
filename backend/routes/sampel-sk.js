// backend/routes/sampel-sk.js
/**
 * ROUTER SAMPEL — SUPLEMEN KESEHATAN (SK)   prefix: /api/sampel-sk
 * ---------------------------------------------------------------------
 * Hanya berisi konfigurasi. Seluruh parsing Excel, aturan impor per tahun,
 * dan CRUD ada di `lib/sampel.js` (`buatRouterSampel`) — engine yang sama
 * dipakai modul Sampel — Obat Tradisional (OT).
 *
 * Berkas "suplemen kesehatan 2025.xlsx" memakai tata letak yang identik
 * dengan berkas sampel OT (55 kolom, header baris 9-10), jadi tidak ada
 * parser khusus: 134 baris mentah -> 62 sampel.
 */
const { buatRouterSampel } = require('../lib/sampel');

module.exports = buatRouterSampel({
  label: 'Sampel Suplemen Kesehatan',
  tabelImpor: 'sampel_sk_import',
  tabelLaporan: 'sampel_sk_laporan',
});
