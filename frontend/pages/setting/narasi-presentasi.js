// pages/setting/narasi-presentasi.js
/**
 * HALAMAN: SETTING → NARASI PRESENTASI (di dalam dashboard ber-SSO)
 * ------------------------------------------------------------------
 * Tempat operator MENGOREKSI naskah 1 menit yang dibacakan widget LAURA di
 * halaman publik /jendela-kinerja. Koreksi disimpan per kombinasi filter
 * dashboard (tahun, bulan, kegiatan, jenis sarana, kab/kota).
 *
 * Data angka diambil dari route publik /api/publik/kinerja/* — sama dengan
 * yang tampil di halaman publik, jadi naskah tidak pernah memakai angka lain.
 *
 * Dipindahkan dari `/beranda/narasi-presentasi` ke `/setting/narasi-presentasi`
 * supaya menu konfigurasi berkumpul di satu kelompok "Setting".
 * Konvensi modul: logika + tampilan di components/beranda/.
 */
import Head from 'next/head';
import DashboardLayout from '../../components/DashboardLayout';
import { BRAND } from '../../components/Brand';
import NarasiPresentasiContainer from '../../components/beranda/NarasiPresentasiContainer';

export default function PengaturanNarasiPresentasiPage() {
  return (
    <>
      <Head>
        <title>{`Setting — Narasi Presentasi | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Setting — Narasi Presentasi">
        <NarasiPresentasiContainer />
      </DashboardLayout>
    </>
  );
}
