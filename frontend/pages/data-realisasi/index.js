// pages/data-realisasi/index.js
/**
 * Anggaran dan Realisasi.
 * Halaman TIPIS: seluruh logika & tampilan ada di components/anggaran/Container.js.
 *
 * Halaman ini BUKAN halaman publik: datanya bersifat internal (pagu, realisasi,
 * sisa anggaran), jadi wajib login seperti modul lain. Path-nya sengaja TIDAK
 * terdaftar di publicPaths frontend/middleware.js dan endpoint API-nya TIDAK
 * masuk publicBacaRoutes backend/server.js.
 *
 * Rute lama /anggaran-realisasi dialihkan permanen (308) ke sini.
 *
 * PENGAMAN GANDA (defense in depth)
 * ---------------------------------
 * Middleware sudah menahan path ini, TETAPI halaman ini dulu dirender statis
 * (`○ Static`): HTML-nya ikut ditulis ke .next/server/pages/data-realisasi.html
 * saat build. Kalau suatu ketika middleware meleset (matcher diubah, path
 * ditambahkan ke publicPaths, atau berkas statis itu disajikan lewat rewrite),
 * isi halaman tetap bisa terbaca tanpa login.
 *
 * Karena itu halaman ini dibuat dinamis dengan pemeriksaan sesi di server:
 *   - tanpa sesi sah -> 302 ke /login?callbackUrl=%2Fdata-realisasi (SEBELUM
 *     HTML dikirim, jadi tidak ada kedipan kerangka dashboard);
 *   - dengan sesi    -> HTML baru dirender.
 * Jangan hapus getServerSideProps di bawah; middleware saja tidak cukup.
 */
import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import DashboardLayout from '../../components/DashboardLayout';
import AnggaranRealisasiContainer from '../../components/anggaran/Container';
import { authOptions } from '../api/auth/[...nextauth]';

export async function getServerSideProps(context) {
  const sesi = await getServerSession(context.req, context.res, authOptions);
  if (!sesi) {
    // 302, bukan 200 + redirect di klien: halaman tidak boleh sempat dikirim.
    return {
      redirect: {
        destination: '/login?callbackUrl=%2Fdata-realisasi',
        permanent: false,
      },
    };
  }
  return { props: {} };
}

export default function DataRealisasiPage() {
  return (
    <>
      <Head>
        <title>Data Realisasi | Jendela Kinerja</title>
      </Head>
      <DashboardLayout>
        <AnggaranRealisasiContainer />
      </DashboardLayout>
    </>
  );
}
