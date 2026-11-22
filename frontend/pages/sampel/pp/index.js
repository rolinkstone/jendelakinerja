// pages/sampel/pp/index.js
/**
 * Sampel — Produk Pangan.
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/sampel/lab/Container.js (satu engine untuk semua komoditi).
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import SampelContainer from '../../../components/sampel/lab/Container';

export default function SampelProdukPanganPage() {
  return (
    <>
      <Head>
        <title>Sampel — Produk Pangan | Jendela Kinerja</title>
      </Head>
      <DashboardLayout>
        <SampelContainer jenis="pp" />
      </DashboardLayout>
    </>
  );
}
