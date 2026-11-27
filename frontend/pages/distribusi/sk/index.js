// pages/distribusi/sk/index.js
/**
 * HALAMAN: DISTRIBUSI \u2014 SUPLEMEN KESEHATAN
 * ---------------------------------------------------------------
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/distribusi/sk/{Container,helper,Modal}.js
 * Backend: backend/routes/distribusi-sk.js (engine lib/distribusi.js).
 *
 * Berkas sumber: "Laporan Hasil Pemeriksaan Sarana Distribusi - Suplemen Kesehatan".
 * Tata letaknya berbeda dari PBF \u2014 memakai engine distribusi dengan pemetaan
 * kolom sendiri.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import { BRAND } from '../../../components/Brand';
import DistribusiSkContainer from '../../../components/distribusi/sk/Container';

export default function DistribusiSkPage() {
  return (
    <>
      <Head>
        <title>{`Distribusi Suplemen Kesehatan | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Distribusi \u2014 Suplemen Kesehatan">
        <DistribusiSkContainer />
      </DashboardLayout>
    </>
  );
}
