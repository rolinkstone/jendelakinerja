// pages/produksi/ot/index.js
/**
 * HALAMAN: PRODUKSI — OBAT TRADISIONAL
 * ------------------------------------
 * Halaman ini sengaja TIPIS — hanya menyiapkan <Head> + layout global.
 * Seluruh logika & tampilan modul ada di:
 *   components/produksi/ot/Container.js
 *   components/produksi/ot/helper.js
 *   components/produksi/ot/Modal.js
 * Backend: backend/routes/produksi-ot.js (prefix /api/produksi-ot).
 *
 * Struktur menu dashboard: Distribusi → PBF, Produksi → Obat Tradisional.
 * Jadi folder halaman mengikuti menu, bukan satu folder per modul.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import { BRAND } from '../../../components/Brand';
import ProduksiOtContainer from '../../../components/produksi/ot/Container';

export default function ProduksiObatTradisionalPage() {
  return (
    <>
      <Head>
        <title>{`Produksi — Obat Tradisional | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Produksi — Obat Tradisional">
        <ProduksiOtContainer />
      </DashboardLayout>
    </>
  );
}
