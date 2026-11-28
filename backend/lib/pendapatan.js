// lib/pendapatan.js
/**
 * MODUL PENDAPATAN — mesin baca berkas dan penyimpanan
 * -----------------------------------------------------
 * Sumber: export SAKTI "ADK REALISASI PENDAPATAN (SUMBER DATA : SAKTI)
 * PERSATKER <kode> ANGGARAN <tahun>" dalam bentuk CSV.
 *
 * Bentuk berkasnya sama seperti ADK belanja: beberapa baris kepala
 * ("Filter Aktif", "Sumber Data,SAKTI", "Tanggal,2026-01-01 s/d ...") sebelum
 * baris header sebenarnya yang memuat TGLPOST. Parser mencari baris header
 * lewat nama kolom, bukan nomor baris, supaya tetap jalan walau jumlah baris
 * kepala berbeda antar versi ekspor.
 *
 * Yang disimpan hanya rekap per (tahun, bulan, akun) — lihat komentar di
 * db/pendapatan.sql untuk alasannya.
 */
const fs = require('fs');
const db = require('../db');

/** Nama akun pendapatan yang ditampilkan aplikasi (sesuai permintaan pemilik). */
const NAMA_AKUN = {
  425321: 'Pendapatan Jasa Pengawasan Obat dan Makanan',
  425811: 'Pendapatan Denda Penyelesaian Pekerjaan Pemerintah',
  425151: 'Pendapatan Penggunaan Sarana dan Prasarana',
  425912: 'Penerimaan Kembali Belanja Barang Tahun Anggaran Yang Lalu',
};

/**
 * Angka Indonesia -> Number. Nilai di berkas SAKTI berupa teks, kadang
 * berpemisah titik ribuan ("2.025.000") dan kadang bertanda minus.
 * Number("2.025.000") menghasilkan NaN, dan NaN yang tersimpan menjadi 0
 * tanpa error — kesalahan yang sulit terlihat. Karena itu selalu lewat sini.
 */
function keAngka(teks) {
  if (teks === null || teks === undefined) return 0;
  let s = String(teks).trim().replace(/\s|"|Rp/gi, '');
  if (!s) return 0;
  const negatif = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '');
  // Buang pemisah ribuan: titik dan koma yang muncul sebelum 3 digit terakhir.
  if (/,\d{1,2}$/.test(s)) {
    // Desimal berkoma (jarang pada realisasi, tetapi dijaga)
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negatif ? -Math.abs(n) : n;
}

/** Pemecah CSV yang menghormati tanda kutip dan "" di dalamnya. */
function pecah(baris) {
  const hasil = [];
  let sel = '';
  let dalamKutip = false;
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (c === '"') {
      if (dalamKutip && baris[i + 1] === '"') {
        sel += '"';
        i++;
      } else dalamKutip = !dalamKutip;
    } else if (c === ',' && !dalamKutip) {
      hasil.push(sel);
      sel = '';
    } else sel += c;
  }
  hasil.push(sel);
  return hasil;
}

/** Bersihkan sel: buang =""..."", kutip sisa, dan spasi tepi. */
const bersih = (v) =>
  String(v ?? '')
    .replace(/^="?|"$/g, '')
    .trim();

/**
 * Tanggal TGLPOST -> { bulan, tahun }. Format di berkas: DD-MM-YYYY.
 * Beberapa ekspor memakai YYYY-MM-DD; keduanya diterima.
 */
function uraiTanggal(teks) {
  const s = bersih(teks);
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return { bulan: Number(m[2]), tahun: Number(m[3]) };
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { bulan: Number(m[2]), tahun: Number(m[1]) };
  return null;
}

/**
 * Baca isi CSV pendapatan.
 * @returns {{tahun:number|null, perBulan:Array<{bulan:number,akun:string,nilai:number}>,
 *            total:number, dokumen:number, dilewati:number, barisSah:number,
 *            akunTerbaca:string[], bulanTerisi:number[], rentang:string|null}}
 */
function bacaPendapatan(isi) {
  const teks = String(isi || '').replace(/^\uFEFF/, '');
  const baris = teks.split(/\r?\n/);

  // Rentang tanggal di kepala berkas, untuk pesan ke pengguna.
  let rentang = null;
  const barisRentang = baris.find((l) => /^\s*Tanggal\s*,/i.test(l));
  if (barisRentang) rentang = barisRentang.replace(/^\s*Tanggal\s*,/i, '').trim();

  const iHeader = baris.findIndex((l) => /TGLPOST/i.test(l) && /REALISASI/i.test(l));
  if (iHeader < 0) throw new Error('Berkas bukan ADK Realisasi Pendapatan (header TGLPOST/REALISASI tidak ditemukan).');

  const head = pecah(baris[iHeader]).map((h) => h.trim().toUpperCase());
  const cari = (nama) => head.indexOf(nama);

  const iAkun = cari('AKUN');
  const iReal = cari('REALISASI');
  const iTgl = cari('TGLPOST');
  const iTahun = cari('TAHUN_ANGGARAN');
  const iTipe = cari('TIPE_ANGGARAN');
  if (iAkun < 0 || iReal < 0 || iTgl < 0) {
    throw new Error('Kolom AKUN / REALISASI / TGLPOST tidak lengkap pada berkas.');
  }

  let tahun = null;
  let dilewati = 0;
  let barisSah = 0;
  let dokumen = 0;
  let total = 0;
  const peta = new Map(); // "bulan|akun" -> nilai
  const akunTerbaca = new Set();
  const bulanTerisi = new Set();

  for (let i = iHeader + 1; i < baris.length; i++) {
    if (!baris[i].trim()) continue;
    const kol = pecah(baris[i]);

    // Baris selain realisasi (komitmen/pengembalian dokumen lain) dilewati.
    const tipe = bersih(kol[iTipe]).toUpperCase();
    if (tipe && /KOMITMEN|NONREAL|NON-REAL|ABT/.test(tipe)) {
      dilewati++;
      continue;
    }

    const tgl = uraiTanggal(kol[iTgl]);
    if (!tgl || tgl.bulan < 1 || tgl.bulan > 12) {
      dilewati++;
      continue;
    }
    if (!tahun) tahun = tgl.tahun;
    if (iTahun >= 0) {
      const th = Number(bersih(kol[iTahun]));
      if (th) tahun = th;
    }

    const akun = bersih(kol[iAkun]).slice(0, 6);
    if (!/^\d{6}$/.test(akun)) {
      dilewati++;
      continue;
    }

    const nilai = keAngka(kol[iReal]);
    const kunci = `${tgl.bulan}|${akun}`;
    peta.set(kunci, (peta.get(kunci) || 0) + nilai);
    akunTerbaca.add(akun);
    bulanTerisi.add(tgl.bulan);
    total += nilai;
    dokumen++;
    barisSah++;
  }

  const perBulan = [...peta.entries()].map(([kunci, nilai]) => {
    const [bulan, akun] = kunci.split('|');
    return { bulan: Number(bulan), akun, nilai };
  });

  return {
    tahun,
    perBulan,
    total,
    dokumen,
    dilewati,
    barisSah,
    akunTerbaca: [...akunTerbaca].sort(),
    bulanTerisi: [...bulanTerisi].sort((a, b) => a - b),
    rentang,
  };
}

