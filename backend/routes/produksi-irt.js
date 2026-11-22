// backend/routes/produksi-irt.js
/**
 * ============================================================
 *  ROUTER PRODUKSI — PANGAN IRT (CPPB - IRT)
 *  Impor laporan Excel per tahun
 * ============================================================
 *  Sumber berkas: "Laporan Hasil Pemeriksaan Sarana Produksi - Pangan IRT"
 *  (export SIPT, satu sheet, satu baris = satu sarana produksi pangan IRT).
 *
 *  ATURAN IMPOR (per tahun) — identik dengan Distribusi PBF & Produksi OT
 *  ---------------------------------------------------------------------
 *  Setiap unggahan terikat pada SATU TAHUN data. Yang dihapus lalu diisi ulang
 *  hanya baris milik tahun tersebut — data tahun lain tidak tersentuh. Jadi
 *  impor 2025 dan 2026 bisa hidup berdampingan.
 *
 *  Tahun ditentukan dengan urutan:
 *    1. field `tahun` pada multipart (dipilih pengguna di UI), bila diisi;
 *    2. deteksi otomatis dari berkas (periode → tanggal entri → tanggal periksa);
 *    3. gagal → 400, pengguna diminta memilih tahun manual.
 *
 *  PETA KOLOM BERKAS
 *  -----------------
 *  Baris 0-6  : identitas berkas (jenis sarana, periode, balai, dst.)
 *  Baris 7-8  : header dua tingkat (merge) — lihat KOLOM di bawah
 *  Baris 9+   : data. Satu baris = satu sarana (tidak ada baris rincian).
 *
 *  Beda dengan OT: berkas ini punya kolom Penyimpangan/Kriteria/Timeline per
 *  baris, kolom Level IRTP, dan blok verifikasi pusat (operator s.d. detil
 *  tindak lanjut) — semuanya ikut disimpan.
 *
 *  SEMUA endpoint di router ini butuh header `Authorization: Bearer ***
 *  (dipenuhi oleh proxy frontend pages/api/produksi-irt/[...path].js).
 * ============================================================
 */
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool } = require('../db');
const { lengkapiBaris } = require('../lib/kinerja');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

/** Tahun data yang masuk akal untuk modul ini. */
const TAHUN_MIN = 2000;
const TAHUN_MAX = 2100;

/**
 * Indeks kolom (0-based) pada baris data — mengikuti header dua tingkat
 * baris 7-8 berkas Pangan IRT (40 kolom).
 */
const KOLOM = {
  no_urut: 0,
  nama_balai: 1,
  nama_sarana: 2,
  alamat: 3,
  kab_kota: 4,
  jenis_industri: 5,
  tgl_input: 6,
  tgl_periksa_mulai: 7,
  tgl_periksa_selesai: 8,
  tujuan_pemeriksaan: 9,
  status_sarana: 10,
  penyimpangan: 11,
  kriteria: 12,
  timeline: 13,
  jumlah_mayor: 14,
  jumlah_minor: 15,
  jumlah_serius: 16,
  jumlah_kritis: 17,
  level_irtp: 18,
  hasil_balai: 19,
  tindak_lanjut: 20,
  grading: 21,
  operator: 22,
  petugas: 23,
  status_tarikan: 24,
  kepala_balai: 25,
  tgl_kirim_ka_balai: 26,
  verif_operator_pusat: 27,
  verif_tgl_operator: 28,
  verif_supervisor_1: 29,
  verif_tgl_supervisor_1: 30,
  verif_supervisor_2: 31,
  verif_tgl_supervisor_2: 32,
  direktur: 33,
  verif_tgl_direktur: 34,
  verif_hasil_kesimpulan: 35,
  verif_hasil_temuan: 36,
  verif_catatan: 37,
  verif_saran_tindak_lanjut: 38,
  verif_detil_tindak_lanjut: 39,
};

/** Kolom yang disimpan sebagai angka, bukan teks. */
const KOLOM_ANGKA = ['jumlah_mayor', 'jumlah_minor', 'jumlah_serius', 'jumlah_kritis'];

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Serial tanggal Excel (1900) → Date. Epoch Excel memakai basis 1899-12-30. */
function serialKeTanggal(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}

