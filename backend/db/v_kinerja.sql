-- ============================================================================
--  VIEW GABUNGAN KINERJA — DISTRIBUSI (PBF) + PRODUKSI (OT + PANGAN IRT)
--                          + SAMPEL (OBAT TRADISIONAL)
-- ----------------------------------------------------------------------------
--  Dashboard publik /jendela-kinerja menampilkan SARANA PRODUKSI dan SARANA
--  DISTRIBUSI dalam satu tabel + satu peta. Supaya router publik tidak perlu
--  tahu dari tabel mana asalnya, kedua tabel dijahit di sini dengan kolom yang
--  seragam:
--
--    sumber            : 'PBF' | 'OT' | 'IRTP' | 'SAMPEL_OT' | 'SAMPEL_SK' |
--                        'SAMPEL_OB' | 'SAMPEL_KOS' | 'SAMPEL_PP' | 'SAMPEL_KP'
--    sumber_label      : 'PBF' | 'Obat Tradisional' | 'Pangan IRT' |
--                        'Sampel Obat Tradisional' | 'Sampel Suplemen Kesehatan' |
--                        'Sampel Obat' | 'Sampel Kosmetika' | 'Sampel Produk Pangan' |
--                        'Sampel Kemasan Pangan' |
--                        'Sampel Obat Kuasi'
--    kegiatan          : 'Distribusi' | 'Produksi' | 'Sampling'
--    kesimpulan_akhir  : hasil pemeriksaan (PBF: kesimpulan_akhir; OT/IRTP: hasil_balai)
--    produk_sampel     : nama produk yang diuji — hanya cabang SAMPEL_*.
--                        NULL untuk PBF/OT/IRTP karena satu baris di sana =
--                        satu sarana, bukan sampel. Kode sampel sengaja TIDAK
--                        ikut supaya kolom di modal rincian tidak melebar.
--                        Dipakai modal rincian kab/kota supaya beberapa sampel
--                        dari sarana & tanggal yang sama (mis. 6 obat diambil di
--                        satu RS pada hari yang sama) bisa dibedakan pembaca.
--
--  File ini IDEMPOTEN (CREATE OR REPLACE VIEW) dan HARUS diurutkan SESUDAH
--  pbf.sql / pbf_kinerja.sql / pbf_sampel_lab.sql / produksi_ot.sql /
--  produksi_irt.sql / sampel_ot.sql / sampel_sk.sql / sampel_ob.sql /
--  sampel_kos.sql / sampel_pp.sql / sampel_kp.sql / sampel_ok.sql — makanya
--  namanya diawali 'v_' supaya apply-schema.js (urut alfabetis) menjalankannya
--  paling akhir. View bergantung pada kolom yang baru ada setelah migrasi itu.
-- ============================================================================

USE `jendelakinerja`;

CREATE OR REPLACE VIEW `v_kinerja_sarana` AS
SELECT
  'PBF'                AS `sumber`,
  'PBF'                AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `jenis_sarana`       AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `kesimpulan_akhir`   AS `kesimpulan_akhir`,
  `jumlah_mayor`       AS `jumlah_mayor`,
  `jumlah_minor`       AS `jumlah_minor`,
  NULL                 AS `jumlah_lain`,
  `jumlah_kritis`      AS `jumlah_kritis`,
  `jumlah_sampel_lab`  AS `jumlah_sampel_lab`,
  `tgl_input`          AS `tgl_input`,
  `tgl_periksa_mulai`  AS `tgl_periksa_mulai`,
  `tgl_periksa_selesai` AS `tgl_periksa_selesai`,
  `jenis_industri`     AS `jenis_industri`,
  NULL                 AS `produk_sampel`
FROM `pbf_laporan`

UNION ALL

SELECT
  'IRTP'               AS `sumber`,
  'Pangan IRT'         AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `jenis_sarana`       AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `hasil_balai`        AS `kesimpulan_akhir`,
  `jumlah_mayor`       AS `jumlah_mayor`,
  `jumlah_minor`       AS `jumlah_minor`,
  `jumlah_serius`      AS `jumlah_lain`,
  `jumlah_kritis`      AS `jumlah_kritis`,
  `jumlah_sampel_lab`  AS `jumlah_sampel_lab`,
  `tgl_input`          AS `tgl_input`,
  `tgl_periksa_mulai`  AS `tgl_periksa_mulai`,
  `tgl_periksa_selesai` AS `tgl_periksa_selesai`,
  `jenis_industri`     AS `jenis_industri`,
  NULL                 AS `produk_sampel`
FROM `irt_laporan`

UNION ALL

