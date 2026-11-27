// pages/produksi/pangan-md/index.js
/**
 * HALAMAN: PRODUKSI \u2014 PANGAN MD (Pangan Olahan Makanan Dalam)
 * ----------------------------------------------------------
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/produksi/pangan-md/{Container,helper,Modal}.js
 * Backend: backend/routes/produksi-pangan-md.js (prefix /api/produksi-pangan-md),
 * memakai mesin lib/distribusi.js dengan pemetaan kolom sendiri.
 *
 * Berkas "Laporan Hasil Pemeriksaan Sarana Produksi - Pangan MD" punya 48
 * kolom \u2014 berbeda dari IRT (55 kolom) dan OT, jadi tidak bisa memakai
 * router keduanya.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import { BRAND } from '../../../components/Brand';
import ProduksiPanganMdContainer from '../../../components/produksi/pangan-md/Container';

export default function ProduksiPanganMdPage() {
  return (
    <>
      <Head>
        <title>{`Produksi Pangan MD | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Produksi \u2014 Pangan MD">
        <ProduksiPanganMdContainer />
      </DashboardLayout>
    </>
  );
}
