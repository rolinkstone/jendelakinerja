// backend/lib/kinerja.js
/**
 * HELPER TURUNAN DATA KINERJA
 * ---------------------------
 * Dipakai bersama oleh:
 *   - routes/pbf.js               → saat impor (mengisi kolom turunan tiap baris)
 *   - scripts/backfill-kinerja.js → mengisi baris lama yang belum punya kolom turunan
 *   - routes/publik.js            → label bulan untuk filter dashboard publik
 *
 * Kolom turunan ini sengaja denormalisasi ke pbf_laporan supaya dashboard publik
 * bisa mengelompokkan per kab/kota, bulan, kegiatan (produksi/distribusi), dan
 * jenis sarana tanpa join ke pbf_import.
 */

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Singkatan 3 huruf (dan varian lazim) → nomor bulan. */
const SINGKATAN = {
  jan: 1, feb: 2, peb: 2, mar: 3, mrt: 3, apr: 4, mei: 5, may: 5, jun: 6, jni: 6,
  jul: 7, agu: 8, ags: 8, aug: 8, agt: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

/**
 * Ambil nomor bulan (1–12) dari teks tanggal gaya laporan: "08 Oktober 2026",
 * "Oktober 2026", "2026-10-08", "08/10/2026". Null bila tak dikenali.
 */
function bulanDariTeks(nilai) {
  const s = String(nilai ?? '').trim();
  if (!s) return null;

  // 1. Nama bulan Indonesia (boleh disingkat 3 huruf pertama).
  const kata = s.match(/[A-Za-z]{3,}/g) || [];
  for (const k of kata) {
    const kecil = k.toLowerCase();
    const idx = BULAN_ID.findIndex((b) => b.toLowerCase() === kecil);
    if (idx >= 0) return idx + 1;
    const pendek = kecil.slice(0, 3);
    if (SINGKATAN[pendek]) return SINGKATAN[pendek];
  }

  // 2. Tanggal angka: ISO (2026-10-08) atau gaya Indonesia (08-10-2026 / 08/10/2026).
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.]\d{1,2}$/);
  if (m) {
    const b = Number(m[2]);
    return b >= 1 && b <= 12 ? b : null;
  }
  m = s.match(/^\d{1,2}[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const b = Number(m[1]);
    return b >= 1 && b <= 12 ? b : null;
  }
  return null;
}

/** 1 → "Januari"; untuk label di API. */
function namaBulan(nomor) {
  return BULAN_ID[Number(nomor) - 1] || null;
}

/**
 * Pisahkan teks jenis sarana dari kepala berkas Excel menjadi kegiatan
 * (produksi/distribusi) + jenis sarana.
 *
 *   "Distribusi - PBF"        → { kegiatan: 'Distribusi', jenis_sarana: 'PBF' }
 *   "Produksi - Pangan MD"    → { kegiatan: 'Produksi',   jenis_sarana: 'Pangan MD' }
 *   "Distribusi – Kosmetik"   → { kegiatan: 'Distribusi', jenis_sarana: 'Kosmetik' }
 *   "PBF"                     → { kegiatan: null,         jenis_sarana: 'PBF' }
 *
 * Diterima juga pemisah tanpa spasi ("Distribusi-PBF") dan titik dua.
 */
function pecahJenisSarana(nilai) {
  const teks = String(nilai ?? '').replace(/\s+/g, ' ').trim();
  if (!teks) return { kegiatan: null, jenis_sarana: null };

  const cocok = teks.match(/^(produksi|distribusi)\s*[-–—:]\s*(.*)$/i) || teks.match(/^(produksi|distribusi)$/i);
  if (cocok) {
    const kegiatan = cocok[1].charAt(0).toUpperCase() + cocok[1].slice(1).toLowerCase();
    let jenis = (cocok[2] || '').trim();
    // Rapikan sisa tanda hubung/spasi berlebih.
    jenis = jenis.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '');
    return { kegiatan, jenis_sarana: jenis || null };
  }
  return { kegiatan: null, jenis_sarana: teks };
}

/**
 * Lengkapi satu baris laporan dengan kolom turunan.
 * Urutan bulan: tanggal periksa mulai → selesai → tanggal input.
 *
 * Modul sampel memakai nama kolom tanggal yang berbeda (tgl_sampling,
 * tgl_lhu) dan rentang tanggalnya jauh lebih lebar dari jendela biasa, jadi
 * kolomnya diterima sebagai cadangan lewat `laporan.__tanggal_bulan` atau
 * pencocokan nama di bawah ini.
 */
function lengkapiBaris(laporan, jenisSaranaBerkas) {
  const { kegiatan, jenis_sarana: jenisDariBerkas } = pecahJenisSarana(jenisSaranaBerkas);
  const bulan =
    bulanDariTeks(laporan.tgl_periksa_mulai) ??
    bulanDariTeks(laporan.tgl_periksa_selesai) ??
    bulanDariTeks(laporan.tgl_input) ??
    // Modul sampel: tanggal sampling lebih mewakili periode data daripada LHU.
    bulanDariTeks(laporan.tgl_sampling) ??
    bulanDariTeks(laporan.tgl_lhu) ??
    bulanDariTeks(laporan.tgl_spk);

  return {
    kegiatan: laporan.kegiatan || kegiatan,
    // Baris boleh punya jenis sarana sendiri (mis. dari kolom berkas); kepala berkas
    // tetap dipakai sebagai sumber utama agar konsisten satu berkas = satu jenis.
    jenis_sarana: jenisDariBerkas || null,
    bulan,
  };
}

module.exports = {
  BULAN_ID,
  namaBulan,
  bulanDariTeks,
  pecahJenisSarana,
  lengkapiBaris,
};
