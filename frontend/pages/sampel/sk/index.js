// pages/sampel/sk/index.js
/**
 * HALAMAN — Sampel: — Suplemen Kesehatan
 * -----------------------------------------
 * Halaman TIPIS: <Head> + <DashboardLayout> + Container. Komponennya dipakai
 * bersama semua komoditi sampel (components/sampel/lab/) — yang membedakan
 * hanya prop `jenis`, yang menunjuk entri di components/sampel/lab/config.js.
 *
 * Impor memakai ../../../ karena folder halaman tiga tingkat:
 * pages/sampel/sk/ → root frontend/.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import SampelContainer from '../../../components/sampel/lab/Container';

export default function SampelSKPage() {
  return (
    <>
      <Head>
        <title>Sampel — Suplemen Kesehatan | Jendela Kinerja</title>
        <meta
          name="description"
          content="Rekap data sampel Suplemen Kesehatan yang diuji laboratorium di wilayah kerja Balai Besar POM di Palangka Raya."
        />
      </Head>
      <DashboardLayout pageTitle="Sampel — Suplemen Kesehatan">
        <SampelContainer jenis="sk" />
      </DashboardLayout>
    </>
  );
}
