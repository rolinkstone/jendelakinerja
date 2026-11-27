// pages/sampel/kp/index.js
/**
 * Sampel \u2014 Kemasan Pangan.
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/sampel/lab/Container.js (satu engine untuk semua komoditi).
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import SampelContainer from '../../../components/sampel/lab/Container';

export default function SampelKemasanPanganPage() {
  return (
    <>
      <Head>
        <title>Sampel \u2014 Kemasan Pangan | Jendela Kinerja</title>
      </Head>
      <DashboardLayout>
        <SampelContainer jenis="kp" />
      </DashboardLayout>
    </>
  );
}
