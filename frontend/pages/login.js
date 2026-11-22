// pages/login.js
/**
 * HALAMAN LOGIN — Jendela Kinerja
 * -------------------------------
 * Pintu masuk aplikasi. Identitas brand (nama, logo, tagline) diambil dari
 * components/Brand.js supaya konsisten di seluruh halaman.
 *
 * Tampilan: "executive cockpit" — panel kiri tinta navy bermotif jendela dengan
 * aksen biru/hijau, panel kanan kertas hangat berisi form. Autentikasi via SSO
 * Keycloak (NextAuth): halaman ini TIDAK pernah menangani password.
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import Head from 'next/head';
import {
  FaShieldAlt,
  FaChartLine,
  FaFileExport,
  FaSpinner,
  FaLock,
  FaCircle,
} from 'react-icons/fa';
import Brand, { BRAND, BrandMark } from '../components/Brand';

const features = [
  {
    icon: FaShieldAlt,
    title: 'Autentikasi SSO',
    desc: 'Masuk sekali dengan akun terpusat yang aman.',
  },
  {
    icon: FaChartLine,
    title: 'Ringkasan Kinerja',
    desc: 'Capaian unit dan pegawai dalam satu tampilan.',
  },
  {
    icon: FaFileExport,
    title: 'Riwayat & Ekspor',
    desc: 'Data tersimpan rapi dan siap diekspor untuk pelaporan.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Pesan saat diarahkan ke sini karena sesi kedaluwarsa
  useEffect(() => {
    if (router.query.error === 'session_expired') {
      setError(
        'Sesi Anda telah berakhir karena token kedaluwarsa. Silakan masuk kembali menggunakan SSO.'
      );
    }
  }, [router.query.error]);

  const handleSSOLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Setelah login mendarat di beranda DASHBOARD, bukan di '/': akar '/'
      // sekarang halaman publik yang dialihkan ke /jendela-kinerja, sehingga
      // callbackUrl '/' membuat pengguna yang baru login terlempar ke halaman
      // tanpa menu internal.
      await signIn('keycloak', { callbackUrl: '/beranda' });
    } catch (err) {
      setError('Gagal terhubung ke server SSO. Silakan coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`Masuk | ${BRAND.name}`}</title>
        <meta
          name="description"
          content={`${BRAND.name} — ${BRAND.tagline}. Masuk menggunakan akun SSO untuk mengakses dashboard.`}
        />
      </Head>

      {/* ================= LAYAR LOGIN ================= */}
      <div className="app-surface relative flex min-h-screen items-center justify-center p-4 text-slate-800 dark:text-slate-100 sm:p-8">
        <div className="animate-rise w-full max-w-5xl">
          <div className="panel grid overflow-hidden lg:grid-cols-[0.85fr_1fr]">
            {/* ===== KIRI — HERO BRAND (panel tinta) ===== */}
            <div className="window-pattern relative hidden flex-col justify-between bg-ink-900 p-8 text-white lg:flex">
              <div className="relative">
                <Brand size="lg" tone="onDark" subtitle={BRAND.subtitle} />
              </div>

              <div className="relative mt-10">
                <p className="text-[13px] leading-relaxed text-slate-300">{BRAND.description}</p>

                <div className="mt-8 space-y-5">
                  {features.map((f) => {
                    const Icon = f.icon;
                    return (
                      <div key={f.title} className="flex items-start gap-3.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-500/30 bg-accent-500/10 text-accent-400">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-white">{f.title}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                            {f.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative mt-auto pt-10">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-4 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <FaCircle className="h-1.5 w-1.5 animate-pulse text-emerald-400" />
                    Sistem aktif
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    {BRAND.name} v{BRAND.version}
                  </span>
                </div>
              </div>
            </div>

            {/* ===== KANAN — FORM LOGIN ===== */}
            <div className="flex items-center p-7 sm:p-10">
              <div className="mx-auto w-full max-w-sm">
                {/* Lockup brand (layar kecil) */}
                <div className="mb-7 flex items-center justify-center lg:hidden">
                  <Brand size="lg" subtitle={BRAND.subtitle} />
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-600 dark:text-accent-400">
                  Masuk aplikasi
                </p>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Selamat datang di{' '}
                  <span className="text-gradient-accent">{BRAND.name}</span>
                </h1>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Masuk menggunakan akun SSO untuk mengakses dashboard{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {BRAND.name}
                  </span>
                  .
                </p>

                {/* Error */}
                {error && (
                  <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    <span className="mt-0.5">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Tombol SSO */}
                <button onClick={handleSSOLogin} disabled={isLoading} className="btn-primary mt-6 w-full">
                  {isLoading ? (
                    <FaSpinner className="h-4 w-4 animate-spin" />
                  ) : (
                    <FaLock className="h-4 w-4" />
                  )}
                  <span>{isLoading ? 'Mengarahkan ke SSO…' : 'Masuk dengan SSO'}</span>
                </button>

                <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                  Anda akan diarahkan ke halaman autentikasi terpusat (SSO) untuk memverifikasi
                  identitas.
                </p>

                {/* Info sistem */}
                <div className="panel-sunken mt-7 divide-y divide-paper-200 dark:divide-white/5">
                  <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                    <span className="text-slate-500 dark:text-slate-400">Status sistem</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Aktif
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                    <span className="text-slate-500 dark:text-slate-400">Autentikasi</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">SSO</span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                    <span className="text-slate-500 dark:text-slate-400">Lingkungan</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Internal</span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                    <span className="text-slate-500 dark:text-slate-400">Versi</span>
                    <span className="badge-primary">
                      {BRAND.name} v{BRAND.version}
                    </span>
                  </div>
                </div>

                <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">
                  Butuh bantuan? Hubungi administrator sistem.
                </p>
              </div>
            </div>
          </div>

          {/* Kaki halaman */}
          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <BrandMark size="xs" glow={false} />
            <span>
              {BRAND.name} v{BRAND.version} — {BRAND.footerNote}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
