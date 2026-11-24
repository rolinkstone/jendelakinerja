// backend/lib/sampel.js
/**
 * ============================================================
 *  ENGINE MODUL SAMPEL — dipakai bersama oleh semua komoditi
 *  (Obat Tradisional / OT, Suplemen Kesehatan / SK, dan berikutnya)
 * ============================================================
 *
 *  Berkas "REKAP DATA SAMPEL" (export SIPT) untuk setiap komoditi memakai
 *  TATA LETAK YANG SAMA: baris 1-8 identitas, baris 9-10 header dua tingkat,
 *  data mulai baris 11, 55 kolom (A..BC). Karena itu modul baru cukup memanggil
 *  `buatRouterSampel()` dengan nama tabelnya — parser, aturan impor, dan CRUD
 *  tidak perlu ditulis ulang per komoditi.
 *
 *  ATURAN IMPOR (per tahun) — sama dengan modul lain
 *  ---------------------------------------------------
 *  Setiap unggahan terikat pada SATU TAHUN data. Yang dihapus lalu diisi ulang
 *  hanya baris milik tahun tersebut; tahun lain tidak tersentuh.
 *
 *  Tahun ditentukan dengan urutan:
 *    1. field `tahun` pada multipart (dipilih pengguna di UI), bila diisi;
 *    2. deteksi otomatis dari berkas (periode → tanggal sampling → tanggal LHU);
 *    3. gagal → 400, pengguna diminta memilih tahun manual.
 *
 *  SATU SAMPEL BISA BEBERAPA BARIS (ini yang paling mudah salah)
 *  --------------------------------------------------------------
 *  Kolom Kategori (35) dan Komposisi (24) kadang berlanjut ke baris berikutnya
 *  yang TIDAK mengulang nomor/kode sampel. Penanda sampel baru adalah kolom
 *  Sampel (3) yang terisi. Baris lanjutan digabung ke sampel terakhir sebagai
 *  tambahan `kategori` / `komposisi`. Pada berkas OT: 901 baris → 303 sampel;
 *  berkas SK: 134 baris → 62 sampel.
 *
 *  SEMUA endpoint hasil factory ini butuh header `Authorization: Bearer ***
 *  (dipenuhi oleh proxy frontend pages/api/sampel/[...path].js).
 * ============================================================
 */
const express = require('express');
// Akses baca sekarang publik → kolom pribadi dibuang di endpoint detail
const { saringPribadi } = require('./saring-publik');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool } = require('../db');
const { lengkapiBaris } = require('./kinerja');

/** Tahun data yang masuk akal untuk modul ini. */
const TAHUN_MIN = 2000;
const TAHUN_MAX = 2100;

/** Kegiatan yang dipakai kolom turunan `kegiatan` (dibaca view publik). */
const KEGIATAN = 'Sampling';

/**
 * Indeks kolom (0-based) pada baris data — diambil dari header tingkat-2
 * (baris Excel ke-10). Berkas memakai 55 kolom (A..BC).
 *
 * Peta ini berlaku untuk SEMUA komoditi sampel. Jangan menyalin indeks modul
 * sarana: berkas sampel jauh lebih lebar, dan kesimpulan akhir ada di DUA
 * tempat (blok UPT dan blok Pusat).
 */
const KOLOM = {
  // Nomor
  no_urut: 0,
  nama_balai: 1,
  nomor_manual: 2,
  nomor_sampel: 3,          // <- penanda awal sampel baru
  nomor_spu: 4,
  nomor_sp: 5,
  nomor_sps: 6,
  nomor_spk: 7,
  nomor_surat_tugas: 8,
  // Kode sampling
  tgl_sampling: 9,
  bulan_anggaran: 10,
  asal_sampel: 11,
  // Tempat sampling
  kategori_sarana: 12,
  nama_sarana: 13,
  jenis_sarana: 14,
  kab_kota: 15,
  // Tujuan sampling
  tujuan_sampling: 16,
  // Identitas sampel
  jenis_pengujian: 17,
  anggaran_sampling: 18,
  kondisi_sampling: 19,
  nama_sampel: 20,
  brand_produk: 21,
  url_produk: 22,
  cara_perolehan: 23,       // Daring / Luring
  komposisi: 24,
  netto: 25,
  harga: 26,
  bentuk_sediaan: 27,
  no_reg: 28,
  pabrik: 29,
  no_bets: 30,
  keterangan_ed: 31,
  importir: 32,
  // Kolom yang hanya ada di berkas komoditi tertentu (Obat): di berkas OT/SK
  // tidak ada, jadi `null` dan diisi lewat pemetaan judul kolom saat impor.
  kriteria_resiko: null,
  atc: null,
  // Komoditi
  jumlah_sampel: 33,        // mis. "7 Botol" — teks, bukan angka
  komoditi: 34,
  kategori: 35,             // rincian kegunaan; bisa berlanjut ke baris berikutnya
  // Status sampel
  status_sampel: 36,
  operator: 37,
  verifikasi_oleh: 38,
  tgl_status: 39,
  // Informasi UPT
  upt_penyampling: 40,
  upt_penguji: 41,
  // Kesimpulan UPT
  upt_kesimpulan_uji: 42,
  upt_kesimpulan_penandaan: 43,
  upt_kesimpulan_akhir: 44,
  // Kesimpulan Pusat
  pusat_parameter_tms: 45,
  pusat_kesimpulan_uji: 46,
  pusat_kesimpulan_penandaan: 47,
  pusat_kesimpulan_akhir: 48,
  // Tindak lanjut
  jenis_tindak_lanjut: 49,
  nomor_surat: 50,
  tanggal_surat: 51,
  // Metode & tanggal berkas
  metode_pengambilan: 52,
  tgl_spk: 53,
  tgl_lhu: 54,
};

/**
 * Kolom yang teksnya boleh digabung dari baris lanjutan (satu sampel beberapa
 * baris). Selain kolom ini, baris lanjutan diabaikan supaya nilai tidak dobel.
 */
const KOLOM_GABUNG = ['kategori', 'komposisi'];

