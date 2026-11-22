// components/navbar/Segera.js
/**
 * HALAMAN "SEGERA HADIR" — menu publik yang belum selesai
 * -------------------------------------------------------
 * Menu di navbar publik sudah lengkap, tetapi empat di antaranya masih dalam
 * pengerjaan. Halaman ini menjaga supaya tautan menu tetap hidup (bukan 404)
 * dan memberi tahu modul mana yang sedang dikerjakan lebih dulu.
 *
 * Menu yang sudah siap: Jendela Kinerja (`/jendela-kinerja`).
 */
import Head from 'next/head';
import Link from 'next/link';
import { FaHardHat, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { BRAND } from '../Brand';
import Navbar from './Navbar';
import LauraAI from '../jendela-kinerja/LauraAI';
import { MENU_PUBLIK } from './helper';

export default function Segera({ href }) {
  const menu = MENU_PUBLIK.find((m) => m.href === href) || { label: 'Halaman', href };
  const sudahSiap = MENU_PUBLIK.filter((m) => m.siap);

  return (
    <>
      <Head>
        <title>{`${menu.label} — segera hadir | ${BRAND.name}`}</title>
        <meta name="description" content={`${menu.label} masih dalam pengerjaan.`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app-surface min-h-screen">
        <Navbar />

        {/* Maskot Laura AI juga tampil di halaman "segera hadir" — pengunjung
            yang nyasar tetap bisa bertanya lewat Laura. */}
        <LauraAI />

        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="panel p-6 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600 dark:text-accent-300">
              <FaHardHat size={22} />
            </span>

            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {menu.label}
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              Menu ini masih dalam pengerjaan. Yang sedang dibangun lebih dulu adalah
              <strong className="font-semibold text-slate-800 dark:text-slate-100"> Jendela Kinerja</strong> —
              menu lain menyusul setelah modulnya siap.
            </p>

            <div className="mt-5 rounded-xl border border-paper-200 bg-paper-50/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <p className="section-label">Yang sudah bisa dibuka</p>
              <ul className="mt-2 space-y-1.5">
                {sudahSiap.map((m) => (
                  <li key={m.href}>
                    <Link
                      href={m.href}
                      className="inline-flex items-center gap-2 text-[13px] font-semibold text-accent-700 hover:underline dark:text-accent-300"
                    >
                      <FaCheckCircle className="h-3 w-3" />
                      {m.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <Link href="/jendela-kinerja" className="btn-primary mt-6">
              <FaArrowLeft className="h-3 w-3" />
              Buka Jendela Kinerja
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
