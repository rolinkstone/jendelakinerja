// pages/jendela-kinerja/index.js
/**
 * HALAMAN PUBLIK — JENDELA KINERJA (di luar dashboard ber-SSO)
 * ------------------------------------------------------------
 * Halaman tipis: <Head> + container. Struktur mengikuti konvensi modul:
 *   pages/jendela-kinerja/index.js        -> halaman tipis (file ini)
 *   components/jendela-kinerja/Container.js -> logika + tampilan
 *   components/jendela-kinerja/helper.js    -> konstanta & formatter
 *   components/jendela-kinerja/Peta.js      -> peta SVG Kalimantan Tengah
 *
 * Halaman ini TIDAK memakai DashboardLayout (tanpa sidebar) dan TIDAK butuh
 * login: path-nya terdaftar di publicPaths frontend/middleware.js.
 */
import Head from 'next/head';
import Container from '../../components/jendela-kinerja/Container';
import { BRAND } from '../../components/Brand';
import { SUBJUDUL } from '../../components/jendela-kinerja/helper';

export default function JendelaKinerjaPublik() {
  return (
    <>
      <Head>
        <title>{`${BRAND.name} — Pengawasan Sarana Produksi & Distribusi | Balai Besar POM di Palangka Raya`}</title>
        <meta name="description" content={SUBJUDUL} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Container />
    </>
  );
}
