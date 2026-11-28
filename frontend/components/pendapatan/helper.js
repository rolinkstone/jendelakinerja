// components/pendapatan/helper.js
/**
 * Formatter modul Pendapatan. Tanpa state, tanpa panggilan API — hanya angka
 * dan label, supaya bisa dipakai ulang di halaman lain (mis. dashboard publik).
 */

/** Nama bulan 1-12 dalam bahasa Indonesia. */
export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Singkatan 3 huruf untuk sumbu grafik. */
export const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Angka penuh dengan pemisah ribuan Indonesia: 565593844 -> "565.593.844".
 * Nilai kosong/NaN ditampilkan "0", bukan "-" atau "NaN".
 */
export function formatAngka(nilai) {
  const n = Number(nilai) || 0;
  return n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

/** Versi ringkas untuk sumbu grafik: 565593844 -> "565,6 jt". */
export function formatRingkas(nilai) {
  const n = Number(nilai) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 1 })} T`;
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return formatAngka(n);
}

/** Persentase satu desimal; pembagi 0 menghasilkan "0%". */
export function formatPersen(bagian, total) {
  const t = Number(total) || 0;
  if (!t) return '0%';
  const p = (Number(bagian) || 0) / t * 100;
  return `${p.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
}

/** Tahun berjalan — dipakai sebagai nilai awal pemilih tahun. */
export function tahunSekarang() {
  return new Date().getFullYear();
}

/**
 * Perkiraan nama akun dari kode, untuk akun yang belum dipetakan di backend.
 * Dipakai hanya sebagai cadangan tampilan; sumber utama tetap backend.
 */
export function labelAkun(akun, nama) {
  return nama || `Akun ${akun}`;
}
