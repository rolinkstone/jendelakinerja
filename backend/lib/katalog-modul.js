// backend/lib/katalog-modul.js
/**
 * ============================================================================
 *  KATALOG MODUL & FIELD — sumber tunggal untuk fitur "Link API"
 * ============================================================================
 *  Fitur yang dilayani berkas ini:
 *
 *    1. UI dashboard menampilkan daftar FIELD sebuah modul (dengan label
 *       manusiawi + grup), operator mencentang mana yang boleh keluar.
 *    2. Backend memvalidasi pilihan itu terhadap katalog ini — nama kolom
 *       TIDAK pernah dipakai mentah dari body request (cegah SQL injection
 *       lewat nama kolom), hanya yang ada di `KOLOM[tabel]` yang lolos.
 *    3. Link publik hasil pilihan hanya membawa kolom-kolom itu.
 *
 *  Kenapa katalog di kode, bukan introspection DB setiap request:
 *    - whitelist harus eksplisit (kolom baru di DB tidak otomatis publik);
 *    - label & grup butuh terjemahan manusia, bukan nama kolom mentah;
 *    - satu sumber kebenaran untuk validasi server + tampilan UI.
 *
 *  Menambah kolom: tambahkan ke KOLOM[tabel] beserta label & grupnya.
 *  Menambah modul: tambahkan ke MODUL, lalu pastikan tabelnya ada.
 * ============================================================================
 */

/**
 * Metadata satu field.
 *   label   : judul yang tampil di UI
 *   grup    : pengelompokan di UI (Identitas, Sarana, Hasil Uji, ...)
 *   pribadi : true = menyentuh nama orang/penanggung jawab → TIDAK dicentang
 *             otomatis, karena data ini masuk knowledge dan bisa tersebar
 *   ringkas : true = ikut preset "ringkas" (field inti untuk rekap)
 *   tipe    : number | text | date  (membantu perakit teks di LAURA)
 */
const f = (label, grup, opsi = {}) => ({ label, grup, ...opsi });

const GRUP = {
  IDENTITAS: 'Identitas Sampel',
  SARANA: 'Sarana & Lokasi',
  PRODUK: 'Produk & Pendaftaran',
  UPT: 'Hasil Uji UPT',
  PUSAT: 'Hasil Uji Pusat',
  TINDAK: 'Tindak Lanjut',
  BERKAS: 'Berkas & Waktu',
  RINGKASAN: 'Ringkasan'
};

