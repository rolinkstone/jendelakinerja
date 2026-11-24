/**
 * ============================================================
 *  ROUTER DISTRIBUSI IFK — impor laporan Excel per tahun
 *
 *  IFK = Instalasi Farmasi Pemerintah KOTA/KABUPATEN.
 *  Berkasnya IDENTIK dengan PBF dan IFP (44 kolom, header dua tingkat baris
 *  8-9, data mulai baris 10, ada baris lanjutan Kategori/Observasi/Temuan
 *  untuk rincian fokus pemeriksaan), jadi router ini kembar dengan keduanya.
 *  Berkas contoh "distribusi IFK 2024.xlsx": 149 baris -> 140 baris data
 *  mentah (sebagian di antaranya baris lanjutan, jadi jumlah LAPORAN lebih
 *  sedikit daripada jumlah baris).
 *
 *  JANGAN tertukar dengan Distribusi IFP (provinsi): keduanya memakai kolom
 *  yang sama, tetapi tabel & jenis sarananya berbeda.
 * ============================================================
 *  Sumber berkas: "Laporan Hasil Pemeriksaan Sarana Distribusi - IFK"
 *  (export SIPT, satu sheet, satu baris = satu sarana IFK).
 *
 *  ATURAN IMPOR (per tahun)
 *  ------------------------
 *  Setiap unggahan terikat pada SATU TAHUN data. Yang dihapus lalu diisi ulang
 *  hanya baris milik tahun tersebut — data tahun lain tidak tersentuh. Jadi
 *  impor 2024, 2025, dan 2026 bisa hidup berdampingan.
 *
 *  Tahun ditentukan dengan urutan:
 *    1. field `tahun` pada multipart (dipilih pengguna di UI), bila diisi;
 *    2. deteksi otomatis dari berkas (periode → tanggal entri → tanggal periksa);
 *    3. gagal → 400, pengguna diminta memilih tahun manual.
 *
 *  Penggantian dijalankan dalam SATU transaksi: berkas gagal baca atau error di
 *  tengah jalan tidak pernah menghapus data lama.
 *
 *  PETA KOLOM BERKAS
 *  -----------------
 *  Baris 0-6  : identitas berkas (jenis sarana, periode, balai, dst.)
 *  Baris 7-8  : header dua tingkat (merge) — lihat KOLOM di bawah
 *  Baris 9+   : data. Kolom A berisi nomor  → baris laporan baru;
 *               kolom A kosong + M/N/O ada  → baris rincian fokus pemeriksaan.
 *
 *  SEMUA endpoint di router ini butuh header `Authorization: Bearer ***
 *  (dipenuhi oleh proxy frontend pages/api/distribusi-ifk/[...path].js).
 * ============================================================
 */
const express = require('express');
// Akses baca sekarang publik → kolom pribadi dibuang di endpoint detail
const { saringPribadi } = require('../lib/saring-publik');
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

/** Indeks kolom (0-based) pada baris data. */
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
  fokus_pemeriksaan: 10,
  jenis_komoditi: 11,
  kategori: 12,
  observasi: 13,
  temuan: 14,
  analisa: 15,
  kesimpulan_kekritisan: 16,
  penetapan_sanksi: 17,
  kesimpulan_akhir: 18,
  rekomendasi: 19,
  jumlah_mayor: 20,
  jumlah_minor: 21,
  jumlah_kritis: 22,
  hasil_balai: 23,
  tindak_lanjut: 24,
  grading: 25,
  operator: 26,
  petugas: 27,
  status_tarikan: 28,
  kepala_balai: 29,
  tgl_kirim_ka_balai: 30,
  verif_operator_pusat: 31,
  verif_tgl_operator: 32,
  verif_supervisor_1: 33,
  verif_tgl_supervisor_1: 34,
  verif_supervisor_2: 35,
  verif_tgl_supervisor_2: 36,
  verif_direktur: 37,
  verif_tgl_direktur: 38,
  just_kesimpulan: 39,
  just_temuan: 40,
  just_catatan: 41,
  just_saran: 42,
  just_detil: 43,
};

