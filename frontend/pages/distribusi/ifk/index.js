// pages/distribusi/ifk/index.js
/**
 * HALAMAN: DISTRIBUSI — IFK
 * ---------------------------------------------------------------
 * IFK = Instalasi Farmasi Pemerintah KOTA/KABUPATEN.
 * Berkasnya identik dengan PBF/IFP (44 kolom, ada rincian fokus pemeriksaan),
 * jadi modul ini kembar dengan keduanya. Jangan tertukar dengan IFP (provinsi).
 *
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/distribusi/ifk/{Container,helper,Modal}.js
 * Backend: backend/routes/distribusi-ifk.js (prefix /api/distribusi-ifk).
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import { BRAND } from '../../../components/Brand';
import DistribusiIfkContainer from '../../../components/distribusi/ifk/Container';

export default function DistribusiIfkPage() {
  return (
    <>
      <Head>
        <title>{`Distribusi IFK | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Distribusi — IFK">
        <DistribusiIfkContainer />
      </DashboardLayout>
    </>
  );
}