/** Field sampel — dipakai bersama oleh 7 komoditi sampel (tata letak sama). */
const KOLOM_SAMPEL = {
  tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
  no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
  nomor_sampel: f('Nomor Sampel', GRUP.IDENTITAS, { ringkas: true }),
  tgl_sampling: f('Tanggal Sampling', GRUP.IDENTITAS, { ringkas: true }),
  kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
  nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
  jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
  kategori_sarana: f('Kategori Sarana', GRUP.SARANA),
  tujuan_sampling: f('Tujuan Sampling', GRUP.SARANA),

  nama_sampel: f('Nama Sampel', GRUP.PRODUK, { ringkas: true }),
  brand_produk: f('Brand Produk', GRUP.PRODUK, { ringkas: true }),
  bentuk_sediaan: f('Bentuk Sediaan', GRUP.PRODUK, { ringkas: true }),
  no_reg: f('No. Registrasi', GRUP.PRODUK),
  pabrik: f('Pabrik', GRUP.PRODUK),
  importir: f('Importir', GRUP.PRODUK),
  komposisi: f('Komposisi', GRUP.PRODUK),
  netto: f('Netto', GRUP.PRODUK),
  jumlah_sampel: f('Jumlah Sampel', GRUP.PRODUK, { ringkas: true }),
  no_bets: f('No. Bets', GRUP.PRODUK),
  url_produk: f('URL Produk', GRUP.PRODUK),

  kesimpulan_akhir: f('Kesimpulan Akhir', GRUP.RINGKASAN, { ringkas: true }),
  sumber_kesimpulan: f('Sumber Kesimpulan', GRUP.RINGKASAN),
  status_sampel: f('Status Sampel', GRUP.RINGKASAN, { ringkas: true }),

  upt_penguji: f('UPT Penguji', GRUP.UPT),
  upt_kesimpulan_uji: f('Kesimpulan Uji (UPT)', GRUP.UPT),
  upt_kesimpulan_penandaan: f('Kesimpulan Penandaan (UPT)', GRUP.UPT),
  upt_kesimpulan_akhir: f('Kesimpulan Akhir (UPT)', GRUP.UPT),

  pusat_parameter_tms: f('Parameter TMS (Pusat)', GRUP.PUSAT),
  pusat_kesimpulan_uji: f('Kesimpulan Uji (Pusat)', GRUP.PUSAT),
  pusat_kesimpulan_penandaan: f('Kesimpulan Penandaan (Pusat)', GRUP.PUSAT),
  pusat_kesimpulan_akhir: f('Kesimpulan Akhir (Pusat)', GRUP.PUSAT),

  jenis_tindak_lanjut: f('Jenis Tindak Lanjut', GRUP.TINDAK, { ringkas: true }),
  nomor_surat: f('Nomor Surat TL', GRUP.TINDAK),
  tanggal_surat: f('Tanggal Surat TL', GRUP.TINDAK),

  tgl_lhu: f('Tanggal LHU', GRUP.BERKAS),
  // Data pribadi petugas — sengaja TIDAK ikut preset ringkas
  operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
  verifikasi_oleh: f('Diverifikasi Oleh', GRUP.BERKAS, { pribadi: true }),
  upt_penyampling: f('UPT Penyampling', GRUP.BERKAS, { pribadi: true }),
  metode_pengambilan: f('Metode Pengambilan', GRUP.BERKAS),
  kondisi_sampling: f('Kondisi Sampling', GRUP.BERKAS),
  cara_perolehan: f('Cara Perolehan', GRUP.BERKAS),
  asal_sampel: f('Asal Sampel', GRUP.BERKAS),
  jenis_pengujian: f('Jenis Pengujian', GRUP.BERKAS),
  anggaran_sampling: f('Anggaran Sampling', GRUP.BERKAS),
  bulan: f('Bulan', GRUP.BERKAS, { tipe: 'number' }),
  tgl_spk: f('Tanggal SPK', GRUP.BERKAS)
};

/**
 * Daftar modul yang bisa menerbitkan link.
 *   tabel  : tabel laporan (satu baris = satu unit data)
 *   sumber : kolom kunci untuk filter tahun
 *   kolom  : katalog field (whitelist)
 */
