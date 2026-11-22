// pages/produksi/irt/index.js
/**
 * HALAMAN — Produksi: Pangan IRT (CPPB - IRT)
 * ------------------------------------------
 * Halaman TIPIS: hanya <Head> + DashboardLayout + container modul.
 * Seluruh logika & tampilan ada di components/produksi/irt/Container.js.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import ProduksiIrtContainer from '../../../components/produksi/irt/Container';
import { BRAND } from '../../../components/Brand';

export default function ProduksiIrtPage() {
  return (
    <>
      <Head>
        <title>{`Produksi — Pangan IRT | ${BRAND.name}`}</title>
        <meta
          name="description"
          content="Laporan hasil pemeriksaan sarana produksi pangan IRT (CPPB-IRT) per tahun."
        />
      </Head>

      <DashboardLayout pageTitle="Produksi — Pangan IRT">
        <ProduksiIrtContainer />
      </DashboardLayout>
    </>
  );
}
