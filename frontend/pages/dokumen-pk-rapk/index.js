// pages/dokumen-pk-rapk/index.js
/**
 * HALAMAN PUBLIK — Dokumen PK dan RAPK
 * -----------------------------------------
 * Menu ini sudah tampil di navbar tetapi modulnya belum selesai. Halaman ini
 * menjaga tautan menu tetap hidup (bukan 404) memakai komponen bersama
 * components/navbar/Segera.js.
 *
 * Bila modulnya nanti selesai: ganti isi berkas ini dengan
 * <Head> + Navbar + container modul, mengikuti pola pages/jendela-kinerja/index.js.
 */
import Segera from '../../components/navbar/Segera';

export default function HalamanDokumenPkRapk() {
  return <Segera href="/dokumen-pk-rapk" />;
}
