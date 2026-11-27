// components/sampel/lab/config.js
/**
 * KONFIGURASI MODUL SAMPEL PER KOMODITI
 * -------------------------------------
 * Modul Sampel punya beberapa sub menu (Obat Tradisional, Suplemen Kesehatan,
 * Obat, Kosmetika, Produk Pangan, Kemasan Pangan, Obat Kuasi). Komponennya sama \u2014 yang berbeda hanya:
 * prefix API, judul halaman, label komoditi, dan ikon. Berkas Excel-nya TIDAK
 * selalu sama tata letaknya (Obat 59 kolom dengan Kriteria Resiko & ATC,
 * Kosmetika & Produk Pangan 54 kolom tanpa Jenis Sarana), tetapi perbedaan itu
 * ditangani engine di backend.
 *
 * Jadi jangan menyalin folder komponen per komoditi: tambahkan satu entri di
 * sini, satu router tipis di backend (lihat backend/routes/sampel-sk.js), satu
 * pasang tabel (backend/db/sampel_sk.sql), lalu halaman tipis di
 * pages/sampel/<segmen>/index.js.
 */
export const KONFIG = {
  ot: {
    kode: 'OT',
    segmen: 'ot',
    api: '/api/sampel/ot',
    judul: 'Sampel Obat Tradisional',
    judulMenu: 'Obat Tradisional',
    komoditi: 'Obat Tradisional (OT)',
    ikon: 'FaFlask',
  },
  sk: {
    kode: 'SK',
    segmen: 'sk',
    api: '/api/sampel/sk',
    judul: 'Sampel Suplemen Kesehatan',
    judulMenu: 'Suplemen Kesehatan',
    komoditi: 'Suplemen Kesehatan',
    ikon: 'FaPills',
  },
  ob: {
    kode: 'OB',
    segmen: 'ob',
    api: '/api/sampel/ob',
    judul: 'Sampel Obat',
    judulMenu: 'Obat',
    komoditi: 'Obat',
    ikon: 'FaCapsules',
  },
  kos: {
    kode: 'KOS',
    segmen: 'kos',
    api: '/api/sampel/kos',
    judul: 'Sampel Kosmetika',
    judulMenu: 'Kosmetika',
    komoditi: 'Kosmetika',
    ikon: 'FaSprayCan',
  },
  pp: {
    kode: 'PP',
    segmen: 'pp',
    api: '/api/sampel/pp',
    judul: 'Sampel Produk Pangan',
    judulMenu: 'Produk Pangan',
    komoditi: 'Produk Pangan',
    ikon: 'FaUtensils',
  },  kp: {
    kode: 'KP',
    segmen: 'kp',
    api: '/api/sampel/kp',
    judul: 'Sampel Kemasan Pangan',
    judulMenu: 'Kemasan Pangan',
    komoditi: 'Kemasan Pangan',
    ikon: 'FaBoxOpen',
  },  ok: {
    kode: 'OK',
    segmen: 'ok',
    api: '/api/sampel/ok',
    judul: 'Sampel Obat Kuasi',
    judulMenu: 'Obat Kuasi',
    komoditi: 'Obat Kuasi',
    ikon: 'FaBandAid',
  },
};

/** Konfigurasi satu komoditi; jatuh ke OT bila segmen tidak dikenal. */
export function konfig(segmen) {
  return KONFIG[segmen] || KONFIG.ot;
}