SELECT
  'OT'                 AS `sumber`,
  'Obat Tradisional'   AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `jenis_sarana`       AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `hasil_balai`        AS `kesimpulan_akhir`,
  `jumlah_mayor`       AS `jumlah_mayor`,
  `jumlah_minor`       AS `jumlah_minor`,
  -- OBAT TRADISIONAL: kolom "O" (lainnya) menempati slot jumlah_lain.
  -- PANGAN IRT: kolom "S" (serius) menempati slot yang sama.
  `jumlah_lain`        AS `jumlah_lain`,
  `jumlah_kritis`      AS `jumlah_kritis`,
  `jumlah_sampel_lab`  AS `jumlah_sampel_lab`,
  `tgl_input`          AS `tgl_input`,
  `tgl_periksa_mulai`  AS `tgl_periksa_mulai`,
  `tgl_periksa_selesai` AS `tgl_periksa_selesai`,
  `jenis_industri`     AS `jenis_industri`,
  NULL                 AS `produk_sampel`
FROM `ot_laporan`

UNION ALL

-- SAMPEL OT: bukan pemeriksaan sarana, melainkan SAMPEL produk yang diuji lab.
-- Karena itu kolom temuan (mayor/minor/lain/kritis) selalu NULL: tidak ada
-- grading sarana di berkas sampel. Kolom yang bermakna: kesimpulan_akhir
-- (Memenuhi/Tidak Memenuhi Syarat) dan jumlah_sampel_lab = 1 per sampel,
-- sehingga "total sampel" di dashboard publik terhitung benar.
SELECT
  'SAMPEL_OT'          AS `sumber`,
  'Sampel Obat Tradisional' AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `komoditi`           AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `kesimpulan_akhir`   AS `kesimpulan_akhir`,
  NULL                 AS `jumlah_mayor`,
  NULL                 AS `jumlah_minor`,
  NULL                 AS `jumlah_lain`,
  NULL                 AS `jumlah_kritis`,
  1                    AS `jumlah_sampel_lab`,
  `tgl_sampling`       AS `tgl_input`,
  `tgl_sampling`       AS `tgl_periksa_mulai`,
  `tgl_lhu`            AS `tgl_periksa_selesai`,
  `bentuk_sediaan`     AS `jenis_industri`,
  -- nama produk saja (kode sampel tidak diikutkan: kolom jadi terlalu lebar)
  `nama_sampel`        AS `produk_sampel`
FROM `sampel_ot_laporan`

UNION ALL

-- ---------------------------------------------------------------------------
-- Cabang 5: SAMPEL SUPLEMEN KESEHATAN (SK)
-- ---------------------------------------------------------------------------
SELECT
  'SAMPEL_SK'               AS `sumber`,
  'Sampel Suplemen Kesehatan' AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `komoditi`           AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `kesimpulan_akhir`   AS `kesimpulan_akhir`,
  NULL                 AS `jumlah_mayor`,
  NULL                 AS `jumlah_minor`,
  NULL                 AS `jumlah_lain`,
  NULL                 AS `jumlah_kritis`,
  1                    AS `jumlah_sampel_lab`,
  `tgl_sampling`       AS `tgl_input`,
  `tgl_sampling`       AS `tgl_periksa_mulai`,
  `tgl_lhu`            AS `tgl_periksa_selesai`,
  `bentuk_sediaan`     AS `jenis_industri`,
  -- nama produk saja (kode sampel tidak diikutkan: kolom jadi terlalu lebar)
  `nama_sampel`        AS `produk_sampel`
FROM `sampel_sk_laporan`

UNION ALL

-- ---------------------------------------------------------------------------
-- Cabang 6: SAMPEL OBAT (OB)
-- ---------------------------------------------------------------------------
SELECT
  'SAMPEL_OB'               AS `sumber`,
  'Sampel Obat'             AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `komoditi`           AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `kesimpulan_akhir`   AS `kesimpulan_akhir`,
  NULL                 AS `jumlah_mayor`,
  NULL                 AS `jumlah_minor`,
  NULL                 AS `jumlah_lain`,
  NULL                 AS `jumlah_kritis`,
  1                    AS `jumlah_sampel_lab`,
  `tgl_sampling`       AS `tgl_input`,
  `tgl_sampling`       AS `tgl_periksa_mulai`,
  `tgl_lhu`            AS `tgl_periksa_selesai`,
  `bentuk_sediaan`     AS `jenis_industri`,
  -- nama produk saja (kode sampel tidak diikutkan: kolom jadi terlalu lebar)
  `nama_sampel`        AS `produk_sampel`
FROM `sampel_ob_laporan`

UNION ALL

-- ---------------------------------------------------------------------------
-- Cabang 7: SAMPEL KOSMETIKA (KOS)
-- ---------------------------------------------------------------------------
SELECT
  'SAMPEL_KOS'              AS `sumber`,
  'Sampel Kosmetika'        AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `komoditi`           AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `kesimpulan_akhir`   AS `kesimpulan_akhir`,
  NULL                 AS `jumlah_mayor`,
  NULL                 AS `jumlah_minor`,
  NULL                 AS `jumlah_lain`,
  NULL                 AS `jumlah_kritis`,
  1                    AS `jumlah_sampel_lab`,
  `tgl_sampling`       AS `tgl_input`,
  `tgl_sampling`       AS `tgl_periksa_mulai`,
  `tgl_lhu`            AS `tgl_periksa_selesai`,
  `bentuk_sediaan`     AS `jenis_industri`,
  -- nama produk saja (kode sampel tidak diikutkan: kolom jadi terlalu lebar)
  `nama_sampel`        AS `produk_sampel`
