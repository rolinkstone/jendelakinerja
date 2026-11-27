// pages/distribusi/ot/index.js
/**
 * HALAMAN: DISTRIBUSI \u2014 OBAT TRADISIONAL
 * ---------------------------------------------------------------
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/distribusi/ot/{Container,helper,Modal}.js
 * Backend: backend/routes/distribusi-ot.js (engine lib/distribusi.js).
 *
 * Berkas sumber: "Laporan Hasil Pemeriksaan Sarana Distribusi - Obat Tradisional".
 * Tata letaknya BERBEDA dari PBF \u2014 karena itu memakai engine tersendiri
 * dengan pemetaan kolom per komoditi.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import { BRAND } from '../../../components/Brand';
import DistribusiOtContainer from '../../../components/distribusi/ot/Container';

export default function DistribusiOtPage() {
  return (
    <>
      <Head>
        <title>{`Distribusi Obat Tradisional | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Distribusi \u2014 Obat Tradisional">
        <DistribusiOtContainer />
      </DashboardLayout>
    </>
  );
}
