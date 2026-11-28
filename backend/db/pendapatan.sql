-- ============================================================================
--  MODUL PENDAPATAN — REALISASI PENDAPATAN PER BULAN DAN PER AKUN
--  Sumber: export SAKTI "ADK REALISASI PENDAPATAN (SUMBER DATA : SAKTI)
--  PER SATKER", satu berkas per tahun anggaran, kolom TGLPOST per dokumen.
-- ----------------------------------------------------------------------------
--  Berkas ADK pendapatan memuat 19 kolom; yang dipakai hanya:
--      TAHUN_ANGGARAN | AKUN | REALISASI | TGLPOST | TIPE_ANGGARAN | NO_DOKUMEN
--
--  AKUN di sini adalah kode akun pendapatan 6 digit, mis. 425321.
--  Empat akun yang ditampilkan di aplikasi:
--      425321  Pendapatan Jasa Pengawasan Obat dan Makanan
--      425811  Pendapatan Denda Penyelesaian Pekerjaan Pemerintah
--      425151  Pendapatan Penggunaan Sarana dan Prasarana
--      425912  Penerimaan Kembali Belanja Barang Tahun Anggaran Yang Lalu
--
--  NILAI DISIMPAN PER (tahun, bulan, akun), BUKAN per dokumen.
--  Alasannya: yang dibutuhkan aplikasi hanya rekap bulanan per akun. Menyimpan
--  510-an dokumen per tahun tidak menambah informasi apa pun bagi tampilan,
--  tetapi membuat tabel cepat membengkak. Rincian dokumen tetap bisa dibuat
--  ulang kapan saja dari berkas CSV aslinya.
--
--  Berbeda dengan modul Anggaran/Realisasi Belanja (yang memakai MAK), modul
--  pendapatan cukup memakai AKUN: kode kegiatan/program tidak dipakai di layar.
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. Metadata berkas terakhir diunggah, satu baris per tahun anggaran
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pendapatan_import` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `tahun`          SMALLINT NOT NULL,
  `nama_berkas`    VARCHAR(255) NOT NULL,
  `jumlah_baris`   INT NOT NULL DEFAULT 0,
  `jumlah_dokumen` INT NOT NULL DEFAULT 0,
  `total`          DECIMAL(20,2) NOT NULL DEFAULT 0,
  `diunggah_oleh`  VARCHAR(150) NULL,
  `diunggah_pada`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Realisasi pendapatan per bulan per akun
--    bulan 1-12, akun 6 digit. Indeks unik dipakai untuk UPSERT saat impor
--    ulang, sehingga tidak pernah ada baris ganda untuk bulan+akun yang sama.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pendapatan_bulanan` (
  `id`     INT NOT NULL AUTO_INCREMENT,
  `tahun`  SMALLINT NOT NULL,
  `bulan`  TINYINT UNSIGNED NOT NULL,
  `akun`   CHAR(6) NOT NULL,
  `nilai`  DECIMAL(20,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tahun_bulan_akun` (`tahun`, `bulan`, `akun`),
  KEY `idx_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. Pandangan rekap per akun per tahun (dipakai endpoint ringkasan)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_pendapatan_akun` AS
SELECT
  `tahun`,
  `akun`,
  SUM(`nilai`) AS `total`,
  SUM(CASE WHEN `bulan` <= 6 THEN `nilai` ELSE 0 END) AS `semester_1`,
  SUM(CASE WHEN `bulan` >= 7 THEN `nilai` ELSE 0 END) AS `semester_2`
FROM `pendapatan_bulanan`
GROUP BY `tahun`, `akun`;
