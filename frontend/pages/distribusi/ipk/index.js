// pages/distribusi/ipk/index.js
/**
 * HALAMAN: DISTRIBUSI \u2014 IPK \u2014 INTENSIFIKASI PENGAWASAN KHUSUS
 * ---------------------------------------------------------------
 * Halaman TIPIS: seluruh logika & tampilan ada di
 * components/distribusi/ipk/{Container,helper,Modal}.js
 * Backend: backend/routes/distribusi-ipk.js (engine lib/distribusi.js).
 *
 * Berkas sumber: "Laporan Hasil Pemeriksaan Sarana Distribusi - IPK \u2014 Intensifikasi Pengawasan Khusus".
 * Tata letaknya berbeda dari PBF \u2014 memakai engine distribusi dengan pemetaan
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
        <title>{`Distribusi IPK \u2014 Intensifikasi Pengawasan Khusus | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Distribusi \u2014 IPK \u2014 Intensifikasi Pengawasan Khusus">
        <DistribusiIpkContainer />
      </DashboardLayout>
    </>
  );
}
