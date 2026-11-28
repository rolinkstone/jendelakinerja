// backend/routes/narasi-presentasi.js
/**
 * ============================================================================
 *  ROUTER NARASI PRESENTASI — koreksi naskah 1 menit
 * ============================================================================
 *  Dipakai dua pihak:
 *
 *  1. DASHBOARD (ber-SSO, butuh token) — halaman Beranda → Narasi Presentasi:
 *       GET    /api/narasi-presentasi?limit=   daftar koreksi
 *       POST   /api/narasi-presentasi         simpan/ubah naskah satu filter
 *       DELETE /api/narasi-presentasi/:id      hapus koreksi (kembali otomatis)
 *
 *  2. HALAMAN PUBLIK /jendela-kinerja (tanpa token) — widget LAURA:
 *       GET    /api/narasi-presentasi/aktif?tahun=&bulan=&kegiatan=&jenis=&kab=
 *
 *  Kenapa /aktif publik: naskahnya memang dibacakan di halaman publik, jadi
 *  membacanya tidak membuka apa pun yang belum tampil di layar. Menyimpan dan
 *  menghapus tetap wajib token — hanya operator yang boleh mengoreksi.
 *
 *  Naskah untuk filter yang belum dikoreksi TIDAK dikarang di sini: endpoint
 *  /aktif menjawab success:false + 404, lalu widget meminta naskah otomatis ke
 *  LAURA AI. Satu sumber benar untuk "belum ada koreksi".
 * ============================================================================
 */
const express = require('express');
const { keycloakAuth, hanyaAdmin } = require('../middleware/keycloakAuth');
const db = require('../db');
const { rapikan, kunciFilter, labelFilter } = require('../lib/narasi');

const router = express.Router();

/** Batas panjang naskah — 1 menit bicara ≈ 900 karakter, 4000 sangat longgar. */
const MAKS_NASKAH = 4000;
/** Batas bawah: naskah 3 detik bukan presentasi. */
const MIN_NASKAH = 80;

/** Bungkus naskah ke bentuk balasan standar. */
const bentuk = (row) => ({
  id: row.id,
  kunci: row.kunci,
  filter: typeof row.filter === 'string' ? safeJson(row.filter) : row.filter || {},
  label: row.label,
  naskah: row.naskah,
  sumber: row.sumber,
  catatan: row.catatan,
  diubah_oleh: row.diubah_oleh,
  diubah_pada: row.diubah_pada,
  jumlah_kata: String(row.naskah || '').trim().split(/\s+/).filter(Boolean).length,
});

const safeJson = (t) => {
  try { return JSON.parse(t); } catch { return {}; }
};

/**
 * GET /api/narasi-presentasi/aktif
 * Dibaca widget publik. Tanpa koreksi → 404 (widget lanjut ke LAURA AI).
 */
router.get('/aktif', async (req, res, next) => {
  try {
    const filter = rapikan(req.query || {});
    const kunci = kunciFilter(filter);
    const [rows] = await db.query(
      'SELECT * FROM narasi_presentasi WHERE kunci = ? LIMIT 1',
      [kunci]
    );
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        code: 'BELUM_DIKOREKSI',
        message: 'Belum ada koreksi untuk filter ini. Pakai naskah otomatis.',
        kunci
      });
    }
    return res.json({ success: true, data: bentuk(rows[0]) });
  } catch (err) {
    next(err);
  }
});

/** GET /api/narasi-presentasi — daftar koreksi tersimpan (dashboard). */
router.get('/', async (req, res, next) => {
  try {
    const batas = Math.min(Number(req.query.limit) || 50, 200);
    const [rows] = await db.query(
      `SELECT * FROM narasi_presentasi ORDER BY diubah_pada DESC LIMIT ${batas}`
    );
    return res.json({
      success: true,
      total: rows.length,
      data: rows.map(bentuk)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/narasi-presentasi — simpan / ubah koreksi satu filter.
 * Body: { filter: {...}, naskah, catatan? }
 * Upsert by kunci: satu filter = satu naskah berlaku.
 */
router.post('/', keycloakAuth, hanyaAdmin, async (req, res, next) => {
  try {
    const { filter = {}, naskah = '', catatan = null } = req.body || {};
    const teks = String(naskah).replace(/\s+/g, ' ').trim();

    if (!teks) {
      return res.status(400).json({ success: false, message: 'Naskah tidak boleh kosong' });
    }
    if (teks.length < MIN_NASKAH) {
      return res.status(400).json({
        success: false,
        message: `Naskah terlalu pendek (${teks.length} karakter). Minimal ${MIN_NASKAH} karakter agar presentasi tetap ±1 menit.`
      });
    }
    if (teks.length > MAKS_NASKAH) {
      return res.status(400).json({
        success: false,
        message: `Naskah terlalu panjang (${teks.length} karakter, maksimal ${MAKS_NASKAH}).`
      });
    }

    const f = rapikan(filter);
    const kunci = kunciFilter(f);
    const label = labelFilter(f);
    const oleh = req.user?.username || req.user?.email || null;

    await db.query(
      `INSERT INTO narasi_presentasi (kunci, filter, label, naskah, sumber, catatan, diubah_oleh)
       VALUES (?, ?, ?, ?, 'koreksi', ?, ?)
       ON DUPLICATE KEY UPDATE
         filter = VALUES(filter),
         label = VALUES(label),
         naskah = VALUES(naskah),
         sumber = VALUES(sumber),
         catatan = VALUES(catatan),
         diubah_oleh = VALUES(diubah_oleh)`,
      [kunci, JSON.stringify(f), label, teks, catatan || null, oleh]
    );

    const [rows] = await db.query('SELECT * FROM narasi_presentasi WHERE kunci = ?', [kunci]);
    return res.json({
      success: true,
      message: `Koreksi tersimpan untuk ${label}. Widget di /jendela-kinerja memakai naskah ini.`,
      data: bentuk(rows[0])
    });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/narasi-presentasi/:id — hapus koreksi, naskah otomatis dipakai lagi. */
router.delete('/:id', keycloakAuth, hanyaAdmin, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM narasi_presentasi WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Koreksi tidak ditemukan' });
    }
    await db.query('DELETE FROM narasi_presentasi WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      message: `Koreksi untuk ${rows[0].label || 'filter ini'} dihapus. Naskah otomatis dipakai lagi.`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
