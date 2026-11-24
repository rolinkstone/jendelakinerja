// backend/routes/publik.js
/**
 * ============================================================================
 *  ROUTER PUBLIK — DASHBOARD "JENDELA KINERJA" (tanpa login)
 * ============================================================================
 *  Dipakai halaman publik /jendela-kinerja (di luar dashboard ber-SSO):
 *  peta Kalimantan Tengah per kab/kota + filter bulan, tahun, produksi/
 *  distribusi, dan jenis sarana.
 *
 *  Semua endpoint di bawah ini READ-ONLY dan hanya mengembalikan ANGKA
 *  REKAP + nama sarana yang sudah diperiksa (tidak ada temuan/observasi
 *  mentah, tidak ada data pribadi petugas).
 *
 *  Didaftarkan sebagai route publik di server.js (`publicRoutes`), jadi tidak
 *  memerlukan Bearer token. Frontend memanggilnya lewat proxy
 *  pages/api/publik/[...path].js supaya tetap satu pintu (server-side).
 *
 *  Sumber data: VIEW `v_kinerja_sarana` (gabungan pbf_laporan + ot_laporan,
 *  lihat backend/db/v_kinerja.sql) beserta kolom turunan kegiatan/jenis_sarana/
 *  bulan dari lib/kinerja.js. Jadi satu tabel & satu peta memuat sarana
 *  distribusi (PBF) DAN sarana produksi (Obat Tradisional, Pangan IRT).
 *  Peta kab/kota ada di frontend/data/kalteng-kabupaten.json.
 * ============================================================================
 */
const express = require('express');
const db = require('../db');
const { BULAN_ID, namaBulan } = require('../lib/kinerja');
const { daftarLinkApi, daftarModul } = require('../lib/modul-api');
const linkApi = require('./link-api');

const router = express.Router();

/** Nilai yang diterima untuk kolom kegiatan. */
const KEGIATAN = ['Produksi', 'Distribusi'];

/** Asal modul yang menyumbang data — dipakai filter `?sumber=`. */
// Asal modul yang boleh diminta lewat ?sumber=. Modul baru cukup ditambahkan
// di sini — nama label & kegiatan dibaca dari view, bukan dari daftar ini.
const SUMBER = ['PBF', 'IFP', 'IFK', 'DIST_KOS', 'DIST_OT', 'DIST_IPK', 'DIST_SK', 'OT', 'IRTP', 'MD', 'SAMPEL_OT', 'SAMPEL_SK', 'SAMPEL_OB', 'SAMPEL_KOS', 'SAMPEL_PP', 'SAMPEL_KP', 'SAMPEL_OK'];

/**
 * Susun klausa WHERE dari query string.
 * Semua nilai divalidasi sebelum masuk parameter binding (anti-injeksi +
 * pesan galat yang jelas untuk nilai ngawur).
 */
