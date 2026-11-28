// routes/talawang.js
/**
 * ROUTER API TALAWANG — dua sisi dalam satu berkas
 * ------------------------------------------------
 * SISI 1 (dipakai Talawang, TANPA login SSO):
 *   GET /api/talawang/realisasi?token=<token>&tahun=2026
 *   GET /api/talawang/tahun?token=<token>
 *
 * SISI 2 (dipakai halaman Setting JK, WAJIB login + peran tulis):
 *   GET    /api/talawang/token          daftar token (token asli ikut, dibuka dari segel)
 *   POST   /api/talawang/token          terbitkan token baru
 *   DELETE /api/talawang/token/:id      cabut token
 *   GET    /api/talawang/info           ringkasan konfigurasi + contoh URL
 *
 * KENAPA SATU BERKAS: kedua sisi mengurus tabel yang sama. Memisahkannya
 * membuat dua tempat yang harus diubah setiap kali ada kolom baru, dan
 * gampang melenceng.
 *
 * PEMISAHAN OTORISASI:
 *   Route yang diawali `/token` dan `/info` dijaga keycloakAuth (dipanggil
 *   sebagai middleware di sini, bukan hanya mengandalkan server.js) karena
 *   mengembalikan token asli dan mengubah konfigurasi.
 *   Route `/realisasi` dan `/tahun` sengaja TIDAK dijaga SSO — justru itu
 *   pintu masuk Talawang — tetapi WAJIB token yang sah, dan datanya dibatasi
 *   pada akun 524 oleh lib/talawang-api.js.
 */
const express = require('express');
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');
const { originPermintaan } = require('../lib/base-publik');
const {
  terbitkanToken,
  daftarToken,
  cabutToken,
  periksaToken,
  daftarTahun,
  rekapBelanjaPerjalanan,
  AWALAN_TETAP,
  NAMA_AKUN,
} = require('../lib/talawang-api');

const router = express.Router();

/** Ambil token dari query `token` atau header Authorization: Bearer. */
const ambilToken = (req) => {
  const dariQuery = String(req.query.token || '').trim();
  if (dariQuery) return dariQuery;
  const header = String(req.headers.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return '';
};

// ===========================================================================
// SISI TALAWANG — tanpa SSO, wajib token
// ===========================================================================

router.get('/realisasi', async (req, res) => {
  try {
    const sah = await periksaToken(ambilToken(req));
    if (sah.galat) {
      return res.status(sah.kode).json({ success: false, message: sah.galat });
    }

    const tahun = Number(req.query.tahun) || (await daftarTahun(sah.akun_awalan))[0];
    if (!tahun) {
      return res.status(404).json({ success: false, message: 'Belum ada data anggaran.' });
    }

    // Filter OPSIONAL yang hanya bisa MEMPERSEMPIT hasil:
    //   &komponen=BDB  -> satu komponen saja
    //   &akun=524111   -> satu akun (harus berawalan 524)
    //   &limit=500     -> batasi jumlah baris
    const data = await rekapBelanjaPerjalanan(tahun, {
      awalan: sah.akun_awalan,
      komponen: req.query.komponen,
      akun: req.query.akun,
      limit: req.query.limit,
    });

    return res.json({
      success: true,
      data: {
        sumber: 'Jendela Kinerja — BBPOM Palangka Raya',
        untuk: sah.nama,
        diambil_pada: new Date().toISOString(),
        ...data,
      },
    });
  } catch (e) {
    const kode = e.kode || 500;
    if (kode >= 500) console.error('[talawang] realisasi gagal:', e.message);
    return res.status(kode).json({ success: false, message: e.message });
  }
});

router.get('/tahun', async (req, res) => {
  try {
    const sah = await periksaToken(ambilToken(req));
    if (sah.galat) return res.status(sah.kode).json({ success: false, message: sah.galat });
    return res.json({
      success: true,
      data: { tahun: await daftarTahun(sah.akun_awalan), akun_awalan: sah.akun_awalan },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ===========================================================================
// SISI PENGATURAN — wajib login
// ===========================================================================

/** Base URL untuk merakit contoh URL yang ditempel ke Talawang. */
/**
 * Alamat API Talawang untuk ditempel di konfigurasi Talawang.
 *
 * MEMAKAI DOMAIN PERMINTAAN, BUKAN PUBLIC_BASE_URL.
 * PUBLIC_BASE_URL mengarah ke domain API terpisah (data-lets...), yang bisa
 * tertinggal versi atau belum dirutekan. Kalau operator menyalin tautan itu,
 * hasilnya gagal dibuka meski pratinjau di halaman berhasil — persis keluhan
 * "pratinjau muncul, URL tidak". Dengan domain yang sama dengan halaman,
 * tautan selalu hidup karena melewati proxy /api/talawang (yang meneruskan
 * rute realisasi/tahun tanpa sesi) dan backend yang sama.
 *
 * Bila operator memang ingin menunjuk domain API terpisah, set
 * TALAWANG_BASE_URL — nilai itu yang dipakai apa adanya.
 */
const baseApi = (req) => {
  const khusus = String(process.env.TALAWANG_BASE_URL || '').trim().replace(/\/+$/, '');
  if (khusus) return `${khusus.replace(/\/api$/i, '')}/api/talawang`;
  return `${originPermintaan(req)}/api/talawang`;
};

router.get('/info', keycloakAuth, (req, res) => {
  const dasar = baseApi(req);
  return res.json({
    success: true,
    data: {
      akun_awalan: AWALAN_TETAP,
      keterangan: `Hanya akun ${AWALAN_TETAP}xxx (Belanja Perjalanan Dinas) yang dapat diakses`,
      nama_akun: NAMA_AKUN,
      endpoint: {
        realisasi: `${dasar}/realisasi?token=<TOKEN>&tahun=<TAHUN>`,
        tahun: `${dasar}/tahun?token=<TOKEN>`,
      },
      contoh: {
        curl: `curl "${dasar}/realisasi?token=<TOKEN>&tahun=2026"`,
      },
    },
  });
});

router.get('/token', keycloakAuth, async (req, res) => {
  try {
    return res.json({ success: true, data: await daftarToken() });
  } catch (e) {
    console.error('[talawang] daftar token gagal:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/token', keycloakAuth, async (req, res) => {
  try {
    const hasil = await terbitkanToken({
      nama: req.body?.nama,
      masa_berlaku_hari: req.body?.masa_berlaku_hari,
      dibuat_oleh: getUsername(req.user),
    });
    return res.status(201).json({
      success: true,
      message: 'Token diterbitkan. Simpan sekarang — token ini juga bisa dilihat lagi di halaman ini.',
      data: { ...hasil, url_contoh: `${baseApi(req)}/realisasi?token=${hasil.token}&tahun=2026` },
    });
  } catch (e) {
    console.error('[talawang] terbitkan token gagal:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.delete('/token/:id', keycloakAuth, async (req, res) => {
  try {
    const berhasil = await cabutToken(req.params.id);
    if (!berhasil) {
      return res.status(404).json({ success: false, message: 'Token tidak ditemukan atau sudah dicabut' });
    }
    return res.json({ success: true, message: 'Token dicabut' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