/** Kolom detail yang diisi per fokus pemeriksaan. */
const KOLOM_DETAIL = { kategori: 12, observasi: 13, temuan: 14 };

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

/** Pulihkan karakter yang ter-salah-kode saat berkas diekspor (mis. "â—" → "•"). */
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

/** Nilai sel → angka bulat (untuk kolom M/m/C dan nomor). */
function keAngka(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Ambil tahun (4 digit) terakhir dari sebuah teks, mis. "14 November 2026" → 2026.
 * Mengembalikan null bila tidak ada tahun yang wajar.
 */
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

  // Tidak ada periode di kepala berkas: hitung tahun yang paling sering muncul
  // pada tanggal pemeriksaan/input tiap baris.
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

/**
 * Baca workbook → { meta, laporan[] }.
 * Setiap laporan punya array `rincian` (fokus pemeriksaan).
 */
function bacaWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const namaSheet = wb.SheetNames[0];
  const ws = wb.Sheets[namaSheet];
  if (!ws) throw new Error('Berkas tidak berisi sheet apa pun');

  const baris = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });

  // Cari baris header: baris yang kolom A-nya "No."
  const idxHeader = baris.findIndex(
    (r) => r && String(r[0] || '').replace(/\./g, '').trim().toLowerCase() === 'no',
  );
  if (idxHeader < 0) throw new Error('Baris header ("No.") tidak ditemukan di berkas');

  const ambil = (r, c) => (baris[r] ? baris[r][c] : null);

  // Kolom opsional "sampel" (mis. "Jumlah Sampel", "Sampel Lab"). Berkas yang
  // dipakai sekarang belum punya kolom ini — kalau ada, nilainya ikut disimpan
  // ke ifk_laporan.jumlah_sampel_lab (dipakai tabel per kab/kota di halaman
  // publik); kalau tidak ada, kolom itu dibiarkan NULL (= 0 di dashboard).
  const idxSampel = (baris[idxHeader] || []).findIndex((sel) =>
    /sampel/i.test(String(sel ?? '')),
  );

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
  let sekarang = null;

  for (let i = idxHeader + 2; i < baris.length; i += 1) {
    const r = baris[i] || [];
    const noMentah = r[KOLOM.no_urut];
    const adaNomor = noMentah !== null && noMentah !== undefined && String(noMentah).trim() !== '';

    if (adaNomor) {
      sekarang = {};
      Object.entries(KOLOM).forEach(([kol, idx]) => {
        sekarang[kol] = ['jumlah_mayor', 'jumlah_minor', 'jumlah_kritis'].includes(kol)
          ? keAngka(r[idx])
          : teks(r[idx]);
      });
      sekarang.no_urut = keAngka(noMentah);
      sekarang.jumlah_sampel_lab = idxSampel >= 0 ? keAngka(r[idxSampel]) : null;
      sekarang.rincian = [];
      laporan.push(sekarang);
      continue;
    }

    // Baris lanjutan: hanya kolom M/N/O yang terisi → rincian fokus pemeriksaan.
    const kategori = teks(r[KOLOM_DETAIL.kategori]);
    const observasi = teks(r[KOLOM_DETAIL.observasi]);
    const temuan = teks(r[KOLOM_DETAIL.temuan]);
    if (sekarang && (kategori || observasi || temuan)) {
      sekarang.rincian.push({
        no_urut: sekarang.rincian.length + 1,
        kategori,
        observasi,
        temuan,
      });
    }
  }

  return { meta, laporan };
}

const KOLOM_LAPORAN = [...Object.keys(KOLOM), 'jumlah_sampel_lab'];

