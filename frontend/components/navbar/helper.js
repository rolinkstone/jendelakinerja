// components/navbar/helper.js
/**
 * HELPER NAVBAR PUBLIK \u2014 "Jendela Kinerja"
 * ----------------------------------------
 * Satu sumber kebenaran untuk daftar menu di navbar publik. Konstanta saja,
 * tanpa state/API (konvensi `components/<kelompok>/<modul>/helper.js`).
 *
 * Menu "Jendela Kinerja" sudah aktif; sisanya masih dikerjakan sehingga
 * endpoint-nya belum ada. Halaman persiapannya memakai `components/navbar/Segera.jsx`.
 */

/** Menu navbar publik, urut tampil dari kiri ke kanan. */
export const MENU_PUBLIK = [
  {
    label: 'Jendela Kinerja',
    href: '/dashboard',
    icon: 'FaRegWindowMaximize',
    siap: true,
  },
  {
    label: 'Prestasi Unit Kerja',
    href: '/prestasi-unit-kerja',
    icon: 'FaAward',
    siap: false,
  },
  {
    label: 'Anggaran dan Realisasi',
    href: '/anggaran-realisasi',
    icon: 'FaChartPie',
    siap: false,
  },
  {
    label: 'Dokumen PK dan RAPK',
    href: '/dokumen-pk-rapk',
    icon: 'FaFileSignature',
    siap: false,
  },
  {
    label: 'Sumber Daya',
    href: '/sumber-daya',
    icon: 'FaUsers',
    siap: false,
  },
];

/** True bila `pathname` masih bagian dari menu ini (termasuk sub-halaman). */
export function menuAktif(href, pathname) {
  if (!pathname) return false;
  // Cocok untuk alamat baru maupun lama (redirect 308) agar menu tetap aktif.
  if (href === '/dashboard') return pathname.startsWith('/dashboard') || pathname.startsWith('/jendela-kinerja');
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Menu yang belum selesai \u2014 dipakai halaman "segera hadir". */
export function cariMenu(href) {
  return MENU_PUBLIK.find((m) => m.href === href) || null;
}
