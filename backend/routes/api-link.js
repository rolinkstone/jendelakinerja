// routes/api-link.js
/**
 * ROUTER API LINK — Jendela Kinerja
 * --------------------------------
 * Dashboard menyediakan TOMBOL per modul untuk menerbitkan LINK API. Link itu
 * berisi token (acak 32 byte) sehingga aplikasi lain (mis. LAURA AI) bisa
 * menarik data modul itu TANPA login SSO.
 *
 *   POST   /api/api-link            terbitkan link untuk satu modul (admin)
 *   GET    /api/api-link            daftar link yang pernah diterbitkan (admin)
 *   DELETE /api/api-link/:id        cabut link (admin)
 *   GET    /api/publik/link/:token  konsumsi link (publik, lihat routes/publik.js)
 *
 * Keamanan:
 *  - token asli HANYA ditampilkan sekali saat diterbitkan; disimpan sha256.
 *  - masa berlaku per link (`masa_berlaku_hari`), dicabut = tidak berlaku lagi.
 *  - hanya data REKAP (angka), tanpa data pribadi petugas.
 */
const crypto = require('crypto');
const express = require('express');
// Dulu menunjuk '../config/database' yang TIDAK ADA di proyek ini, sehingga
// router gagal dimuat dan server mati saat router ini dipasang. Proyek ini
// memakai wrapper pool tunggal di backend/db.js.
const db = require('../db');
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');

const router = express.Router();

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Daftar modul yang boleh menerbitkan link + sumbernya di view gabungan.
 * `sumber` = nilai kolom `sumber` pada v_kinerja_sarana.
 */
const MODUL = {
  pbf: { nama: 'Distribusi PBF', sumber: 'PBF' },
  'produksi-ot': { nama: 'Produksi Obat Tradisional', sumber: 'OT' },
  'produksi-irt': { nama: 'Produksi Pangan IRT', sumber: 'IRTP' },
  'sampel-ot': { nama: 'Sampel Obat Tradisional', sumber: 'SAMPEL_OT' },
  'sampel-sk': { nama: 'Sampel Suplemen Kesehatan', sumber: 'SAMPEL_SK' },
  'sampel-ob': { nama: 'Sampel Obat', sumber: 'SAMPEL_OB' },
  'sampel-kos': { nama: 'Sampel Kosmetika', sumber: 'SAMPEL_KOS' },
  'sampel-pp': { nama: 'Sampel Produk Pangan', sumber: 'SAMPEL_PP' },
  'sampel-kp': { nama: 'Sampel Kemasan Pangan', sumber: 'SAMPEL_KP' },
  'sampel-ok': { nama: 'Sampel Obat Kuasi', sumber: 'SAMPEL_OK' }
};

const batasi = (v, maks) => String(v ?? '').slice(0, maks);

/** Base URL publik JK — dipakai saat merakit link yang ditempel ke aplikasi lain. */
const basePublic = (req) => {
  const dariEnv = process.env.PUBLIC_BASE_URL || process.env.JK_PUBLIC_URL;
  if (dariEnv) return dariEnv.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  return `${proto}://${req.get('host')}`;
};