FROM `sampel_kos_laporan`

UNION ALL

-- ---------------------------------------------------------------------------
-- Cabang 8: SAMPEL PRODUK PANGAN (PP)
-- Salah satu bagian dari berkas "Produk Pangan" (komoditi = Produk Pangan).
-- `kategori_sarana` di berkas ini berisi "Pangan IRT (CPPB - IRT)" dsb, tapi
-- yang dipakai sebagai `jenis_sarana` di view tetap KOMODITI ("Produk Pangan")
-- supaya sejalan dengan cabang sampel lain dan tidak tercampur dengan modul
-- Produksi Pangan IRT yang memang menilai sarana.
-- ---------------------------------------------------------------------------
SELECT
  'SAMPEL_PP'               AS `sumber`,
  'Sampel Produk Pangan'    AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `komoditi`           AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `kesimpulan_akhir`   AS `kesimpulan_akhir`,
  NULL                 AS `jumlah_mayor`,
  NULL                 AS `jumlah_minor`,
  NULL                 AS `jumlah_lain`,
  NULL                 AS `jumlah_kritis`,
  1                    AS `jumlah_sampel_lab`,
  `tgl_sampling`       AS `tgl_input`,
  `tgl_sampling`       AS `tgl_periksa_mulai`,
  `tgl_lhu`            AS `tgl_periksa_selesai`,
  `bentuk_sediaan`     AS `jenis_industri`,
  -- nama produk saja (kode sampel tidak diikutkan: kolom jadi terlalu lebar)
  `nama_sampel`        AS `produk_sampel`
FROM `sampel_pp_laporan`

UNION ALL

-- ---------------------------------------------------------------------------
-- Cabang 9: SAMPEL KEMASAN PANGAN (KP)
-- Tata letak berkasnya sama dengan Produk Pangan (54 kolom). `kategori_sarana`
-- di berkas ini hanya berisi "Pangan" sehingga bukan jenis sarana; `jenis_sarana`
-- di view tetap KOMODITI ("Kemasan Pangan") agar sejalan cabang sampel lain.
-- Rincian kemasan ("» Polikarbonat (pc)") ada di kolom `kategori` dan tidak
-- dipakai sebagai kunci agregat.
-- ---------------------------------------------------------------------------
SELECT
  'SAMPEL_KP'               AS `sumber`,
  'Sampel Kemasan Pangan'   AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `komoditi`           AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `kesimpulan_akhir`   AS `kesimpulan_akhir`,
  NULL                 AS `jumlah_mayor`,
  NULL                 AS `jumlah_minor`,
  NULL                 AS `jumlah_lain`,
  NULL                 AS `jumlah_kritis`,
  1                    AS `jumlah_sampel_lab`,
  `tgl_sampling`       AS `tgl_input`,
  `tgl_sampling`       AS `tgl_periksa_mulai`,
  `tgl_lhu`            AS `tgl_periksa_selesai`,
  `bentuk_sediaan`     AS `jenis_industri`,
  -- nama produk saja (kode sampel tidak diikutkan: kolom jadi terlalu lebar)
  `nama_sampel`        AS `produk_sampel`
FROM `sampel_kp_laporan`

UNION ALL

-- ---------------------------------------------------------------------------
-- Cabang 10: SAMPEL OBAT KUASI (OK)
-- Tata letak berkasnya sama dengan Produk Pangan (54 kolom). `jenis_sarana`
-- di view adalah KOMODITI ("Obat Kuasi").
-- ---------------------------------------------------------------------------
SELECT
  'SAMPEL_OK'               AS `sumber`,
  'Sampel Obat Kuasi'       AS `sumber_label`,
  `kegiatan`           AS `kegiatan`,
  `komoditi`           AS `jenis_sarana`,
  `tahun`              AS `tahun`,
  `bulan`              AS `bulan`,
  `kab_kota`           AS `kab_kota`,
  `nama_sarana`        AS `nama_sarana`,
  `kesimpulan_akhir`   AS `kesimpulan_akhir`,
  NULL                 AS `jumlah_mayor`,
  NULL                 AS `jumlah_minor`,
  NULL                 AS `jumlah_lain`,
  NULL                 AS `jumlah_kritis`,
  1                    AS `jumlah_sampel_lab`,
  `tgl_sampling`       AS `tgl_input`,
  `tgl_sampling`       AS `tgl_periksa_mulai`,
  `tgl_lhu`            AS `tgl_periksa_selesai`,
  `bentuk_sediaan`     AS `jenis_industri`,
  -- nama produk saja (kode sampel tidak diikutkan: kolom jadi terlalu lebar)
  `nama_sampel`        AS `produk_sampel`
FROM `sampel_ok_laporan`;
