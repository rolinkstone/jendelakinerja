// backend/lib/modul-api.js
/**
 * ============================================================================
 *  KATALOG MODUL API — sumber tunggal untuk tombol "Keluarkan Link API"
 * ============================================================================
 *  Setiap entri = satu endpoint yang datanya layak masuk knowledge LAURA AI.
 *  Halaman /jendela-kinerja mengeluarkan daftar ini sebagai kartu link yang bisa
 *  disalin; LAURA AI menempelkannya ke menu Integrasi JK lalu menekan Sinkron.
 *
 *  Bentuk tiap entri (kontrak dengan LAURA AI):
 *    kode        : kode unik endpoint (dipakai sebagai kunci dedup)
 *    nama        : judul manusiawi
 *    url_path    : path relatif terhadap BASE API JK (diawali /api/...)
 *    auth_mode   : 'public' (tanpa token) | 'bearer' (butuh Bearer Keycloak)
 *                  Semua endpoint BACA modul dibuka publik di server.js
 *                  (`publicBacaRoutes`, hanya GET/HEAD). Kolom pribadi
 *                  (operator/petugas/verifikator) dibuang oleh
 *                  lib/saring-publik.js. Impor/ubah/hapus tetap wajib token,
 *                  jadi auth_mode di sini hanya menyangkut BACA.
 *    parameter   : objek query default
 *    model_data  : cara LAURA merakit teks → 'ringkasan' | 'pilihan' |
 *                  'daftar_sarana' | 'rekap_sampel'
 *    masa_berlaku_hari : usia token yang diterbitkan LAURA untuk endpoint ini
 *
 *  ⚠️ `model_data` dan `auth_mode` harus cocok dengan perakit di
 *     laura-ai/backend/src/services/jkIntegrationService.js
 * ============================================================================
 */

const TAHUN_TERSEDIA = [2026, 2025, 2024];

const modulRingkasan = TAHUN_TERSEDIA.map((tahun, i) => ({
  kode: `JK-RINGKASAN-${tahun}`,
  nama: `Rekap Kinerja Pengawasan ${tahun}`,
  url_path: '/api/publik/kinerja/ringkasan',
  auth_mode: 'public',
  parameter: { tahun: String(tahun) },
  model_data: 'ringkasan',
  masa_berlaku_hari: 30,
  urutan: (i + 1) * 10,
  keterangan: `Rekap sarana diperiksa, MK/TMK, temuan, dan sampel lab tahun ${tahun}.`,
  modul: 'jendela-kinerja',
  halaman: '/jendela-kinerja',
}));