const MODUL = {
  'sampel-ot': {
    nama: 'Sampel Obat Tradisional',
    tabel: 'sampel_ot_laporan',
    kolom: KOLOM_SAMPEL
  },
  'sampel-sk': {
    nama: 'Sampel Suplemen Kesehatan',
    tabel: 'sampel_sk_laporan',
    kolom: KOLOM_SAMPEL
  },
  'sampel-ob': {
    nama: 'Sampel Obat',
    tabel: 'sampel_ob_laporan',
    kolom: KOLOM_SAMPEL
  },
  'sampel-kos': {
    nama: 'Sampel Kosmetika',
    tabel: 'sampel_kos_laporan',
    kolom: KOLOM_SAMPEL
  },
  'sampel-pp': {
    nama: 'Sampel Produk Pangan',
    tabel: 'sampel_pp_laporan',
    kolom: KOLOM_SAMPEL
  },
  'sampel-kp': {
    nama: 'Sampel Kemasan Pangan',
    tabel: 'sampel_kp_laporan',
    kolom: KOLOM_SAMPEL
  },
  'sampel-ok': {
    nama: 'Sampel Obat Kuasi',
    tabel: 'sampel_ok_laporan',
    kolom: KOLOM_SAMPEL
  },
  'pbf': {
    nama: 'Distribusi PBF',
    tabel: 'pbf_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      kesimpulan_akhir: f('Kesimpulan Akhir', GRUP.RINGKASAN, { ringkas: true }),
      jumlah_mayor: f('Temuan Mayor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_minor: f('Temuan Minor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_kritis: f('Temuan Kritis', GRUP.RINGKASAN, { tipe: 'number' }),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      tindak_lanjut: f('Tindak Lanjut', GRUP.TINDAK, { ringkas: true }),
      temuan: f('Uraian Temuan', GRUP.UPT),
      rekomendasi: f('Rekomendasi', GRUP.TINDAK),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  },
  'ifp': {
    nama: 'Distribusi IFP',
    tabel: 'ifp_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      kesimpulan_akhir: f('Kesimpulan Akhir', GRUP.RINGKASAN, { ringkas: true }),
      jumlah_mayor: f('Temuan Mayor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_minor: f('Temuan Minor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_kritis: f('Temuan Kritis', GRUP.RINGKASAN, { tipe: 'number' }),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      tindak_lanjut: f('Tindak Lanjut', GRUP.TINDAK, { ringkas: true }),
      temuan: f('Uraian Temuan', GRUP.UPT),
      rekomendasi: f('Rekomendasi', GRUP.TINDAK),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  },
  'distribusi-ifk': {
    nama: 'Distribusi IFK',
    tabel: 'ifk_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      kesimpulan_akhir: f('Kesimpulan Akhir', GRUP.RINGKASAN, { ringkas: true }),
      jumlah_mayor: f('Temuan Mayor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_minor: f('Temuan Minor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_kritis: f('Temuan Kritis', GRUP.RINGKASAN, { tipe: 'number' }),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      tindak_lanjut: f('Tindak Lanjut', GRUP.TINDAK, { ringkas: true }),
      temuan: f('Uraian Temuan', GRUP.UPT),
      rekomendasi: f('Rekomendasi', GRUP.TINDAK),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  },
  'distribusi-kos': {
    nama: 'Distribusi Kosmetika',
    tabel: 'dist_kos_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      // Berkas kosmetika tidak punya kolom "Kesimpulan Akhir"; yang dipakai
      // adalah "Hasil Balai" (kolom 14).
      hasil_balai: f('Hasil Balai', GRUP.RINGKASAN, { ringkas: true }),
      klasifikasi: f('Klasifikasi', GRUP.RINGKASAN, { ringkas: true }),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      tindak_lanjut: f('Tindak Lanjut (UPT)', GRUP.TINDAK, { ringkas: true }),
      tindak_lanjut_pusat: f('Tindak Lanjut (Pusat)', GRUP.TINDAK),
      saran_tindak_lanjut: f('Saran Tindak Lanjut', GRUP.TINDAK),
      catatan: f('Catatan', GRUP.UPT),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  },
  'distribusi-ot': {
    nama: 'Distribusi Obat Tradisional',
    tabel: 'dist_ot_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      metode_inspeksi: f('Metode Inspeksi', GRUP.SARANA),
      // Kesimpulan ada di "Hasil Balai" (kolom 17), bukan "Kesimpulan Akhir".
      hasil_balai: f('Hasil Balai', GRUP.RINGKASAN, { ringkas: true }),
      klasifikasi: f('Klasifikasi', GRUP.RINGKASAN, { ringkas: true }),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      detil_hasil_pemeriksaan: f('Detil Hasil Pemeriksaan', GRUP.UPT),
      detil_kesimpulan_tmk: f('Detil Kesimpulan TMK', GRUP.UPT),
      tindak_lanjut: f('Tindak Lanjut', GRUP.TINDAK, { ringkas: true }),
      saran_tindak_lanjut: f('Saran Tindak Lanjut', GRUP.TINDAK),
      catatan: f('Catatan', GRUP.UPT),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  },
  'distribusi-ipk': {
    nama: 'Distribusi IPK',
    tabel: 'dist_ipk_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      // IPK tidak punya "Klasifikasi"; yang khas hanya tindakan terhadap produk.
      tindakan_terhadap_produk: f('Tindakan Terhadap Produk', GRUP.RINGKASAN, { ringkas: true }),
      hasil_balai: f('Hasil Balai', GRUP.RINGKASAN, { ringkas: true }),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      tindak_lanjut: f('Tindak Lanjut', GRUP.TINDAK, { ringkas: true }),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  },
  'distribusi-sk': {
    nama: 'Distribusi Suplemen Kesehatan',
    tabel: 'dist_sk_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      metode_inspeksi: f('Metode Inspeksi', GRUP.SARANA),
      klasifikasi: f('Klasifikasi', GRUP.RINGKASAN, { ringkas: true }),
      hasil_balai: f('Hasil Balai', GRUP.RINGKASAN, { ringkas: true }),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      tindak_lanjut: f('Tindak Lanjut (UPT)', GRUP.TINDAK, { ringkas: true }),
      tindak_lanjut_pusat: f('Tindak Lanjut (Pusat)', GRUP.TINDAK),
      detil_hasil_pemeriksaan: f('Detil Hasil Pemeriksaan', GRUP.UPT),
      detil_kesimpulan_tmk: f('Detil Kesimpulan TMK', GRUP.UPT),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  },
  'produksi-ot': {
    nama: 'Produksi Obat Tradisional',
    tabel: 'ot_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      status_sarana: f('Status Sarana', GRUP.RINGKASAN, { ringkas: true }),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      jumlah_mayor: f('Temuan Mayor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_minor: f('Temuan Minor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_lain: f('Temuan Lain', GRUP.RINGKASAN, { tipe: 'number' }),
      jumlah_kritis: f('Temuan Kritis', GRUP.RINGKASAN, { tipe: 'number' }),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      hasil_balai: f('Hasil Balai', GRUP.UPT),
      tindak_lanjut: f('Tindak Lanjut', GRUP.TINDAK, { ringkas: true }),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  },
  'produksi-irt': {
    nama: 'Produksi Pangan IRT',
    tabel: 'irt_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      status_sarana: f('Status Sarana', GRUP.RINGKASAN, { ringkas: true }),
      level_irtp: f('Level IRTP', GRUP.RINGKASAN, { ringkas: true }),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      jumlah_mayor: f('Temuan Mayor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_minor: f('Temuan Minor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_serius: f('Temuan Serius', GRUP.RINGKASAN, { tipe: 'number' }),
      jumlah_kritis: f('Temuan Kritis', GRUP.RINGKASAN, { tipe: 'number' }),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      penyimpangan: f('Penyimpangan', GRUP.UPT),
      tindak_lanjut: f('Tindak Lanjut', GRUP.TINDAK, { ringkas: true }),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  },
'produksi-pangan-md': {
    nama: 'Produksi Pangan MD',
    tabel: 'prod_md_laporan',
    kolom: {
      tahun: f('Tahun Data', GRUP.BERKAS, { ringkas: true, tipe: 'number' }),
      no_urut: f('No. Urut', GRUP.IDENTITAS, { tipe: 'number' }),
      nama_sarana: f('Nama Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_sarana: f('Jenis Sarana', GRUP.SARANA, { ringkas: true }),
      jenis_industri: f('Jenis Industri', GRUP.SARANA),
      kab_kota: f('Kabupaten / Kota', GRUP.SARANA, { ringkas: true }),
      tujuan_pemeriksaan: f('Tujuan Pemeriksaan', GRUP.SARANA),
      metode_inspeksi: f('Metode Inspeksi', GRUP.SARANA),
      // Identitas produk pangan yang diperiksa
      nama_pangan: f('Nama Pangan', GRUP.RINGKASAN, { ringkas: true }),
      jenis_pangan: f('Jenis Pangan', GRUP.RINGKASAN, { ringkas: true }),
      merk_produk: f('Merk Produk', GRUP.RINGKASAN),
      sert_jenis: f('Jenis Sertifikat', GRUP.RINGKASAN),
      sert_nomor: f('Nomor Sertifikat', GRUP.RINGKASAN),
      sert_masa_berlaku: f('Masa Berlaku Sertifikat', GRUP.RINGKASAN),
      sert_lembaga: f('Lembaga Penerbit', GRUP.RINGKASAN),
      status_sarana: f('Status Sarana', GRUP.RINGKASAN),
      temuan_nomor: f('Nomor & Kategori Ketidaksesuaian', GRUP.UPT),
      temuan_deskripsi: f('Deskripsi Ketidaksesuaian', GRUP.UPT),
      jumlah_mayor: f('Temuan Mayor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_minor: f('Temuan Minor', GRUP.RINGKASAN, { ringkas: true, tipe: 'number' }),
      jumlah_kritis: f('Temuan Kritis', GRUP.RINGKASAN, { tipe: 'number' }),
      rating: f('Tingkat Rating', GRUP.RINGKASAN, { ringkas: true }),
      hasil_balai: f('Hasil Balai', GRUP.RINGKASAN, { ringkas: true }),
      kesimpulan: f('Kesimpulan', GRUP.RINGKASAN),
      grading: f('Grading', GRUP.RINGKASAN, { ringkas: true }),
      tindak_lanjut: f('Tindak Lanjut', GRUP.TINDAK, { ringkas: true }),
      catatan: f('Catatan', GRUP.UPT),
      jumlah_sampel_lab: f('Sampel Lab', GRUP.RINGKASAN, { tipe: 'number' }),
      operator: f('Operator', GRUP.BERKAS, { pribadi: true }),
      petugas: f('Petugas', GRUP.BERKAS, { pribadi: true })
    }
  }
};

/** Daftar modul untuk pemilih di UI (tanpa membocorkan nama tabel). */
const daftarModul = () =>
  Object.entries(MODUL).map(([kode, m]) => ({
    kode,
    nama: m.nama,
    jumlah_field: Object.keys(m.kolom).length
  }));

/**
 * Katalog field satu modul, dikelompokkan per grup untuk UI.
 * `terpilih` = saran awal (field `ringkas` dan bukan `pribadi`).
 */
const katalogField = (kodeModul) => {
  const modul = MODUL[kodeModul];
  if (!modul) return null;

  const grup = {};
  for (const [kolom, meta] of Object.entries(modul.kolom)) {
    if (!grup[meta.grup]) grup[meta.grup] = [];
    grup[meta.grup].push({
      kolom,
      label: meta.label,
      pribadi: Boolean(meta.pribadi),
      ringkas: Boolean(meta.ringkas),
      tipe: meta.tipe || 'text',
      terpilih: Boolean(meta.ringkas) && !meta.pribadi
    });
  }

  return {
    kode: kodeModul,
    nama: modul.nama,
    grup: Object.entries(grup).map(([nama, field]) => ({ nama, field })),
    saran_kolom: Object.entries(modul.kolom)
      .filter(([, m]) => m.ringkas && !m.pribadi)
      .map(([k]) => k)
  };
};

/**
 * Validasi pilihan operator → hanya kolom yang ADA di katalog yang lolos.
 * Ini gerbang keamanan: nama kolom dari request tidak pernah masuk SQL
 * sebelum diperiksa di sini.
 */
const validasiKolom = (kodeModul, kolom) => {
  const modul = MODUL[kodeModul];
  if (!modul) return { ok: false, pesan: `Modul tidak dikenal: ${kodeModul}` };

  const daftar = Array.isArray(kolom) ? kolom.map((k) => String(k).trim()) : [];
  const dipilih = [...new Set(daftar)].filter((k) => Object.hasOwn(modul.kolom, k));

  if (!dipilih.length) {
    return { ok: false, pesan: 'Pilih minimal satu field' };
  }
  return { ok: true, kolom: dipilih, modul };
};

module.exports = { MODUL, daftarModul, katalogField, validasiKolom };
