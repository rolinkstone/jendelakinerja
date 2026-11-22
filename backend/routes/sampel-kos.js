// backend/routes/sampel-kos.js
/**
 * ROUTER SAMPEL — KOSMETIKA (KOS)   prefix: /api/sampel-kos
 * ---------------------------------------------------------------------
 * Hanya berisi konfigurasi. Seluruh parsing Excel, aturan impor per tahun,
 * dan CRUD ada di `lib/sampel.js` (`buatRouterSampel`).
 *
 * Berkas Kosmetika 54 kolom — lebih sedikit dari OT/SK (55) dan Obat (59):
 * "Jenis Sarana", "Kriteria Resiko", dan "ATC" tidak ada.
 * Kolom 15 di bawah kelompok "Tujuan Sampling" TIDAK berjudul, dan isinya
 * memang tujuan sampling ("Targeted » Berisiko tinggi » Cluster A …"). Karena
 * judul kelompok di situ cocok dengan medannya, engine memetakannya sendiri —
 * tidak perlu `kolomPaku`.
 * Berkas contoh: 812 baris mentah -> 406 sampel (tahun 2026).
 */
const { buatRouterSampel } = require('../lib/sampel');

module.exports = buatRouterSampel({
  label: 'Sampel Kosmetika',
  tabelImpor: 'sampel_kos_import',
  tabelLaporan: 'sampel_kos_laporan',
});
