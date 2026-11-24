// backend/routes/produksi-pangan-md.js
/**
 * ROUTER PRODUKSI — PANGAN MD (Pangan Olahan Makanan Dalam)
 * prefix: /api/produksi-pangan-md
 * ---------------------------------------------------------------------------
 * Hanya PEMETAAN KOLOM + konfigurasi; parser & CRUD ada di `lib/distribusi.js`
 * (mesin generik "laporan sarana per tahun" — dipakai keluarga distribusi dan
 * modul produksi ini; namanya historis, bukan pembatas).
 *
 * Berkas "Laporan Hasil Pemeriksaan Sarana Produksi - Pangan MD":
 * **48 kolom**, 31 baris mentah → 22 laporan. Header dua tingkat baris 8-9,
 * data mulai baris 10, TIDAK ada baris lanjutan.
 *
 * CIRI KHAS:
 *   - identitas produk ada di baris sarana: Nama Pangan (11), Jenis Pangan (12),
 *     Merk Produk (13);
 *   - blok Sertifikat empat kolom: Jenis (14), Nomor (15), Masa Berlaku (16),
 *     Lembaga Penerbit (17);
 *   - Status Sarana (18), temuan ketidaksesuaian administrasi (19-20),
 *     M/m/C (21-23), Tingkat Rating Unit Pengolahan (24);
 *   - DUA kolom kesimpulan: `kesimpulan` (26) dan `hasil_balai` (27).
 *     Dashboard memakai `hasil_balai` sebagai kesimpulan akhir.
 *
 * `kegiatan` diisi otomatis oleh lib/kinerja.js dari kepala berkas
 * ("Produksi - Pangan MD") → kegiatan = 'Produksi', jenis_sarana = 'Pangan MD'.
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
  nama_pangan: 11,
  jenis_pangan: 12,
  merk_produk: 13,
  sert_jenis: 14,
  sert_nomor: 15,
  sert_masa_berlaku: 16,
  sert_lembaga: 17,
  status_sarana: 18,
  temuan_nomor: 19,
  temuan_deskripsi: 20,
  jumlah_mayor: 21,
  jumlah_minor: 22,
  jumlah_kritis: 23,
  rating: 24,
  catatan: 25,
  kesimpulan: 26,
  hasil_balai: 27,
  tindak_lanjut: 28,
  grading: 29,
  operator: 30,
  petugas: 31,
  status_tarikan: 32,
  kepala_balai: 33,
  tgl_kirim_ka_balai: 34,
  verif_operator_pusat: 35,
  verif_tgl_operator: 36,
  verif_supervisor_1: 37,
  verif_tgl_supervisor_1: 38,
  verif_supervisor_2: 39,
  verif_tgl_supervisor_2: 40,
  verif_direktur: 41,
  verif_tgl_direktur: 42,
  just_kesimpulan: 43,
  just_temuan: 44,
  just_catatan: 45,
  just_saran: 46,
  just_detil: 47,
};

/** Kolom angka — jangan disimpan sebagai teks. */
const ANGKA = new Set(['jumlah_mayor', 'jumlah_minor', 'jumlah_kritis']);

/** Kolom tanggal — hanya ini yang boleh menerjemahkan serial angka Excel. */
const TANGGAL = new Set([
  'tgl_input', 'tgl_periksa_mulai', 'tgl_periksa_selesai', 'tgl_kirim_ka_balai',
  'sert_masa_berlaku',
  'verif_tgl_operator', 'verif_tgl_supervisor_1', 'verif_tgl_supervisor_2',
  'verif_tgl_direktur',
]);

module.exports = buatRouterDistribusi({
  kode: 'md',
  label: 'Produksi Pangan MD',
  tabelImpor: 'prod_md_import',
  tabelLaporan: 'prod_md_laporan',
  kolom: KOLOM,
  tanggal: TANGGAL,
  angka: ANGKA,
  kolomDaftar: ['jenis_pangan', 'nama_pangan', 'jumlah_mayor', 'jumlah_minor', 'jumlah_kritis', 'hasil_balai', 'grading'],
  kolomCari: ['nama_sarana', 'nama_balai', 'alamat', 'kab_kota', 'nama_pangan', 'jenis_pangan', 'merk_produk', 'hasil_balai'],
});
