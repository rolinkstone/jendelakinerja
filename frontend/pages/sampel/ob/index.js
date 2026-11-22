// pages/sampel/ob/index.js
/**
 * HALAMAN — Sampel: — Obat
 * -------------------------
 * Halaman TIPIS: <Head> + <DashboardLayout> + Container. Komponennya dipakai
 * bersama semua komoditi sampel (components/sampel/lab/) — yang membedakan
 * hanya prop `jenis`, yang menunjuk entri di components/sampel/lab/config.js.
 *
 * Impor memakai ../../../ karena folder halaman tiga tingkat:
 * pages/sampel/ob/ → root frontend/.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import SampelContainer from '../../../components/sampel/lab/Container';

export default function SampelOBPage() {
  return (
    <>
      <Head>
        <title>Sampel — Obat | Jendela Kinerja</title>
        <meta
          name="description"
          content="Rekap data sampel Obat yang diuji laboratorium di wilayah kerja Balai Besar POM di Palangka Raya."
        />
      </Head>
      <DashboardLayout pageTitle="Sampel — Obat">
        <SampelContainer jenis="ob" />
      </DashboardLayout>
    </>
  );
}