/**
 * Kolom yang dikirim ke INSERT. `komoditi` DIKELUARKAN karena sudah diisi
 * sebagai kolom turunan — kalau ikut di sini, MySQL menolak dengan
 * "Column 'komoditi' specified twice".
 */
const KOLOM_TURUNAN = ['komoditi'];
const KOLOM_SIMPAN = [
  ...Object.keys(KOLOM).filter((k) => !KOLOM_TURUNAN.includes(k)),
  'kesimpulan_akhir',
  'sumber_kesimpulan',
];

/**
 * Normalisasi kesimpulan. Berkas menulis hasil dalam tiga bentuk: "Memenuhi
 * Syarat", singkatan "MS" (diisi operator pusat), "Tidak Memenuhi Syarat", dan
 * "TMS". Tanpa pemetaan ini, `SUM(kesimpulan_akhir LIKE '%Memenuhi%')`
 * menghasilkan angka yang SALAH: berkas OT 2024 punya 21 baris "MS" yang
 * tertinggal (281 dari 302), berkas SK 2025 punya 7 (55 dari 62).
 */
const MEMENUHI = `UPPER(TRIM(COALESCE(kesimpulan_akhir,''))) IN
  ('MS','MK','MEMENUHI SYARAT','MEMENUHI KRITERIA','MEMENUHI')`;
const TIDAK_MEMENUHI = `UPPER(TRIM(COALESCE(kesimpulan_akhir,''))) IN
  ('TMS','TMK','TIDAK MEMENUHI SYARAT','TIDAK MEMENUHI KRITERIA')`;
const KESIMPULAN_NORMAL = `(CASE
    WHEN ${MEMENUHI} THEN 'Memenuhi Syarat'
    WHEN ${TIDAK_MEMENUHI} THEN 'Tidak Memenuhi Syarat'
    WHEN TRIM(COALESCE(kesimpulan_akhir,'')) = '' THEN '(belum ada kesimpulan)'
    ELSE kesimpulan_akhir END)`;

/**
 * Bentuk baku kesimpulan yang DISIMPAN. Berkas menulis singkatan berbeda per
 * komoditi: OT/SK memakai "MS"/"TMS", Obat memakai "MK"/"TMK". Semua dipetakan
 * ke satu kalimat supaya hitungan, filter, dan tampilan tidak perlu tahu asal
 * komoditinya. Tanda "-" berarti hasil belum ada → disimpan NULL.
 */
const KESIMPULAN_BAKU = {
  MS: 'Memenuhi Syarat',
  MK: 'Memenuhi Syarat',
  'MEMENUHI SYARAT': 'Memenuhi Syarat',
  'MEMENUHI KRITERIA': 'Memenuhi Syarat',
  MEMENUHI: 'Memenuhi Syarat',
  TMS: 'Tidak Memenuhi Syarat',
  TMK: 'Tidak Memenuhi Syarat',
  'TIDAK MEMENUHI SYARAT': 'Tidak Memenuhi Syarat',
  'TIDAK MEMENUHI KRITERIA': 'Tidak Memenuhi Syarat',
};

