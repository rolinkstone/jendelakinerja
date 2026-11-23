// backend/lib/narasi.js
/**
 * KUNCI FILTER NARASI PRESENTASI
 * -----------------------------
 * Naskah presentasi 1 menit di halaman publik /jendela-kinerja dihasilkan dari
 * data dashboard PADA FILTER TERTENTU (tahun, bulan, kegiatan, jenis sarana,
 * kab/kota). Koreksi manual disimpan per FILTER yang sama, jadi:
 *
 *   - narasi untuk "tahun 2026" tidak menimpa narasi "tahun 2026 + Kosmetika";
 *   - operator bisa mengoreksi satu kombinasi tanpa mengganggu yang lain;
 *   - widget di halaman publik memakai koreksi itu HANYA bila filternya cocok.
 *
 * Kunci = sha1 dari filter yang sudah dinormalkan (urutan tetap, nilai kosong
 * dianggap tidak ada). Satu fungsi dipakai untuk menyimpan DAN membaca, jadi
 * tidak mungkin dua sisi menghasilkan kunci berbeda.
 */
const crypto = require('crypto');

/** Urutan kolom filter — TIDAK boleh berubah tanpa migrasi data lama. */
const KOLOM = ['tahun', 'bulan', 'kegiatan', 'jenis', 'kab'];

/** Nilai filter yang dinormalkan: string, tanpa spasi pinggir, kosong → ''. */
const rapikan = (filter = {}) => {
  const out = {};
  for (const k of KOLOM) {
    const v = filter?.[k];
    out[k] = v === null || v === undefined ? '' : String(v).trim();
  }
  return out;
};

/** sha1 dari filter ternormalisasi — kunci baris di tabel narasi_presentasi. */
const kunciFilter = (filter = {}) => {
  const f = rapikan(filter);
  return crypto.createHash('sha1').update(JSON.stringify(f)).digest('hex');
};

/** Label manusiawi untuk ditampilkan di tabel koreksi. */
const labelFilter = (filter = {}) => {
  const f = rapikan(filter);
  const bagian = [];
  if (f.tahun) bagian.push(`tahun ${f.tahun}`);
  if (f.bulan) bagian.push(`bulan ${f.bulan}`);
  if (f.kegiatan) bagian.push(f.kegiatan);
  if (f.jenis) bagian.push(f.jenis);
  if (f.kab) bagian.push(f.kab);
  return bagian.length ? bagian.join(' · ') : 'semua data (tanpa filter)';
};

/** Query string untuk membaca koreksi lewat GET (dipakai proxy frontend). */
const queryFilter = (filter = {}) => {
  const f = rapikan(filter);
  const q = new URLSearchParams();
  for (const k of KOLOM) if (f[k]) q.set(k, f[k]);
  return q.toString();
};

module.exports = { KOLOM, rapikan, kunciFilter, labelFilter, queryFilter };
