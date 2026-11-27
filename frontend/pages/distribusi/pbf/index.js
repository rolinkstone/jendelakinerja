// pages/distribusi/pbf/index.js
/**
 * HALAMAN: DISTRIBUSI \u2014 PBF
 * -------------------------
 * Halaman ini sengaja TIPIS \u2014 hanya menyiapkan <Head> + layout global.
 * Seluruh logika & tampilan modul ada di:
 *   components/distribusi/pbf/Container.js
 *   components/distribusi/pbf/helper.js
 *   components/distribusi/pbf/Modal.js
 * Backend: backend/routes/pbf.js (prefix /api/pbf).
 *
 * Menu dashboard dibagi dua kelompok: Distribusi \u2192 PBF dan
 * Produksi \u2192 Obat Tradisional. Karena itu folder halaman mengikuti menu.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import { BRAND } from '../../../components/Brand';
import DistribusiPbfContainer from '../../../components/distribusi/pbf/Container';

export default function DistribusiPbfPage() {
  return (
    <>
      <Head>
        <title>{`Distribusi PBF | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Distribusi \u2014 PBF">
        <DistribusiPbfContainer />
      </DashboardLayout>
    </>
  );
}
