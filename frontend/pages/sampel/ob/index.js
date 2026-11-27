// pages/sampel/ob/index.js
/**
 * HALAMAN \u2014 Sampel: \u2014 Obat
 * -------------------------
 * Halaman TIPIS: <Head> + <DashboardLayout> + Container. Komponennya dipakai
 * bersama semua komoditi sampel (components/sampel/lab/) \u2014 yang membedakan
 * hanya prop `jenis`, yang menunjuk entri di components/sampel/lab/config.js.
 *
 * Impor memakai ../../../ karena folder halaman tiga tingkat:
 * pages/sampel/ob/ \u2192 root frontend/.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import SampelContainer from '../../../components/sampel/lab/Container';

export default function SampelOBPage() {
  return (
    <>
      <Head>
        <title>Sampel \u2014 Obat | Jendela Kinerja</title>
        <meta
          name="description"
          content="Rekap data sampel Obat yang diuji laboratorium di wilayah kerja Balai Besar POM di Palangka Raya."
        />
      </Head>
      <DashboardLayout pageTitle="Sampel \u2014 Obat">
        <SampelContainer jenis="ob" />
      </DashboardLayout>
    </>
  );
}
