// pages/beranda/integrasi-laura.js
/**
 * HALAMAN: INTEGRASI LAURA AI (di dalam dashboard ber-SSO)
 * --------------------------------------------------------
 * Satu tempat untuk mengelola data Jendela Kinerja yang masuk ke knowledge
 * LAURA AI:
 *
 *   1. Katalog link API tiap modul (dari GET /api/publik/kinerja/api-modul)
 *      — link bisa disalin per baris / semuanya sekaligus / diunduh JSON.
 *   2. Pengaturan masa berlaku token per modul (diatur di sisi LAURA AI).
 *
 * Alur kerja:
 *   Salin link di sini → tempel di LAURA AI → Integrasi JK → Sinkron.
 *
 * Konvensi modul: logika + tampilan di components/beranda/Container.js.
 */
import Head from 'next/head';
import DashboardLayout from '../../components/DashboardLayout';
import { BRAND } from '../../components/Brand';
import IntegrasiLauraContainer from '../../components/beranda/IntegrasiLauraContainer';

export default function IntegrasiLauraPage() {
  return (
    <>
      <Head>
        <title>{`Integrasi Laura AI | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Integrasi Laura AI">
        <IntegrasiLauraContainer />
      </DashboardLayout>
    </>
  );
}