/**
 * Hapus data SATU tahun (laporan + rincian + metadata impor).
 * FK ifk_laporan_detail → ifk_laporan ON DELETE CASCADE, jadi rincian ikut
 * terhapus saat laporannya dihapus.
 */
async function hapusTahun(conn, tahun) {
  await conn.query('DELETE FROM ifk_laporan WHERE tahun = ?', [tahun]);
  const [sisa] = await conn.query(
    'SELECT COUNT(*) AS n FROM ifk_laporan WHERE tahun = ?', [tahun],
  );
  if (Number(sisa[0]?.n || 0) > 0) {
    // Baris lama yang kolom tahunnya belum terisi (sebelum migrasi) — bersihkan
    // lewat relasi ke ifk_import.
    await conn.query(
      `DELETE l FROM ifk_laporan l
         JOIN ifk_import i ON i.id = l.import_id
        WHERE i.tahun = ?`, [tahun],
    );
  }
  const [hasilImpor] = await conn.query('DELETE FROM ifk_import WHERE tahun = ?', [tahun]);
  return hasilImpor.affectedRows || 0;
}

/** Hitung isi satu tahun SEBELUM diganti (untuk pesan ke pengguna). */
async function hitungTahun(conn, tahun) {
  const [[laporan]] = await conn.query(
    'SELECT COUNT(*) AS n FROM ifk_laporan WHERE tahun = ?', [tahun],
  );
  const [[rincian]] = await conn.query(
    `SELECT COUNT(*) AS n FROM ifk_laporan_detail d
       JOIN ifk_laporan l ON l.id = d.laporan_id
      WHERE l.tahun = ?`, [tahun],
  );
  return { laporan: Number(laporan?.n || 0), rincian: Number(rincian?.n || 0) };
}

/** Kosongkan SELURUH isi tabel modul ini (dipakai DELETE /data tanpa tahun). */
async function kosongkan(conn) {
  await conn.query('DELETE FROM ifk_laporan_detail');
  await conn.query('DELETE FROM ifk_laporan');
  await conn.query('DELETE FROM ifk_import');
}

