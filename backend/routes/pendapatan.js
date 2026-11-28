// routes/pendapatan.js
/**
 * MODUL PENDAPATAN
 * ----------------
 * Impor export SAKTI "ADK REALISASI PENDAPATAN (SUMBER DATA : SAKTI) PER SATKER"
 * lalu rekap realisasi pendapatan per bulan dan per akun.
 *
 * Router ini TIPIS: pembacaan berkas dan penulisan database ada di
 * lib/pendapatan.js, sehingga unggahan dari browser dan skrip pemuatan awal
 * memakai jalur yang SAMA.
 *
 * Otorisasi TIDAK dipasang di sini — server.js memasang authMiddleware global
 * (baca butuh token, tulis butuh peran). Menambah penjaga sendiri di router
 * hanya menggandakan aturan dan gampang melenceng.
 *
 * Endpoint:
 *   GET    /api/pendapatan/ringkasan?tahun=2026   rekap per akun + per bulan
 *   GET    /api/pendapatan/pilihan               daftar tahun yang ada datanya
 *   POST   /api/pendapatan/import                multipart `berkas` + `tahun`
 *   DELETE /api/pendapatan/data?tahun=2026       hapus seluruh tahun
 */
const express = require('express');
const multer = require('multer');
const db = require('../db');
const {
  NAMA_AKUN,
  bacaPendapatan,
  simpanPendapatan,
  rekapPendapatan,
} = require('../lib/pendapatan');

const router = express.Router();

// Simpan di memori: berkas dibaca sekali lalu dibuang. Batas 16 MB jauh di atas
// kebutuhan (berkas contoh 93 KB untuk 514 dokumen setahun).
const unggah = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
});

/**
 * Tahun dari nama berkas ADK ("... ANGGARAN 2026_2026-11-28_1119.csv").
 * Dipakai hanya sebagai cadangan bila kolom TAHUN_ANGGARAN tidak ada.
 */
function tahunDariNama(nama) {
  const m = String(nama || '').match(/ANGGARAN[_\s]+(\d{4})/i);
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------------------
// GET /api/pendapatan/pilihan — daftar tahun yang sudah punya data
// ---------------------------------------------------------------------------
router.get('/pilihan', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT tahun, COUNT(*) AS baris FROM pendapatan_bulanan GROUP BY tahun ORDER BY tahun DESC',
    );
    const [meta] = await db.query(
      'SELECT tahun, nama_berkas, jumlah_baris, jumlah_dokumen, total, diunggah_pada FROM pendapatan_import ORDER BY tahun DESC',
    );
    const tahunAktif = Number(req.query.tahun) || rows[0]?.tahun || null;
    const [akun] = tahunAktif
      ? await db.query(
          'SELECT DISTINCT akun FROM pendapatan_bulanan WHERE tahun = ? ORDER BY akun',
          [tahunAktif],
        )
      : [[]];

    res.json({
      success: true,
      data: {
        tahun: rows.map((r) => r.tahun),
        tahun_aktif: tahunAktif,
        akun: akun.map((a) => ({ akun: a.akun, nama: NAMA_AKUN[a.akun] || `Akun ${a.akun}` })),
        berkas: meta,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pendapatan/ringkasan?tahun=2026
//   total, per_akun (12 angka per bulan), per_bulan (kumulatif),
//   daftar_tahun, dan metadata berkas.
// ---------------------------------------------------------------------------
router.get('/ringkasan', async (req, res) => {
  try {
    const [tahunRows] = await db.query(
      'SELECT tahun FROM pendapatan_bulanan GROUP BY tahun ORDER BY tahun DESC',
    );
    const tahun = Number(req.query.tahun) || tahunRows[0]?.tahun || null;

    // Tahun tanpa data tetap dijawab 200 dengan angka nol; halaman menampilkan
    // status kosong, bukan galat. Ini penting agar satu panel kosong tidak
    // menjatuhkan seluruh halaman.
    const rekap = tahun ? await rekapPendapatan(tahun) : { perAkun: [], perBulan: [], total: 0 };
    const [meta] = tahun
      ? await db.query('SELECT nama_berkas, jumlah_dokumen, diunggah_pada FROM pendapatan_import WHERE tahun = ?', [tahun])
      : [[]];

    res.json({
      success: true,
      data: {
        tahun,
        total: rekap.total,
        per_akun: rekap.perAkun,
        per_bulan: rekap.perBulan,
        daftar_tahun: tahunRows.map((r) => r.tahun),
        berkas: meta[0] || null,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pendapatan/import  (multipart: berkas CSV, field opsional `tahun`)
// ---------------------------------------------------------------------------
router.post('/import', unggah.single('berkas'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Berkas wajib diunggah (field: berkas)' });

  try {
    const isi = req.file.buffer.toString('utf8');

    // Periksa dulu apakah ini berkas pendapatan, supaya pesan galat jelas dan
    // tidak ada data yang setengah tersimpan.
    const intip = bacaPendapatan(isi);
    const tahunDiminta = Number(req.body?.tahun) || intip.tahun || tahunDariNama(req.file.originalname);
    if (!tahunDiminta) {
      return res.status(400).json({ success: false, message: 'Tahun anggaran tidak terbaca; sertakan field tahun.' });
    }

    const hasil = await simpanPendapatan({
      isi,
      namaBerkas: req.file.originalname,
      diunggahOleh: req.user?.nama || req.user?.name || null,
    });

    res.json({
      success: true,
      message:
        `Pendapatan ${hasil.tahun} tersimpan: ${hasil.dokumen} dokumen, ` +
        `${hasil.barisSah} baris terbaca, total ${hasil.total.toLocaleString('id-ID')}` +
        (hasil.rentang ? ` (rentang ${hasil.rentang})` : ''),
      data: {
        tahun: hasil.tahun,
        dokumen: hasil.dokumen,
        baris: hasil.barisSah,
        dilewati: hasil.dilewati,
        total: hasil.total,
        bulan: hasil.bulan,
        rentang: hasil.rentang,
        rekap: await rekapPendapatan(hasil.tahun),
      },
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/pendapatan/data?tahun=2026 — hapus seluruh tahun (impor ulang)
// ---------------------------------------------------------------------------
router.delete('/data', async (req, res) => {
  const tahun = Number(req.query.tahun);
  if (!tahun) return res.status(400).json({ success: false, message: 'Parameter tahun wajib diisi' });
  try {
    const [hasil] = await db.query('DELETE FROM pendapatan_bulanan WHERE tahun = ?', [tahun]);
    await db.query('DELETE FROM pendapatan_import WHERE tahun = ?', [tahun]);
    res.json({
      success: true,
      message: `Data pendapatan tahun ${tahun} dikosongkan (${hasil.affectedRows} baris)`,
      data: { tahun, baris_dihapus: hasil.affectedRows },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
