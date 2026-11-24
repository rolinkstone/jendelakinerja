// backend/lib/distribusi.js
/**
 * ENGINE MODUL SARANA PER TAHUN — satu mesin, beberapa komoditi
 * (dipakai keluarga DISTRIBUSI: PBF, IFP, IFK, Kosmetika, Obat Tradisional,
 *  IPK, Suplemen Kesehatan; dan PRODUKSI: Pangan MD).
 * Nama berkas `distribusi.js` historis — mesinnya generik untuk berkas
 * "Laporan Hasil Pemeriksaan Sarana" apa pun yang berpola satu baris = satu
 * sarana, impor per tahun.
 * ---------------------------------------------------------------------------
 * Dipakai oleh:
 *   routes/distribusi-kos.js  → Distribusi Kosmetika (35 kolom)
 *   routes/distribusi-ot.js   → Distribusi Obat Tradisional (38 kolom)
 *
 * Kenapa modul terpisah dari `routes/pbf.js`: tata letak berkas ketiga komoditi
 * BERBEDA, bukan sekadar berganti nama tabel seperti PBF ↔ IFP.
 *
 *   PBF / IFP        44 kolom, punya blok temuan (Kategori/Observasi/Temuan),
 *                    M/m/C, Analisa, Kesimpulan Kekritisan, Penetapan Sanksi.
 *   Kosmetika        35 kolom, TIDAK punya blok temuan maupun M/m/C.
 *                    Kesimpulan ada di `Hasil Balai` (kolom 14) dan
 *                    "Klasifikasi" (10) + "Tindak Lanjut" muncul DUA kali
 *                    (11 dan 15) dengan arti berbeda.
 *   Obat Tradisional 38 kolom, ada Metode Inspeksi (10), Detil Tindak Lanjut
 *                    (13), Detil Hasil Pemeriksaan (14), Detil Kesimpulan TMK (15).
 *
 * Karena itu pemetaan kolom diberikan per modul (`kolom`), bukan dipaku di
 * dalam parser. Yang dibagi bersama: pembacaan workbook, deteksi tahun,
 * aturan impor per tahun (ganti tahun yang dipilih saja), dan CRUD baca.
 *
 * ATURAN IMPOR
 *   Setiap unggahan terikat SATU tahun; hanya baris tahun itu yang dihapus lalu
 *   diisi ulang, di dalam satu transaksi. Tahun lain tidak tersentuh.
 */
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const pool = require('../db');
const { lengkapiBaris } = require('./kinerja');
const { saringPribadi } = require('./saring-publik');

const TAHUN_MIN = 2015;
const TAHUN_MAX = 2035;

/** Batas unggahan — sama dengan modul lain. */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Serial tanggal Excel (1900) → Date. */
function serialKeTanggal(serial) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

