// components/navbar/Navbar.js
/**
 * NAVBAR PUBLIK — "Jendela Kinerja"
 * --------------------------------
 * Dipakai SEMUA halaman publik (di luar dashboard ber-SSO): Jendela Kinerja,
 * Prestasi Unit Kerja, Anggaran dan Realisasi, Dokumen PK dan RAPK, Sumber Daya.
 *
 * Menu aktif ditentukan dari `useRouter().pathname`, bukan prop, supaya tiap
 * halaman tidak perlu mengirim statusnya sendiri.
 *
 * Di layar kecil menu dilipat jadi panel bergulir di bawah header; tombol
 * tema dan "Masuk dashboard" tetap terlihat.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaBars, FaTimes, FaSignInAlt, FaSun, FaMoon } from 'react-icons/fa';
import { BRAND, BrandMark } from '../Brand';
import { MENU_PUBLIK, menuAktif } from './helper';

export default function Navbar({ subjudul = 'Balai Besar POM di Palangka Raya' }) {
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);
  const [gelap, setGelap] = useState(false);

  // Tema disimpan di localStorage dengan kunci `theme` (sama dengan dashboard).
  useEffect(() => {
    const tersimpan = window.localStorage.getItem('theme');
    const pakaiGelap = tersimpan ? tersimpan === 'dark' : false;
    setGelap(pakaiGelap);
    document.documentElement.classList.toggle('dark', pakaiGelap);
  }, []);

  // Tutup panel setiap kali pindah halaman.
  useEffect(() => {
    setTerbuka(false);
  }, [router.pathname]);

  const gantiTema = () => {
    const baru = !gelap;
    setGelap(baru);
    document.documentElement.classList.toggle('dark', baru);
    window.localStorage.setItem('theme', baru ? 'dark' : 'light');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-paper-200/80 bg-white/85 backdrop-blur dark:border-white/[0.08] dark:bg-ink-900/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        {/* Identitas aplikasi */}
        <Link href="/jendela-kinerja" className="flex min-w-0 items-center gap-2.5">
          <BrandMark size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
              {BRAND.name}
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{subjudul}</p>
          </div>
        </Link>

        {/* Menu desktop */}
        <nav aria-label="Menu utama" className="hidden items-center gap-1 lg:flex">
          {MENU_PUBLIK.map((m) => {
            const aktif = menuAktif(m.href, router.pathname);
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={aktif ? 'page' : undefined}
                className={[
                  'rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition',
                  aktif
                    ? 'bg-accent-500/10 text-accent-700 dark:text-accent-300'
                    : 'text-slate-600 hover:bg-paper-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white',
                ].join(' ')}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        {/* Aksi kanan */}
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Data publik
          </span>
          <button
            type="button"
            onClick={gantiTema}
            title={gelap ? 'Mode terang' : 'Mode gelap'}
            className="btn-ghost"
          >
            {gelap ? <FaSun className="h-3.5 w-3.5" /> : <FaMoon className="h-3.5 w-3.5" />}
          </button>
          <Link href="/beranda" className="btn-primary-sm">
            <FaSignInAlt className="h-3 w-3" />
            <span className="hidden sm:inline">Masuk dashboard</span>
            <span className="sm:hidden">Masuk</span>
          </Link>
          <button
            type="button"
            onClick={() => setTerbuka((v) => !v)}
            aria-expanded={terbuka}
            aria-controls="menu-publik-bergerak"
            aria-label={terbuka ? 'Tutup menu' : 'Buka menu'}
            className="btn-ghost lg:hidden"
          >
            {terbuka ? <FaTimes className="h-3.5 w-3.5" /> : <FaBars className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Menu lipat (layar kecil) */}
      {terbuka && (
        <nav
          id="menu-publik-bergerak"
          aria-label="Menu utama (layar kecil)"
          className="border-t border-paper-200/80 bg-white px-4 py-2 dark:border-white/[0.08] dark:bg-ink-900 lg:hidden"
        >
          <ul className="flex flex-col">
            {MENU_PUBLIK.map((m) => {
              const aktif = menuAktif(m.href, router.pathname);
              return (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    aria-current={aktif ? 'page' : undefined}
                    className={[
                      'block rounded-lg px-2.5 py-2 text-[13px] font-semibold transition',
                      aktif
                        ? 'bg-accent-500/10 text-accent-700 dark:text-accent-300'
                        : 'text-slate-600 hover:bg-paper-100 dark:text-slate-300 dark:hover:bg-white/[0.06]',
                    ].join(' ')}
                  >
                    {m.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
