// components/distribusi/sk/helper.js
/**
 * HELPER \u2014 Modul Distribusi Suplemen Kesehatan
 * -----------------------------
 * Konstanta tampilan + formatter + validasi berkas.
 * Tidak ada state / request API di sini (murni fungsi), mengikuti konvensi
 * `components/<modul>/helper.js`.
 */

/** Batas ukuran unggahan \u2014 harus sama dengan `limits.fileSize` di backend/routes/kos.js */
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

/** "2026-11-15T06:35:59.000Z" \u2192 "15 November 2026, 13:35" */
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
  return s.length > maks ? `${s.slice(0, maks - 1)}\u2026` : s;
}

/** Kelas badge untuk nilai kesimpulan akhir. */
export function kelasKesimpulan(nilai) {
  const s = String(nilai || '').toLowerCase();
  if (s.includes('tidak memenuhi')) return 'bg-rose-500/10 text-rose-600 dark:text-rose-300';
  if (s.includes('memenuhi')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  return 'bg-paper-200/70 text-ink-600 dark:bg-ink-800 dark:text-ink-300';
}

/** Kelas badge untuk tingkat kekritisan temuan. */
export function kelasKekritisan(nilai) {
  const s = String(nilai || '').toLowerCase();
  if (s.startsWith('major') || s.includes('kritis')) return 'bg-rose-500/10 text-rose-600 dark:text-rose-300';
  if (s.startsWith('minor')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
  if (s.includes('tidak ada') || s === '-' || !s) return 'bg-paper-200/70 text-ink-500 dark:bg-ink-800 dark:text-ink-300';
  return 'bg-accent-500/10 text-accent-700 dark:text-accent-300';
}

/** Baris ringkas kolom M/m/C: "1 mayor \xb7 3 minor \xb7 0 kritis". */
export function ringkasTemuan(row) {
  return [
    { label: 'mayor', nilai: row?.jumlah_mayor },
    { label: 'minor', nilai: row?.jumlah_minor },
    { label: 'kritis', nilai: row?.jumlah_kritis },
  ];
}

/** Label + nilai untuk kartu ringkasan unggahan terakhir. */
export function metaUnggahan(impor) {
  if (!impor) return [];
  return [
    { label: 'Tahun Data', nilai: impor.tahun ? String(impor.tahun) : '-' },
    { label: 'Berkas', nilai: impor.berkas },
    { label: 'Sheet', nilai: impor.sheet },
    { label: 'Jenis Sarana', nilai: impor.jenis_sarana },
    { label: 'Balai', nilai: impor.balai },
    { label: 'Periode Pemeriksaan', nilai: `${impor.periode_awal || '-'} \u2014 ${impor.periode_akhir || '-'}` },
    { label: 'Periode Entri', nilai: `${impor.tanggal_entri_awal || '-'} \u2014 ${impor.tanggal_entri_akhir || '-'}` },
    { label: 'Diunggah oleh', nilai: impor.diunggah_oleh || '-' },
    { label: 'Diunggah pada', nilai: formatWaktu(impor.diunggah_pada) },
  ];
}

// ---------------------------------------------------------------------------
// Tahun data \u2014 modul ini menyimpan data beberapa tahun sekaligus, jadi UI punya
// filter tahun (null = semua) dan pemilih tahun saat mengunggah ('otomatis' =
// tahun dibaca dari isi berkas oleh backend).
// ---------------------------------------------------------------------------

/** Berapa tahun ke belakang yang selalu tersedia di pemilih tahun. */
export const RENTANG_TAHUN_KE_BELAKANG = 8;

/** Nilai sentinel pemilih tahun: biar backend yang mendeteksi dari berkas. */
export const TAHUN_OTOMATIS = 'otomatis';

/** Label filter tahun. `null` berarti semua tahun. */
export function labelTahun(tahun) {
  return tahun ? `Tahun ${tahun}` : 'Semua tahun';
}

/**
 * Daftar pilihan tahun untuk pemilih unggahan:
 * tahun ini + rentang ke belakang + tahun yang sudah ada datanya (mis. 2024).
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
