// backend/routes/distribusi-ipk.js
/**
 * ROUTER DISTRIBUSI — IPK (Intensifikasi Pengawasan Khusus)
 * prefix: /api/distribusi-ipk
 * ---------------------------------------------------------------------------
 * Hanya PEMETAAN KOLOM + konfigurasi; parser & CRUD ada di `lib/distribusi.js`.
 *
 * Berkas "Laporan Hasil Pemeriksaan Sarana Distribusi - Intensifikasi
 * Pengawasan Khusus": **32 kolom** — paling ringkas di keluarga distribusi
 * (berkas contoh 21 baris → 12 laporan).
 *
 * CIRI KHAS:
 *   - TIDAK ada blok temuan (Kategori/Observasi/Temuan), M/m/C, maupun
 *     "Klasifikasi" — jadi `kolomDaftar`/`kolomCari` di bawah TIDAK boleh
 *     menyebut `klasifikasi` (akan jadi SQL error);
 *   - yang khas hanya "Tindakan Terhadap Produk" (10);
 *   - kesimpulan ada di "Hasil Balai" (11).
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
  tindakan_terhadap_produk: 10,
  hasil_balai: 11,
  tindak_lanjut: 12,
  grading: 13,
  operator: 14,
  petugas: 15,
  status_tarikan: 16,
  kepala_balai: 17,
  tgl_kirim_ka_balai: 18,
  verif_operator_pusat: 19,
  verif_tgl_operator: 20,
  verif_supervisor_1: 21,
  verif_tgl_supervisor_1: 22,
  verif_supervisor_2: 23,
  verif_tgl_supervisor_2: 24,
  verif_direktur: 25,
  verif_tgl_direktur: 26,
  just_kesimpulan: 27,
  just_temuan: 28,
  just_catatan: 29,
  just_saran: 30,
  just_detil: 31,
};

/** Kolom tanggal — hanya ini yang boleh menerjemahkan serial angka Excel. */
const TANGGAL = new Set([
  'tgl_input', 'tgl_periksa_mulai', 'tgl_periksa_selesai', 'tgl_kirim_ka_balai',
  'verif_tgl_operator', 'verif_tgl_supervisor_1', 'verif_tgl_supervisor_2',
  'verif_tgl_direktur',
]);

module.exports = buatRouterDistribusi({
  kode: 'ipk',
  label: 'Distribusi IPK',
  tabelImpor: 'dist_ipk_import',
  tabelLaporan: 'dist_ipk_laporan',
  kolom: KOLOM,
  tanggal: TANGGAL,
  // IPK tidak punya `klasifikasi` — daftar kolomnya disesuaikan.
  kolomDaftar: ['tindakan_terhadap_produk', 'hasil_balai', 'grading'],
  kolomCari: ['nama_sarana', 'nama_balai', 'alamat', 'kab_kota', 'hasil_balai', 'grading', 'tindakan_terhadap_produk'],
});
