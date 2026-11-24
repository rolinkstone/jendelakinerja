// pages/setting/laura-ai.js
/**
 * HALAMAN: SETTING → LAURA AI (di dalam dashboard ber-SSO)
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
 * Dipindahkan dari `/beranda/integrasi-laura` ke `/setting/laura-ai` supaya
 * menu konfigurasi berkumpul di satu kelompok "Setting" (bukan tercampur di
 * antara Beranda dan modul data Distribusi/Produksi/Sampel).
 * Konvensi modul: logika + tampilan di components/beranda/.
 */
import Head from 'next/head';
import DashboardLayout from '../../components/DashboardLayout';
import { BRAND } from '../../components/Brand';
import IntegrasiLauraContainer from '../../components/beranda/IntegrasiLauraContainer';

export default function PengaturanLauraAiPage() {
  return (
    <>
      <Head>
        <title>{`Setting — Laura AI | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Setting — Laura AI">
        <IntegrasiLauraContainer />
      </DashboardLayout>
    </>
  );
}
