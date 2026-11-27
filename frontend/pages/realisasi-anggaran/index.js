// pages/realisasi-anggaran/index.js
/**
 * HALAMAN PUBLIK — Dashboard Realisasi Keuangan (/realisasi-anggaran)
 * ------------------------------------------------------------------
 * Halaman tipis: <Head> + container.
 *   pages/realisasi-anggaran/index.js        -> halaman tipis (file ini)
 *   components/realisasi-anggaran/Container.js -> logika + tampilan
 *   components/realisasi-anggaran/helper.js    -> formatter + label akun
 *
 * PUBLIK: hanya angka agregat (pagu, realisasi, sisa, serapan per jenis MAK /
 * kode kegiatan / unit kerja). Endpoint-nya `/api/publik/realisasi` yang
 * memang mengeluarkan agregat saja. Rincian per MAK ada di /data-realisasi
 * yang WAJIB LOGIN — jangan menambahkan kode COA atau daftar MAK per baris ke
 * halaman ini.
 */
import Head from 'next/head';
import RealisasiAnggaranContainer from '../../components/realisasi-anggaran/Container';
import { BRAND } from '../../components/Brand';

const JUDUL = 'Dashboard Realisasi Keuangan | Balai Besar POM di Palangka Raya';
const DESKRIPSI =
  'Pagu, realisasi, sisa anggaran, dan tingkat serapan Balai Besar POM di Palangka Raya per jenis MAK dan kode kegiatan.';

export default function RealisasiAnggaranPage() {
  return (
    <>
      <Head>
        <title>{`${BRAND.name} — ${JUDUL}`}</title>
        <meta name="description" content={DESKRIPSI} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <RealisasiAnggaranContainer />
    </>
  );
}