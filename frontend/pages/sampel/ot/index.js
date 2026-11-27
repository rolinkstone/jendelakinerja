// pages/sampel/ot/index.js
/**
 * HALAMAN \u2014 Sampel: \u2014 Obat Tradisional
 * ---------------------------------------
 * Halaman TIPIS: <Head> + <DashboardLayout> + Container. Komponennya dipakai
 * bersama semua komoditi sampel (components/sampel/lab/) \u2014 yang membedakan
 * hanya prop `jenis`, yang menunjuk entri di components/sampel/lab/config.js.
 *
 * Impor memakai ../../../ karena folder halaman tiga tingkat:
 * pages/sampel/ot/ \u2192 root frontend/.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import SampelContainer from '../../../components/sampel/lab/Container';

export default function SampelOTPage() {
  return (
    <>
      <Head>
        <title>Sampel \u2014 Obat Tradisional | Jendela Kinerja</title>
        <meta
          name="description"
          content="Rekap data sampel Obat Tradisional yang diuji laboratorium di wilayah kerja Balai Besar POM di Palangka Raya."
        />
      </Head>
      <DashboardLayout pageTitle="Sampel \u2014 Obat Tradisional">
        <SampelContainer jenis="ot" />
      </DashboardLayout>
    </>
  );
}
