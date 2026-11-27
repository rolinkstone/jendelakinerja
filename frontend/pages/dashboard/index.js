// pages/dashboard/index.js
/**
 * HALAMAN PUBLIK \u2014 DASHBOARD JENDELA KINERJA (di luar dashboard ber-SSO)
 * ------------------------------------------------------
 * Halaman tipis: <Head> + container. Struktur mengikuti konvensi modul:
 *   pages/dashboard/index.js              -> halaman tipis (file ini)
 *   components/jendela-kinerja/Container.js -> logika + tampilan
 *   (nama folder components/ sengaja TIDAK ikut diubah: komponennya sudah
 *    dipakai navbar & Segera, dan rutenya kini /dashboard)
 *   components/jendela-kinerja/helper.js    -> konstanta & formatter
 *   components/jendela-kinerja/Peta.js      -> peta SVG Kalimantan Tengah
 *
 * Halaman ini TIDAK memakai DashboardLayout (tanpa sidebar) dan TIDAK butuh
 * login: path-nya terdaftar di publicPaths frontend/middleware.js.
 *
 * Rute: /dashboard. Alamat lama /jendela-kinerja dialihkan permanen
 * (308) ke sini di next.config.mjs supaya tautan lama tetap hidup.
 */
import Head from 'next/head';
import Container from '../../components/jendela-kinerja/Container';
import { BRAND } from '../../components/Brand';
import { SUBJUDUL } from '../../components/jendela-kinerja/helper';

export default function DashboardPublik() {
  return (
    <>
      <Head>
        <title>{`${BRAND.name} \u2014 Pengawasan Sarana Produksi & Distribusi | Balai Besar POM di Palangka Raya`}</title>
        <meta name="description" content={SUBJUDUL} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Container />
    </>
  );
}
