// backend/lib/saring-publik.js
/**
 * ============================================================================
 *  PENYARING KOLOM PRIBADI — untuk akses BACA PUBLIK
 * ============================================================================
 *  Sejak data modul (PBF, Produksi, Sampel) dibuka untuk dibaca tanpa login
 *  (dipakai LAURA AI dan halaman publik), kolom bertanda personal TIDAK boleh
 *  ikut keluar. Endpoint daftar sudah memilih kolom satu per satu, tetapi
 *  endpoint DETAIL memakai `SELECT *` sehingga nama operator/petugas/
 *  verifikator ikut terkirim.
 *
 *  Berkas ini membuang kolom itu dari objek baris sebelum dikirim. Daftar
 *  kolom dicocokkan dengan pola nama (bukan daftar tetap) supaya kolom
 *  personal baru di tabel mana pun otomatis tersaring.
 *
 *  Yang HILANG dari respons publik: nama orang + tanggal tanda tangan
 *  (tanggal verifikasi tidak berguna tanpa nama, dan tanggal itu bisa
 *  mengungkap beban kerja/jejak pegawai).
 *  Yang TETAP ada: seluruh data teknis (sarana, alamat, hasil uji, temuan,
 *  grading, kesimpulan, jumlah, sertifikat, rincian pemeriksaan).
 * ============================================================================
 */

/** Pola nama kolom yang dianggap data pribadi. */
const POLA_PRIBADI = [
  /^operator$/i,
  /^petugas$/i,
  /^verif/i,
  /^verifikasi_oleh$/i,
  /^penanggung_jawab$/i,
  /_oleh$/i, // diunggah_oleh, dibuat_oleh, diubah_oleh
];

/** Nama kolom cadangan: kalau nama tabel memakai awalan lain. */
const PERSIS = new Set([
  'operator',
  'petugas',
  'verifikasi_oleh',
  'penanggung_jawab',
  'metode_pengambilan',
  'diunggah_oleh',
  'dibuat_oleh',
  'diubah_oleh',
]);

/** true bila kolom ini harus disembunyikan dari respons publik. */
const pribadi = (nama) => PERSIS.has(nama) || POLA_PRIBADI.some((pola) => pola.test(nama));

/**
 * Buang kolom pribadi dari satu baris.
 * `...baris` di dalam objek baru dipakai supaya objek asli (cache pool
 * mysql2) tidak pernah diubah.
 */
const saringBaris = (baris) => {
  if (!baris || typeof baris !== 'object' || Array.isArray(baris)) return baris;
  const bersih = {};
  for (const [kunci, nilai] of Object.entries(baris)) {
    if (!pribadi(kunci)) bersih[kunci] = nilai;
  }
  return bersih;
};

/** Terapkan ke satu baris atau array baris (aman untuk keduanya). */
const saringPribadi = (data) => (Array.isArray(data) ? data.map(saringBaris) : saringBaris(data));

module.exports = { pribadi, saringBaris, saringPribadi };