/** Format tanggal gaya berkas sumber: "16 November 2026". */
function formatTanggal(d) {
  return `${String(d.getUTCDate()).padStart(2, '0')} ${BULAN_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Sisa salah-kode (mojibake) yang sering muncul di export Excel instansi. */
const MOJIBAKE = [
  ['â—', '•'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€“', '–'],
  ['â€”', '—'],
  ['â€', '”'],
  ['Â·', '·'],
  ['Â ', ' '],
];

/** Pulihkan karakter yang ter-salah-kode saat berkas diekspor. */
function rapikanMojibake(s) {
  let hasil = s;
  for (const [dari, ke] of MOJIBAKE) hasil = hasil.split(dari).join(ke);
  return hasil;
}

/** Nilai sel → teks siap simpan. Tanggal/serial angka dirapikan. */
function teks(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return formatTanggal(v);
  if (typeof v === 'number') {
    // Serial tanggal Excel wajar berada di rentang ini; angka lain dibiarkan.
    if (v > 20000 && v < 80000 && Number.isInteger(v)) return formatTanggal(serialKeTanggal(v));
    return String(v);
  }
  const s = rapikanMojibake(String(v).replace(/\s+/g, ' ').trim());
  return s === '' ? null : s;
}

/** Nilai sel → angka bulat (untuk kolom M/m/S/C dan nomor). */
function keAngka(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Ambil tahun (4 digit) terakhir dari sebuah teks, mis. "31 Desember 2025" → 2025. */
function tahunDariTeks(nilai) {
  const cocok = String(nilai || '').match(/(?:19|20)\d{2}/g);
  if (!cocok || !cocok.length) return null;
  const angka = Number(cocok[cocok.length - 1]);
  return angka >= TAHUN_MIN && angka <= TAHUN_MAX ? angka : null;
}

/**
 * Tebak tahun data dari isi berkas.
 * Urutan: periode pemeriksaan → periode entri → tahun terbanyak di baris data.
 */
function deteksiTahun(hasil) {
  const dariMeta = [
    hasil.meta.periode_akhir,
    hasil.meta.periode_awal,
    hasil.meta.tanggal_entri_akhir,
    hasil.meta.tanggal_entri_awal,
  ];
  for (const teksMeta of dariMeta) {
    const t = tahunDariTeks(teksMeta);
    if (t) return t;
  }

  const hitung = new Map();
  for (const l of hasil.laporan) {
    for (const kol of ['tgl_periksa_selesai', 'tgl_periksa_mulai', 'tgl_input']) {
      const t = tahunDariTeks(l[kol]);
      if (t) hitung.set(t, (hitung.get(t) || 0) + 1);
    }
  }
  let terpilih = null;
  let maks = 0;
  for (const [t, jumlah] of hitung) {
    if (jumlah > maks) {
      maks = jumlah;
      terpilih = t;
    }
  }
  return terpilih;
}

/** Query `?tahun=` → angka tahun, atau null (= semua tahun). */
function bacaTahunQuery(nilai) {
  const s = String(nilai ?? '').trim();
  if (!s || s === 'semua') return { tahun: null };
  if (!/^\d{4}$/.test(s)) return { galat: 'Parameter tahun harus 4 digit (mis. 2025)' };
  const angka = Number(s);
  if (angka < TAHUN_MIN || angka > TAHUN_MAX) {
    return { galat: `Tahun harus di antara ${TAHUN_MIN} dan ${TAHUN_MAX}` };
  }
  return { tahun: angka };
}

/** Judul/ketebalan header — dipakai untuk membuang baris total di akhir berkas. */
function berupaHeader(sel) {
  const s = String(sel ?? '').toLowerCase();
  return s.includes('jumlah') || s.includes('total');
}

/**
 * Baca workbook → { meta, laporan[] }.
 * Berkas Pangan IRT tidak punya baris rincian: satu baris bernomor = satu laporan.
 */
function bacaWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const namaSheet = wb.SheetNames[0];
  const ws = wb.Sheets[namaSheet];
  if (!ws) throw new Error('Berkas tidak berisi sheet apa pun');

  const baris = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });

  // Header dua tingkat: baris pertama yang kolom A-nya "No."
  const idxHeader = baris.findIndex(
    (r) => r && String(r[0] || '').replace(/\./g, '').trim().toLowerCase() === 'no',
  );
  if (idxHeader < 0) throw new Error('Baris header ("No.") tidak ditemukan di berkas');

  const ambil = (r, c) => (baris[r] ? baris[r][c] : null);

  // Kolom opsional "sampel" — kalau ada, nilainya ikut disimpan walau tidak
  // tergambar di UI utama.
  const gabungHeader = [...(baris[idxHeader] || []), ...(baris[idxHeader + 1] || [])];
  const idxSampel = gabungHeader.findIndex((sel) => /sampel/i.test(String(sel ?? '')));

  const meta = {
    sheet: namaSheet,
    jenis_sarana: teks(ambil(1, 2)),
    periode_awal: teks(ambil(2, 2)),
    periode_akhir: teks(ambil(3, 2)),
    tanggal_entri_awal: teks(ambil(4, 2)),
    tanggal_entri_akhir: teks(ambil(5, 2)),
    balai: teks(ambil(6, 2)),
  };

  const laporan = [];

  // Lewati dua baris header (tingkat 1 & 2).
  for (let i = idxHeader + 2; i < baris.length; i += 1) {
    const r = baris[i] || [];
    const noMentah = r[KOLOM.no_urut];
    const adaNomor = noMentah !== null && noMentah !== undefined && String(noMentah).trim() !== '';
    if (!adaNomor) continue;

    // Baris total di kaki tabel ("Jumlah", "Total") bukan data sarana.
    if (berupaHeader(noMentah)) continue;

    const sekarang = {};
    Object.entries(KOLOM).forEach(([kol, idx]) => {
      sekarang[kol] = KOLOM_ANGKA.includes(kol) ? keAngka(r[idx]) : teks(r[idx]);
    });
    sekarang.no_urut = keAngka(noMentah);
    sekarang.jumlah_sampel_lab = idxSampel >= 0 ? keAngka(r[idxSampel]) : null;
    laporan.push(sekarang);
  }

  return { meta, laporan };
}

const KOLOM_LAPORAN = [...Object.keys(KOLOM), 'jumlah_sampel_lab'];

/**
 * Hapus data SATU tahun (laporan + metadata impor).
 * FK irt_laporan → irt_import ON DELETE CASCADE, jadi laporan ikut terhapus.
 */
async function hapusTahun(conn, tahun) {
  await conn.query('DELETE FROM irt_laporan WHERE tahun = ?', [tahun]);
  const [hasilImpor] = await conn.query('DELETE FROM irt_import WHERE tahun = ?', [tahun]);
  return hasilImpor.affectedRows || 0;
}

/** Hitung isi satu tahun SEBELUM diganti (untuk pesan ke pengguna). */
async function hitungTahun(conn, tahun) {
  const [[laporan]] = await conn.query('SELECT COUNT(*) AS n FROM irt_laporan WHERE tahun = ?', [tahun]);
  return { laporan: Number(laporan?.n || 0) };
}

/** Kosongkan SELURUH isi tabel modul ini (dipakai DELETE /data tanpa tahun). */
async function kosongkan(conn) {
  await conn.query('DELETE FROM irt_laporan');
  await conn.query('DELETE FROM irt_import');
}

// ---------------------------------------------------------------------------
// POST /api/produksi-irt/import — unggah berkas Excel, GANTI data tahun terpilih
//   multipart: berkas (file), tahun (opsional, 4 digit; kosong = otomatis)
// ---------------------------------------------------------------------------
router.post('/import', (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      const pesan = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran berkas melebihi 15 MB'
        : `Gagal membaca unggahan: ${err.message}`;
      return res.status(400).json({ success: false, message: pesan });
    }
    return next();
  });
}, async (req, res) => {
  const berkas = (req.files || [])[0];
  if (!berkas) {
    return res.status(400).json({ success: false, message: 'Tidak ada berkas yang diunggah' });
  }

  const ekstensi = (berkas.originalname.split('.').pop() || '').toLowerCase();
  if (!['xlsx', 'xls', 'xlsm'].includes(ekstensi)) {
    return res.status(400).json({
      success: false,
      message: 'Format berkas harus .xlsx / .xls / .xlsm',
    });
  }

  // Tahun pilihan pengguna (kalau ada) divalidasi lebih dulu.
  const tahunMentah = String((req.body && req.body.tahun) || '').trim();
  let tahunPilihan = null;
  if (tahunMentah && tahunMentah.toLowerCase() !== 'otomatis') {
    if (!/^\d{4}$/.test(tahunMentah)) {
      return res.status(400).json({ success: false, message: 'Tahun data harus 4 digit (mis. 2025)' });
    }
    tahunPilihan = Number(tahunMentah);
    if (tahunPilihan < TAHUN_MIN || tahunPilihan > TAHUN_MAX) {
      return res.status(400).json({
        success: false,
        message: `Tahun data harus di antara ${TAHUN_MIN} dan ${TAHUN_MAX}`,
      });
    }
  }

  let hasil;
  try {
    hasil = bacaWorkbook(berkas.buffer);
  } catch (e) {
    return res.status(400).json({ success: false, message: `Berkas gagal dibaca: ${e.message}` });
  }

  if (!hasil.laporan.length) {
    return res.status(400).json({
      success: false,
      message: 'Tidak ada baris data yang terbaca. Pastikan berkas memakai format laporan yang benar.',
    });
  }

  const tahunTerdeteksi = deteksiTahun(hasil);
  const tahun = tahunPilihan ?? tahunTerdeteksi;
  if (!tahun) {
    return res.status(400).json({
      success: false,
      message: 'Tahun data tidak bisa dideteksi dari berkas. Pilih tahun data secara manual lalu unggah ulang.',
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const sebelum = await hitungTahun(conn, tahun);
    await hapusTahun(conn, tahun);

    const [imp] = await conn.query(
      `INSERT INTO irt_import
        (tahun, berkas, sheet, jenis_sarana, periode_awal, periode_akhir, tanggal_entri_awal,
         tanggal_entri_akhir, balai, jumlah_laporan, diunggah_oleh)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        tahun, berkas.originalname, hasil.meta.sheet, hasil.meta.jenis_sarana,
        hasil.meta.periode_awal, hasil.meta.periode_akhir, hasil.meta.tanggal_entri_awal,
        hasil.meta.tanggal_entri_akhir, hasil.meta.balai, hasil.laporan.length,
        req.user?.name || req.user?.username || null,
      ],
    );

    const sqlLaporan = `INSERT INTO irt_laporan
      (import_id, tahun, kegiatan, jenis_sarana, bulan, ${KOLOM_LAPORAN.join(', ')})
     VALUES (?, ?, ?, ?, ?, ${KOLOM_LAPORAN.map(() => '?').join(', ')})`;

    for (const l of hasil.laporan) {
      // Kolom turunan (kegiatan/jenis sarana dari kepala berkas, bulan dari
      // tanggal periksa) diisi di sini supaya dashboard publik bisa menyaring
      // tanpa join. Lihat lib/kinerja.js.
      const turunan = lengkapiBaris(l, hasil.meta.jenis_sarana);
      const nilai = [
        imp.insertId, tahun, turunan.kegiatan, turunan.jenis_sarana, turunan.bulan,
        ...KOLOM_LAPORAN.map((k) => l[k] ?? null),
      ];
      await conn.query(sqlLaporan, nilai);
    }

    await conn.commit();

    const pengganti = sebelum.laporan > 0
      ? `menggantikan ${sebelum.laporan} laporan tahun ${tahun}`
      : `data tahun ${tahun} sebelumnya kosong`;

    return res.json({
      success: true,
      message: `Impor selesai — ${hasil.laporan.length} laporan untuk tahun ${tahun} (${pengganti}). Tahun lain tidak diubah.`,
      data: {
        import_id: imp.insertId,
        tahun,
        tahun_terdeteksi: tahunTerdeteksi,
        tahun_dipilih_manual: tahunPilihan !== null,
        berkas: berkas.originalname,
        meta: hasil.meta,
        jumlah_laporan: hasil.laporan.length,
        sebelumnya: sebelum,
      },
    });
  } catch (e) {
    await conn.rollback();
    console.error('Impor Produksi Pangan IRT gagal:', e);
    return res.status(500).json({
      success: false,
      message: `Impor gagal, data lama tidak diubah: ${e.message}`,
    });
  } finally {
    conn.release();
  }
});

