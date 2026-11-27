// routes/anggaran-realisasi.js
/**
 * MODUL ANGGARAN DAN REALISASI
 * ----------------------------
 * Impor export SAKTI "Realisasi FA berdasarkan SP2D" dan rekap per MAK.
 *
 * Router ini TIPIS: pembacaan berkas, pembentukan MAK, dan penulisan ke database
 * ada di lib/anggaran.js + lib/mak.js. Dengan begitu unggahan dari browser dan
 * skrip pemuatan awal memakai jalur yang SAMA, hasilnya tidak mungkin beda.
 *
 * Otorisasi TIDAK dipasang di sini. server.js sudah memasang authMiddleware
 * global yang membedakan baca vs tulis (bolehMenulis); menambah penjaga sendiri
 * di router hanya menggandakan aturan dan gampang melenceng.
 *
 * Angka di berkas bertipe TEKS berpemisah titik ribuan ("2.025.000").
 * Number("2.025.000") = NaN, dan NaN yang masuk kolom DECIMAL jadi 0 tanpa
 * error apa pun - karena itu keAngka di lib/anggaran.js wajib dipakai.
 */
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { ringkas, simpanTahun, tahunDariNama } = require('../lib/anggaran');

const router = express.Router();

// Simpan di memori: berkas hanya dibaca sekali lalu dibuang. Batas 16 MB cukup
// untuk rekap SP2D satu tahun (berkas contoh 62 KB).
const unggah = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// GET /api/anggaran-realisasi/tahun  - daftar tahun yang sudah diimpor
// ---------------------------------------------------------------------------
router.get('/tahun', async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT tahun FROM anggaran_realisasi GROUP BY tahun ORDER BY tahun DESC',
    );
    res.json({ success: true, data: rows.map((r) => r.tahun) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/anggaran-realisasi/pilihan?tahun=2026
// Isi daftar Filter: tahun tersedia, kode (komponen: AEA/BAH/BDB/...), dan
// jenis MAK (akun: 524111/521211/...). Satu permintaan untuk ketiga dropdown -
// kalau dipecah, tiga fetch berjalan bersamaan dan dropdown berkedip sendiri-
// sendiri saat halaman pertama dibuka.
// ---------------------------------------------------------------------------
router.get('/pilihan', async (req, res) => {
  const tahun = Number(req.query.tahun);
  try {
    const [tahunRows] = await db.query(
      'SELECT tahun FROM anggaran_realisasi GROUP BY tahun ORDER BY tahun DESC',
    );
    // Tanpa tahun, pakai tahun terbaru supaya dropdown kode/jenis langsung berisi.
    const dipakai = tahun || tahunRows[0]?.tahun || null;
    let komponen = [];
    let akun = [];
    if (dipakai) {
      const [k] = await db.query(
        'SELECT DISTINCT komponen FROM v_anggaran_mak WHERE tahun = ? ORDER BY komponen',
        [dipakai],
      );
      const [a] = await db.query(
        'SELECT DISTINCT akun FROM v_anggaran_mak WHERE tahun = ? ORDER BY akun',
        [dipakai],
      );
      komponen = k.map((r) => r.komponen);
      akun = a.map((r) => r.akun);
    }
    res.json({
      success: true,
      data: {
        tahun: tahunRows.map((r) => r.tahun),
        dipakai,
        komponen,
        akun,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/anggaran-realisasi/ringkasan?tahun=2026
// ---------------------------------------------------------------------------
router.get('/ringkasan', async (req, res) => {
  const tahun = Number(req.query.tahun);
  if (!tahun) return res.status(400).json({ success: false, message: 'Parameter tahun wajib diisi' });
  try {
    res.json({ success: true, data: await ringkas(tahun) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/anggaran-realisasi/detail?tahun=2026&q=&komponen=&akun=&page=1&limit=50
// Daftar MAK (dari view v_anggaran_mak) beserta angka serapannya.
// ---------------------------------------------------------------------------
router.get('/detail', async (req, res) => {
  const tahun = Number(req.query.tahun);
  if (!tahun) return res.status(400).json({ success: false, message: 'Parameter tahun wajib diisi' });

  const q = String(req.query.q ?? '').trim();
  const komponen = String(req.query.komponen ?? '').trim();
  const akun = String(req.query.akun ?? '').trim();
  const urut = String(req.query.urut ?? 'mak');
  const arah = String(req.query.arah ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  const syarat = ['tahun = ?'];
  const params = [tahun];
  if (q) {
    syarat.push('(mak LIKE ? OR akun LIKE ? OR komponen LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (komponen) {
    syarat.push('komponen = ?');
    params.push(komponen);
  }
  if (akun) {
    syarat.push('akun = ?');
    params.push(akun);
  }
  const where = `WHERE ${syarat.join(' AND ')}`;

  // Kolom pengurutan dibatasi daftar putih - nama kolom tidak boleh datang
  // langsung dari query string (celah injeksi kolom).
  const kolomUrut = { mak: 'mak', pagu: 'pagu', realisasi: 'realisasi', sisa: 'sisa', serapan: 'persen_serapan' };
  const orderBy = kolomUrut[urut] || 'mak';

  try {
    const [rows] = await db.query(
      `SELECT mak, unit_kerja, komponen, seg12, seg13, akun, huruf,
              pagu, realisasi, sisa, persen_serapan, jumlah_baris
         FROM v_anggaran_mak ${where} ORDER BY ${orderBy} ${arah}, mak ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const [hitung] = await db.query(`SELECT COUNT(*) AS n FROM v_anggaran_mak ${where}`, params);
    const total = Number(hitung[0]?.n || 0);

    res.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          ...r,
          pagu: Number(r.pagu),
          realisasi: Number(r.realisasi),
          sisa: Number(r.sisa),
          persen_serapan: Number(r.persen_serapan),
          jumlah_baris: Number(r.jumlah_baris),
        })),
        total,
        page,
        limit,
        total_halaman: Math.ceil(total / limit) || 1,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/anggaran-realisasi/per-komponen?tahun=2026  - untuk grafik
// ---------------------------------------------------------------------------
router.get('/per-komponen', async (req, res) => {
  const tahun = Number(req.query.tahun);
  if (!tahun) return res.status(400).json({ success: false, message: 'Parameter tahun wajib diisi' });
  try {
    const [rows] = await db.query(
      `SELECT komponen, SUM(pagu) AS pagu, SUM(realisasi) AS realisasi, SUM(sisa) AS sisa
         FROM v_anggaran_mak WHERE tahun = ? GROUP BY komponen ORDER BY pagu DESC`,
      [tahun],
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        komponen: r.komponen,
        pagu: Number(r.pagu),
        realisasi: Number(r.realisasi),
        sisa: Number(r.sisa),
        persen_serapan: Number(r.pagu) > 0 ? Math.round((Number(r.realisasi) / Number(r.pagu)) * 10000) / 100 : 0,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/anggaran-realisasi/per-akun?tahun=2026 - untuk grafik
// ---------------------------------------------------------------------------
router.get('/per-akun', async (req, res) => {
  const tahun = Number(req.query.tahun);
  if (!tahun) return res.status(400).json({ success: false, message: 'Parameter tahun wajib diisi' });
  try {
    const [rows] = await db.query(
      `SELECT akun, SUM(pagu) AS pagu, SUM(realisasi) AS realisasi, SUM(sisa) AS sisa
         FROM v_anggaran_mak WHERE tahun = ? GROUP BY akun ORDER BY pagu DESC`,
      [tahun],
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        akun: r.akun,
        pagu: Number(r.pagu),
        realisasi: Number(r.realisasi),
        sisa: Number(r.sisa),
        persen_serapan: Number(r.pagu) > 0 ? Math.round((Number(r.realisasi) / Number(r.pagu)) * 10000) / 100 : 0,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/anggaran-realisasi/import  (multipart: berkas + tahun)
// Mengganti SELURUH data tahun tersebut; tahun lain tidak disentuh.
//
// Otorisasi TIDAK dipasang di sini: server.js sudah memasang authMiddleware
// global yang membedakan baca vs tulis (bolehMenulis). Menambah penjaga
// sendiri di router hanya menggandakan aturan dan gampang melenceng.
// ---------------------------------------------------------------------------
router.post('/import', unggah.single('berkas'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Berkas wajib diunggah (field: berkas)' });

  // Tahun dari formulir; kalau kosong, ambil dari nama berkas ("..._2026-11-27").
  let tahun = Number(req.body?.tahun);
  if (!tahun) tahun = tahunDariNama(req.file.originalname);
  if (!tahun || tahun < 2000 || tahun > 2100) {
    return res.status(400).json({ success: false, message: 'Tahun anggaran wajib diisi (4 digit, mis. 2026)' });
  }

  try {
    const hasil = await simpanTahun({
      tahun,
      namaBerkas: req.file.originalname,
      diunggahOleh: req.user?.nama || null,
      buffer: req.file.buffer,
    });
    if (hasil.gagal) {
      return res.status(400).json({
        success: false,
        message: hasil.gagal,
        data: { dilewati: hasil.dilewati, tanpa_mak: (hasil.tanpaMak || []).slice(0, 10) },
      });
    }
    res.json({
      success: true,
      message: `Berhasil mengimpor ${hasil.baris_tersimpan} baris untuk tahun ${tahun}`,
      data: { ...hasil, tanpa_mak: (hasil.tanpaMak || []).slice(0, 10) },
    });
  } catch (e) {
    const pesan = /Berkas|Header|Tahun/.test(e.message) ? e.message : `Impor gagal: ${e.message}`;
    res.status(/Berkas|Header|Tahun/.test(e.message) ? 400 : 500).json({ success: false, message: pesan });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/anggaran-realisasi/data?tahun=2026
// ---------------------------------------------------------------------------
router.delete('/data', async (req, res) => {
  const tahun = Number(req.query.tahun);
  if (!tahun) return res.status(400).json({ success: false, message: 'Parameter tahun wajib diisi' });
  try {
    const [hasil] = await db.query('DELETE FROM anggaran_realisasi WHERE tahun = ?', [tahun]);
    await db.query('DELETE FROM anggaran_import WHERE tahun = ?', [tahun]);
    res.json({
      success: true,
      message: `Data anggaran tahun ${tahun} dihapus (${hasil.affectedRows} baris)`,
      data: { tahun, baris_dihapus: hasil.affectedRows },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
