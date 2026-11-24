// backend/routes/distribusi-kos.js
/**
 * ROUTER DISTRIBUSI — KOSMETIKA   prefix: /api/distribusi-kos
 * ---------------------------------------------------------------------------
 * Hanya berisi PEMETAAN KOLOM + konfigurasi; seluruh parser, aturan impor per
 * tahun, dan CRUD ada di `lib/distribusi.js`.
 *
 * Berkas "Laporan Hasil Pemeriksaan Sarana Distribusi - Kosmetik"
 * (berkas contoh: 35 kolom, header dua tingkat di baris 8-9, data mulai 10).
 *
 * CIRI KHAS yang membedakan dari PBF (44 kolom):
 *   - TIDAK ada blok temuan (Kategori / Observasi / Temuan) maupun M/m/C;
 *   - "Klasifikasi" (10) menggantikan Fokus Pemeriksaan;
 *   - judul "Tindak Lanjut" muncul DUA kali: kolom 11 (tindak lanjut UPT,
 *     sederajat dengan Saran Tindak Lanjut) dan kolom 15 (tindak lanjut
 *     setelah Hasil Balai) — keduanya disimpan ke kolom berbeda supaya tidak
 *     saling menimpa;
 *   - kesimpulan pemeriksaan ada di "Hasil Balai" (14).
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
  klasifikasi: 10,
  tindak_lanjut: 11,
  saran_tindak_lanjut: 12,
  catatan: 13,
  hasil_balai: 14,
  tindak_lanjut_pusat: 15,
  grading: 16,
  operator: 17,
  petugas: 18,
  status_tarikan: 19,
  kepala_balai: 20,
  tgl_kirim_ka_balai: 21,
  verif_operator_pusat: 22,
  verif_tgl_operator: 23,
  verif_supervisor_1: 24,
  verif_tgl_supervisor_1: 25,
  verif_supervisor_2: 26,
  verif_tgl_supervisor_2: 27,
  verif_direktur: 28,
  verif_tgl_direktur: 29,
  just_kesimpulan: 30,
  just_temuan: 31,
  just_catatan: 32,
  just_saran: 33,
  just_detil: 34,
};

/**
 * Kolom tanggal. WAJIB didaftarkan: hanya kolom di sini yang boleh
 * menerjemahkan serial angka Excel — tanpa daftar ini, angka lain (mis. harga)
 * ikut berubah menjadi tanggal.
 */
const TANGGAL = new Set([
  'tgl_input', 'tgl_periksa_mulai', 'tgl_periksa_selesai', 'tgl_kirim_ka_balai',
  'verif_tgl_operator', 'verif_tgl_supervisor_1', 'verif_tgl_supervisor_2',
  'verif_tgl_direktur',
]);

module.exports = buatRouterDistribusi({
  kode: 'kos',
  label: 'Distribusi Kosmetika',
  tabelImpor: 'dist_kos_import',
  tabelLaporan: 'dist_kos_laporan',
  kolom: KOLOM,
  tanggal: TANGGAL,
});