// ---------------------------------------------------------------------------
// GET /api/produksi-irt/summary?tahun=2025 — metadata + rekap per tahun
// ---------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  const { tahun, galat } = bacaTahunQuery(req.query.tahun);
  if (galat) return res.status(400).json({ success: false, message: galat });

  const p = tahun ? [tahun] : [];
  const where = tahun ? 'WHERE tahun = ?' : '';

  try {
    const [imp] = await pool.query(
      `SELECT * FROM irt_import ${where} ORDER BY id DESC LIMIT 1`,
      p,
    );

    const [tot] = await pool.query(
      `SELECT
         COUNT(*) AS total_laporan,
         COALESCE(SUM(jumlah_serius),0) AS serius,
         COALESCE(SUM(jumlah_mayor),0)  AS mayor,
         COALESCE(SUM(jumlah_minor),0)  AS minor,
         COALESCE(SUM(jumlah_kritis),0) AS kritis
       FROM irt_laporan ${where}`,
      p,
    );

    const [grading] = await pool.query(
      `SELECT COALESCE(NULLIF(grading,''),'-') AS label, COUNT(*) AS jumlah
         FROM irt_laporan ${where}
        GROUP BY label ORDER BY jumlah DESC`,
      p,
    );

    // Distribusi hasil balai: Memenuhi / Tidak Memenuhi Ketentuan.
    const [hasil] = await pool.query(
      `SELECT COALESCE(NULLIF(hasil_balai,''),'-') AS label, COUNT(*) AS jumlah
         FROM irt_laporan ${where}
        GROUP BY label ORDER BY jumlah DESC`,
      p,
    );

    const [daftarTahun] = await pool.query(
      `SELECT t.tahun,
              (SELECT COUNT(*) FROM irt_laporan l WHERE l.tahun = t.tahun) AS jumlah_laporan,
              (SELECT i.berkas FROM irt_import i WHERE i.tahun = t.tahun ORDER BY i.id DESC LIMIT 1) AS berkas_terakhir,
              (SELECT i.diunggah_pada FROM irt_import i WHERE i.tahun = t.tahun ORDER BY i.id DESC LIMIT 1) AS diunggah_terakhir
         FROM (SELECT tahun FROM irt_laporan WHERE tahun IS NOT NULL
               UNION
               SELECT tahun FROM irt_import WHERE tahun IS NOT NULL) t
        ORDER BY t.tahun DESC`,
    );

    return res.json({
      success: true,
      data: {
        tahun,
        impor_terakhir: imp[0] || null,
        total: tot[0],
        sebaran_grading: grading,
        sebaran_hasil_balai: hasil,
        daftar_tahun: daftarTahun,
      },
    });
  } catch (e) {
    console.error('Summary Produksi Pangan IRT gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/produksi-irt/laporan?tahun=&q=&page= — daftar laporan (cari + paginasi)
// ---------------------------------------------------------------------------
router.get('/laporan', async (req, res) => {
  const { tahun, galat } = bacaTahunQuery(req.query.tahun);
  if (galat) return res.status(400).json({ success: false, message: galat });

  const q = String(req.query.q || '').trim();
  const halaman = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const offset = (halaman - 1) * limit;

  const syarat = [];
  const params = [];
  if (tahun) {
    syarat.push('tahun = ?');
    params.push(tahun);
  }
  if (q) {
    syarat.push(`(nama_sarana LIKE ? OR nama_balai LIKE ? OR alamat LIKE ? OR kab_kota LIKE ?
                  OR jenis_industri LIKE ? OR hasil_balai LIKE ? OR grading LIKE ?)`);
    params.push(...Array(7).fill(`%${q}%`));
  }
  const where = syarat.length ? `WHERE ${syarat.join(' AND ')}` : '';

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM irt_laporan ${where}`, params,
    );
    const [rows] = await pool.query(
      `SELECT id, tahun, no_urut, nama_balai, nama_sarana, alamat, kab_kota, jenis_industri,
              tgl_periksa_mulai, tgl_periksa_selesai, level_irtp, hasil_balai, tindak_lanjut, grading,
              jumlah_serius, jumlah_mayor, jumlah_minor, jumlah_kritis, jumlah_sampel_lab
         FROM irt_laporan ${where}
        ORDER BY no_urut ASC, id ASC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return res.json({
      success: true,
      data: { rows, total, page: halaman, limit, total_halaman: Math.ceil(total / limit) || 1, tahun },
    });
  } catch (e) {
    console.error('Daftar laporan Produksi Pangan IRT gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/produksi-irt/laporan/:id — satu laporan lengkap
// ---------------------------------------------------------------------------
router.get('/laporan/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: 'ID laporan tidak valid' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM irt_laporan WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }
    // Bentuk jawaban disamakan dengan modul PBF/OT (`rincian` kosong) supaya
    // modal di frontend bisa memakai pola yang sama.
    return res.json({ success: true, data: { ...rows[0], rincian: [] } });
  } catch (e) {
    console.error('Detail laporan Produksi Pangan IRT gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/produksi-irt/data?tahun=2025 — kosongkan satu tahun (= semua)
// ---------------------------------------------------------------------------
router.delete('/data', async (req, res) => {
  const { tahun, galat } = bacaTahunQuery(req.query.tahun);
  if (galat) return res.status(400).json({ success: false, message: galat });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (tahun) {
      const sebelum = await hitungTahun(conn, tahun);
      await hapusTahun(conn, tahun);
      await conn.commit();
      return res.json({
        success: true,
        message: `Data tahun ${tahun} dihapus (${sebelum.laporan} laporan). Tahun lain tidak diubah.`,
      });
    }
    await kosongkan(conn);
    await conn.commit();
    return res.json({ success: true, message: 'Seluruh data Produksi Pangan IRT (semua tahun) sudah dihapus.' });
  } catch (e) {
    await conn.rollback();
    console.error('Hapus data Produksi Pangan IRT gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
