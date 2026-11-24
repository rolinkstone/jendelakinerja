// pages/distribusi/ifp/index.js
/**
 * HALAMAN: DISTRIBUSI — IFP (Instalasi Farmasi Pemerintah)
 * -------------------------------------------------------
 * Halaman TIPIS — hanya <Head> + layout global. Seluruh logika & tampilan ada
 * di components/distribusi/ifp/{Container,helper,Modal}.js.
 * Backend: backend/routes/ifp.js (prefix /api/ifp).
 *
 * Berkas "Laporan Hasil Pemeriksaan Sarana Distribusi - Instalasi Farmasi"
 * tata letaknya IDENTIK dengan PBF (44 kolom, header dua tingkat di baris 8-9),
 * jadi modul ini kembar dengan PBF.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import { BRAND } from '../../../components/Brand';
import DistribusiIfpContainer from '../../../components/distribusi/ifp/Container';

export default function DistribusiIfpPage() {
  return (
    <>
      <Head>
        <title>{`Distribusi IFP | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Distribusi — IFP">
        <DistribusiIfpContainer />
      </DashboardLayout>
    </>
  );
}
