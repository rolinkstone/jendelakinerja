// pages/sampel/kos/index.js
/**
 * HALAMAN — Sampel: — Kosmetika
 * ------------------------------
 * Halaman TIPIS: <Head> + <DashboardLayout> + Container. Komponennya dipakai
 * bersama semua komoditi sampel (components/sampel/lab/) — yang membedakan
 * hanya prop `jenis`, yang menunjuk entri di components/sampel/lab/config.js.
 *
 * Impor memakai ../../../ karena folder halaman tiga tingkat:
 * pages/sampel/kos/ → root frontend/.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import SampelContainer from '../../../components/sampel/lab/Container';

export default function SampelKosPage() {
  return (
    <>
      <Head>
        <title>Sampel — Kosmetika | Jendela Kinerja</title>
        <meta
          name="description"
          content="Rekap data sampel Kosmetika yang diuji laboratorium di wilayah kerja Balai Besar POM di Palangka Raya."
        />
      </Head>
      <DashboardLayout pageTitle="Sampel — Kosmetika">
        <SampelContainer jenis="kos" />
      </DashboardLayout>
    </>
  );
}
