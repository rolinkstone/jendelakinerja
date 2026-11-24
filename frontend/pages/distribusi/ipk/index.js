// pages/distribusi/ipk/index.js
/**
 * HALAMAN: DISTRIBUSI — IPK — INTENSIFIKASI PENGAWASAN KHUSUS
 * ---------------------------------------------------------------
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/distribusi/ipk/{Container,helper,Modal}.js
 * Backend: backend/routes/distribusi-ipk.js (engine lib/distribusi.js).
 *
 * Berkas sumber: "Laporan Hasil Pemeriksaan Sarana Distribusi - IPK — Intensifikasi Pengawasan Khusus".
 * Tata letaknya berbeda dari PBF — memakai engine distribusi dengan pemetaan
 * kolom sendiri.
 */
import Head from 'next/head';
import DashboardLayout from '../../../components/DashboardLayout';
import { BRAND } from '../../../components/Brand';
import DistribusiIpkContainer from '../../../components/distribusi/ipk/Container';

export default function DistribusiIpkPage() {
  return (
    <>
      <Head>
        <title>{`Distribusi IPK — Intensifikasi Pengawasan Khusus | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Distribusi — IPK — Intensifikasi Pengawasan Khusus">
        <DistribusiIpkContainer />
      </DashboardLayout>
    </>
  );
}
