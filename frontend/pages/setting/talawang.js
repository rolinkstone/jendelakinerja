// pages/setting/talawang.js
/**
 * HALAMAN: SETTING → TALAWANG (di dalam dashboard ber-SSO)
 * -------------------------------------------------------
 * Mengatur akses API data realisasi Jendela Kinerja untuk aplikasi Talawang
 * (Sistem Perjalanan Dinas). Yang diatur: token akses, pencabutannya, dan URL
 * endpoint yang ditempel ke konfigurasi Talawang.
 *
 * Cakupan data DIBATASI pada akun 524xxx (Belanja Modal) dan ditegakkan di
 * backend — halaman ini hanya mengatur token, bukan memperluas akses.
 *
 * Konvensi modul: logika + tampilan di components/setting/talawang/.
 */
import Head from 'next/head';
import DashboardLayout from '../../components/DashboardLayout';
import { BRAND } from '../../components/Brand';
import TalawangContainer from '../../components/setting/talawang/Container';

export default function PengaturanTalawangPage() {
  return (
    <>
      <Head>
        <title>{`Setting — Talawang | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Setting — Talawang">
        <TalawangContainer />
      </DashboardLayout>
    </>
  );
}
