// pages/sampel/ot/index.js
/**
 * HALAMAN — Sampel: — Obat Tradisional
 * ---------------------------------------
 * Halaman TIPIS: <Head> + <DashboardLayout> + Container. Komponennya dipakai
 * bersama semua komoditi sampel (components/sampel/lab/) — yang membedakan
 * hanya prop `jenis`, yang menunjuk entri di components/sampel/lab/config.js.
 *
 * Impor memakai ../../../ karena folder halaman tiga tingkat:
 * pages/sampel/ot/ → root frontend/.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import SampelContainer from '../../../components/sampel/lab/Container';

export default function SampelOTPage() {
  return (
    <>
      <Head>
        <title>Sampel — Obat Tradisional | Jendela Kinerja</title>
        <meta
          name="description"
          content="Rekap data sampel Obat Tradisional yang diuji laboratorium di wilayah kerja Balai Besar POM di Palangka Raya."
        />
      </Head>
      <DashboardLayout pageTitle="Sampel — Obat Tradisional">
        <SampelContainer jenis="ot" />
      </DashboardLayout>
    </>
  );
}