// ---------------------------------------------------------------------------
// POST /api/distribusi-ifk/import — unggah berkas Excel, GANTI data tahun yang dipilih
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

  // ---------------------------------------------------------------------
  // Tahun KOSONG (0 laporan).
  //
  // Dulu selalu ditolak ("Tidak ada baris data yang terbaca"). Akibatnya
  // tahun yang memang tidak ada kegiatannya tidak bisa didaftarkan, sehingga
  // rekap per tahun melompat (2024 → 2026) seolah 2025 hilang datanya.
  //
  // Sekarang impor kosong DIIZINKAN bila tahunnya dipilih manual — tidak ada
  // isi untuk dideteksi. `bacaWorkbook` sudah memastikan baris header "No."
  // ditemukan, jadi berkas yang bukan laporan tetap ditolak lebih awal.
  // Yang dicatat hanya baris *_import dengan jumlah_laporan = 0.
  // ---------------------------------------------------------------------
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
    // Seluruh penggantian data tahun ini dijalankan dalam SATU transaksi: kalau
    // ada kegagalan di tengah jalan, data tahun tersebut tetap utuh. Tahun lain
    // sama sekali tidak disentuh. AUTO_INCREMENT sengaja tidak di-reset — reset
    // menuntut ALTER TABLE di luar transaksi (commit implisit), dan nilai id
    // tidak pernah ditampilkan ke pengguna.
    await conn.beginTransaction();

    const sebelum = await hitungTahun(conn, tahun);
    await hapusTahun(conn, tahun);

    const jumlahRincian = hasil.laporan.reduce((t, l) => t + l.rincian.length, 0);

    const [imp] = await conn.query(
      `INSERT INTO ifk_import
        (tahun, berkas, sheet, jenis_sarana, periode_awal, periode_akhir, tanggal_entri_awal,
         tanggal_entri_akhir, balai, jumlah_laporan, jumlah_rincian, diunggah_oleh)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        tahun, berkas.originalname, hasil.meta.sheet, hasil.meta.jenis_sarana,
        hasil.meta.periode_awal, hasil.meta.periode_akhir, hasil.meta.tanggal_entri_awal,
        hasil.meta.tanggal_entri_akhir, hasil.meta.balai, hasil.laporan.length, jumlahRincian,
        req.user?.name || req.user?.username || null,
      ],
    );

    const sqlLaporan = `INSERT INTO ifk_laporan
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
      const [baru] = await conn.query(sqlLaporan, nilai);

      if (l.rincian.length) {
        await conn.query(
          `INSERT INTO ifk_laporan_detail (laporan_id, no_urut, kategori, observasi, temuan)
           VALUES ${l.rincian.map(() => '(?,?,?,?,?)').join(', ')}`,
          l.rincian.flatMap((d) => [baru.insertId, d.no_urut, d.kategori, d.observasi, d.temuan]),
        );
      }
    }

    await conn.commit();

    const pengganti = sebelum.laporan > 0
      ? `menggantikan ${sebelum.laporan} laporan dan ${sebelum.rincian} rincian tahun ${tahun}`
      : `data tahun ${tahun} sebelumnya kosong`;

    const pesan = berkasKosong
      ? `Tahun ${tahun} didaftarkan dengan 0 laporan (${pengganti}). ` +
        'Tahun ini sekarang ikut terhitung di rekap per tahun. Tahun lain tidak diubah.'
      : `Impor selesai — ${hasil.laporan.length} laporan dan ${jumlahRincian} rincian untuk tahun ${tahun} (${pengganti}). Tahun lain tidak diubah.`;

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
        jumlah_rincian: jumlahRincian,
        sebelumnya: sebelum,
        tahun_kosong: berkasKosong,
      },
    });
  } catch (e) {
    await conn.rollback();
    console.error('Impor IFK gagal:', e);
    return res.status(500).json({
      success: false,
      message: `Impor gagal, data lama tidak diubah: ${e.message}`,
    });
  } finally {
    conn.release();
  }
});