/** Format tanggal gaya berkas sumber: "16 November 2026". */
function formatTanggal(d) {
  return `${String(d.getUTCDate()).padStart(2, '0')} ${BULAN_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Sisa salah-kode (mojibake) yang sering muncul di export Excel instansi. */
const MOJIBAKE = [
  ['â—', '•'], ['â€™', '’'], ['â€œ', '“'], ['â€“', '–'],
  ['â€”', '—'], ['â€', '”'], ['Â·', '·'], ['Â ', ' '],
];

function rapikanMojibake(s) {
  let hasil = s;
  for (const [dari, ke] of MOJIBAKE) hasil = hasil.split(dari).join(ke);
  return hasil;
}

/**
 * Nilai sel → teks siap simpan.
 * `sebagaiTanggal` WAJIB hanya untuk medan tanggal: menerjemahkan serial angka
 * di rentang 20000–80000. Tanpa bendera ini, harga Rp 40.000 bisa tersimpan
 * sebagai "06 Juli 2009" (bug yang pernah terjadi di modul sampel).
 */
function teks(v, sebagaiTanggal = false) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return formatTanggal(v);
  if (typeof v === 'number') {
    if (sebagaiTanggal && v > 20000 && v < 80000 && Number.isInteger(v)) {
      return formatTanggal(serialKeTanggal(v));
    }
    return String(v);
  }
  const s = rapikanMojibake(String(v).replace(/\s+/g, ' ').trim());
  return s === '' ? null : s;
}

function keAngka(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Ambil tahun (4 digit) dari teks, mis. "14 November 2026" → 2026. */
function tahunDariTeks(nilai) {
  const cocok = String(nilai || '').match(/(?:19|20)\d{2}/g);
  if (!cocok || !cocok.length) return null;
  const angka = Number(cocok[cocok.length - 1]);
  return angka >= TAHUN_MIN && angka <= TAHUN_MAX ? angka : null;
}

/**
 * Tebak tahun data: periode pemeriksaan → periode entri → tahun terbanyak di
 * baris. Meta berkas bisa menyesatkan (mis. "01 Januari 2025 - 31 Desember
 * 2024"), jadi isi baris dipakai lebih dulu.
 */
function deteksiTahun(hasil) {
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
    if (jumlah > maks) { maks = jumlah; terpilih = t; }
  }
  if (terpilih) return terpilih;

  for (const teksMeta of [hasil.meta.periode_akhir, hasil.meta.periode_awal,
    hasil.meta.tanggal_entri_akhir, hasil.meta.tanggal_entri_awal]) {
    const t = tahunDariTeks(teksMeta);
    if (t) return t;
  }
  return null;
}

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

/**
 * Baca workbook → { meta, laporan[] }.
 * `kolom`     : { nama_kolom_db: indeks_excel }
 * `tanggal`   : Set nama kolom yang boleh menerjemahkan serial angka Excel
 */
function bacaWorkbook(buffer, kolom, tanggal, angka = new Set()) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const namaSheet = wb.SheetNames[0];
  const ws = wb.Sheets[namaSheet];
  if (!ws) throw new Error('Berkas tidak berisi sheet apa pun');

  const baris = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });

  // Baris header = baris yang kolom A-nya "No." (bisa "No" / "NO.").
  const idxHeader = baris.findIndex(
    (r) => r && String(r[0] || '').replace(/\./g, '').trim().toLowerCase() === 'no',
  );
  if (idxHeader < 0) throw new Error('Baris header ("No.") tidak ditemukan di berkas');

  const ambil = (r, c) => (baris[r] ? baris[r][c] : null);

  // Kolom "Jumlah Sampel" opsional.
  const idxSampel = (baris[idxHeader] || []).findIndex((sel) => /jumlah\s*sampel|sampel\s*lab/i.test(String(sel ?? '')));

  const meta = {
    sheet: namaSheet,
    jenis_sarana: teks(ambil(1, 2)),
    periode_awal: teks(ambil(2, 2), true),
    periode_akhir: teks(ambil(3, 2), true),
    tanggal_entri_awal: teks(ambil(4, 2), true),
    tanggal_entri_akhir: teks(ambil(5, 2), true),
    balai: teks(ambil(6, 2)),
  };

  const laporan = [];
  for (let i = idxHeader + 2; i < baris.length; i += 1) {
    const r = baris[i] || [];
    const noMentah = r[kolom.no_urut];
    const adaNomor = noMentah !== null && noMentah !== undefined && String(noMentah).trim() !== '';
    if (!adaNomor) continue; // tidak ada baris lanjutan di modul ini

    const barisBaru = {};
    Object.entries(kolom).forEach(([k, idx]) => {
      // Kolom hitungan (M/m/C) disimpan sebagai INTEGER; sisanya teks. Tanpa
      // pemisahan ini, jumlah temuan masuk sebagai teks dan SUM() di SQL
      // diam-diam menghasilkan 0.
      barisBaru[k] = angka.has(k) ? keAngka(r[idx]) : teks(r[idx], tanggal.has(k));
    });
    barisBaru.no_urut = keAngka(noMentah);
    barisBaru.jumlah_sampel_lab = idxSampel >= 0 ? keAngka(r[idxSampel]) : null;
    laporan.push(barisBaru);
  }

  return { meta, laporan };
}

/**
 * Bangun router untuk satu komoditi distribusi.
 * @param {object} cfg
 * @param {string} cfg.kode        'kos' | 'ot' (dipakai di pesan log)
 * @param {string} cfg.label       'Distribusi Kosmetika'
 * @param {string} cfg.tabelImpor  nama tabel import
 * @param {string} cfg.tabelLaporan nama tabel laporan
 * @param {object} cfg.kolom       { kolom_db: indeks_excel }
 * @param {Set<string>} cfg.tanggal nama kolom yang bertipe tanggal
 */
function buatRouterDistribusi({
  kode, label, tabelImpor, tabelLaporan, kolom, tanggal,
  // Kolom yang dikembalikan daftar laporan & dipakai pencarian teks.
  // WAJIB dapat diatur: tidak semua komoditi punya `klasifikasi` (IPK tidak),
  // jadi daftar yang dipaku di sini akan menghasilkan SQL error di modul lain.
  // Kolom hitungan yang harus disimpan sebagai INTEGER (mis. M/m/C).
  angka = new Set(),
  kolomDaftar = ['klasifikasi', 'hasil_balai', 'grading'],
  kolomCari = ['nama_sarana', 'nama_balai', 'alamat', 'kab_kota', 'hasil_balai', 'grading', 'klasifikasi'],
}) {
  const router = express.Router();
  const KOLOM_SIMPAN = Object.keys(kolom);

  async function hapusTahun(conn, tahun) {
    await conn.query(`DELETE FROM ${tabelLaporan} WHERE tahun = ?`, [tahun]);
    const [hasilImpor] = await conn.query(`DELETE FROM ${tabelImpor} WHERE tahun = ?`, [tahun]);
    return hasilImpor.affectedRows || 0;
  }

  async function hitungTahun(conn, tahun) {
    const [[laporan]] = await conn.query(
      `SELECT COUNT(*) AS n FROM ${tabelLaporan} WHERE tahun = ?`, [tahun],
    );
    return { laporan: Number(laporan?.n || 0), rincian: 0 };
  }

  // ---- POST /import -------------------------------------------------------
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
      return res.status(400).json({ success: false, message: 'Format berkas harus .xlsx / .xls / .xlsm' });
    }

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
      hasil = bacaWorkbook(berkas.buffer, kolom, tanggal, angka);
    } catch (e) {
      return res.status(400).json({ success: false, message: `Berkas gagal dibaca: ${e.message}` });
    }

    // ------------------------------------------------------------------
    // Tahun KOSONG (0 laporan).
    //
    // Dulu ini selalu ditolak. Akibatnya tahun yang memang tidak ada
    // kegiatannya tidak bisa didaftarkan, sehingga grafik "per tahun"
    // melompat dan pembaca mengira datanya hilang.
    //
    // Sekarang impor kosong DIIZINKAN bila tahunnya dipilih manual (tidak ada
    // isi untuk dideteksi). `bacaWorkbook` sudah memastikan header "No."
    // ditemukan, jadi berkas asal-asalan tetap ditolak lebih awal.
    // Yang dicatat hanya baris *_import dengan jumlah_laporan = 0.
    // ------------------------------------------------------------------
    const berkasKosong = hasil.laporan.length === 0;

    if (berkasKosong && tahunPilihan === null) {
      return res.status(400).json({
        success: false,
        message:
          'Berkas ini tidak berisi baris data, jadi tahunnya tidak bisa dibaca otomatis. ' +
          'Pilih tahun data secara manual (bukan "Otomatis") lalu unggah ulang untuk mendaftarkan tahun kosong.',
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
        `INSERT INTO ${tabelImpor}
          (tahun, berkas, sheet, jenis_sarana, periode_awal, periode_akhir,
           tanggal_entri_awal, tanggal_entri_akhir, balai, jumlah_laporan, diunggah_oleh)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          tahun, berkas.originalname, hasil.meta.sheet, hasil.meta.jenis_sarana,
          hasil.meta.periode_awal, hasil.meta.periode_akhir, hasil.meta.tanggal_entri_awal,
          hasil.meta.tanggal_entri_akhir, hasil.meta.balai, hasil.laporan.length,
          req.user?.name || req.user?.username || null,
        ],
      );

      const sql = `INSERT INTO ${tabelLaporan}
        (import_id, tahun, kegiatan, jenis_sarana, bulan, ${KOLOM_SIMPAN.join(', ')})
       VALUES (?, ?, ?, ?, ?, ${KOLOM_SIMPAN.map(() => '?').join(', ')})`;

      for (const l of hasil.laporan) {
        // kegiatan/jenis_sarana/bulan diturunkan dari kepala berkas + tanggal
        // periksa (lib/kinerja.js), supaya dashboard publik bisa menyaring
        // tanpa join.
        const turunan = lengkapiBaris(l, hasil.meta.jenis_sarana);
        await conn.query(sql, [
          imp.insertId, tahun, turunan.kegiatan, turunan.jenis_sarana, turunan.bulan,
          ...KOLOM_SIMPAN.map((k) => l[k] ?? null),
        ]);
      }

      await conn.commit();

      const pengganti = sebelum.laporan > 0
        ? `menggantikan ${sebelum.laporan} laporan tahun ${tahun}`
        : `data tahun ${tahun} sebelumnya kosong`;

      const pesan = berkasKosong
        ? `Tahun ${tahun} didaftarkan dengan 0 laporan (${pengganti}). ` +
          'Tahun ini sekarang ikut terhitung di rekap per tahun. Tahun lain tidak diubah.'
        : `Impor selesai — ${hasil.laporan.length} laporan untuk tahun ${tahun} (${pengganti}). Tahun lain tidak diubah.`;

      return res.json({
        success: true,
        message: pesan,
        data: {
          import_id: imp.insertId,
          tahun,
          tahun_terdeteksi: tahunTerdeteksi,
          tahun_dipilih_manual: tahunPilihan !== null,
          berkas: berkas.originalname,
          meta: hasil.meta,
          jumlah_laporan: hasil.laporan.length,
          sebelumnya: sebelum,
          tahun_kosong: berkasKosong,
        },
      });
    } catch (e) {
      await conn.rollback();
      console.error(`Impor ${label} gagal:`, e);
      return res.status(500).json({
        success: false,
        message: `Impor gagal, data lama tidak diubah: ${e.message}`,
      });
    } finally {
      conn.release();
    }
  });

  // ---- GET /summary -------------------------------------------------------
  router.get('/summary', async (req, res) => {
    const { tahun, galat } = bacaTahunQuery(req.query.tahun);
    if (galat) return res.status(400).json({ success: false, message: galat });
    const p = tahun ? [tahun] : [];
    const where = tahun ? 'WHERE tahun = ?' : '';

    try {
      const [imp] = await pool.query(
        `SELECT * FROM ${tabelImpor} ${where} ORDER BY id DESC LIMIT 1`, p,
      );
      const [tot] = await pool.query(
        `SELECT COUNT(*) AS total_laporan,
                COALESCE(SUM(jumlah_sampel_lab),0) AS total_sampel_lab
           FROM ${tabelLaporan} ${where}`, p,
      );
      const [grading] = await pool.query(
        `SELECT COALESCE(NULLIF(grading,''),'-') AS label, COUNT(*) AS jumlah
           FROM ${tabelLaporan} ${where} GROUP BY label ORDER BY jumlah DESC`, p,
      );
      const [kesimpulan] = await pool.query(
        `SELECT COALESCE(NULLIF(hasil_balai,''),'-') AS label, COUNT(*) AS jumlah
           FROM ${tabelLaporan} ${where} GROUP BY label ORDER BY jumlah DESC`, p,
      );
      const [daftarTahun] = await pool.query(
        `SELECT t.tahun,
                (SELECT COUNT(*) FROM ${tabelLaporan} l WHERE l.tahun = t.tahun) AS jumlah_laporan,
                0 AS jumlah_rincian,
                (SELECT i.berkas FROM ${tabelImpor} i WHERE i.tahun = t.tahun ORDER BY i.id DESC LIMIT 1) AS berkas_terakhir,
                (SELECT i.diunggah_pada FROM ${tabelImpor} i WHERE i.tahun = t.tahun ORDER BY i.id DESC LIMIT 1) AS diunggah_terakhir
           FROM (SELECT tahun FROM ${tabelLaporan} WHERE tahun IS NOT NULL
                 UNION
                 SELECT tahun FROM ${tabelImpor} WHERE tahun IS NOT NULL) t
          ORDER BY t.tahun DESC`,
      );

      return res.json({
        success: true,
        data: {
          tahun,
          impor_terakhir: saringPribadi(imp[0]) || null,
          total: tot[0],
          sebaran_grading: grading,
          sebaran_kesimpulan: kesimpulan,
          daftar_tahun: daftarTahun,
        },
      });
    } catch (e) {
      console.error(`Summary ${label} gagal:`, e);
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // ---- GET /laporan -------------------------------------------------------
  router.get('/laporan', async (req, res) => {
    const { tahun, galat } = bacaTahunQuery(req.query.tahun);
    if (galat) return res.status(400).json({ success: false, message: galat });

    const q = String(req.query.q || '').trim();
    const halaman = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (halaman - 1) * limit;

    const syarat = [];
    const params = [];
    if (tahun) { syarat.push('tahun = ?'); params.push(tahun); }
    if (q) {
      syarat.push(`(${kolomCari.map((k) => `${k} LIKE ?`).join(' OR ')})`);
      params.push(...Array(kolomCari.length).fill(`%${q}%`));
    }
    const where = syarat.length ? `WHERE ${syarat.join(' AND ')}` : '';

    try {
      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM ${tabelLaporan} ${where}`, params,
      );
      const [rows] = await pool.query(
        `SELECT id, tahun, no_urut, nama_balai, nama_sarana, alamat, kab_kota, tgl_periksa_mulai,
                ${kolomDaftar.join(', ')}, jumlah_sampel_lab
           FROM ${tabelLaporan} ${where}
          ORDER BY no_urut ASC, id ASC
          LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      return res.json({
        success: true,
        data: { rows, total, page: halaman, limit, total_halaman: Math.ceil(total / limit) || 1, tahun },
      });
    } catch (e) {
      console.error(`Daftar laporan ${label} gagal:`, e);
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // ---- GET /laporan/:id ---------------------------------------------------
  router.get('/laporan/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'ID laporan tidak valid' });
    }
    try {
      const [rows] = await pool.query(`SELECT * FROM ${tabelLaporan} WHERE id = ?`, [id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
      }
      // Modul distribusi ini tidak punya tabel rincian (berkasnya datar).
      return res.json({ success: true, data: saringPribadi({ ...rows[0], rincian: [] }) });
    } catch (e) {
      console.error(`Detail laporan ${label} gagal:`, e);
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // ---- DELETE /data -------------------------------------------------------
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
      await conn.query(`DELETE FROM ${tabelLaporan}`);
      await conn.query(`DELETE FROM ${tabelImpor}`);
      await conn.commit();
      return res.json({ success: true, message: `Seluruh data ${label} (semua tahun) sudah dihapus.` });
    } catch (e) {
      await conn.rollback();
      console.error(`Hapus data ${label} gagal:`, e);
      return res.status(500).json({ success: false, message: e.message });
    } finally {
      conn.release();
    }
  });

  return router;
}

module.exports = { buatRouterDistribusi, bacaWorkbook, deteksiTahun, TAHUN_MIN, TAHUN_MAX };
