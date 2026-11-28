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
  // Dua varian ekspor SAKTI memakai kolom berbeda untuk menandai jenis baris:
  //   varian lama : TIPE_ANGGARAN = "REALISASI"
  //   varian SPAN : TIPE_ANGGARAN = "2", DESKRIPSI_TIPE_ANGGARAN = "REALISASI"
  // Karena itu penandanya dibaca dari keduanya.
  const iDeskripsiTipe = cari('DESKRIPSI_TIPE_ANGGARAN');
  if (iReal < 0 || iTgl < 0) throw new Error('Kolom REALISASI atau TGLPOST tidak ada di header.');

  const peta = new Map(); // "bulan|jenis" -> nilai
  const perJenisTotal = new Map();
  const bulanTerisi = new Set();
  let total = 0;
  let tahun = null;
  let dilewati = 0;
  let barisSah = 0;

  // Berkas ADK bulanan mencantumkan rentang tanggal di kepala berkas
  // (baris "Tanggal,2026-01-01 s.d 2026-01-31"). Nilai ini dipakai hanya untuk
  // memberi tahu pengguna bulan apa yang sedang diimpor - sumber kebenaran
  // tetap TGLPOST tiap baris.
  let rentang = null;
  const barisRentang = baris.find((l) => /^\s*Tanggal\s*,/i.test(l));
  if (barisRentang) rentang = barisRentang.replace(/^\s*Tanggal\s*,/i, '').trim();

  for (let i = iHeader + 1; i < baris.length; i++) {
    if (!baris[i].trim()) continue;
    const kol = pecah(baris[i]);

    // Hanya baris realisasi. Dipakai DAFTAR TOLAK (komitmen/non-realisasi),
    // bukan daftar terima: nilai TIPE_ANGGARAN berbeda antar versi ekspor
    // ("REALISASI" vs "2"), dan daftar terima membuat seluruh berkas terlewati.
    const tipe = `${bersih(kol[iTipe])} ${iDeskripsiTipe >= 0 ? bersih(kol[iDeskripsiTipe]) : ''}`.toUpperCase();
    if (/KOMITMEN|NONREAL|NON-REAL|ABT/.test(tipe)) {
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
    bulanTerisi.add(bulan);

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

  return { tahun, perBulan, total, dilewati, barisSah, bulanTerisi: [...bulanTerisi].sort((a, b) => a - b), rentang };
}

/**
 * Hasil baca + simpan dalam SATU transaksi, ganti-per-tahun.
 */
async function simpanBulanan({ isi, namaBerkas, diunggahOleh }) {
  const { tahun, perBulan, total, dilewati, barisSah, bulanTerisi, rentang } = bacaAdk(isi);
  if (!tahun) throw new Error('Tahun anggaran tidak terbaca dari berkas.');
  if (!barisSah) throw new Error('Tidak ada baris realisasi yang bisa dibaca.');

  // Kolom '00' (total per bulan) juga disimpan bersama baris per jenis.
  const bulan = bulanTerisi || [];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // GABUNG PER BULAN, JANGAN HAPUS SATU TAHUN.
    // Berkas ADK bulanan hanya memuat satu bulan (mis. "Tanggal,2026-01-01 s.d
    // 2026-01-31"). Kalau kita menghapus seluruh tahun, unggahan Januari akan
    // menghapus Februari-Desember yang sudah ada. Yang dihapus hanya bulan yang
    // memang ada di berkas ini, sehingga unggah ulang bulan yang sama tetap
    // menggantikan angka bulan itu (tidak menumpuk).
    // Baris per-jenis (selain '00') dibersihkan dulu supaya impor ulang tidak
    // meninggalkan jenis yang sudah tidak ada di berkas. Baris '00' SENGAJA
    // tidak dihapus: kolom `pagu`-nya bisa berisi angka yang diketik manual,
    // dan UPSERT di bawah hanya memperbarui `nilai` sehingga pagu tetap aman.
    if (bulan.length) {
      await conn.query(
        "DELETE FROM realisasi_bulanan WHERE tahun = ? AND bulan IN (?) AND jenis <> '00'",
        [tahun, bulan],
      );
    } else {
      await conn.query("DELETE FROM realisasi_bulanan WHERE tahun = ? AND jenis <> '00'", [tahun]);
    }

    const isiBaru = perBulan
      .filter((r) => bulan.length === 0 || bulan.includes(r.bulan))
      .map((r) => [tahun, r.bulan, r.jenis, r.nilai]);
    await conn.query(
      `INSERT INTO realisasi_bulanan (tahun, bulan, jenis, nilai) VALUES ?
       ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
      [isiBaru],
    );

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
    return { tahun, total, dilewati, barisSah, bulan, rentang };
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
    'SELECT bulan, nilai, pagu FROM realisasi_bulanan WHERE tahun = ? AND jenis = ? ORDER BY bulan',
    [tahun, '00'],
  );
  const peta = new Map(rows.map((r) => [Number(r.bulan), { nilai: Number(r.nilai), pagu: Number(r.pagu) }]));
  let kum = 0;
  let kumPagu = 0;
  const hasil = [];
  for (let b = 1; b <= 12; b++) {
    const satu = peta.get(b) || { nilai: 0, pagu: 0 };
    kum += satu.nilai;
    kumPagu += satu.pagu;
    hasil.push({ bulan: b, nilai: satu.nilai, pagu: satu.pagu, kumulatif: kum, kumulatif_pagu: kumPagu });
  }
  return hasil;
}

/**
 * Simpan realisasi bulanan yang DIKETIK pengguna (bukan hasil impor berkas).
 * Satu baris = satu bulan, berisi pagu dan realisasi bulan itu.
 * Bulan yang kedua nilainya 0 dianggap "dikosongkan" sehingga barisnya dihapus -
 * dengan begitu kisi status 12 bulan menampilkan keadaan sebenarnya.
 * @param {{tahun:number, baris:Array<{bulan:number, pagu:number, realisasi:number}>}} isi
 */
async function simpanBulananManual({ tahun, baris }) {
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
    throw new Error('Tahun anggaran tidak sah.');
  }
  if (!Array.isArray(baris) || !baris.length) throw new Error('Tidak ada baris yang dikirim.');

  const bersih = baris.map((r) => {
    const bulan = Number(r.bulan);
    if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) throw new Error(`Bulan tidak sah: ${r.bulan}`);
    return { bulan, pagu: Number(r.pagu) || 0, realisasi: Number(r.realisasi) || 0 };
  });

  const conn = await db.getConnection();
  let tersimpan = 0;
  let dikosongkan = 0;
  try {
    await conn.beginTransaction();
    for (const r of bersih) {
      if (r.pagu === 0 && r.realisasi === 0) {
        const [h] = await conn.query(
          'DELETE FROM realisasi_bulanan WHERE tahun = ? AND bulan = ? AND jenis = ?',
          [tahun, r.bulan, '00'],
        );
        dikosongkan += h.affectedRows;
        continue;
      }
      await conn.query(
        `INSERT INTO realisasi_bulanan (tahun, bulan, jenis, nilai, pagu)
         VALUES (?, ?, '00', ?, ?)
         ON DUPLICATE KEY UPDATE nilai = VALUES(nilai), pagu = VALUES(pagu)`,
        [tahun, r.bulan, r.realisasi, r.pagu],
      );
      tersimpan++;
    }
    await conn.commit();
    return { tahun, tersimpan, dikosongkan, kumulatif: await kumulatifBulanan(tahun) };
  } catch (e) {
    await conn.rollback();
    throw new Error(`Gagal menyimpan: ${e.message}`);
  } finally {
    conn.release();
  }
}

module.exports = { bacaAdk, simpanBulanan, simpanBulananManual, bacaBerkas, kumulatifBulanan, keAngka };