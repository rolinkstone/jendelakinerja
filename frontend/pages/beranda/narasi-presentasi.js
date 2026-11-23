// pages/beranda/narasi-presentasi.js
/**
 * HALAMAN: NARASI PRESENTASI (di dalam dashboard ber-SSO)
 * ------------------------------------------------------
 * Tempat operator MENGOREKSI naskah 1 menit yang dibacakan widget LAURA di
 * halaman publik /jendela-kinerja. Koreksi disimpan per kombinasi filter
 * dashboard (tahun, bulan, kegiatan, jenis sarana, kab/kota).
 *
 * Data angka diambil dari route publik /api/publik/kinerja/* — sama dengan
 * yang tampil di halaman publik, jadi naskah tidak pernah memakai angka lain.
 *
 * Konvensi modul: logika + tampilan di components/beranda/.
 */
import Head from 'next/head';
import DashboardLayout from '../../components/DashboardLayout';
import { BRAND } from '../../components/Brand';
import NarasiPresentasiContainer from '../../components/beranda/NarasiPresentasiContainer';

export default function NarasiPresentasiPage() {
  return (
    <>
      <Head>
        <title>{`Narasi Presentasi | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Narasi Presentasi">
        <NarasiPresentasiContainer />
      </DashboardLayout>
    </>
  );
}