// ---------------------------------------------------------------------------
// GET /api/distribusi-ifk/summary?tahun=2025 — metadata + rekap (per tahun bila diminta)
// ---------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  const { tahun, galat } = bacaTahunQuery(req.query.tahun);
  if (galat) return res.status(400).json({ success: false, message: galat });

  const p = tahun ? [tahun] : [];
  const lima = tahun ? [...p, ...p, ...p, ...p, ...p] : [];

  try {
    const [imp] = await pool.query(
      `SELECT * FROM ifk_import ${tahun ? 'WHERE tahun = ?' : ''} ORDER BY id DESC LIMIT 1`,
      p,
    );

    const [tot] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM ifk_laporan ${tahun ? 'WHERE tahun = ?' : ''}) AS total_laporan,
         (SELECT COUNT(*) FROM ifk_laporan_detail d
            JOIN ifk_laporan l ON l.id = d.laporan_id ${tahun ? 'WHERE l.tahun = ?' : ''}) AS total_rincian,
         (SELECT COALESCE(SUM(jumlah_mayor),0) FROM ifk_laporan ${tahun ? 'WHERE tahun = ?' : ''}) AS mayor,
         (SELECT COALESCE(SUM(jumlah_minor),0) FROM ifk_laporan ${tahun ? 'WHERE tahun = ?' : ''}) AS minor,
         (SELECT COALESCE(SUM(jumlah_kritis),0) FROM ifk_laporan ${tahun ? 'WHERE tahun = ?' : ''}) AS kritis`,
      lima,
    );

    const [grading] = await pool.query(
      `SELECT COALESCE(NULLIF(grading,''),'-') AS label, COUNT(*) AS jumlah
         FROM ifk_laporan ${tahun ? 'WHERE tahun = ?' : ''}
        GROUP BY label ORDER BY jumlah DESC`,
      p,
    );
    const [kesimpulan] = await pool.query(
      `SELECT COALESCE(NULLIF(kesimpulan_akhir,''),'-') AS label, COUNT(*) AS jumlah
         FROM ifk_laporan ${tahun ? 'WHERE tahun = ?' : ''}
        GROUP BY label ORDER BY jumlah DESC`,
      p,
    );

    // Daftar tahun yang tersedia (untuk filter di UI) + ringkasan per tahun.
    const [daftarTahun] = await pool.query(
      `SELECT t.tahun,
              (SELECT COUNT(*) FROM ifk_laporan l WHERE l.tahun = t.tahun) AS jumlah_laporan,
              (SELECT COUNT(*) FROM ifk_laporan_detail d
                 JOIN ifk_laporan l2 ON l2.id = d.laporan_id
                WHERE l2.tahun = t.tahun) AS jumlah_rincian,
              (SELECT i.berkas FROM ifk_import i WHERE i.tahun = t.tahun ORDER BY i.id DESC LIMIT 1) AS berkas_terakhir,
              (SELECT i.diunggah_pada FROM ifk_import i WHERE i.tahun = t.tahun ORDER BY i.id DESC LIMIT 1) AS diunggah_terakhir
         FROM (SELECT tahun FROM ifk_laporan WHERE tahun IS NOT NULL
               UNION
               SELECT tahun FROM ifk_import WHERE tahun IS NOT NULL) t
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
    console.error('Summary IFK gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/distribusi-ifk/laporan?tahun=2025&q=&page= — daftar laporan (cari + paginasi)
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
                  OR kategori LIKE ? OR kesimpulan_akhir LIKE ? OR grading LIKE ?)`);
    params.push(...Array(7).fill(`%${q}%`));
  }
  const where = syarat.length ? `WHERE ${syarat.join(' AND ')}` : '';

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ifk_laporan ${where}`, params,
    );
    const [rows] = await pool.query(
      `SELECT id, tahun, no_urut, nama_balai, nama_sarana, alamat, kab_kota, tgl_periksa_mulai,
              kategori, kesimpulan_kekritisan, penetapan_sanksi, kesimpulan_akhir, grading,
              jumlah_mayor, jumlah_minor, jumlah_kritis,
              (SELECT COUNT(*) FROM ifk_laporan_detail d WHERE d.laporan_id = l.id) AS jumlah_rincian
         FROM ifk_laporan l ${where}
        ORDER BY no_urut ASC, id ASC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return res.json({
      success: true,
      data: { rows, total, page: halaman, limit, total_halaman: Math.ceil(total / limit) || 1, tahun },
    });
  } catch (e) {
    console.error('Daftar laporan IFK gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/distribusi-ifk/laporan/:id — satu laporan + rincian fokus pemeriksaan
// ---------------------------------------------------------------------------
router.get('/laporan/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: 'ID laporan tidak valid' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM ifk_laporan WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
    }
    const [rincian] = await pool.query(
      'SELECT id, no_urut, kategori, observasi, temuan FROM ifk_laporan_detail WHERE laporan_id = ? ORDER BY no_urut ASC, id ASC',
      [id],
    );
    return res.json({ success: true, data: saringPribadi({ ...rows[0], rincian }) });
  } catch (e) {
    console.error('Detail laporan IFK gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/distribusi-ifk/data?tahun=2025 — kosongkan satu tahun (tanpa tahun = semua)
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
        message: `Data tahun ${tahun} dihapus (${sebelum.laporan} laporan, ${sebelum.rincian} rincian). Tahun lain tidak diubah.`,
      });
    }
    await kosongkan(conn);
    await conn.commit();
    return res.json({ success: true, message: 'Seluruh data Distribusi IFK (semua tahun) sudah dihapus.' });
  } catch (e) {
    await conn.rollback();
    console.error('Hapus data IFK gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
