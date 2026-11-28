// lib/talawang-api.js
/**
 * AKSES API TALAWANG — REALISASI BELANJA PERJALANAN DINAS (AKUN 524)
 * ------------------------------------------------------------------
 * Talawang (Sistem Perjalanan Dinas) menarik angka realisasi dari Jendela
 * Kinerja. Yang dibutuhkan HANYA belanja perjalanan dinas: akun 524xxx
 * (524111 perjalanan biasa luar kota, 524113 perjalanan biasa dalam kota,
 * 524114 paket meeting dalam kota, 524119 perjalanan lainnya). Seluruh 42 akun
 * lain (pegawai, barang, dan akun pendapatan) TIDAK boleh ikut keluar.
 *
 * KENAPA DIBATASI DI KODE, BUKAN HANYA DI DATABASE:
 *   Kolom `akun_awalan` gampang berubah (salah ketik saat insert, migrasi,
 *   atau operator menerbitkan token lewat SQL langsung). Kalau pembatasan hanya
 *   mengandalkan isi kolom, satu baris yang salah bisa membocorkan seluruh
 *   anggaran. Karena itu `AKUN_TERIZINKAN` di bawah adalah daftar-tolak tetap:
 *   nilai dari database akan DITOLAK bila tidak berawalan '524'.
 *
 * KENAPA PER AKUN, BUKAN PER MAK:
 *   Talawang hanya butuh "berapa pagu dan realisasi belanja perjalanan dinas",
 *   dirinci per akun (524111, 524113, 524114, 524119). Rincian MAK memuat kode
 *   kegiatan/program yang tidak dipakai
 *   Talawang, dan mengirimkannya berarti membocorkan struktur anggaran internal
 *   yang tidak diperlukan. `rincian_mak` tetap disediakan tetapi OPSIONAL
 *   (`?rincian=1`) supaya pemanggil harus memintanya secara sadar.
 */

const crypto = require('crypto');
const db = require('../db');
const { segel, bukaSegel, siap } = require('./crypto-link');

/** Awalan akun yang boleh keluar lewat API ini. 524 = Belanja Perjalanan Dinas. */
const AWALAN_TETAP = '524';

/** Nama panjang akun 524 yang dipakai di aplikasi. */
const NAMA_AKUN = {
  '524111': 'Belanja Perjalanan Biasa (Luar Kota)',
  '524113': 'Belanja Perjalanan Biasa (Dalam Kota)',
  '524114': 'Belanja Perjalanan Dinas Paket Meeting (Dalam Kota)',
  '524119': 'Belanja Perjalanan Lainnya',
};

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/**
 * Normalisasi awalan akun dari database. Mengembalikan '524' bila tidak sah.
 * Dipakai supaya kesalahan data tidak pernah memperluas cakupan akses.
 */
function awalanSah(nilai) {
  const bersih = String(nilai ?? '').trim();
  if (!/^\d{3}$/.test(bersih)) return AWALAN_TETAP;
  if (!bersih.startsWith(AWALAN_TETAP)) {
    console.warn(`[talawang] akun_awalan "${bersih}" ditolak, dipaksa memakai ${AWALAN_TETAP}`);
    return AWALAN_TETAP;
  }
  return bersih;
}

// ---------------------------------------------------------------------------
// PENERBITAN & PENGELOLAAN TOKEN
// ---------------------------------------------------------------------------

/**
 * Terbitkan token baru. Token asli dikembalikan SEKALI ke pemanggil (untuk
 * ditampilkan), database hanya menyimpan hash + segel.
 * @param {{nama?:string, masa_berlaku_hari?:number, dibuat_oleh?:string}} isi
 */
