// components/anggaran/helper.js
/**
 * HELPER — Modul Anggaran & Realisasi
 * -----------------------------------
 * Formatter + konstanta tampilan. Murni fungsi, tanpa state / request API,
 * mengikuti konvensi `components/<kelompok>/helper.js`.
 */

/** Batas ukuran unggahan — harus sama dengan `limits.fileSize` di routes/anggaran-realisasi.js */
export const MAKS_BERKAS = 16 * 1024 * 1024;
export const EKSTENSI_DIIZINKAN = ['.xlsx', '.xls', '.xlsm'];

/** Format ukuran berkas: 34.6 KB */
export function formatUkuran(byte) {
  if (!byte && byte !== 0) return '-';
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

/** Validasi berkas sebelum diunggah. Mengembalikan pesan galat atau null. */
export function validasiBerkas(file) {
  if (!file) return 'Belum ada berkas yang dipilih.';
  const nama = (file.name || '').toLowerCase();
  if (!EKSTENSI_DIIZINKAN.some((ext) => nama.endsWith(ext))) {
    return `Format berkas harus ${EKSTENSI_DIIZINKAN.join(' / ')}.`;
  }
  if (file.size > MAKS_BERKAS) {
    return `Ukuran berkas ${formatUkuran(file.size)} melebihi batas ${formatUkuran(MAKS_BERKAS)}.`;
  }
  return null;
}

/** Angka dengan pemisah ribuan gaya Indonesia. */
export function formatAngka(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return '0';
  const n = Number(nilai);
  if (!Number.isFinite(n)) return String(nilai);
  return n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

/**
 * Rupiah ringkas untuk kolom tabel: 16.816.295.000 -> "16,8 M"
 * Nilai kecil tetap utuh supaya tidak kehilangan angka penting.
 */
export function formatRupiahRingkas(nilai) {
  const n = Number(nilai) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1).replace('.', ',')} T`;
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  return formatAngka(n);
}

/** Rupiah penuh untuk tooltip / judul kolom. */
export function formatRupiah(nilai) {
  return `Rp ${formatAngka(nilai)}`;
}

/** Satu desimal, koma sebagai pemisah desimal. */
export function formatPersen(nilai) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return '0%';
  return `${String(n).replace('.', ',')}%`;
}

/** Warna batang/angka berdasarkan tingkat serapan. */
export function warnaserapan(persen) {
  const n = Number(persen) || 0;
  if (n >= 95) return 'text-emerald-600 dark:text-emerald-400';
  if (n >= 80) return 'text-accent-600 dark:text-accent-400';
  return 'text-rose-600 dark:text-rose-400';
}

/** Tahun anggaran berjalan (untuk nilai awal formulir unggah). */
export function tahunSekarang() {
  return new Date().getFullYear();
}