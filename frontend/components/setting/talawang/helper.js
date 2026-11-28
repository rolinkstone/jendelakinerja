// components/setting/talawang/helper.js
/**
 * Helper tampilan Setting → Talawang.
 * Semua angka ditulis penuh (tanpa singkatan "jt"/"M") supaya bisa dicocokkan
 * langsung dengan lembar SAKTI oleh operator keuangan.
 */

// Nama akun 524 = BELANJA PERJALANAN DINAS (bukan belanja modal). Ini yang
// dipakai Talawang untuk mencocokkan angka perjalanan dinasnya.
export const NAMA_AKUN_TALAWANG = {
  '524111': 'Belanja Perjalanan Biasa (Luar Kota)',
  '524113': 'Belanja Perjalanan Biasa (Dalam Kota)',
  '524114': 'Belanja Perjalanan Dinas Paket Meeting (Dalam Kota)',
  '524119': 'Belanja Perjalanan Lainnya',
};

/** 776309000 → "776.309.000" */
export function formatAngka(nilai) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
}

/** 92.2441 → "92,24%" */
export function formatPersen(nilai) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return '0%';
  return `${String(Math.round(n * 100) / 100).replace('.', ',')}%`;
}

/** "2026-11-29T10:12:33.000Z" → "29 Nov 2026 17.12" */
export function formatWaktu(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dua = (x) => String(x).padStart(2, '0');
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()} ${dua(d.getHours())}.${dua(d.getMinutes())}`;
}

/** Umur token dalam hari (boleh negatif = sudah lewat). */
export function sisaHari(kedaluwarsa) {
  if (!kedaluwarsa) return null;
  const d = new Date(kedaluwarsa);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 3600 * 1000));
}

/**
 * Warna lencana status. Hanya biru/hijau/merah sesuai palet aplikasi
 * (merah dipakai untuk status mati/kedaluwarsa, bukan hiasan).
 */
export function gayaStatus(status) {
  switch (status) {
    case 'aktif':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'segera_kedaluwarsa':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    case 'kedaluwarsa':
    case 'dicabut':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';
  }
}

/** Label manusiawi untuk status dari backend. */
export function labelStatus(status) {
  switch (status) {
    case 'aktif':
      return 'Aktif';
    case 'segera_kedaluwarsa':
      return 'Segera berakhir';
    case 'kedaluwarsa':
      return 'Kedaluwarsa';
    case 'dicabut':
      return 'Dicabut';
    default:
      return status || '—';
  }
}
