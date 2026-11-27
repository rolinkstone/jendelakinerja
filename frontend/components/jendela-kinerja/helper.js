// components/jendela-kinerja/helper.js
/**
 * HELPER DASHBOARD PUBLIK "JENDELA KINERJA"
 * -----------------------------------------
 * Konstanta + formatter. TANPA state, TANPA pemanggilan API (konvensi modul).
 * Geometri kab/kota ikut di-bundle (frontend/data/kalteng-kabupaten.json,
 * hasil penyederhanaan GeoJSON batas administrasi \u2192 path SVG).
 */
import geometri from '../../data/kalteng-kabupaten.json';

export const PETA = geometri;

export const JUDUL = 'Jendela Kinerja';
export const SUBJUDUL =
  'Pengawasan Sarana Produksi dan Distribusi Obat dan Makanan di Wilayah Kerja Balai Besar POM di Palangka Raya';

export const FILTER_KOSONG = {
  tahun: '',
  bulan: '',
  kegiatan: '',
  jenis: '',
  kab: '',
};

/** Nama kab/kota untuk label peta/daftar \u2014 tanpa awalan "Kabupaten/Kota". */
export function namaPendek(nama) {
  return String(nama || '')
    .replace(/^Kabupaten\s+/i, '')
    .replace(/^Kota\s+/i, '')
    .trim();
}

/**
 * WILAYAH KERJA UPT \u2014 dikelompokkan per unit.
 * -----------------------------------------------------------------
 * Loka POM Kotawaringin Barat membawahi empat kabupaten, jadi di peta keempat
 * wilayah itu diberi SATU warna (bukan skala jumlah sarana) supaya batas
 * wilayah kerjanya terbaca sekali lihat. Wilayah lain tetap memakai skala
 * hijau\u2192biru seperti biasa.
 *
 * Nama HARUS sama dengan nama di data/kalteng-kabupaten.json, karena
 * pencocokannya memakai nama penuh ("Kabupaten ...").
 */
export const WILAYAH_UPT = [
  {
    kode: 'LOKA_KOBAR',
    label: 'Wilayah Kerja Loka POM Kotawaringin Barat',
    singkat: 'Loka POM Kotawaringin Barat',
    // Abu-abu netral: wilayah kerja ditandai lewat Rona & garis tegas, bukan
    // warna data. Abu-abu dipilih supaya sama sekali tidak tertukar dengan
    // skala choropleth (hijau\u2192biru) yang menyatakan jumlah sarana.
    warna: 'rgba(148,163,184,0.55)',
    warnaGaris: 'rgba(100,116,139,0.95)',
    kabupaten: [
      'Kabupaten Kotawaringin Barat',
      'Kabupaten Seruyan',
      'Kabupaten Lamandau',
      'Kabupaten Sukamara',
    ],
  },
];

/** Peta nama kab/kota \u2192 kelompok wilayah ({} bila wilayah itu mandiri). */
export const WILAYAH_KAB = WILAYAH_UPT.reduce((acc, w) => {
  for (const nama of w.kabupaten) acc[nama] = w;
  return acc;
}, {});

/** Kelompok wilayah kerja untuk sebuah kab/kota, atau null. */
export function wilayahKab(nama) {
  return WILAYAH_KAB[nama] || null;
}

/** Kumpulan nama kab/kota milik satu kelompok wilayah. */
export function kabDalamWilayah(w) {
  return w ? w.kabupaten : [];
}

/** Angka dari API (MySQL SUM bisa datang sebagai teks) \u2192 number aman. */
export function angka(nilai) {
  const n = Number(nilai);
  return Number.isFinite(n) ? n : 0;
}

/** Format ribuan gaya Indonesia. */
export function formatAngka(nilai) {
  return angka(nilai).toLocaleString('id-ID');
}

/**
 * Skala warna choropleth dua warna (Badan POM): HIJAU saat sarana sedikit
 * bergeser ke BIRU saat sarana banyak, dengan kepekatan ikut naik.
 * Dikembalikan sebagai rgba supaya tetap terbaca di mode gelap.
 */