/** "-" / kosong = belum ada kesimpulan → NULL (ditampilkan "—"). */
function normalkanKesimpulan(nilai) {
  const asli = String(nilai || '').trim();
  if (!asli || asli === '-' || asli === '–' || asli === '—') return null;
  return KESIMPULAN_BAKU[asli.toUpperCase()] || asli;
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Serial tanggal Excel (1900) → Date. Epoch Excel memakai basis 1899-12-30. */
function serialKeTanggal(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}

/** Format tanggal gaya berkas sumber: "16 November 2026". */
function formatTanggal(d) {
  return `${String(d.getUTCDate()).padStart(2, '0')} ${BULAN_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Sisa salah-kode (mojibake) yang sering muncul di export Excel instansi. */
const MOJIBAKE = [
  ['â—', '•'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€“', '–'],
  ['â€”', '—'],
  ['â€', '”'],
  ['Â·', '·'],
  ['Â ', ' '],
];

/** Pulihkan karakter yang ter-salah-kode saat berkas diekspor (mis. "â—" → "•"). */
function rapikanMojibake(s) {
  let hasil = s;
  for (const [dari, ke] of MOJIBAKE) hasil = hasil.split(dari).join(ke);
  return hasil;
}

/**
 * Medan yang boleh menerjemahkan serial angka Excel menjadi tanggal.
 *
 * Hanya medan di daftar ini. Jangan menebak dari rentang angkanya: dulu semua
 * bilangan 20000–80000 dianggap serial tanggal, sehingga harga Rp 40.000
 * (serial 40000) tersimpan sebagai "06 Juli 2009" dan Rp 115.000 sebagai
 * "02 Mei 2018". Kerusakan itu senyap — tidak ada error, nilainya cuma salah.
 */
const MEDAN_TANGGAL = new Set([
  'tgl_sampling',
  'bulan_anggaran',
  'tgl_status',
  'keterangan_ed',
  'tgl_spk',
  'tgl_lhu',
  'tanggal_surat',
]);

/** Nilai sel → teks siap simpan. */
function teks(v, sebagaiTanggal = false) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return formatTanggal(v);
  if (typeof v === 'number') {
    // Sel tanggal Excel tersimpan sebagai serial; terjemahkan hanya kalau
    // medannya memang medan tanggal.
    if (sebagaiTanggal && v > 20000 && v < 80000 && Number.isInteger(v)) {
      return formatTanggal(serialKeTanggal(v));
    }
    return String(v);
  }
  const s = rapikanMojibake(String(v).replace(/\s+/g, ' ').trim());
  return s === '' ? null : s;
}

/** Nilai sel → angka bulat (untuk nomor urut). */
function keAngka(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Ambil tahun (4 digit) terakhir dari sebuah teks, mis. "31 Desember 2024" → 2024.
 * Mengembalikan null bila tidak ada tahun yang wajar.
 */
function tahunDariTeks(nilai) {
  const cocok = String(nilai || '').match(/(?:19|20)\d{2}/g);
  if (!cocok || !cocok.length) return null;
  // Ambil angka PERTAMA, bukan terakhir. Meta "PERIODE SAMPLING" ditulis
  // "01-01-2024 - 01-01-2025" pada berkas Produk Pangan 2024, jadi angka
  // terakhir (2025) adalah batas akhir periode — bukan tahun data. Tahun data
  // selalu di depan rentang.
  const angka = Number(cocok[0]);
  return angka >= TAHUN_MIN && angka <= TAHUN_MAX ? angka : null;
}

/**
 * Tebak tahun data dari isi berkas.
 *
 * Urutan BARU: tanggal sampling terbanyak → tanggal LHU/SPK → meta periode.
 *
 * Kenapa isi didahulukan: meta `PERIODE SAMPLING` bukan penanda tahun data.
 * Berkas "Produk Pangan 2024.xlsx" menulis `01-01-2024 - 01-01-2025` padahal
 * seluruh sampelnya bertanggal September 2024; kalau meta dibaca lebih dulu,
 * 631 sampel 2024 tersimpan sebagai tahun 2025 — salah tahun, tanpa error.
 *
 * `tgl_sampling` diberi bobot 3 karena itu tanggal kegiatan yang sebenarnya;
 * `tgl_lhu`/`tgl_spk` bisa jatuh di tahun berikutnya (sampling Desember 2024,
 * LHU Januari 2025). Tahun = yang bobotnya terbesar.
 */
function deteksiTahun(hasil) {
  const hitung = new Map();
  const tambah = (nilai, bobot) => {
    const t = tahunDariTeks(nilai);
    if (t) hitung.set(t, (hitung.get(t) || 0) + bobot);
  };
  for (const l of hasil.laporan) {
    tambah(l.tgl_sampling, 3);
    tambah(l.tgl_lhu, 1);
    tambah(l.tgl_spk, 1);
  }
  if (hitung.size) {
    let terpilih = null;
    let maks = 0;
    for (const [t, jumlah] of hitung) {
      if (jumlah > maks) {
        maks = jumlah;
        terpilih = t;
      }
    }
    return terpilih;
  }

  // Cadangan terakhir: meta periode (angka pertama = tahun awal periode).
  for (const teksMeta of [hasil.meta.periode_awal, hasil.meta.periode_akhir]) {
    const t = tahunDariTeks(teksMeta);
    if (t) return t;
  }
  return null;
}

/** Query `?tahun=` → angka tahun, atau null (= semua tahun). */
function bacaTahunQuery(nilai) {
  const s = String(nilai ?? '').trim();
  if (!s || s === 'semua') return { tahun: null };
  if (!/^\d{4}$/.test(s)) return { galat: 'Parameter tahun harus 4 digit (mis. 2024)' };
  const angka = Number(s);
  if (angka < TAHUN_MIN || angka > TAHUN_MAX) {
    return { galat: `Tahun harus di antara ${TAHUN_MIN} dan ${TAHUN_MAX}` };
  }
  return { tahun: angka };
}

/** Ambil nilai sel sebuah baris pada indeks kolom tertentu. */
function bacaSel(baris, idx) {
  return baris && baris[idx] !== undefined ? baris[idx] : null;
}

/**
 * Pemetaan kolom BERBASIS JUDUL, bukan indeks tetap.
 *
 * Alasannya nyata: berkas "Obat 2025.xlsx" memakai 59 kolom dengan dua kolom
 * tambahan ("Kriteria Resiko", "ATC") sehingga seluruh kolom setelah
 * "Kabupaten/Kota" bergeser satu ke kanan, dan "Jenis Sarana" tidak ada sama
 * sekali. Peta indeks tetap akan memasukkan data ke kolom yang salah TANPA
 * error apa pun — jenis yang paling sulit dilacak. Karena itu judul kolom
 * dibaca dari header (baris 9 = kelompok, baris 10 = nama kolom), lalu
 * dicocokkan ke nama medan; indeks tetap (`KOLOM`) hanya dipakai sebagai
 * cadangan bila berkas sama sekali tidak dikenali.
 */

/** Judul kolom (ternormalisasi) → nama medan. Satu judul = satu medan. */
const SINONIM_KOLOM = {
  no: 'no_urut',
  'balai / unit': 'nama_balai',
  unit: 'nama_balai',
  'nomor manual': 'nomor_manual',
  sampel: 'nomor_sampel',
  spu: 'nomor_spu',
  sp: 'nomor_sp',
  sps: 'nomor_sps',
  spk: 'nomor_spk',
  'nomor surat tugas': 'nomor_surat_tugas',
  'tanggal sampling': 'tgl_sampling',
  'bulan anggaran': 'bulan_anggaran',
  'asal sampel': 'asal_sampel',
  'kategori sarana': 'kategori_sarana',
  'nama sarana': 'nama_sarana',
  'jenis sarana': 'jenis_sarana',
  'kabupaten/kota': 'kab_kota',
  'tujuan sampling': 'tujuan_sampling',
  pengujian: 'jenis_pengujian',
  'jenis pengujian': 'jenis_pengujian',
  'anggaran sampling': 'anggaran_sampling',
  'kriteria resiko': 'kriteria_resiko',
  'kriteria risiko': 'kriteria_resiko',
  'kondisi sampling': 'kondisi_sampling',
  'nama sampel': 'nama_sampel',
  'brand produk': 'brand_produk',
  brand: 'brand_produk',
  'url produk': 'url_produk',
  'daring/luring': 'cara_perolehan',
  'cara perolehan': 'cara_perolehan',
  komposisi: 'komposisi',
  netto: 'netto',
  harga: 'harga',
  'bentuk sediaan': 'bentuk_sediaan',
  'no reg': 'no_reg',
  atc: 'atc',
  pabrik: 'pabrik',
  'no bets': 'no_bets',
  'keterangan ed': 'keterangan_ed',
  importir: 'importir',
  'jumlah sampel': 'jumlah_sampel',
  komoditi: 'komoditi',
  kategori: 'kategori',
  status: 'status_sampel',
  operator: 'operator',
  'verifikasi oleh': 'verifikasi_oleh',
  tanggal: 'tgl_status',
  'upt penyampling': 'upt_penyampling',
  'upt penguji': 'upt_penguji',
  'jenis tindak lanjut': 'jenis_tindak_lanjut',
  'nomor surat': 'nomor_surat',
  'tanggal surat': 'tanggal_surat',
  'metode pengambilan sampel': 'metode_pengambilan',
  'metode pengambilan': 'metode_pengambilan',
  'tanggal spk': 'tgl_spk',
  'tanggal lhu': 'tgl_lhu',
};

/** Judul kolom → teks kunci: huruf kecil, tanpa titik, spasi dirapikan. */
function kunciJudul(nilai) {
  return String(nilai ?? '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Judul kolom + kelompoknya → nama medan.
 *
 * "Kesimpulan Uji", "Kesimpulan Penandaan", dan "Kesimpulan Akhir" muncul DUA
 * KALI (blok UPT dan blok Pusat) dengan judul yang sama persis, jadi kelompok
 * dari header baris 9 yang membedakan.
 */
function medanDariJudul(judul, kelompok) {
  const langsung = SINONIM_KOLOM[judul];
  if (langsung) return langsung;
  const pusat = kelompok.includes('PUSAT');
  if (judul.startsWith('kesimpulan uji')) return pusat ? 'pusat_kesimpulan_uji' : 'upt_kesimpulan_uji';
  if (judul.startsWith('kesimpulan penandaan')) {
    return pusat ? 'pusat_kesimpulan_penandaan' : 'upt_kesimpulan_penandaan';
  }
  if (judul.startsWith('kesimpulan akhir')) {
    return pusat ? 'pusat_kesimpulan_akhir' : 'upt_kesimpulan_akhir';
  }
  if (judul === 'parameter tms') return 'pusat_parameter_tms';
  return null;
}

/** Susun peta medan → indeks dari header berkas, DUA LANGKAH:
 *
 *   1. Kolom yang punya judul sendiri dipetakan lewat judulnya (sumber utama).
 *   2. Kolom tanpa judul dipetakan lewat JUDUL KELOMPOK — tetapi hanya kalau
 *      kolom itu belum dipakai medan lain. Excel menggabungkan sel judul, dan
 *      penggabungan itu kerap menghapus judul kolom di bawahnya ("No",
 *      "Kategori", "Tujuan Sampling").
 *
 * Langkah 2 harus memeriksa kolom yang sudah terpakai. Buktinya berkas
 * Obat 2025: kelompok "Tujuan Sampling" menaungi kolom tanpa judul yang isinya
 * justru Jenis Sarana ("Sarana Berizin » Obat JKN"). Kolom itu sudah dipaku
 * sebagai jenis_sarana oleh konfigurasi modul, sehingga langkah 2 melewatinya
 * dan tujuan_sampling dibiarkan kosong — lebih baik kosong daripada salah isi.
 */
/**
 * PETUNJUK NILAI — dipakai HANYA untuk kolom tanpa judul.
 *
 * Kolom tanpa judul yang sama bisa berisi medan berbeda antar berkas, padahal
 * kelompoknya sama. Bukti nyata berkas Obat:
 *   - Obat 2025 kolom 15: "Sarana Berizin » Obat JKN"   → jenis_sarana
 *   - Obat 2024 kolom 15: "Acak » NON JKN"              → tujuan_sampling
 * Keduanya duduk di bawah kelompok "Tujuan Sampling" tanpa judul kolom. Kalau
 * dipercaya kelompoknya saja, tahun 2025 salah; kalau dipaku jenis_sarana,
 * tahun 2024 salah ("Targeted » Risk Based (…)" 211 karakter masuk ke kolom
 * jenis sarana → impor gagal "Data too long for column 'jenis_sarana'").
 * Jadi isi kolomnya yang menentukan.
 */
const PETUNJUK_NILAI = [
  { medan: 'jenis_sarana', pola: /^(sarana berizin|sarana tidak berizin|belum berizin|sarana produksi|sarana distribusi)/i },
  { medan: 'tujuan_sampling', pola: /^(targeted|acak|purposive|random|klaim|sampling)/i },
];

/** Tebak medan dari isi kolom; null bila tidak ada yang cocok. */
function medanDariNilai(contohNilai) {
  if (!contohNilai || !contohNilai.length) return null;
  const skor = new Map();
  for (const nilai of contohNilai) {
    for (const { medan, pola } of PETUNJUK_NILAI) {
      if (pola.test(String(nilai).trim())) skor.set(medan, (skor.get(medan) || 0) + 1);
    }
  }
  if (!skor.size) return null;
  // Menang kalau mayoritas nilai yang terbaca cocok pola itu.
  const [medan, jumlah] = [...skor.entries()].sort((a, b) => b[1] - a[1])[0];
  return jumlah >= Math.ceil(contohNilai.length / 2) ? medan : null;
}

function petaKolomDariHeader(kolKelompok, kolJudul, kolomPaku = {}, contohNilai = null) {
  const maks = Math.max(kolKelompok.length, kolJudul.length);
  const kelompokKolom = [];
  let kelompokSekarang = '';
  for (let j = 0; j < maks; j += 1) {
    const k = kunciJudul(kolKelompok[j]);
    if (k) kelompokSekarang = k.toUpperCase();
    kelompokKolom[j] = kelompokSekarang;
  }

  const peta = {};
  const kolomTerpakai = new Set();

  // Kolom yang dipaku konfigurasi modul dianggap sudah dipakai, supaya langkah 2
  // tidak memetakan kolom yang sama ke medan lain.
  for (const [medan, idx] of Object.entries(kolomPaku)) {
    if (Number.isInteger(idx)) {
      peta[medan] = idx;
      kolomTerpakai.add(idx);
    }
  }

  // --- langkah 1: judul kolom sendiri ---
  for (let j = 0; j < maks; j += 1) {
    const judul = kunciJudul(kolJudul[j]);
    if (!judul) continue;
    const medan = medanDariJudul(judul, kelompokKolom[j] || '');
    if (!medan || peta[medan] !== undefined) continue;
    peta[medan] = j;
    kolomTerpakai.add(j);
  }

  // --- langkah 2: kolom tanpa judul ---
  // Medannya ditentukan oleh ISI kolom lebih dulu; judul kelompok cuma cadangan.
  for (let j = 0; j < maks; j += 1) {
    if (kolomTerpakai.has(j) || kunciJudul(kolJudul[j])) continue;
    const dariNilai = contohNilai ? medanDariNilai(contohNilai(j)) : null;
    const dariKelompok = SINONIM_KOLOM[kunciJudul(kolKelompok[j])];
    const medan = dariNilai || dariKelompok;
    if (!medan || peta[medan] !== undefined) continue;
    peta[medan] = j;
    kolomTerpakai.add(j);
  }

  return peta;
}

/** Jumlah medan yang harus dikenali agar peta header dianggap sahih. */
const MIN_MEDAN_TERDETEKSI = 25;

/**
 * Baca workbook → { meta, laporan[], jumlahBaris }.
 *
 * Penggabungan baris: setiap kali kolom `nomor_sampel` terisi, itu sampel baru.
 * Baris berikutnya yang tidak punya nomor sampel dianggap lanjutan — hanya
 * kolom `kategori` dan `komposisi` yang ikut ditambahkan.
 */
function bacaWorkbook(buffer, kolomPaku = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const namaSheet = wb.SheetNames[0];
  const ws = wb.Sheets[namaSheet];
  if (!ws) throw new Error('Berkas tidak berisi sheet apa pun');

  const baris = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });

  // Cari baris header: baris yang kolom A-nya "No" (tanpa titik).
  const idxHeader = baris.findIndex(
    (r) => r && String(r[0] || '').replace(/\./g, '').trim().toLowerCase() === 'no',
  );
  if (idxHeader < 0) throw new Error('Baris header ("No") tidak ditemukan di berkas');

  // Identitas berkas ada di kolom C (indeks 2) untuk label di kolom A.
  const label = {};
  for (let i = 0; i < idxHeader; i++) {
    const kunci = String(bacaSel(baris[i], 0) || '').trim().toUpperCase();
    const nilai = teks(bacaSel(baris[i], 2));
    if (kunci && nilai) label[kunci] = nilai;
  }

  // Label unit tidak seragam antar komoditi: berkas OT menulis
  // "UNIT / BALAI BESAR / BALAI / LOKA POM", berkas SK hanya sampai ".../LAKA".
  // Jadi dicari lewat awalan, bukan dicocokkan persis.
  const kunciUnit = Object.keys(label).find((k) => k.startsWith('UNIT')) || 'UNIT';

  const meta = {
    sheet: namaSheet,
    komoditi: label['KOMODITI'] || null,
    periode_awal: label['PERIODE SAMPLING'] || null,
    periode_akhir: label['PERIODE SAMPLING'] || null,
    balai: label[kunciUnit] || null,
    anggaran_sampling: label['ANGGARAN SAMPLING'] || null,
    tujuan_sampling: label['TUJUAN SAMPLING'] || null,
    asal_sampling: label['ASAL SAMPLING'] || null,
  };

  // --- Pemetaan kolom dari judul header (lihat petaKolomDariHeader) ---
  const kolHeader = baris[idxHeader] || [];
  const kolBawah = baris[idxHeader + 1] || [];
  // Contoh nilai dipakai untuk menebak kolom tanpa judul (lihat PETUNJUK_NILAI).
  const barisDataPertama = idxHeader + 2;
  const contohNilai = (j) => {
    const keluar = [];
    for (let i = barisDataPertama; i < baris.length && keluar.length < 30; i += 1) {
      const nilai = teks(bacaSel(baris[i], j));
      if (nilai) keluar.push(nilai);
    }
    return keluar;
  };
  const dariHeader = petaKolomDariHeader(kolHeader, kolBawah, kolomPaku, contohNilai);
  const jumlahTerdeteksi = Object.keys(dariHeader).length;

  // Kalau berkas tidak dikenali sama sekali (judul kolom berbeda total),
  // lebih baik memakai peta indeks lama daripada menebak: modul lama tetap
  // berjalan, dan pengguna melihat pesan peringatan di ringkasan impor.
  const pakaiHeader = jumlahTerdeteksi >= MIN_MEDAN_TERDETEKSI;

  // Kalau peta header dipakai, medan yang TIDAK ditemukan dibiarkan kosong.
  // Jangan jatuh ke indeks tetap: berkas Obat tidak punya kolom "Tujuan
  // Sampling", dan indeks cadangan 16 di sana berisi "Pengujian" — nilai
  // "Rutin" akan salah tersimpan sebagai tujuan sampling.
  const AKTIF = pakaiHeader
    ? { ...Object.fromEntries(Object.keys(KOLOM).map((k) => [k, null])), ...dariHeader }
    : { ...KOLOM };
  const iSampel = AKTIF.nomor_sampel;

  const laporan = [];
  let sekarang = null;
  let jumlahBaris = 0;

  for (let i = idxHeader + 2; i < baris.length; i += 1) {
    const r = baris[i] || [];
    const kosong = !r.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
    if (kosong) continue;
    jumlahBaris += 1;

    const nomorSampel = teks(bacaSel(r, iSampel >= 0 ? iSampel : KOLOM.nomor_sampel));

    if (nomorSampel) {
      // ---- sampel baru ----
      const baru = {};
      Object.entries(AKTIF).forEach(([kol, idx]) => {
        baru[kol] = teks(bacaSel(r, idx), MEDAN_TANGGAL.has(kol));
      });
      baru.no_urut = keAngka(bacaSel(r, AKTIF.no_urut));
      laporan.push(baru);
      sekarang = baru;
    } else if (sekarang) {
      // ---- baris lanjutan: hanya kolom gabung yang boleh menambah ----
      for (const kol of KOLOM_GABUNG) {
        const tambahan = teks(bacaSel(r, AKTIF[kol]), MEDAN_TANGGAL.has(kol));
        if (!tambahan) continue;
        if (!sekarang[kol]) sekarang[kol] = tambahan;
        else if (!sekarang[kol].includes(tambahan)) sekarang[kol] += `\n${tambahan}`;
      }
    }
    // Baris lanjutan tanpa sampel sebelumnya (mis. baris cacat) diabaikan.
  }

  // Nilai akhir yang dipakai modul lain: kesimpulan pusat bila ada, kalau tidak
  // kesimpulan UPT. Disimpan sebagai kolom tersendiri supaya bisa difilter SQL.
  // Kolom asli blok UPT/Pusat dibiarkan apa adanya; hanya `kesimpulan_akhir`
  // (kolom turunan yang dipakai semua hitungan) yang dibakukan.
  for (const l of laporan) {
    if (normalkanKesimpulan(l.pusat_kesimpulan_akhir)) {
      l.kesimpulan_akhir = normalkanKesimpulan(l.pusat_kesimpulan_akhir);
      l.sumber_kesimpulan = 'Pusat';
    } else if (normalkanKesimpulan(l.upt_kesimpulan_akhir)) {
      l.kesimpulan_akhir = normalkanKesimpulan(l.upt_kesimpulan_akhir);
      l.sumber_kesimpulan = 'UPT';
    } else {
      l.kesimpulan_akhir = null;
      l.sumber_kesimpulan = null;
    }
  }

  return { meta, laporan, jumlahBaris, kolom: { dari_header: pakaiHeader, terdeteksi: jumlahTerdeteksi } };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

/**
 * Buat router Express untuk satu komoditi sampel.
 *
 * @param {object} opsi
 * @param {string} opsi.label       label manusia, mis. 'Sampel Suplemen Kesehatan'
 * @param {string} opsi.tabelImpor  nama tabel metadata impor
 * @param {string} opsi.tabelLaporan nama tabel sampel
 */
function buatRouterSampel({ label, tabelImpor, tabelLaporan, kolomPaku = {} }) {
  const router = express.Router();
  const T = { impor: tabelImpor, laporan: tabelLaporan };

  /**
   * Hapus data SATU tahun (sampel + metadata impor).
   * FK <tabel_laporan> → <tabel_impor> ON DELETE CASCADE, jadi sampel ikut.
   */
  async function hapusTahun(conn, tahun) {
    await conn.query(`DELETE FROM ${T.laporan} WHERE tahun = ?`, [tahun]);
    const [hasilImpor] = await conn.query(`DELETE FROM ${T.impor} WHERE tahun = ?`, [tahun]);
    return hasilImpor.affectedRows || 0;
  }

  /** Hitung isi satu tahun SEBELUM diganti (untuk pesan ke pengguna). */
  async function hitungTahun(conn, tahun) {
    const [[row]] = await conn.query(
      `SELECT COUNT(*) AS n FROM ${T.laporan} WHERE tahun = ?`, [tahun],
    );
    return { laporan: Number(row?.n || 0), rincian: 0 };
  }

  /** Kosongkan SELURUH isi tabel modul ini (dipakai DELETE /data tanpa tahun). */
  async function kosongkan(conn) {
    await conn.query(`DELETE FROM ${T.laporan}`);
    await conn.query(`DELETE FROM ${T.impor}`);
  }

  // -------------------------------------------------------------------------
  // POST /import — unggah Excel, GANTI data tahun terpilih
  //   multipart: berkas (file), tahun (opsional, 4 digit; kosong = otomatis)
  // -------------------------------------------------------------------------
  router.post('/import', (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err) {
        const pesan = err.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran berkas melebihi 15 MB'
          : `Gagal membaca unggahan: ${err.message}`;
        return res.status(400).json({ success: false, message: pesan });
      }
      return next();
    });
  }, async (req, res) => {
    const berkas = (req.files || [])[0];
    if (!berkas) {
      return res.status(400).json({ success: false, message: 'Tidak ada berkas yang diunggah' });
    }

    const ekstensi = (berkas.originalname.split('.').pop() || '').toLowerCase();
    if (!['xlsx', 'xls', 'xlsm'].includes(ekstensi)) {
      return res.status(400).json({
        success: false,
        message: 'Format berkas harus .xlsx / .xls / .xlsm',
      });
    }

    const tahunMentah = String((req.body && req.body.tahun) || '').trim();
    let tahunPilihan = null;
    if (tahunMentah && tahunMentah.toLowerCase() !== 'otomatis') {
      if (!/^\d{4}$/.test(tahunMentah)) {
        return res.status(400).json({ success: false, message: 'Tahun data harus 4 digit (mis. 2024)' });
      }
      tahunPilihan = Number(tahunMentah);
      if (tahunPilihan < TAHUN_MIN || tahunPilihan > TAHUN_MAX) {
        return res.status(400).json({
          success: false,
          message: `Tahun data harus di antara ${TAHUN_MIN} dan ${TAHUN_MAX}`,
        });
      }
    }

    let hasil;
    try {
      hasil = bacaWorkbook(berkas.buffer, kolomPaku);
    } catch (e) {
      return res.status(400).json({ success: false, message: `Berkas gagal dibaca: ${e.message}` });
    }

    // ------------------------------------------------------------------
    // Tahun KOSONG (0 sampel).
    //
    // Dulu ini SELALU ditolak 400. Akibatnya tahun yang memang tidak ada
    // kegiatannya (mis. Kemasan Pangan 2025) tidak pernah bisa terdaftar,
    // sehingga grafik "sampel per tahun" melompat 2024 → 2026 dan pembaca
    // mengira 2025 hilang datanya/belum diunggah.
    //
    // Sekarang: impor kosong DIIZINKAN asalkan tahunnya dipilih manual di UI
    // (tidak ada isi untuk dideteksi) dan berkasnya masih berbentuk rekap
    // sampel (header kolom dikenali). Baris laporan tidak dibuat; yang dicatat
    // hanya baris `*_import` dengan jumlah_sampel = 0 — itulah yang membuat
    // tahun tetap muncul di daftar dan di rekap per tahun.
    // ------------------------------------------------------------------
    const berkasKosong = hasil.laporan.length === 0;

    if (berkasKosong && !hasil.kolom.dari_header) {
      return res.status(400).json({
        success: false,
        message:
          'Tidak ada baris sampel yang terbaca dan header berkas tidak dikenali. ' +
          'Pastikan berkas memakai format rekap data sampel yang benar.',
      });
    }

    if (berkasKosong && tahunPilihan === null) {
      return res.status(400).json({
        success: false,
        message:
          'Berkas ini tidak berisi sampel, jadi tahunnya tidak bisa dibaca otomatis. ' +
          'Pilih tahun data secara manual (bukan "Otomatis") lalu unggah ulang untuk mendaftarkan tahun kosong.',
      });
    }

    if (!hasil.kolom.dari_header) {
      console.warn(
        `[${label}] Judul kolom berkas tidak dikenali (${hasil.kolom.terdeteksi} medan). ` +
          'Impor memakai peta indeks cadangan — periksa kembali hasilnya.',
      );
    }

    const tahunTerdeteksi = deteksiTahun(hasil);
    const tahun = tahunPilihan ?? tahunTerdeteksi;
    if (!tahun) {
      return res.status(400).json({
        success: false,
        message: 'Tahun data tidak bisa dideteksi dari berkas. Pilih tahun data secara manual lalu unggah ulang.',
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const sebelum = await hitungTahun(conn, tahun);
      await hapusTahun(conn, tahun);

      const [imp] = await conn.query(
        `INSERT INTO ${T.impor}
          (tahun, berkas, sheet, komoditi, periode_awal, periode_akhir, balai,
           anggaran_sampling, tujuan_sampling, asal_sampling,
           jumlah_sampel, jumlah_baris, diunggah_oleh)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          tahun, berkas.originalname, hasil.meta.sheet, hasil.meta.komoditi,
          hasil.meta.periode_awal, hasil.meta.periode_akhir, hasil.meta.balai,
          hasil.meta.anggaran_sampling, hasil.meta.tujuan_sampling, hasil.meta.asal_sampling,
          hasil.laporan.length, hasil.jumlahBaris,
          req.user?.name || req.user?.username || null,
        ],
      );

      // Kolom turunan (kegiatan/komoditi/bulan) sudah menjadi kolom tersendiri di
      // tabel, jadi jangan diulang di daftar KOLOM_SIMPAN.
      const sqlSampel = `INSERT INTO ${T.laporan}
        (import_id, tahun, kegiatan, komoditi, bulan, ${KOLOM_SIMPAN.join(', ')})
       VALUES (?, ?, ?, ?, ?, ${KOLOM_SIMPAN.map(() => '?').join(', ')})`;

      for (const l of hasil.laporan) {
        // Bulan diambil dari tanggal sampel (lib/kinerja.js); kegiatan untuk modul
        // ini selalu "Sampling" — berkas sampel tidak memeriksa sarana.
        const bulan = lengkapiBaris(l, hasil.meta.komoditi).bulan;
        const nilai = [
          imp.insertId, tahun, KEGIATAN, l.komoditi ?? hasil.meta.komoditi, bulan,
          ...KOLOM_SIMPAN.map((k) => l[k] ?? null),
        ];
        await conn.query(sqlSampel, nilai);
      }

      await conn.commit();

      const pengganti = sebelum.laporan > 0
        ? `menggantikan ${sebelum.laporan} sampel tahun ${tahun}`
        : `data tahun ${tahun} sebelumnya kosong`;

      // Tahun tanpa sampel tetap DICATAT lewat baris import ini (jumlah_sampel=0),
      // supaya muncul di daftar tahun & grafik per tahun sebagai "0".
      const pesan = berkasKosong
        ? `Tahun ${tahun} didaftarkan dengan 0 sampel (${pengganti}). ` +
          'Tahun ini sekarang ikut terhitung di rekap per tahun. Tahun lain tidak diubah.'
        : `Impor selesai — ${hasil.laporan.length} sampel untuk tahun ${tahun} (${pengganti}). Tahun lain tidak diubah.`;

      return res.json({
        success: true,
        message: pesan,
        data: {
          import_id: imp.insertId,
          tahun,
          tahun_terdeteksi: tahunTerdeteksi,
          tahun_dipilih_manual: tahunPilihan !== null,
          berkas: berkas.originalname,
          meta: hasil.meta,
          jumlah_sampel: hasil.laporan.length,
          jumlah_baris: hasil.jumlahBaris,
          kolom: hasil.kolom,
          sebelumnya: sebelum,
          tahun_kosong: berkasKosong,
        },
      });
    } catch (e) {
      await conn.rollback();
      console.error(`Impor ${label} gagal:`, e);
      return res.status(500).json({
        success: false,
        message: `Impor gagal, data lama tidak diubah: ${e.message}`,
      });
    } finally {
      conn.release();
    }
  });

  // -------------------------------------------------------------------------
  // GET /summary?tahun=2024 — metadata + rekap
  // -------------------------------------------------------------------------
  router.get('/summary', async (req, res) => {
    const { tahun, galat } = bacaTahunQuery(req.query.tahun);
    if (galat) return res.status(400).json({ success: false, message: galat });

    const p = tahun ? [tahun] : [];
    const where = tahun ? 'WHERE tahun = ?' : '';

    try {
      const [imp] = await pool.query(
        `SELECT * FROM ${T.impor} ${where} ORDER BY id DESC LIMIT 1`, p,
      );

      const [tot] = await pool.query(
        `SELECT
           COUNT(*) AS total_sampel,
           COALESCE(SUM(${TIDAK_MEMENUHI}),0) AS tidak_memenuhi,
           COALESCE(SUM(${MEMENUHI}),0) AS memenuhi,
           COUNT(DISTINCT kab_kota) AS jumlah_kab,
           COUNT(DISTINCT nama_sarana) AS jumlah_sarana,
           COUNT(DISTINCT nama_sampel) AS jumlah_produk
         FROM ${T.laporan} ${where}`,
        p,
      );

      // Kesimpulan akhir (blok Pusat bila terisi, kalau tidak blok UPT).
      const [kesimpulan] = await pool.query(
        `SELECT ${KESIMPULAN_NORMAL} AS label, COUNT(*) AS jumlah
           FROM ${T.laporan} ${where}
          GROUP BY label ORDER BY jumlah DESC`,
        p,
      );

      // Bentuk sediaan terbanyak — ciri khas data sampel.
      const [sediaan] = await pool.query(
        `SELECT COALESCE(NULLIF(bentuk_sediaan,''),'-') AS label, COUNT(*) AS jumlah
           FROM ${T.laporan} ${where}
          GROUP BY label ORDER BY jumlah DESC LIMIT 12`,
        p,
      );

      const [tujuan] = await pool.query(
        `SELECT COALESCE(NULLIF(tujuan_sampling,''),'-') AS label, COUNT(*) AS jumlah
           FROM ${T.laporan} ${where}
          GROUP BY label ORDER BY jumlah DESC`,
        p,
      );

      const [perKab] = await pool.query(
        `SELECT COALESCE(NULLIF(kab_kota,''),'(tidak tercatat)') AS kab_kota,
                COUNT(*) AS jumlah,
                COALESCE(SUM(${TIDAK_MEMENUHI}),0) AS tidak_memenuhi
           FROM ${T.laporan} ${where}
          GROUP BY kab_kota ORDER BY jumlah DESC`,
        p,
      );

      const [daftarTahun] = await pool.query(
        `SELECT t.tahun,
                (SELECT COUNT(*) FROM ${T.laporan} l WHERE l.tahun = t.tahun) AS jumlah_sampel,
                0 AS jumlah_rincian,
                (SELECT i.berkas FROM ${T.impor} i WHERE i.tahun = t.tahun ORDER BY i.id DESC LIMIT 1) AS berkas_terakhir,
                (SELECT i.diunggah_pada FROM ${T.impor} i WHERE i.tahun = t.tahun ORDER BY i.id DESC LIMIT 1) AS diunggah_terakhir
           FROM (SELECT tahun FROM ${T.laporan} WHERE tahun IS NOT NULL
                 UNION
                 SELECT tahun FROM ${T.impor} WHERE tahun IS NOT NULL) t
          ORDER BY t.tahun DESC`,
      );

      return res.json({
        success: true,
        data: {
          tahun,
          impor_terakhir: imp[0] || null,
          total: tot[0],
          sebaran_kesimpulan: kesimpulan,
          sebaran_sediaan: sediaan,
          sebaran_tujuan: tujuan,
          per_kab_kota: perKab,
          daftar_tahun: daftarTahun,
        },
      });
    } catch (e) {
      console.error(`Summary ${label} gagal:`, e);
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // -------------------------------------------------------------------------
  // GET /sampel?tahun=&q=&page=&kesimpulan= — daftar sampel
  // -------------------------------------------------------------------------
  router.get('/sampel', async (req, res) => {
    const { tahun, galat } = bacaTahunQuery(req.query.tahun);
    if (galat) return res.status(400).json({ success: false, message: galat });

    const q = String(req.query.q || '').trim();
    const kesimpulan = String(req.query.kesimpulan || '').trim();
    const halaman = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (halaman - 1) * limit;

    const syarat = [];
    const params = [];
    if (tahun) {
      syarat.push('tahun = ?');
      params.push(tahun);
    }
    if (kesimpulan) {
      // "MS" dan "Memenuhi Syarat" adalah hasil yang sama; begitu juga "TMS".
      // Tanpa penyamaan ini, memilih salah satu menyembunyikan separuh data.
      const k = kesimpulan.trim().toUpperCase();
      if (k === 'MS' || k === 'MEMENUHI SYARAT' || k === 'MEMENUHI') {
        syarat.push(MEMENUHI);
      } else if (k === 'TMS' || k === 'TIDAK MEMENUHI SYARAT') {
        syarat.push(TIDAK_MEMENUHI);
      } else {
        syarat.push('kesimpulan_akhir = ?');
        params.push(kesimpulan);
      }
    }
    if (q) {
      syarat.push(`(nama_sampel LIKE ? OR nomor_sampel LIKE ? OR nama_sarana LIKE ?
                    OR kab_kota LIKE ? OR pabrik LIKE ? OR no_reg LIKE ?
                    OR brand_produk LIKE ? OR bentuk_sediaan LIKE ?)`);
      params.push(...Array(8).fill(`%${q}%`));
    }
    const where = syarat.length ? `WHERE ${syarat.join(' AND ')}` : '';

    try {
      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM ${T.laporan} ${where}`, params,
      );
      const [rows] = await pool.query(
        `SELECT id, tahun, no_urut, nomor_sampel, tgl_sampling, kab_kota, nama_sarana,
                jenis_sarana, nama_sampel, brand_produk, bentuk_sediaan, no_reg, pabrik,
                netto, jumlah_sampel, tujuan_sampling, kesimpulan_akhir, sumber_kesimpulan
           FROM ${T.laporan} ${where}
          ORDER BY no_urut ASC, id ASC
          LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      return res.json({
        success: true,
        data: { rows, total, page: halaman, limit, total_halaman: Math.ceil(total / limit) || 1, tahun },
      });
    } catch (e) {
      console.error(`Daftar ${label} gagal:`, e);
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // -------------------------------------------------------------------------
  // GET /sampel/:id — satu sampel lengkap
  // -------------------------------------------------------------------------
  router.get('/sampel/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'ID sampel tidak valid' });
    }
    try {
      const [rows] = await pool.query(`SELECT * FROM ${T.laporan} WHERE id = ?`, [id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, message: 'Sampel tidak ditemukan' });
      }
      return res.json({ success: true, data: saringPribadi({ ...rows[0], rincian: [] }) });
    } catch (e) {
      console.error(`Detail ${label} gagal:`, e);
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /data?tahun=2024 — kosongkan satu tahun (= semua)
  // -------------------------------------------------------------------------
  router.delete('/data', async (req, res) => {
    const { tahun, galat } = bacaTahunQuery(req.query.tahun);
    if (galat) return res.status(400).json({ success: false, message: galat });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (tahun) {
        const sebelum = await hitungTahun(conn, tahun);
        await hapusTahun(conn, tahun);
        await conn.commit();
        return res.json({
          success: true,
          message: `Data tahun ${tahun} dihapus (${sebelum.laporan} sampel). Tahun lain tidak diubah.`,
        });
      }
      await kosongkan(conn);
      await conn.commit();
      return res.json({
        success: true,
        message: `Seluruh data ${label} (semua tahun) sudah dihapus.`,
      });
    } catch (e) {
      await conn.rollback();
      console.error(`Hapus data ${label} gagal:`, e);
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      conn.release();
    }
  });

  return router;
}

module.exports = { buatRouterSampel, bacaWorkbook, deteksiTahun, KOLOM, TAHUN_MIN, TAHUN_MAX };