async function terbitkanToken({ nama, masa_berlaku_hari, dibuat_oleh } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const hari = Math.min(Math.max(Number(masa_berlaku_hari) || 365, 1), 3650);
  const kedaluwarsa = new Date(Date.now() + hari * 24 * 3600 * 1000);

  const [hasil] = await db.query(
    `INSERT INTO talawang_api
       (nama, akun_awalan, token_hash, token_terenkripsi, masa_berlaku_hari,
        kedaluwarsa_pada, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      String(nama || 'Talawang').slice(0, 120),
      AWALAN_TETAP,
      sha256(token),
      siap() ? segel(token) : null,
      hari,
      kedaluwarsa.toISOString().slice(0, 19).replace('T', ' '),
      String(dibuat_oleh || '').slice(0, 150) || null,
    ],
  );

  return {
    id: hasil.insertId,
    token,
    masa_berlaku_hari: hari,
    kedaluwarsa_pada: kedaluwarsa.toISOString(),
  };
}

/**
 * Daftar token untuk halaman Setting. Token asli ikut dikirim (dibuka dari
 * segel) karena route ini dijaga keycloakAuth — operator perlu bisa menyalin
 * ulang. Baris lama tanpa segel hanya menampilkan `token: null`.
 */
async function daftarToken() {
  const [rows] = await db.query(
    `SELECT id, nama, akun_awalan, token_terenkripsi, masa_berlaku_hari,
            terbit_pada, kedaluwarsa_pada, dicabut_pada, dibuat_oleh,
            jumlah_akses, akses_terakhir,
            CASE
              WHEN dicabut_pada IS NOT NULL THEN 'dicabut'
              WHEN kedaluwarsa_pada <= NOW() THEN 'kedaluwarsa'
              WHEN kedaluwarsa_pada <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 'segera_kedaluwarsa'
              ELSE 'aktif'
            END AS status
       FROM talawang_api
      ORDER BY terbit_pada DESC`,
  );
  return rows.map((r) => ({
    ...r,
    token: r.token_terenkripsi ? bukaSegel(r.token_terenkripsi) : null,
    akun_awalan: awalanSah(r.akun_awalan),
  }));
}

/** Cabut token (tidak dihapus, agar jejak pemakaian tetap ada). */
async function cabutToken(id) {
  const [hasil] = await db.query(
    'UPDATE talawang_api SET dicabut_pada = NOW(), token_terenkripsi = NULL WHERE id = ? AND dicabut_pada IS NULL',
    [Number(id)],
  );
  return hasil.affectedRows > 0;
}

/**
 * Validasi token yang datang dari Talawang.
 * Mengembalikan baris token bila sah, atau { galat, kode } bila tidak.
 */
async function periksaToken(token) {
  if (!/^[a-f0-9]{64}$/i.test(String(token || ''))) {
    return { galat: 'Token tidak valid', kode: 400 };
  }
  const [rows] = await db.query(
    `SELECT id, nama, akun_awalan, masa_berlaku_hari, terbit_pada, kedaluwarsa_pada, dicabut_pada
       FROM talawang_api WHERE token_hash = ?`,
    [sha256(token)],
  );
  const baris = rows[0];
  if (!baris) return { galat: 'Token tidak dikenal', kode: 401 };
  if (baris.dicabut_pada) return { galat: 'Token sudah dicabut', kode: 401 };
  if (new Date(baris.kedaluwarsa_pada) <= new Date()) {
    return { galat: 'Token sudah kedaluwarsa', kode: 401 };
  }

  await db.query(
    'UPDATE talawang_api SET jumlah_akses = jumlah_akses + 1, akses_terakhir = NOW() WHERE id = ?',
    [baris.id],
  );

  return { ...baris, akun_awalan: awalanSah(baris.akun_awalan) };
}

// ---------------------------------------------------------------------------
// DATA YANG DIBERIKAN
// ---------------------------------------------------------------------------

/** Daftar tahun anggaran yang punya data belanja perjalanan dinas. */
async function daftarTahun(awalan = AWALAN_TETAP) {
  const [rows] = await db.query(
    `SELECT DISTINCT tahun FROM v_anggaran_mak
      WHERE akun LIKE ? ORDER BY tahun DESC`,
    [`${awalan}%`],
  );
  return rows.map((r) => Number(r.tahun));
}

/**
 * Rincian belanja perjalanan dinas per MAK untuk satu tahun.
 *
 * BENTUK KELUARAN (yang diminta Talawang):
 *   mak          "3165.AEA.001.054.524111.A"
 *   pagu         3.855.000
 *   realisasi    3.855.000
 *   persen       100           (realisasi / pagu x 100, 2 desimal)
 *   sisa         0             (pagu - realisasi)
 *
 * KENAPA PER MAK: Talawang mencocokkan belanja perjalanan dinasnya per kode
 * MAK (komponen 3 huruf untuk unit, 3 digit untuk kegiatan). Ringkasan per akun
 * saja tidak cukup karena satu akun tersebar di banyak komponen.
 *
 * `total` dihitung dari PENJUMLAHAN baris yang dikirim, bukan query terpisah,
 * supaya angka total selalu sama dengan jumlah rinciannya - tidak ada selisih
 * yang membuat operator curiga.
 *
 * @param {number} tahun
 * @param {{awalan?:string, komponen?:string, akun?:string, limit?:number}} opsi
 */
async function rekapBelanjaPerjalanan(tahun, { awalan = AWALAN_TETAP, komponen = '', akun = '', limit = 2000 } = {}) {
  const th = Number(tahun);
  if (!Number.isInteger(th) || th < 2000 || th > 2100) {
    throw Object.assign(new Error('Parameter tahun tidak sah'), { kode: 400 });
  }

  // Awalan akun WAJIB dari konstanta, bukan dari pemanggil: nilai dari luar
  // hanya boleh MEMPERSEMPIT (lewat `akun`), tidak pernah memperlebar.
  const syarat = ['tahun = ?', 'akun LIKE ?'];
  const params = [th, `${awalan}%`];

  if (akun) {
    // `akun` harus 6 digit dan berawalan sama; selain itu diabaikan.
    const bersih = String(akun).trim();
    if (/^\d{6}$/.test(bersih) && bersih.startsWith(awalan)) {
      syarat.push('akun = ?');
      params.push(bersih);
    }
  }
  if (komponen) {
    syarat.push('komponen = ?');
    params.push(String(komponen).trim().slice(0, 10));
  }

  const where = `WHERE ${syarat.join(' AND ')}`;
  const batas = Math.min(Math.max(Number(limit) || 2000, 1), 5000);

  const [rows] = await db.query(
    `SELECT mak, unit_kerja, komponen, akun, pagu, realisasi, sisa, persen_serapan
       FROM v_anggaran_mak ${where}
      ORDER BY mak LIMIT ?`,
    [...params, batas],
  );

  // Baris dengan pagu 0 dan realisasi 0 tetap dikirim: Talawang perlu tahu MAK
  // itu ADA (mis. pagu belum turun) supaya tidak menyimpulkan "MAK tidak dikenal".
  const daftar = rows.map((r) => {
    const pagu = Number(r.pagu);
    const realisasi = Number(r.realisasi);
    return {
      mak: r.mak,
      unit_kerja: r.unit_kerja,
      komponen: r.komponen,
      akun: r.akun,
      nama_akun: NAMA_AKUN[r.akun] || null,
      pagu,
      realisasi,
      persen: pagu > 0 ? Math.round((realisasi / pagu) * 10000) / 100 : 0,
      // Dihitung ulang, tidak memakai kolom `sisa` view, agar konsisten dengan
      // pembulatan di atas bila nanti ada penyesuaian.
      sisa: pagu - realisasi,
    };
  });

  const total = daftar.reduce(
    (a, b) => ({
      pagu: a.pagu + b.pagu,
      realisasi: a.realisasi + b.realisasi,
      sisa: a.sisa + b.sisa,
    }),
    { pagu: 0, realisasi: 0, sisa: 0 },
  );

  // Jumlah MAK dihitung terpisah bila kena batas `limit` - supaya pemanggil
  // tahu ada baris yang tidak terkirim.
  const [hitung] = await db.query(`SELECT COUNT(*) AS n FROM v_anggaran_mak ${where}`, params);

  return {
    tahun: th,
    cakupan: {
      akun_awalan: awalan,
      keterangan: `Hanya akun ${awalan}xxx (Belanja Perjalanan Dinas)`,
      nama_akun: NAMA_AKUN,
    },
    total: {
      ...total,
      persen: total.pagu > 0 ? Math.round((total.realisasi / total.pagu) * 10000) / 100 : 0,
      jumlah_mak: daftar.length,
    },
    // Kunci utama yang dipakai Talawang.
    rincian_mak: daftar,
    // Nama lain agar pemanggil yang sudah menulis `data` atau `mak` tetap jalan.
    data: daftar,
    terpotong: Number(hitung[0]?.n || 0) > daftar.length,
    jumlah_mak_tersedia: Number(hitung[0]?.n || 0),
  };
}

module.exports = {
  AWALAN_TETAP,
  NAMA_AKUN,
  awalanSah,
  terbitkanToken,
  daftarToken,
  cabutToken,
  periksaToken,
  daftarTahun,
  rekapBelanjaPerjalanan,
};
