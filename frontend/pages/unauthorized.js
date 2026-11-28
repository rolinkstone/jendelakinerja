// pages/unauthorized.js
/**
 * HALAMAN AKSES DITOLAK (403 tampilan)
 * ------------------------------------
 * Middleware mengalihkan ke sini bila pengguna sudah login tetapi perananya
 * tidak mencukupi — saat ini khusus menu/pengaturan (`/setting/*`) yang hanya
 * boleh dibuka `admin` dan `admin_jendela_kinerja`.
 *
 * Halaman ini SENGAJA tidak memakai DashboardLayout: kalau ada galat pada
 * sidebar, pengguna tetap harus melihat penjelasan yang jelas dan jalan keluar.
 * Tombol "Muat ulang" membantu ketika peran baru saja ditambahkan di Keycloak
 * tetapi token di browser masih membawa daftar peran lama (perlu login ulang
 * karena peran disimpan di dalam token NextAuth).
 */
import Head from 'next/head';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { FaLock, FaHome, FaRedo, FaSignOutAlt } from 'react-icons/fa';
import Brand from '../components/Brand';

export default function UnauthorizedPage() {
  return (
    <>
      <Head>
        <title>Akses Ditolak · Jendela Kinerja</title>
      </Head>

      <main className="app-gradient flex min-h-screen items-center justify-center p-4">
        <div className="panel w-full max-w-md p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
            <FaLock size={20} />
          </div>

          <h1 className="mt-4 text-lg font-bold text-ink-900 dark:text-ink-50">
            Akses ditolak
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500 dark:text-ink-300">
            Halaman ini hanya dapat dibuka oleh administrator
            (<em>admin</em> atau <em>admin_jendela_kinerja</em>). Akun Anda tetap dapat
            membuka dan membaca seluruh modul lain.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <Link href="/beranda" className="btn-primary w-full">
              <FaHome /> Kembali ke Beranda
            </Link>
            <button type="button" onClick={() => window.location.reload()} className="btn-ghost w-full">
              <FaRedo /> Muat ulang halaman
            </button>
            <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className="btn-ghost w-full">
              <FaSignOutAlt /> Masuk dengan akun lain
            </button>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-ink-400 dark:text-ink-500">
            Peran disimpan di dalam token sesi. Bila administrator baru saja menambahkan
            peran Anda, keluar lalu masuk kembali agar peran terbaru terbaca.
          </p>

          <div className="mt-6 flex justify-center border-t border-paper-200 pt-4 dark:border-white/10">
            <Brand />
          </div>
        </div>
      </main>
    </>
  );
}
