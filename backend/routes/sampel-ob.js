// backend/routes/sampel-ob.js
/**
 * ROUTER SAMPEL — OBAT (OB)   prefix: /api/sampel-ob
 * ---------------------------------------------------------------------
 * Hanya berisi konfigurasi. Seluruh parsing Excel, aturan impor per tahun,
 * dan CRUD ada di `lib/sampel.js` (`buatRouterSampel`).
 *
 * Berkas Obat 59 kolom, ada "Kriteria Resiko" dan "ATC", dan "Jenis Sarana"
 * tidak berjudul. Kolom ke-15 (setelah "Kabupaten/Kota") TIDAK punya judul dan
 * isinya TIDAK SAMA antar tahun:
 *   - Obat 2025 → "Sarana Berizin » Obat JKN"       (jenis sarana)
 *   - Obat 2024 → "Acak » NON JKN"                  (tujuan sampling)
 * Karena itu JANGAN dipaku di sini. Engine menentukan medannya dari ISI kolom
 * (PETUNJUK_NILAI di lib/sampel.js), bukan dari judul kelompoknya.
 * Catatan: berkas Obat tidak punya kolom Tujuan Sampling berjudul pada 2025,
 * jadi `tujuan_sampling` kosong untuk tahun itu — lebih baik kosong daripada
 * salah isi.
 * Berkas contoh: 1.104 baris mentah -> 274 sampel (2025); 1.654 -> 426 (2024).
 */
const { buatRouterSampel } = require('../lib/sampel');

module.exports = buatRouterSampel({
  label: 'Sampel Obat',
  tabelImpor: 'sampel_ob_import',
  tabelLaporan: 'sampel_ob_laporan',
});