const MODUL_API = [
  ...modulRingkasan,
  {
    kode: 'JK-SAMPEL',
    nama: 'Hasil Pengujian Laboratorium Sampel',
    url_path: '/api/publik/kinerja/sampel',
    auth_mode: 'public',
    parameter: {},
    model_data: 'rekap_sampel',
    masa_berlaku_hari: 30,
    urutan: 40,
    keterangan: 'Total sampel diuji per tahun/komoditas/bentuk sediaan beserta hasil MK & TMK.',
    modul: 'jendela-kinerja',
    halaman: '/jendela-kinerja',
  },
  {
    kode: 'JK-PILIHAN',
    nama: 'Pilihan Filter & Data Terakhir Diunggah',
    url_path: '/api/publik/kinerja/pilihan',
    auth_mode: 'public',
    parameter: {},
    model_data: 'pilihan',
    masa_berlaku_hari: 30,
    urutan: 50,
    keterangan: 'Daftar tahun, jenis sarana, kab/kota, dan tanggal unggah terakhir.',
    modul: 'jendela-kinerja',
    halaman: '/jendela-kinerja',
  },
  {
    kode: 'JK-SARANA-2026',
    nama: 'Daftar Sarana Diperiksa 2026',
    url_path: '/api/publik/kinerja/sarana',
    auth_mode: 'public',
    parameter: { tahun: '2026', page: '1', limit: '200' },
    model_data: 'daftar_sarana',
    masa_berlaku_hari: 7,
    urutan: 60,
    keterangan: 'Baris sarana yang diperiksa (nama, jenis, kab/kota, kesimpulan). Butuh Bearer token Keycloak.',
    modul: 'jendela-kinerja',
    halaman: '/jendela-kinerja',
  },

  // -------------------------------------------------------------------------
  // Distribusi — PBF
  // -------------------------------------------------------------------------
  {
    kode: 'PBF-SUMMARY',
    nama: 'Ringkasan PBF per Tahun',
    url_path: '/api/pbf/summary',
    auth_mode: 'public',
    parameter: {},
    model_data: 'generik',
    masa_berlaku_hari: 30,
    urutan: 110,
    modul: 'distribusi/pbf',
    halaman: '/distribusi/pbf',
    keterangan: 'Rekap sarana PBF: grading, kategori, kesimpulan akhir.',
  },
  {
    kode: 'PBF-LAPORAN',
    nama: 'Daftar Laporan PBF',
    url_path: '/api/pbf/laporan',
    auth_mode: 'public',
    parameter: { page: '1', limit: '100' },
    model_data: 'generik',
    masa_berlaku_hari: 7,
    urutan: 120,
    modul: 'distribusi/pbf',
    halaman: '/distribusi/pbf',
    keterangan: 'Baris laporan pemeriksaan sarana PBF.',
  },

  // -------------------------------------------------------------------------
  // Produksi — Obat Tradisional & Pangan IRT
  // -------------------------------------------------------------------------
  {
    kode: 'PROD-OT-SUMMARY',
    nama: 'Ringkasan Produksi Obat Tradisional',
    url_path: '/api/produksi-ot/summary',
    auth_mode: 'public',
    parameter: {},
    model_data: 'generik',
    masa_berlaku_hari: 30,
    urutan: 210,
    modul: 'produksi/ot',
    halaman: '/produksi/ot',
    keterangan: 'Rekap sarana produksi OT: grading, kategori, kesimpulan.',
  },
  {
    kode: 'PROD-OT-LAPORAN',
    nama: 'Daftar Laporan Produksi OT',
    url_path: '/api/produksi-ot/laporan',
    auth_mode: 'public',
    parameter: { page: '1', limit: '100' },
    model_data: 'generik',
    masa_berlaku_hari: 7,
    urutan: 220,
    modul: 'produksi/ot',
    halaman: '/produksi/ot',
    keterangan: 'Baris laporan pemeriksaan sarana produksi OT.',
  },
  {
    kode: 'PROD-IRT-SUMMARY',
    nama: 'Ringkasan Produksi Pangan IRT',
    url_path: '/api/produksi-irt/summary',
    auth_mode: 'public',
    parameter: {},
    model_data: 'generik',
    masa_berlaku_hari: 30,
    urutan: 230,
    modul: 'produksi/irt',
    halaman: '/produksi/irt',
    keterangan: 'Rekap sarana produksi Pangan IRT: grading, kategori, kesimpulan.',
  },
  {
    kode: 'PROD-IRT-LAPORAN',
    nama: 'Daftar Laporan Produksi IRT',
    url_path: '/api/produksi-irt/laporan',
    auth_mode: 'public',
    parameter: { page: '1', limit: '100' },
    model_data: 'generik',
    masa_berlaku_hari: 7,
    urutan: 240,
    modul: 'produksi/irt',
    halaman: '/produksi/irt',
    keterangan: 'Baris laporan pemeriksaan sarana produksi Pangan IRT.',
  },

  // -------------------------------------------------------------------------
  // Sampel — satu entri per komoditi (router dari factory lib/sampel.js)
  // -------------------------------------------------------------------------
  ...[
    { segmen: 'ot', kode: 'OT', label: 'Obat Tradisional' },
    { segmen: 'sk', kode: 'SK', label: 'Suplemen Kesehatan' },
    { segmen: 'ob', kode: 'OB', label: 'Obat' },
    { segmen: 'kos', kode: 'KOS', label: 'Kosmetika' },
    { segmen: 'pp', kode: 'PP', label: 'Produk Pangan' },
    { segmen: 'kp', kode: 'KP', label: 'Kemasan Pangan' },
    { segmen: 'ok', kode: 'OK', label: 'Obat Kuasi' },
  ].flatMap((k, i) => [
    {
      kode: `SAMPEL-${k.kode}-SUMMARY`,
      nama: `Ringkasan Pengujian ${k.label}`,
      url_path: `/api/sampel-${k.segmen}/summary`,
      auth_mode: 'public',
      parameter: {},
      model_data: 'generik',
      masa_berlaku_hari: 30,
      urutan: 300 + i * 10,
      modul: `sampel/${k.segmen}`,
      halaman: `/sampel/${k.segmen}`,
      keterangan: `Rekap hasil pengujian sampel ${k.label} per tahun & kesimpulan.`,
    },
    {
      kode: `SAMPEL-${k.kode}-DAFTAR`,
      nama: `Daftar Sampel ${k.label}`,
      url_path: `/api/sampel-${k.segmen}/sampel`,
      auth_mode: 'public',
      parameter: { page: '1', limit: '100' },
      model_data: 'generik',
      masa_berlaku_hari: 7,
      urutan: 300 + i * 10 + 1,
      modul: `sampel/${k.segmen}`,
      halaman: `/sampel/${k.segmen}`,
      keterangan: `Baris sampel ${k.label}: nomor, sarana, sediaan, kesimpulan akhir.`,
    },
  ]),
];

/**
 * Bangun daftar link siap tempel untuk satu host API.
 * @param {string} baseUrl mis. "https://jendela-kinerja.bbpompky.id"
 * @param {string|null} modul filter modul (mis. "sampel/ot"); null = semua
 */
function daftarLinkApi(baseUrl, modul = null) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return MODUL_API
    .filter((m) => !modul || m.modul === modul)
    .sort((a, b) => String(a.modul).localeCompare(String(b.modul)) || a.urutan - b.urutan)
    .map((m) => {
      const q = new URLSearchParams(m.parameter || {}).toString();
      return {
        ...m,
        url_lengkap: `${base}${m.url_path}${q ? `?${q}` : ''}`,
      };
    });
}

/** Daftar modul + jumlah endpoint-nya (untuk pemilih modul di UI). */
function daftarModul() {
  const peta = new Map();
  for (const m of MODUL_API) {
    if (!peta.has(m.modul)) {
      peta.set(m.modul, { modul: m.modul, halaman: m.halaman, jumlah_endpoint: 0 });
    }
    peta.get(m.modul).jumlah_endpoint += 1;
  }
  return [...peta.values()];
}

/** Cari kode modul dari path halaman (mis. "/sampel/ot" → "sampel/ot"). */
function modulDariHalaman(pathname) {
  const bersih = String(pathname || '').replace(/\/+$/, '') || '/';
  const ketemu = MODUL_API.find((m) => m.halaman === bersih);
  return ketemu ? ketemu.modul : null;
}

module.exports = { MODUL_API, daftarLinkApi, daftarModul, modulDariHalaman, TAHUN_TERSEDIA };
