// pages/404.js
/**
 * Halaman 404 — memakai identitas brand Jendela Kinerja (components/Brand.js).
 * Gaya: panel kertas dengan bingkai "jendela" bertinta navy + aksen biru/hijau.
 */
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { BRAND, BrandMark } from '../components/Brand';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>{`Halaman Tidak Ditemukan | ${BRAND.name}`}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="app-surface relative flex min-h-screen items-center justify-center p-6 text-slate-800 dark:text-slate-100">
        <div className="animate-rise w-full max-w-md">
          <div className="panel overflow-hidden text-center">
            {/* Bingkai atas: motif jendela */}
            <div className="window-pattern flex items-center justify-center bg-ink-900 py-8">
              <BrandMark size="2xl" />
            </div>

            <div className="p-8">
              <p className="text-[64px] font-extrabold leading-none tracking-tight text-gradient-accent">
                404
              </p>
              <h1 className="mt-3 text-base font-bold text-slate-800 dark:text-white">
                Halaman tidak ditemukan
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                Halaman yang Anda cari mungkin telah dihapus, dipindahkan, atau tidak pernah ada di{' '}
                {BRAND.name}.
              </p>
              <Link href="/" className="btn-primary mt-6 w-full">
                <FaArrowLeft className="h-3.5 w-3.5" />
                Kembali ke Beranda
              </Link>
              <p className="mt-5 text-[11px] text-slate-400 dark:text-slate-500">
                {BRAND.name} v{BRAND.version} — {BRAND.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