function susunSaringan(q) {
  const syarat = [];
  const params = [];
  const dipakai = {};

  const tahun = String(q.tahun ?? '').trim();
  if (tahun && tahun !== 'semua') {
    if (!/^\d{4}$/.test(tahun)) return { galat: 'Parameter tahun harus 4 digit (mis. 2025)' };
    syarat.push('tahun = ?');
    params.push(Number(tahun));
    dipakai.tahun = Number(tahun);
  }

  const bulan = String(q.bulan ?? '').trim();
  if (bulan && bulan !== 'semua') {
    const n = Number(bulan);
    if (!Number.isInteger(n) || n < 1 || n > 12) return { galat: 'Parameter bulan harus 1–12' };
    syarat.push('bulan = ?');
    params.push(n);
    dipakai.bulan = n;
  }

  const kegiatan = String(q.kegiatan ?? '').trim();
  if (kegiatan && kegiatan !== 'semua') {
    const cocok = KEGIATAN.find((k) => k.toLowerCase() === kegiatan.toLowerCase());
    if (!cocok) return { galat: `Parameter kegiatan harus salah satu dari: ${KEGIATAN.join(', ')}` };
    syarat.push('UPPER(kegiatan) = ?');
    params.push(cocok.toUpperCase());
    dipakai.kegiatan = cocok;
  }

  const jenis = String(q.jenis ?? q.jenis_sarana ?? '').trim();
  if (jenis && jenis !== 'semua') {
    syarat.push('jenis_sarana = ?');
    params.push(jenis);
    dipakai.jenis_sarana = jenis;
  }

  const sumber = String(q.sumber ?? '').trim();
  if (sumber && sumber !== 'semua') {
    const cocok = SUMBER.find((s) => s.toLowerCase() === sumber.toLowerCase());
    if (!cocok) return { galat: `Parameter sumber harus salah satu dari: ${SUMBER.join(', ')}` };
    syarat.push('sumber = ?');
    params.push(cocok);
    dipakai.sumber = cocok;
  }

  const kab = String(q.kab ?? q.kab_kota ?? '').trim();
  if (kab && kab !== 'semua') {
    syarat.push('kab_kota = ?');
    params.push(kab);
    dipakai.kab_kota = kab;
  }

  return {
    where: syarat.length ? `WHERE ${syarat.join(' AND ')}` : '',
    params,
    dipakai,
  };
}

