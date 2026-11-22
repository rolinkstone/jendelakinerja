// components/sampel/lab/helper.js
/**
 * HELPER — Modul Sampel (dipakai bersama semua komoditi)
 * ------------------------------------------------------
 * Konstanta tampilan + formatter + validasi berkas. Modul OT dan SK memakai
 * berkas ini apa adanya — perbedaan antar komoditi hanya ada di config.js.
 * Tidak ada state / request API di sini (murni fungsi), mengikuti konvensi
 * `components/<kelompok>/<modul>/helper.js`.
 */

/** Batas ukuran unggahan — harus sama dengan `limits.fileSize` di backend/lib/sampel.js */
export const MAKS_BERKAS = 15 * 1024 * 1024;
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
  return n.toLocaleString('id-ID');
}

/** "2026-11-15T06:35:59.000Z" → "15 November 2026, 13:35" */
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function formatWaktu(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${jam}:${menit}`;
}

/** Potong teks panjang untuk sel tabel. */
export function ringkas(teks, maks = 90) {
  const s = String(teks || '').replace(/\s+/g, ' ').trim();
  if (!s) return '-';
  return s.length > maks ? `${s.slice(0, maks - 1)}…` : s;
}

/**
 * Kelas badge untuk kesimpulan pengujian sampel.
 * Berkas sampel menulis hasil dalam tiga bentuk: "Memenuhi Syarat",
 * "Tidak Memenuhi Syarat", dan singkatan "MS" (diisi operator pusat). Ketiganya
 * harus terbaca sebagai hasil yang sama.
 */
export function kelasKesimpulan(nilai) {
  const s = String(nilai || '').toLowerCase();
  if (s.includes('tidak memenuhi')) return 'bg-rose-500/10 text-rose-600 dark:text-rose-300';
  if (s.includes('memenuhi')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  return 'bg-paper-200/70 text-ink-600 dark:bg-ink-800 dark:text-ink-300';
}

/** Kelas badge untuk grading/kriteria (A, B, C, …). */
export function kelasGrading(nilai) {
  const s = String(nilai || '').trim().toUpperCase();
  if (s === 'A') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  if (s === 'B') return 'bg-accent-500/10 text-accent-700 dark:text-accent-300';
  if (s === 'C' || s === 'D') return 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
  return 'bg-paper-200/70 text-ink-600 dark:bg-ink-800 dark:text-ink-300';
}

/**
 * Kelas badge untuk tingkat temuan (mayor/minor/lain/kritis).
 * Angka 0 sengaja tampil netral supaya mata langsung tertuju ke yang bukan nol.
 */
export function kelasTemuan(jumlah, tingkat) {
  const n = Number(jumlah || 0);
  if (n <= 0) return 'bg-paper-200/70 text-ink-500 dark:bg-ink-800 dark:text-ink-300';
  if (tingkat === 'kritis') return 'bg-accent-500/10 text-accent-700 dark:text-accent-300';
  if (tingkat === 'mayor') return 'bg-rose-500/10 text-rose-600 dark:text-rose-300';
  if (tingkat === 'minor') return 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
  return 'bg-paper-200/70 text-ink-600 dark:bg-ink-800 dark:text-ink-300';
}

/**
 * Nama penuh kesimpulan. Singkatan berbeda antar komoditi: obat tradisional &
 * suplemen kesehatan memakai "MS"/"TMS", obat memakai "MK"/"TMK" (Memenuhi /
 * Tidak Memenuhi Kriteria). Data yang sudah tersimpan sebelum pemetaan ini juga
 * masih berupa singkatan, jadi keduanya tetap ditampilkan panjang.
 */
export function kesimpulanPenuh(nilai) {
  const s = String(nilai || '').trim();
  if (!s) return '—';
  const kecil = s.toLowerCase();
  if (['ms', 'mk', 'memenuhi kriteria'].includes(kecil)) return 'Memenuhi Syarat';
  if (['tms', 'tmk', 'tidak memenuhi kriteria'].includes(kecil)) return 'Tidak Memenuhi Syarat';
  return s;
}

/**
 * Label + nilai untuk kartu ringkasan unggahan terakhir.
 * Berkas sampel tidak punya "jenis sarana"/"balai"/"periode entri"; yang ada
 * adalah komoditi, periode sampling, dan anggaran sampling. Berkas Obat bahkan
 * tidak punya kolom tujuan sampling, jadi jangan menganggapnya selalu ada.
 */
export function metaUnggahan(impor) {
  if (!impor) return [];
  return [
    { label: 'Tahun Data', nilai: impor.tahun ? String(impor.tahun) : '-' },
    { label: 'Berkas', nilai: impor.berkas },
    { label: 'Sheet', nilai: impor.sheet },
    { label: 'Komoditi', nilai: impor.komoditi },
    { label: 'Periode Sampling', nilai: impor.periode_awal || '-' },
    { label: 'Jumlah Sampel', nilai: formatAngka(impor.jumlah_sampel) },
    { label: 'Baris Berkas', nilai: formatAngka(impor.jumlah_baris) },
    { label: 'Diunggah oleh', nilai: impor.diunggah_oleh || '-' },
    { label: 'Diunggah pada', nilai: formatWaktu(impor.diunggah_pada) },
  ];
}

// ---------------------------------------------------------------------------
// Tahun data — modul ini menyimpan data beberapa tahun sekaligus, jadi UI punya
// filter tahun (null = semua) dan pemilih tahun saat mengunggah ('otomatis' =
// tahun dibaca dari isi berkas oleh backend).
// ---------------------------------------------------------------------------

/** Berapa tahun ke belakang yang selalu tersedia di pemilih tahun. */
export const RENTANG_TAHUN_KE_BELAKANG = 10;

/** Nilai sentinel pemilih tahun: biar backend yang mendeteksi dari berkas. */
export const TAHUN_OTOMATIS = 'otomatis';

/** Label filter tahun. `null` berarti semua tahun. */
export function labelTahun(tahun) {
  return tahun ? `Tahun ${tahun}` : 'Semua tahun';
}

/**
 * Daftar pilihan tahun untuk pemilih unggahan:
 * tahun ini + rentang ke belakang + tahun yang sudah ada datanya.
 */
export function opsiTahun(daftarTahun = [], tahunIni = new Date().getFullYear()) {
  const set = new Set([tahunIni + 1]);
  for (let t = tahunIni; t >= tahunIni - RENTANG_TAHUN_KE_BELAKANG; t -= 1) set.add(t);
  (daftarTahun || []).forEach((d) => {
    const t = Number(d?.tahun);
    if (Number.isInteger(t) && t > 1900) set.add(t);
  });
  return [...set].sort((a, b) => b - a);
}

/** Cari ringkasan satu tahun pada `daftar_tahun` dari endpoint summary. */
export function ringkasanTahun(daftarTahun = [], tahun) {
  if (!tahun) return null;
  return (daftarTahun || []).find((d) => Number(d.tahun) === Number(tahun)) || null;
}

/** Warna latar stat tile. */
export const TONE_TILE = {
  accent: 'bg-accent-500/10 text-accent-700 dark:text-accent-300',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
};

// ---------------------------------------------------------------------------
// Filter kesimpulan — pilihan tetap supaya pengguna tidak perlu mengetik.
// Berkas menulis campuran "Memenuhi Syarat" dan "MS" (begitu pula TMS); backend
// (lib/sampel.js) menyamakan keduanya sebelum menyaring, jadi cukup SATU pilihan
// per hasil — kalau "MS" didaftarkan terpisah, daftar yang tampil jadi kembar.
// ---------------------------------------------------------------------------
export const OPSI_KESIMPULAN = [
  { nilai: '', label: 'Semua kesimpulan' },
  { nilai: 'Memenuhi Syarat', label: 'Memenuhi Syarat' },
  { nilai: 'Tidak Memenuhi Syarat', label: 'Tidak Memenuhi Syarat' },
];