// ---------------------------------------------------------------------------
// POST /api/api-link — terbitkan link API untuk satu modul
// ---------------------------------------------------------------------------
router.post('/', keycloakAuth, async (req, res) => {
  const modul = batasi(req.body?.modul, 30);
  const masaBerlaku = Math.min(Math.max(Number(req.body?.masa_berlaku_hari) || 30, 1), 3650);

  if (!MODUL[modul]) {
    return res.status(400).json({
      success: false,
      message: `Modul tidak dikenal. Pilihan: ${Object.keys(MODUL).join(', ')}`
    });
  }

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const kedaluwarsa = new Date(Date.now() + masaBerlaku * 24 * 3600 * 1000);

    const [hasil] = await db.query(
      `INSERT INTO api_link (modul, nama_modul, token_hash, masa_berlaku_hari, kedaluwarsa_pada, dibuat_oleh)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [modul, MODUL[modul].nama, sha256(token), masaBerlaku,
        kedaluwarsa.toISOString().slice(0, 19).replace('T', ' '), getUsername(req.user)]
    );

    const link = `${basePublic(req)}/api/publik/link/${token}`;

    return res.status(201).json({
      success: true,
      message: 'Link API diterbitkan — salin sekarang, link tidak ditampilkan lagi',
      data: {
        id: hasil.insertId,
        modul,
        nama_modul: MODUL[modul].nama,
        link,
        masa_berlaku_hari: masaBerlaku,
        kedaluwarsa_pada: kedaluwarsa.toISOString()
      }
    });
  } catch (e) {
    console.error('Gagal menerbitkan link API:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/api-link — daftar link (token TIDAK ditampilkan)
// ---------------------------------------------------------------------------
router.get('/', keycloakAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, modul, nama_modul, masa_berlaku_hari, terbit_pada, kedaluwarsa_pada,
              dicabut_pada, dibuat_oleh, jumlah_akses, akses_terakhir,
              CASE
                WHEN dicabut_pada IS NOT NULL THEN 'dicabut'
                WHEN kedaluwarsa_pada <= NOW() THEN 'kedaluwarsa'
                WHEN kedaluwarsa_pada <= DATE_ADD(NOW(), INTERVAL 3 DAY) THEN 'segera_kedaluwarsa'
                ELSE 'aktif'
              END AS status
         FROM api_link
        ORDER BY terbit_pada DESC`
    );
    return res.json({
      success: true,
      data: { daftar_modul: Object.entries(MODUL).map(([kode, m]) => ({ kode, nama: m.nama })), link: rows }
    });
  } catch (e) {
    console.error('Gagal membaca daftar link API:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/api-link/:id — cabut link
// ---------------------------------------------------------------------------
router.delete('/:id', keycloakAuth, async (req, res) => {
  try {
    const [hasil] = await db.query(
      'UPDATE api_link SET dicabut_pada = NOW() WHERE id = ? AND dicabut_pada IS NULL',
      [req.params.id]
    );
    if (!hasil.affectedRows) {
      return res.status(404).json({ success: false, message: 'Link tidak ditemukan / sudah dicabut' });
    }
    return res.json({ success: true, message: 'Link dicabut' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// Konsumsi link — dipasang di router publik: GET /api/publik/link/:token
// ---------------------------------------------------------------------------
const KOLOM = `sumber, sumber_label, kegiatan, jenis_sarana, tahun, bulan, kab_kota,
               nama_sarana, kesimpulan_akhir, jumlah_mayor, jumlah_minor,
               jumlah_lain, jumlah_kritis, jumlah_sampel_lab`;

/** Rakit rekap dari view gabungan untuk satu sumber (dipakai konsumsi link). */
const rekapModul = async (sumber) => {
  const [tahun] = await db.query(
    `SELECT tahun, COUNT(*) AS baris,
            SUM(jumlah_sampel_lab) AS sampel_lab,
            SUM(kesimpulan_akhir LIKE '%Memenuhi%' AND kesimpulan_akhir NOT LIKE '%Tidak%') AS memenuhi,
            SUM(kesimpulan_akhir LIKE '%Tidak Memenuhi%') AS tidak_memenuhi
       FROM v_kinerja_sarana WHERE sumber = ?
      GROUP BY tahun ORDER BY tahun DESC`,
    [sumber]
  );
  const [kab] = await db.query(
    `SELECT COALESCE(NULLIF(kab_kota,''),'Tidak diketahui') AS kab_kota, COUNT(*) AS baris,
            SUM(jumlah_sampel_lab) AS sampel_lab,
            SUM(kesimpulan_akhir LIKE '%Tidak Memenuhi%') AS tidak_memenuhi
       FROM v_kinerja_sarana WHERE sumber = ?
      GROUP BY 1 ORDER BY baris DESC`,
    [sumber]
  );
  const [jenis] = await db.query(
    `SELECT COALESCE(jenis_sarana,'-') AS jenis_sarana, COUNT(*) AS baris,
            SUM(jumlah_sampel_lab) AS sampel_lab
       FROM v_kinerja_sarana WHERE sumber = ?
      GROUP BY 1 ORDER BY baris DESC`,
    [sumber]
  );
  const [bulan] = await db.query(
    `SELECT tahun, bulan, COUNT(*) AS baris FROM v_kinerja_sarana
      WHERE sumber = ? AND bulan IS NOT NULL GROUP BY 1,2 ORDER BY 1 DESC, 2`,
    [sumber]
  );
  const [sarana] = await db.query(
    `SELECT COALESCE(NULLIF(nama_sarana,''),'Tanpa nama') AS nama_sarana, COUNT(*) AS baris
       FROM v_kinerja_sarana WHERE sumber = ?
      GROUP BY 1 ORDER BY baris DESC LIMIT 15`,
    [sumber]
  );
  return { tahun, per_kab_kota: kab, per_jenis_sarana: jenis, per_bulan: bulan, sarana_terbanyak: sarana };
};

/** Handler konsumsi link (publik) — dipasang sebagai GET /api/publik/link/:token */
const konsumsiLink = async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ success: false, message: 'Token tidak valid' });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, modul, nama_modul, masa_berlaku_hari, terbit_pada, kedaluwarsa_pada, dicabut_pada
         FROM api_link WHERE token_hash = ?`,
      [sha256(token)]
    );
    const link = rows[0];
    if (!link) return res.status(404).json({ success: false, message: 'Link tidak dikenal' });
    if (link.dicabut_pada) return res.status(410).json({ success: false, message: 'Link sudah dicabut' });
    if (new Date(link.kedaluwarsa_pada) <= new Date()) {
      return res.status(410).json({ success: false, message: 'Link sudah kedaluwarsa' });
    }

    const modul = MODUL[link.modul];
    if (!modul) return res.status(422).json({ success: false, message: 'Modul link tidak dikenal' });

    await db.query('UPDATE api_link SET jumlah_akses = jumlah_akses + 1, akses_terakhir = NOW() WHERE id = ?', [link.id]);

    const rekap = await rekapModul(modul.sumber);

    return res.json({
      success: true,
      data: {
        modul: link.modul,
        nama_modul: link.nama_modul,
        sumber: modul.sumber,
        diterbitkan: link.terbit_pada,
        kedaluwarsa_pada: link.kedaluwarsa_pada,
        diambil_pada: new Date().toISOString(),
        ...rekap
      }
    });
  } catch (e) {
    console.error('Konsumsi link API gagal:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = router;
module.exports.konsumsiLink = konsumsiLink;
module.exports.MODUL = MODUL;
