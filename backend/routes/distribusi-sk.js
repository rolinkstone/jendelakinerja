// backend/routes/distribusi-sk.js
/**
 * ROUTER DISTRIBUSI — SUPLEMEN KESEHATAN   prefix: /api/distribusi-sk
 * ---------------------------------------------------------------------------
 * Hanya PEMETAAN KOLOM + konfigurasi; parser & CRUD ada di `lib/distribusi.js`.
 *
 * Berkas "Laporan Hasil Pemeriksaan Sarana Distribusi - Suplemen Kesehatan":
 * **38 kolom** (berkas contoh 28 baris → 19 laporan).
 *
 * JANGAN tertukar dengan modul SAMPEL Suplemen Kesehatan (`sampel-sk`):
 * yang ini sarana peredaran yang diperiksa, bukan produk yang diuji lab.
 *
 * CIRI KHAS:
 *   - ada "Metode Inspeksi" (10) dan "Klasifikasi" (11);
 *   - judul "Tindak Lanjut" muncul DUA kali: kolom 12 (UPT) dan kolom 18
 *     (setelah Hasil Balai) → disimpan ke `tindak_lanjut` dan
 *     `tindak_lanjut_pusat` agar tidak saling menimpa;
 *   - "Detil Hasil Pemeriksaan" (14) dan "Detil Kesimpulan TMK" (15);
 *   - kesimpulan ada di "Hasil Balai" (17).
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
  tindak_lanjut: 12,
  saran_tindak_lanjut: 13,
  detil_hasil_pemeriksaan: 14,
  detil_kesimpulan_tmk: 15,
  catatan: 16,
  hasil_balai: 17,
  tindak_lanjut_pusat: 18,
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
  kode: 'sk',
  label: 'Distribusi Suplemen Kesehatan',
  tabelImpor: 'dist_sk_import',
  tabelLaporan: 'dist_sk_laporan',
  kolom: KOLOM,
  tanggal: TANGGAL,
  kolomDaftar: ['klasifikasi', 'hasil_balai', 'grading'],
  kolomCari: ['nama_sarana', 'nama_balai', 'alamat', 'kab_kota', 'hasil_balai', 'grading', 'klasifikasi'],
});