export function warnaSarana(nilai, maks) {
  const n = angka(nilai);
  if (n <= 0) return 'rgba(148,163,184,0.18)'; // belum ada data
  const rasio = maks > 0 ? Math.min(1, n / maks) : 1;
  // Titik ujung: hijau (#1fa65f) \u2192 biru (#0f6cb8).
  const h = [31, 166, 95];
  const b = [15, 108, 184];
  const r = h.map((v, i) => Math.round(v + (b[i] - v) * rasio));
  // 0.18 \u2192 0.85 pekat, dibulatkan agar stabil antar render.
  const alfa = Math.round((0.18 + rasio * 0.67) * 100) / 100;
  return `rgba(${r[0]},${r[1]},${r[2]},${alfa})`;
}

/** Warna garis kab/kota (dibedakan terang/gelap lewat opacity saja). */
export const GARIS_PETA = 'rgba(255,255,255,0.75)';

/** Kumpulkan angka per kab/kota dari respons API \u2192 map nama \u2192 objek. */
export function petaKabupaten(perKabKota) {
  const hasil = {};
  for (const k of perKabKota || []) {
    hasil[k.kab_kota] = {
      total: angka(k.total),
      produksi: angka(k.produksi),
      distribusi: angka(k.distribusi),
      mayor: angka(k.mayor),
      minor: angka(k.minor),
      tidakMemenuhi: angka(k.tidak_memenuhi),
    };
  }
  return hasil;
}

/** Nilai maksimum total sarana antar kab/kota \u2014 untuk skala warna. */
export function maksimum(perKabKota) {
  return (perKabKota || []).reduce((m, k) => Math.max(m, angka(k.total)), 0);
}

/** Bangun query string filter (hanya yang terisi). */
export function queryFilter(filter) {
  const p = new URLSearchParams();
  Object.entries(filter || {}).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Label ringkas filter aktif, untuk baris "sedang menampilkan". */
export function labelFilter(filter, pilihan) {
  const bagian = [];
  if (filter.tahun) bagian.push(`tahun ${filter.tahun}`);
  if (filter.bulan) {
    const b = (pilihan?.bulan_semua || []).find((x) => String(x.nilai) === String(filter.bulan));
    bagian.push(`bulan ${b ? b.nama : filter.bulan}`);
  }
  if (filter.kegiatan) bagian.push(filter.kegiatan.toLowerCase());
  if (filter.jenis) bagian.push(`jenis sarana ${filter.jenis}`);
  if (filter.kab) bagian.push(namaPendek(filter.kab));
  return bagian.length ? bagian.join(', ') : 'seluruh data';
}

/** Label kesimpulan \u2192 gaya badge. */
export function gayaKesimpulan(teks) {
  const t = String(teks || '').toLowerCase();
  if (t.includes('tidak memenuhi')) return 'badge-danger';
  if (t.includes('memenuhi')) return 'badge-success';
  return 'badge';
}

/**
 * Indeks kepatuhan satu kab/kota: MK / (MK + TMK) \xd7 100.
 * `null` bila belum ada penilaian sama sekali (penyebut 0) supaya tabel
 * menampilkan "\u2014" dan tidak menyesatkan seolah 0%.
 */
export function indeksKepatuhan(mk, tmk) {
  const a = angka(mk);
  const b = angka(tmk);
  if (a + b === 0) return null;
  return (a / (a + b)) * 100;
}

/** Format persen gaya Indonesia (satu desimal); `null` \u2192 "\u2014". */
export function formatPersen(nilai) {
  if (nilai === null || nilai === undefined) return '\u2014';
  return `${Number(nilai).toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/** Gaya badge untuk indeks kepatuhan: \u226590 hijau, \u226570 kuning, sisanya merah. */
export function gayaIndeks(nilai) {
  if (nilai === null || nilai === undefined) return 'badge';
  if (nilai >= 90) return 'badge-success';
  if (nilai >= 70) return 'badge-warning';
  return 'badge-danger';
}
