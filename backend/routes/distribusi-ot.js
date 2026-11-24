// backend/routes/distribusi-ot.js
/**
 * ROUTER DISTRIBUSI — OBAT TRADISIONAL   prefix: /api/distribusi-ot
 * ---------------------------------------------------------------------------
 * Hanya berisi PEMETAAN KOLOM + konfigurasi; seluruh parser, aturan impor per
 * tahun, dan CRUD ada di `lib/distribusi.js`.
 *
 * JANGAN tertukar dengan `routes/produksi-ot.js`: yang ini sarana DISTRIBUSI
 * (peredaran), sedangkan produksi-ot menilai sarana PRODUKSI (CPOTB).
 *
 * Berkas "Laporan Hasil Pemeriksaan Sarana Distribusi - Obat Tradisional"
 * (berkas contoh: 38 kolom, header dua tingkat di baris 8-9, data mulai 10).
 *
 * CIRI KHAS yang membedakan dari PBF (44 kolom):
 *   - ada "Metode Inspeksi" (10);
 *   - TIDAK ada blok temuan (Kategori/Observasi/Temuan) maupun M/m/C;
 *   - ada tiga kolom detil berurutan: Detil Tindak Lanjut (13), Detil Hasil
 *     Pemeriksaan (14), Detil Kesimpulan TMK (15);
 *   - kesimpulan pemeriksaan ada di "Hasil Balai" (17).
 */
const { buatRouterDistribusi } = require('../lib/distribusi');

/** Nama kolom DB → indeks kolom Excel (0-based). */
const KOLOM = {
  no_urut: 0,
  nama_balai: 1,
  nama_sarana: 2,
  alamat: 3,
  kab_kota: 4,
  jenis_industri: 5,
  tgl_input: 6,
  tgl_periksa_mulai: 7,
  tgl_periksa_selesai: 8,
  tujuan_pemeriksaan: 9,
  metode_inspeksi: 10,
  klasifikasi: 11,
  saran_tindak_lanjut: 12,
  detil_tindak_lanjut: 13,
  detil_hasil_pemeriksaan: 14,
  detil_kesimpulan_tmk: 15,
  catatan: 16,
  hasil_balai: 17,
  tindak_lanjut: 18,
  grading: 19,
  operator: 20,
  petugas: 21,
  status_tarikan: 22,
  kepala_balai: 23,
  tgl_kirim_ka_balai: 24,
  verif_operator_pusat: 25,
  verif_tgl_operator: 26,
  verif_supervisor_1: 27,
  verif_tgl_supervisor_1: 28,
  verif_supervisor_2: 29,
  verif_tgl_supervisor_2: 30,
  verif_direktur: 31,
  verif_tgl_direktur: 32,
  just_kesimpulan: 33,
  just_temuan: 34,
  just_catatan: 35,
  just_saran: 36,
  just_detil: 37,
};

/** Kolom tanggal — hanya ini yang boleh menerjemahkan serial angka Excel. */
const TANGGAL = new Set([
  'tgl_input', 'tgl_periksa_mulai', 'tgl_periksa_selesai', 'tgl_kirim_ka_balai',
  'verif_tgl_operator', 'verif_tgl_supervisor_1', 'verif_tgl_supervisor_2',
  'verif_tgl_direktur',
]);

module.exports = buatRouterDistribusi({
  kode: 'ot',
  label: 'Distribusi Obat Tradisional',
  tabelImpor: 'dist_ot_import',
  tabelLaporan: 'dist_ot_laporan',
  kolom: KOLOM,
  tanggal: TANGGAL,
});
