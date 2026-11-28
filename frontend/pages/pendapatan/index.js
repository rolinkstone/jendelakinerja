// pages/pendapatan/index.js
/**
 * Modul Pendapatan — realisasi pendapatan per bulan dan per akun.
 * Halaman TIPIS: seluruh logika & tampilan ada di components/pendapatan/Container.js.
 *
 * INTERNAL: angka pendapatan per akun adalah rincian keuangan, jadi wajib login
 * seperti /data-realisasi. Path ini TIDAK terdaftar di publicPaths
 * (frontend/middleware.js) dan endpoint /api/pendapatan TIDAK masuk
 * publicBacaRoutes (backend/server.js).
 *
 * Pengaman ganda: getServerSideProps memeriksa sesi di server, sehingga HTML
 * halaman tidak sempat dikirim tanpa sesi walau middleware meleset.
 */
import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import DashboardLayout from '../../components/DashboardLayout';
import PendapatanContainer from '../../components/pendapatan/Container';
import { authOptions } from '../api/auth/[...nextauth]';

export async function getServerSideProps(context) {
  const sesi = await getServerSession(context.req, context.res, authOptions);
  if (!sesi) {
    return {
      redirect: {
        destination: '/login?callbackUrl=%2Fpendapatan',
        permanent: false,
      },
    };
  }
  return { props: {} };
}

export default function PendapatanPage() {
  return (
    <>
      <Head>
        <title>Pendapatan | Jendela Kinerja</title>
      </Head>
      <DashboardLayout>
        <PendapatanContainer />
      </DashboardLayout>
    </>
  );
}
