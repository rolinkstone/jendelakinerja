// pages/sampel/ok/index.js
/**
 * Sampel — Obat Kuasi.
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/sampel/lab/Container.js (satu engine untuk semua komoditi).
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import SampelContainer from '../../../components/sampel/lab/Container';

export default function SampelObatKuasiPage() {
  return (
    <>
      <Head>
        <title>Sampel — Obat Kuasi | Jendela Kinerja</title>
      </Head>
      <DashboardLayout>
        <SampelContainer jenis="ok" />
      </DashboardLayout>
    </>
  );
}