// ---------------------------------------------------------------------------
// GET /api/publik/kinerja/pilihan — opsi filter yang tersedia (dari data)
// ---------------------------------------------------------------------------
// Semua daftar diambil dari isi tabel, jadi begitu ada impor jenis sarana baru
// (mis. "Distribusi - Kosmetik"), opsinya muncul sendiri tanpa ubah kode.
router.get('/kinerja/pilihan', async (req, res) => {
  // Opsi bulan mengikuti tahun yang sedang dilihat (kalau ada).
  const tahun = String(req.query.tahun ?? '').trim();
  const pakaiTahun = /^\d{4}$/.test(tahun);
  const p = pakaiTahun ? [Number(tahun)] : [];

  try {
    const [tahunRows] = await db.query(
      `SELECT tahun, COUNT(*) AS jumlah FROM v_kinerja_sarana
        WHERE tahun IS NOT NULL GROUP BY tahun ORDER BY tahun DESC`,
    );
    const [bulanRows] = await db.query(
      `SELECT bulan, COUNT(*) AS jumlah FROM v_kinerja_sarana
        WHERE bulan IS NOT NULL ${pakaiTahun ? 'AND tahun = ?' : ''}
        GROUP BY bulan ORDER BY bulan`,
      p,
    );
    const [kegiatanRows] = await db.query(
      `SELECT COALESCE(kegiatan,'-') AS kegiatan, COUNT(*) AS jumlah FROM v_kinerja_sarana
        GROUP BY 1 ORDER BY jumlah DESC`,
    );
    const [jenisRows] = await db.query(
      `SELECT COALESCE(jenis_sarana,'-') AS jenis_sarana, COUNT(*) AS jumlah FROM v_kinerja_sarana
        GROUP BY 1 ORDER BY jumlah DESC, jenis_sarana`,
    );
    const [kabRows] = await db.query(
      `SELECT COALESCE(NULLIF(kab_kota,''),'Tidak diketahui') AS kab_kota, COUNT(*) AS jumlah
         FROM v_kinerja_sarana GROUP BY 1 ORDER BY jumlah DESC`,
    );
    // Asal modul (untuk dropdown "Sumber") — diambil dari isi view, jadi
    // modul baru otomatis muncul tanpa ubah kode.
    const [sumberRows] = await db.query(
      `SELECT sumber, sumber_label, COUNT(*) AS jumlah
         FROM v_kinerja_sarana GROUP BY sumber, sumber_label ORDER BY jumlah DESC`,
    );

    // Unggahan terakhir dihitung dari SEMUA tabel impor modul yang tampil di
    // dashboard publik. Setiap modul baru WAJIB ditambahkan di sini, kalau
    // tidak tanggal "data terakhir diunggah" tidak ikut bergerak.
    const [terakhir] = await db.query(
      `SELECT MAX(diunggah_pada) AS diunggah_pada, SUM(jumlah_impor) AS jumlah_impor
         FROM (
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM pbf_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM ot_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM irt_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM prod_md_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM sampel_ot_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM sampel_sk_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM sampel_ob_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM sampel_kos_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM sampel_pp_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM sampel_kp_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM sampel_ok_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM ifp_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM dist_kos_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM dist_ot_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM dist_ipk_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM dist_sk_import
           UNION ALL
           SELECT MAX(diunggah_pada) AS diunggah_pada, COUNT(*) AS jumlah_impor FROM ifk_import
         ) x`,
    );

    return res.json({
      success: true,
      data: {
        tahun: tahunRows,
        bulan: bulanRows.map((b) => ({
          nilai: b.bulan,
          nama: namaBulan(b.bulan),
          jumlah: b.jumlah,
        })),
        bulan_semua: BULAN_ID.map((nama, i) => ({ nilai: i + 1, nama })),
        kegiatan: kegiatanRows,
        sumber: sumberRows,
        jenis_sarana: jenisRows.filter((j) => j.jenis_sarana !== '-'),
        kab_kota: kabRows,
        terakhir_diunggah: terakhir[0]?.diunggah_pada || null,
      },
    });
  } catch (e) {
    console.error('Pilihan kinerja publik gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/publik/kinerja/ringkasan — rekap untuk peta + kartu angka
// ---------------------------------------------------------------------------
router.get('/kinerja/ringkasan', async (req, res) => {
  const saring = susunSaringan(req.query);
  if (saring.galat) return res.status(400).json({ success: false, message: saring.galat });

  const { where, params } = saring;

  try {
    // PENTING: `sarana_diperiksa` TIDAK boleh COUNT(*).
    // v_kinerja_sarana memuat juga baris SAMPEL (kegiatan='Sampling'), dan tiap
    // sampel = satu baris. Kalau dihitung apa adanya, angka "Total Sarana
    // Diperiksa" membengkak oleh ribuan sampel lab padahal sampel bukan sarana
    // yang diperiksa — sampel masuk ke bagian pengujian laboratorium.
    // Jadi yang dihitung hanya baris dengan kegiatan Produksi atau Distribusi.
    const [total] = await db.query(
      `SELECT SUM(kegiatan IN ('Produksi','Distribusi')) AS sarana_diperiksa,
              SUM(kegiatan = 'Produksi')   AS produksi,
              SUM(kegiatan = 'Distribusi') AS distribusi,
              SUM(kegiatan IS NULL)        AS tanpa_kegiatan,
              COUNT(DISTINCT jenis_sarana) AS jumlah_jenis_sarana,
              COALESCE(SUM(jumlah_mayor),0)  AS temuan_mayor,
              COALESCE(SUM(jumlah_minor),0)  AS temuan_minor,
              -- Berkas Pangan IRT memakai S (serius) di samping M/m/C. View hanya
              -- membawa mayor/minor/kritis, jadi kolom serius dijumlahkan via
              -- sub-agregat di v_kinerja_sarana (bernilai 0 untuk sumber lain).
              COALESCE(SUM(jumlah_lain),0) AS temuan_lain,
              COALESCE(SUM(jumlah_kritis),0) AS temuan_kritis,
              COALESCE(SUM(jumlah_sampel_lab),0) AS sampel_lab,
              SUM(kesimpulan_akhir LIKE '%Tidak Memenuhi%') AS tidak_memenuhi,
              SUM(kesimpulan_akhir LIKE '%Memenuhi%' AND kesimpulan_akhir NOT LIKE '%Tidak%') AS memenuhi
         FROM v_kinerja_sarana ${where}`,
      params,
    );

    // `total` = jumlah SARANA (bukan baris sampel). Wilayah tanpa nama ('-' /
    // kosong) dibuang supaya peringkat hanya berisi kabupaten/kota sungguhan
    // (Kalteng = 10 kab + 1 kota; di sini kota sudah termasuk, '-' bukan wilayah).
    const [perKab] = await db.query(
      `SELECT COALESCE(NULLIF(kab_kota,''),'Tidak diketahui') AS kab_kota,
              SUM(kegiatan IN ('Produksi','Distribusi')) AS total,
              SUM(kegiatan = 'Produksi')   AS produksi,
              SUM(kegiatan = 'Distribusi') AS distribusi,
              -- MK = Memenuhi Ketentuan, TMK = Tidak Memenuhi Ketentuan.
              -- Perhatikan: 'Tidak Memenuhi Ketentuan' JUGA memuat kata "Memenuhi",
              -- jadi MK harus mengecualikan yang berawalan "Tidak".
              SUM(kegiatan = 'Produksi'
                  AND kesimpulan_akhir LIKE '%Memenuhi%'
                  AND kesimpulan_akhir NOT LIKE '%Tidak%')            AS produksi_mk,
              SUM(kegiatan = 'Produksi'
                  AND kesimpulan_akhir LIKE '%Tidak Memenuhi%')       AS produksi_tmk,
              SUM(kegiatan = 'Distribusi'
                  AND kesimpulan_akhir LIKE '%Memenuhi%'
                  AND kesimpulan_akhir NOT LIKE '%Tidak%')            AS distribusi_mk,
              SUM(kegiatan = 'Distribusi'
                  AND kesimpulan_akhir LIKE '%Tidak Memenuhi%')       AS distribusi_tmk,
              COALESCE(SUM(jumlah_sampel_lab),0) AS sampel_lab,
              COALESCE(SUM(jumlah_mayor),0)  AS mayor,
              COALESCE(SUM(jumlah_minor),0)  AS minor,
              SUM(kesimpulan_akhir LIKE '%Tidak Memenuhi%') AS tidak_memenuhi
         FROM v_kinerja_sarana ${where}
        ${where ? 'AND' : 'WHERE'} COALESCE(kab_kota,'') NOT IN ('', '-')
        GROUP BY 1 HAVING total > 0 ORDER BY total DESC, kab_kota`,
      params,
    );

    // MK/TMK seluruh kab/kota — dipakai baris "Jumlah" di tabel per kab/kota.
    const [mkTmk] = await db.query(
      `SELECT SUM(kegiatan = 'Produksi'
                  AND kesimpulan_akhir LIKE '%Memenuhi%'
                  AND kesimpulan_akhir NOT LIKE '%Tidak%')      AS produksi_mk,
              SUM(kegiatan = 'Produksi'
                  AND kesimpulan_akhir LIKE '%Tidak Memenuhi%') AS produksi_tmk,
              SUM(kegiatan = 'Distribusi'
                  AND kesimpulan_akhir LIKE '%Memenuhi%'
                  AND kesimpulan_akhir NOT LIKE '%Tidak%')      AS distribusi_mk,
              SUM(kegiatan = 'Distribusi'
                  AND kesimpulan_akhir LIKE '%Tidak Memenuhi%') AS distribusi_tmk
         FROM v_kinerja_sarana ${where}`,
      params,
    );

    // `kegiatan` ikut dikirim: panel "Sebaran Jenis Sarana" memotong data
    // jadi DUA kelompok (Sarana Distribusi & Sarana Produksi), sedangkan
    // `jenis_sarana` di view dipakai untuk dua hal sekaligus — jenis sarana
    // sungguhan (PBF / Pangan IRT / Obat Tradisional) DAN komoditi sampel
    // (Obat / Kosmetika / …). Tanpa `kegiatan`, keduanya tercampur dan
    // baris sampel salah dihitung sebagai sarana.
    const [perJenis] = await db.query(
      `SELECT COALESCE(jenis_sarana,'Tidak diketahui') AS jenis_sarana,
              COALESCE(kegiatan,'-') AS kegiatan,
              COUNT(*) AS jumlah
         FROM v_kinerja_sarana ${where}
        GROUP BY 1, 2 ORDER BY jumlah DESC, jenis_sarana`,
      params,
    );

    const [perBulan] = await db.query(
      `SELECT bulan, COUNT(*) AS jumlah FROM v_kinerja_sarana ${where}
        ${where ? 'AND' : 'WHERE'} bulan IS NOT NULL
        GROUP BY bulan ORDER BY bulan`,
      params,
    );

    const [perSaranaNama] = await db.query(
      `SELECT COALESCE(NULLIF(nama_sarana,''),'Tanpa nama') AS nama, COUNT(*) AS jumlah
         FROM v_kinerja_sarana ${where}
        GROUP BY 1 ORDER BY jumlah DESC, nama LIMIT 10`,
      params,
    );

    return res.json({
      success: true,
      data: {
        filter: saring.dipakai,
        total: { ...total[0], ...mkTmk[0] },
        per_kab_kota: perKab,
        per_jenis_sarana: perJenis,
        per_bulan: perBulan.map((b) => ({ bulan: b.bulan, nama: namaBulan(b.bulan), jumlah: b.jumlah })),
        sarana_terbanyak: perSaranaNama,
      },
    });
  } catch (e) {
    console.error('Ringkasan kinerja publik gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/publik/kinerja/sarana — daftar sarana yang diperiksa (tabel bawah)
// ---------------------------------------------------------------------------
router.get('/kinerja/sarana', async (req, res) => {
  const saring = susunSaringan(req.query);
  if (saring.galat) return res.status(400).json({ success: false, message: saring.galat });

  const halaman = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (halaman - 1) * limit;
  const { where, params } = saring;

  try {
    const [baris] = await db.query(
      // `produk_sampel` = nama produk untuk cabang SAMPEL_*, NULL untuk
      // PBF/OT/IRTP (satu baris = satu sarana). Tanpa kolom ini modal rincian kab/kota
      // menampilkan beberapa baris yang tampak kembar: satu sarana bisa
      // diambil BEBERAPA produk pada satu kunjungan (mis. 6 obat di RS
      // Bhayangkara, 02 November 2026), dan kolom sarana+tanggalnya sama.
      `SELECT nama_sarana, kab_kota, kegiatan, jenis_sarana, sumber, sumber_label, bulan, tahun,
              tgl_periksa_mulai, tgl_periksa_selesai, kesimpulan_akhir, produk_sampel,
              COALESCE(jumlah_sampel_lab,0) AS sampel_lab,
              COALESCE(jumlah_mayor,0) AS mayor, COALESCE(jumlah_minor,0) AS minor
         FROM v_kinerja_sarana ${where}
        ORDER BY tahun DESC, bulan DESC, kab_kota, nama_sarana, produk_sampel
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const [jumlah] = await db.query(`SELECT COUNT(*) AS total FROM v_kinerja_sarana ${where}`, params);

    return res.json({
      success: true,
      data: {
        halaman,
        limit,
        total: jumlah[0].total,
        baris: baris.map((b) => ({ ...b, bulan_nama: namaBulan(b.bulan) })),
      },
    });
  } catch (e) {
    console.error('Daftar sarana publik gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/publik/kinerja/sampel — hasil pengujian laboratorium (sampel)
// ---------------------------------------------------------------------------
// Sumber data: tabel laporan modul sampel (`sampel_ot_laporan`,
// `sampel_sk_laporan`, `sampel_ob_laporan`, `sampel_kos_laporan`,
// `sampel_pp_laporan`, `sampel_kp_laporan` dijahit lewat TABEL_SAMPEL),
// BUKAN view
// `v_kinerja_sarana`: di view itu satu sampel cuma jadi satu baris sarana
// tanpa nama produk, kode sampel, atau sediaan.
//
// Tiga potong data yang dikembalikan sekaligus karena semuanya berasal dari
// himpunan baris yang sama — memisah jadi 3 request hanya menambah latensi:
//   1. `per_tahun`      — berapa sampel diuji tiap tahun + MK/TMK
//   2. `per_komoditas`  — sebaran kepatuhan mutu per kelompok komoditas
//   3. `per_sediaan`    — sebaran kepatuhan per bentuk sediaan (pelengkap)
//
// Normalisasi kesimpulan: berkas menulis campuran "MS" (21 baris) dan
// "Memenuhi Syarat" (281 baris). Tanpa `CASE` di bawah, kepatuhan terpecah
// jadi dua kategori dan persentasenya salah.
// Singkatan kesimpulan berbeda per komoditi: OT/SK menulis "MS"/"TMS",
// Obat menulis "MK"/"TMK" (Memenuhi/ Tidak Memenuhi Kriteria).
const KESIMPULAN_MEMENUHI = `(CASE
    WHEN UPPER(TRIM(COALESCE(kesimpulan_akhir,''))) IN
      ('MS','MK','MEMENUHI SYARAT','MEMENUHI KRITERIA','MEMENUHI')
      THEN 1 ELSE 0 END)`;

// "Tidak memenuhi" dihitung EKSPLISIT, tidak lagi `COUNT(*) - memenuhi`.
// Selisih itu keliru: hasil pengujian yang belum berkategori (mis. "Hasil
// Pengujian Seperti Tersebut (HPST)" atau belum ada kesimpulan) ikut terhitung
// sebagai tidak memenuhi. Berkas Obat 2025 punya 4 HPST + 2 kosong, dan angka
// tidak-memenuhi di dashboard membengkak jadi 8 padahal yang TMK hanya 2.
const KESIMPULAN_TIDAK_MEMENUHI = `(CASE
    WHEN UPPER(TRIM(COALESCE(kesimpulan_akhir,''))) IN
      ('TMS','TMK','TIDAK MEMENUHI SYARAT','TIDAK MEMENUHI KRITERIA')
      THEN 1 ELSE 0 END)`;

// Ada lebih dari satu modul sampel (Obat Tradisional, Suplemen Kesehatan, dan
// nanti komoditi lain). Struktur tabelnya dibuat seragam, jadi keduanya cukup
// dijahit dengan UNION ALL lalu diperlakukan sebagai satu himpunan:
// `per_komoditas` otomatis memisahkan kelompoknya, dan total tahunan tetap
// satu angka gabungan. Tabel baru CUKUP ditambahkan di daftar bawah ini.
const TABEL_SAMPEL = `(
    SELECT * FROM sampel_ot_laporan
    UNION ALL
    SELECT * FROM sampel_sk_laporan
    UNION ALL
    SELECT * FROM sampel_ob_laporan
    UNION ALL
    SELECT * FROM sampel_kos_laporan
    UNION ALL
    SELECT * FROM sampel_pp_laporan
    UNION ALL
    SELECT * FROM sampel_kp_laporan
    UNION ALL
    SELECT * FROM sampel_ok_laporan
  ) s`;

// Kelompok komoditas: dipakai apa adanya dari berkas (kolom `komoditi`).
// Sekarang berisi "Obat Tradisional", "Suplemen Kesehatan", "Obat",
// "Kosmetika", "Produk Pangan", "Kemasan Pangan", dan "Obat Kuasi". Modul sampel BARU wajib didaftarkan di
// TABEL_SAMPEL — kalau
// tidak, datanya ada di database tapi tidak muncul di dashboard publik.
router.get('/kinerja/sampel', async (req, res) => {
  const tahun = String(req.query.tahun ?? '').trim();
  const saringan = [];
  const params = [];
  if (tahun && tahun !== 'semua') {
    if (!/^\d{4}$/.test(tahun)) return res.status(400).json({ success: false, message: 'Parameter tahun harus 4 digit (mis. 2024)' });
    saringan.push('tahun = ?');
    params.push(Number(tahun));
  }
  const where = saringan.length ? `WHERE ${saringan.join(' AND ')}` : '';

  try {
    // per_tahun memakai LEFT JOIN ke daftar tahun terdaftar supaya tahun yang
    // sengaja didaftarkan TANPA sampel (impor 0 baris) tetap tampil dengan
    // angka 0 — kalau hanya GROUP BY dari tabel sampel, tahun itu hilang dan
    // grafik melompat (2024 → 2026) seolah 2025 tidak pernah ada.
    // Saat difilter satu tahun, subquery `sumber` juga mengikuti filter itu.
    const [perTahun] = await db.query(
      `SELECT t.tahun,
              COALESCE(COUNT(s.tahun), 0) AS sampel,
              COALESCE(SUM(${KESIMPULAN_MEMENUHI}), 0) AS memenuhi,
              COALESCE(SUM(${KESIMPULAN_TIDAK_MEMENUHI}), 0) AS tidak_memenuhi,
              COUNT(DISTINCT NULLIF(s.nama_sampel,'')) AS produk,
              COUNT(DISTINCT NULLIF(s.pabrik,'')) AS produsen,
              -- Wilayah sampling: '-' = berkas tidak mencantumkan wilayah,
              -- bukan kabupaten/kota. Membiarkannya membuat hitungan jadi 11.
              COUNT(DISTINCT CASE WHEN s.kab_kota NOT IN ('','-') THEN s.kab_kota END) AS wilayah
         FROM (
           SELECT tahun FROM ${TABEL_SAMPEL} WHERE tahun IS NOT NULL ${where ? `AND ${where.replace(/^WHERE /, '')}` : ''}
           UNION
           SELECT tahun FROM sampel_ot_import WHERE tahun IS NOT NULL
           UNION
           SELECT tahun FROM sampel_sk_import WHERE tahun IS NOT NULL
           UNION
           SELECT tahun FROM sampel_ob_import WHERE tahun IS NOT NULL
           UNION
           SELECT tahun FROM sampel_kos_import WHERE tahun IS NOT NULL
           UNION
           SELECT tahun FROM sampel_pp_import WHERE tahun IS NOT NULL
           UNION
           SELECT tahun FROM sampel_kp_import WHERE tahun IS NOT NULL
           UNION
           SELECT tahun FROM sampel_ok_import WHERE tahun IS NOT NULL
         ) t
         LEFT JOIN ${TABEL_SAMPEL} ON s.tahun = t.tahun
        ${where ? `WHERE t.${where.replace(/^WHERE /, '')}` : ''}
         GROUP BY t.tahun ORDER BY t.tahun DESC`,
      // Filter di subquery `sumber` dan di WHERE luar memakai parameter yang
      // sama, jadi nilainya diduplikasi persis dengan urutan yang sama.
      where ? [...params, ...params] : params,
    );

    const [perKomoditas] = await db.query(
      `SELECT COALESCE(NULLIF(TRIM(komoditi),''),'Tidak dicantumkan') AS komoditi,
              COUNT(*) AS sampel,
              SUM(${KESIMPULAN_MEMENUHI}) AS memenuhi,
              SUM(${KESIMPULAN_TIDAK_MEMENUHI}) AS tidak_memenuhi, 
              COUNT(DISTINCT NULLIF(nama_sampel,'')) AS produk
         FROM ${TABEL_SAMPEL} ${where}
        GROUP BY 1 ORDER BY sampel DESC, komoditi`,
      params,
    );

    const [perSediaan] = await db.query(
      `SELECT COALESCE(NULLIF(TRIM(bentuk_sediaan),''),'Tidak dicantumkan') AS bentuk_sediaan,
              COUNT(*) AS sampel,
              SUM(${KESIMPULAN_MEMENUHI}) AS memenuhi,
              COUNT(*) - SUM(${KESIMPULAN_MEMENUHI}) AS tidak_memenuhi
         FROM ${TABEL_SAMPEL} ${where}
        GROUP BY 1 ORDER BY sampel DESC, bentuk_sediaan
        LIMIT 12`,
      params,
    );

    const [ringkas] = await db.query(
      `SELECT COUNT(*) AS sampel,
              SUM(${KESIMPULAN_MEMENUHI}) AS memenuhi,
              SUM(${KESIMPULAN_TIDAK_MEMENUHI}) AS tidak_memenuhi, 
              COUNT(DISTINCT NULLIF(nama_sampel,'')) AS produk,
              COUNT(DISTINCT NULLIF(pabrik,'')) AS produsen,
              COUNT(DISTINCT CASE WHEN kab_kota NOT IN ('','-') THEN kab_kota END) AS wilayah
         FROM ${TABEL_SAMPEL} ${where}`,
      params,
    );

    // daftar_tahun juga memuat tahun yang DIDAFTARKAN tanpa sampel (impor 0
    // baris, mis. Kemasan Pangan 2025). Tanpa UNION ke tabel *_import, tahun
    // kosong hilang dari pemilih tahun padahal sengaja didaftarkan.
    const [daftarTahun] = await db.query(
      `SELECT DISTINCT tahun FROM (
         SELECT tahun FROM ${TABEL_SAMPEL} WHERE tahun IS NOT NULL
         UNION
         SELECT tahun FROM sampel_ot_import WHERE tahun IS NOT NULL
         UNION
         SELECT tahun FROM sampel_sk_import WHERE tahun IS NOT NULL
         UNION
         SELECT tahun FROM sampel_ob_import WHERE tahun IS NOT NULL
         UNION
         SELECT tahun FROM sampel_kos_import WHERE tahun IS NOT NULL
         UNION
         SELECT tahun FROM sampel_pp_import WHERE tahun IS NOT NULL
         UNION
         SELECT tahun FROM sampel_kp_import WHERE tahun IS NOT NULL
         UNION
         SELECT tahun FROM sampel_ok_import WHERE tahun IS NOT NULL
       ) t ORDER BY tahun DESC`,
    );

    return res.json({
      success: true,
      data: {
        total: ringkas[0],
        per_tahun: perTahun,
        per_komoditas: perKomoditas,
        per_sediaan: perSediaan,
        daftar_tahun: daftarTahun.map((r) => r.tahun),
      },
    });
  } catch (e) {
    // Tabel sampel belum ada (modul belum diimpor) → jangan bikin dashboard
    // publik error; kembalikan kosong supaya bagian ini hilang sendiri.
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        data: { total: {}, per_tahun: [], per_komoditas: [], per_sediaan: [], daftar_tahun: [] },
      });
    }
    console.error('Rekap sampel publik gagal:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/publik/kinerja/api-modul — katalog link API untuk integrasi LAURA AI
// ---------------------------------------------------------------------------
// Keluaran: daftar modul + `url_lengkap` yang bisa disalin lalu ditempel ke
// menu Integrasi Jendela Kinerja di LAURA AI.
// Konsumsi LINK API — link berisi token yang diterbitkan tombol "Link API"
// di dashboard (field dipilih operator). Tanpa login, hanya kolom terpilih.
router.get('/link/:token', linkApi.konsumsiLink);

router.get('/kinerja/api-modul', (req, res) => {
  // Host API bisa di-override lewat ?base= (mis. saat diakses lewat proxy),
  // default: origin dari request ini.
  const baseDiminta = String(req.query.base || '').trim();
  const base = /^https?:\/\//.test(baseDiminta)
    ? baseDiminta
    : `${req.protocol}://${req.get('host')}`;

  // ?modul=sampel/ot → hanya endpoint modul itu (dipakai tombol Link API
  // di header tiap modul dashboard).
  const modul = String(req.query.modul || '').trim() || null;
  const modul_ = daftarLinkApi(base, modul);

  res.json({
    success: true,
    data: {
      base_url: base.replace(/\/+$/, ''),
      modul_diminta: modul,
      jumlah: modul_.length,
      daftar_modul: daftarModul(),
      modul: modul_,
    },
  });
});

module.exports = router;