/**
 * Simpan hasil baca ke database. GABUNG PER BULAN: hanya bulan yang ada di
 * berkas yang diganti, bulan lain tidak tersentuh. Dengan begitu impor berkas
 * yang hanya memuat sebagian tahun tidak menghapus bulan lain.
 */
async function simpanPendapatan({ isi, namaBerkas, diunggahOleh }) {
  const hasil = bacaPendapatan(isi);
  if (!hasil.tahun) throw new Error('Tahun anggaran tidak terbaca dari berkas.');
  if (!hasil.barisSah) throw new Error('Tidak ada baris realisasi pendapatan yang bisa dibaca.');

  const bulan = hasil.bulanTerisi || [];
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (bulan.length) {
      await conn.query('DELETE FROM pendapatan_bulanan WHERE tahun = ? AND bulan IN (?)', [hasil.tahun, bulan]);
    } else {
      await conn.query('DELETE FROM pendapatan_bulanan WHERE tahun = ?', [hasil.tahun]);
    }

    const isiBaru = hasil.perBulan.map((r) => [hasil.tahun, r.bulan, r.akun, r.nilai]);
    if (isiBaru.length) {
      await conn.query('INSERT INTO pendapatan_bulanan (tahun, bulan, akun, nilai) VALUES ?', [isiBaru]);
    }

    await conn.query(
      `INSERT INTO pendapatan_import (tahun, nama_berkas, jumlah_baris, jumlah_dokumen, total, diunggah_oleh)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nama_berkas = VALUES(nama_berkas), jumlah_baris = VALUES(jumlah_baris),
         jumlah_dokumen = VALUES(jumlah_dokumen), total = VALUES(total),
         diunggah_oleh = VALUES(diunggah_oleh), diunggah_pada = CURRENT_TIMESTAMP`,
      [hasil.tahun, namaBerkas || '(tanpa nama)', hasil.barisSah, hasil.dokumen, hasil.total, diunggahOleh || null],
    );

    await conn.commit();
    return {
      tahun: hasil.tahun,
      barisSah: hasil.barisSah,
      dokumen: hasil.dokumen,
      dilewati: hasil.dilewati,
      total: hasil.total,
      bulan,
      rentang: hasil.rentang,
    };
  } catch (e) {
    await conn.rollback();
    throw new Error(`Gagal menyimpan pendapatan: ${e.message}`);
  } finally {
    conn.release();
  }
}

/**
 * Sebaran 12 bulan per akun untuk satu tahun.
 * @returns {Promise<{perAkun:Array, perBulan:Array, total:number}>}
 */
async function rekapPendapatan(tahun) {
  const [rows] = await db.query(
    'SELECT bulan, akun, nilai FROM pendapatan_bulanan WHERE tahun = ? ORDER BY akun, bulan',
    [tahun],
  );

  const akunPeta = new Map();
  const bulanPeta = new Map();
  for (const r of rows) {
    const b = Number(r.bulan);
    const n = Number(r.nilai);
    if (!akunPeta.has(r.akun)) akunPeta.set(r.akun, new Array(13).fill(0));
    akunPeta.get(r.akun)[b] += n;
    bulanPeta.set(b, (bulanPeta.get(b) || 0) + n);
  }

  const perAkun = [...akunPeta.entries()]
    .map(([akun, deret]) => ({
      akun,
      nama: NAMA_AKUN[akun] || `Akun ${akun}`,
      total: deret.reduce((a, b) => a + b, 0),
      bulan: deret.slice(1), // 12 angka, indeks 0 = Januari
    }))
    .sort((a, b) => b.total - a.total);

  let kum = 0;
  const perBulan = [];
  for (let b = 1; b <= 12; b++) {
    const nilai = bulanPeta.get(b) || 0;
    kum += nilai;
    perBulan.push({ bulan: b, nilai, kumulatif: kum });
  }

  return { perAkun, perBulan, total: kum };
}

/** Muat berkas dari path (untuk skrip pemuatan). */
function bacaBerkas(path) {
  return fs.readFileSync(path, 'utf8');
}

module.exports = {
  NAMA_AKUN,
  keAngka,
  bacaPendapatan,
  simpanPendapatan,
  rekapPendapatan,
  bacaBerkas,
};
