// lib/adk-bulanan.js
/**
 * PEMBACA ADK REALISASI BELANJA → SEBARAN BULANAN
 * ----------------------------------------------
 * Sumber: ekspor SAKTI "ADK REALISASI BELANJA SUMBER DATA SAKTI PER SATKER".
 * Satu baris = satu dokumen/akun, dengan kolom TGLPOST (dd-mm-yyyy) dan
 * REALISASI (rupiah tanpa pemisah).
 *
 * KENAPA BERKAS INI: "Realisasi FA berdasarkan SP2D" yang dipakai tabel MAK
 * TIDAK memuat tanggal, jadi mustahil membuat grafik bulanan dari berkas itu.
 * ADK inilah satu-satunya sumber yang punya tanggal per transaksi.
 *
 * Jebakan format yang harus ditangani:
 *   - nilai sel terbungkus ="..." (mis. ="063"), khas ekspor SAKTI;
 *   - BOM UTF-8 di awal berkas;
 *   - judul laporan di beberapa baris pertama, header baru muncul setelahnya;
 *   - angka rupiah tanpa pemisah ribuan, tetapi tetap ditangani bila ada titik.
 */
const fs = require('fs');
const db = require('../db');

/** Buang pembungkus ="..." dan tanda kutip. */
const bersih = (v) =>
  String(v ?? '')
    .trim()
    .replace(/^="?/, '')
    .replace(/"$/, '')
    .replace(/^"|"$/g, '')
    .trim();

/** Pecah baris CSV dengan menghormati tanda kutip. */
function pecah(baris) {
  const hasil = [];
  let kini = '';
  let dalamKutip = false;
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (c === '"') {
      if (dalamKutip && baris[i + 1] === '"') {
        kini += '"';
        i++;
      } else {
        dalamKutip = !dalamKutip;
      }
    } else if (c === ',' && !dalamKutip) {
      hasil.push(kini);
      kini = '';
    } else {
      kini += c;
    }
  }
  hasil.push(kini);
  return hasil;
}

/** "1.234.567" / "1234567,89" -> number */
function keAngka(v) {
  const s = bersih(v).replace(/\s/g, '');
  if (!s) return 0;
  const n = /,\d{1,2}$/.test(s)
    ? Number(s.replace(/\./g, '').replace(',', '.'))
    : Number(s.replace(/\./g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Baca berkas ADK menjadi agregat bulanan.
 * @returns {{tahun:number|null, perBulan:Array<{bulan:number,jenis:string,nilai:number}>, total:number, dilewati:number, barisSah:number}}
 */
function bacaAdk(isi) {
  const teks = String(isi).replace(/^\uFEFF/, '');
  const baris = teks.split(/\r?\n/);

  const iHeader = baris.findIndex((l) => /TGLPOST/i.test(l));
  if (iHeader < 0) throw new Error('Kolom TGLPOST tidak ditemukan — berkas bukan ADK realisasi SAKTI.');

  const header = pecah(baris[iHeader]).map(bersih);
  const cari = (nama) => header.findIndex((h) => h.toUpperCase() === nama);
  const iAkun = cari('AKUN');
  const iReal = cari('REALISASI');
  const iTgl = cari('TGLPOST');
  const iTahun = cari('TAHUN_ANGGARAN');
  const iTipe = cari('TIPE_ANGGARAN');
  if (iReal < 0 || iTgl < 0) throw new Error('Kolom REALISASI atau TGLPOST tidak ada di header.');

  const peta = new Map(); // "bulan|jenis" -> nilai
  const perJenisTotal = new Map();
  let total = 0;
  let tahun = null;
  let dilewati = 0;
  let barisSah = 0;

  for (let i = iHeader + 1; i < baris.length; i++) {
    if (!baris[i].trim()) continue;
    const kol = pecah(baris[i]);

    // Hanya baris realisasi; baris komitmen/anggaran tidak dihitung.
    const tipe = bersih(kol[iTipe]).toUpperCase();
    if (tipe && !/REAL/.test(tipe)) {
      dilewati++;
      continue;
    }

    const m = bersih(kol[iTgl]).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!m) {
      dilewati++;
      continue;
    }
    const bulan = Number(m[2]);
    if (bulan < 1 || bulan > 12) {
      dilewati++;
      continue;
    }

    if (!tahun && iTahun >= 0) {
      const th = Number(bersih(kol[iTahun]));
      if (th >= 2000 && th <= 2100) tahun = th;
    }
    if (!tahun) tahun = Number(m[3]);

    const nilai = keAngka(kol[iReal]);
    const jenis = bersih(kol[iAkun]).slice(0, 2) || '00';

    total += nilai;
    barisSah++;
    peta.set(`${bulan}|${jenis}`, (peta.get(`${bulan}|${jenis}`) || 0) + nilai);
    perJenisTotal.set(jenis, (perJenisTotal.get(jenis) || 0) + nilai);
  }

  // Simpan baris per jenis + satu baris total '00' per bulan.
  const perBulan = [];
  for (let b = 1; b <= 12; b++) {
    let totalBulan = 0;
    for (const [kunci, nilai] of peta.entries()) {
      const [bl, jen] = kunci.split('|');
      if (Number(bl) === b) {
        perBulan.push({ bulan: b, jenis: jen, nilai });
        totalBulan += nilai;
      }
    }
    perBulan.push({ bulan: b, jenis: '00', nilai: totalBulan });
  }

  return { tahun, perBulan, total, dilewati, barisSah };
}

/**
 * Hasil baca + simpan dalam SATU transaksi, ganti-per-tahun.
 */
async function simpanBulanan({ isi, namaBerkas, diunggahOleh }) {
  const { tahun, perBulan, total, dilewati, barisSah } = bacaAdk(isi);
  if (!tahun) throw new Error('Tahun anggaran tidak terbaca dari berkas.');
  if (!barisSah) throw new Error('Tidak ada baris realisasi yang bisa dibaca.');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM realisasi_bulanan WHERE tahun = ?', [tahun]);
    const isiBaru = perBulan.map((r) => [tahun, r.bulan, r.jenis, r.nilai]);
    await conn.query('INSERT INTO realisasi_bulanan (tahun, bulan, jenis, nilai) VALUES ?', [isiBaru]);
    await conn.query(
      `INSERT INTO realisasi_bulanan_import (tahun, nama_berkas, jumlah_baris, total, diunggah_oleh)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nama_berkas = VALUES(nama_berkas), jumlah_baris = VALUES(jumlah_baris),
         total = VALUES(total), diunggah_oleh = VALUES(diunggah_oleh),
         diunggah_pada = CURRENT_TIMESTAMP`,
      [tahun, namaBerkas || '(tanpa nama)', barisSah, total, diunggahOleh || null],
    );
    await conn.commit();
    return { tahun, total, dilewati, barisSah };
  } catch (e) {
    await conn.rollback();
    throw new Error(`Gagal menyimpan data bulanan: ${e.message}`);
  } finally {
    conn.release();
  }
}

/** Muat berkas dari path (untuk skrip pemuatan). */
function bacaBerkas(path) {
  return fs.readFileSync(path, 'utf8');
}

/**
 * Sebaran kumulatif 12 bulan untuk sebuah tahun.
 * @returns {Promise<Array<{bulan:number, nilai:number, kumulatif:number}>>}
 */
async function kumulatifBulanan(tahun) {
  const [rows] = await db.query(
    'SELECT bulan, nilai FROM realisasi_bulanan WHERE tahun = ? AND jenis = ? ORDER BY bulan',
    [tahun, '00'],
  );
  const peta = new Map(rows.map((r) => [Number(r.bulan), Number(r.nilai)]));
  let kum = 0;
  const hasil = [];
  for (let b = 1; b <= 12; b++) {
    const nilai = peta.get(b) || 0;
    kum += nilai;
    hasil.push({ bulan: b, nilai, kumulatif: kum });
  }
  return hasil;
}

module.exports = { bacaAdk, simpanBulanan, bacaBerkas, kumulatifBulanan, keAngka };