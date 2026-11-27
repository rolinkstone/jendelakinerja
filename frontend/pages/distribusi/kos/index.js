// pages/distribusi/kos/index.js
/**
 * HALAMAN: DISTRIBUSI \u2014 KOSMETIKA
 * ---------------------------------------------------------------
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/distribusi/kos/{Container,helper,Modal}.js
 * Backend: backend/routes/distribusi-kos.js (engine lib/distribusi.js).
 *
 * Berkas sumber: "Laporan Hasil Pemeriksaan Sarana Distribusi - Kosmetika".
 * Tata letaknya BERBEDA dari PBF \u2014 karena itu memakai engine tersendiri
 * dengan pemetaan kolom per komoditi.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import { BRAND } from '../../../components/Brand';
import DistribusiKosContainer from '../../../components/distribusi/kos/Container';

export default function DistribusiKosPage() {
  return (
    <>
      <Head>
        <title>{`Distribusi Kosmetika | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Distribusi \u2014 Kosmetika">
        <DistribusiKosContainer />
      </DashboardLayout>
    </>
  );
}
