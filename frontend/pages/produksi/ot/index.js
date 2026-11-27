// pages/produksi/ot/index.js
/**
 * HALAMAN: PRODUKSI \u2014 OBAT TRADISIONAL
 * ------------------------------------
 * Halaman ini sengaja TIPIS \u2014 hanya menyiapkan <Head> + layout global.
 * Seluruh logika & tampilan modul ada di:
 *   components/produksi/ot/Container.js
 *   components/produksi/ot/helper.js
 *   components/produksi/ot/Modal.js
 * Backend: backend/routes/produksi-ot.js (prefix /api/produksi-ot).
 *
 * Struktur menu dashboard: Distribusi \u2192 PBF, Produksi \u2192 Obat Tradisional.
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
        <title>{`Produksi \u2014 Obat Tradisional | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Produksi \u2014 Obat Tradisional">
        <ProduksiOtContainer />
      </DashboardLayout>
    </>
  );
}
