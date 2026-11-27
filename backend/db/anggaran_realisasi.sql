-- ============================================================================
--  MODUL ANGGARAN DAN REALISASI
--  TABEL IMPOR "Realisasi FA berdasarkan SP2D" PER TAHUN ANGGARAN
-- ----------------------------------------------------------------------------
--  Sumber: export SAKTI "Realisasi FA berdasarkan SP2D", satu sheet "Data",
--  empat kolom: KODE COA | PAGU | REALISASI | SISA PAGU.
--
--  YANG DISIMPAN HANYA LIMA KOLOM
--  ------------------------------
--  Permintaan pemilik aplikasi: database cukup menyimpan MAK, pagu, realisasi,
--  sisa, dan tahun anggaran. Kolom COA disimpan UTUH (bukan dipecah) karena
--  MAK diturunkan darinya SAAT DIBACA, bukan saat disimpan. Dengan begitu:
--    - aturan pembentukan MAK bisa diperbaiki tanpa mengimpor ulang berkas;
--    - kode asli tetap ada sebagai bukti kalau ada sengketa angka.
--
--  MAK (Mata Anggaran Kegiatan) dibentuk di backend/lib/mak.js dari COA:
--      432872.043.524111.06301DR.3165BDB.A000000001.00000.2.1451.2.000000.000000.001.051.0A.000019
--      -> 3165.BDB.001.051.524111.A
--  Tempelan "A" di ujung = huruf dari segmen ke-15 (0A). Aturan ini sengaja
--  ditaruh di satu berkas supaya konsisten di semua tempat.
--
--  ATURAN IMPOR (per tahun) - sama dengan modul lain di aplikasi ini
--  ----------------------------------------------------------------
--  Setiap unggahan terikat pada SATU TAHUN ANGGARAN dari isian formulir.
--  Yang dihapus lalu diisi ulang hanya baris milik tahun tersebut; tahun lain
--  tidak tersentuh. Impor 2025 dan 2026 bisa hidup berdampingan.
--
--  Kolom pagu/realisasi/sisa disimpan sebagai DECIMAL(20,2), BUKAN teks.
--  Di berkas Excel nilainya teks berpemisah titik ribuan ("2.025.000"), jadi
--  parser wajib membuang titik lebih dulu sebelum menyimpan.
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. Metadata berkas yang terakhir diunggah (satu baris per tahun anggaran)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `anggaran_import` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `tahun`        SMALLINT NOT NULL,
  `nama_berkas`  VARCHAR(255) NOT NULL,
  `jumlah_baris` INT NOT NULL DEFAULT 0,
  `total_pagu`   DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total_realisasi` DECIMAL(20,2) NOT NULL DEFAULT 0,
  `total_sisa`   DECIMAL(20,2) NOT NULL DEFAULT 0,
  `diunggah_oleh` VARCHAR(150) NULL,
  `diunggah_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_anggaran_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 2. Baris data: satu baris = satu KODE COA pada satu tahun anggaran
--    `mak` diisi hasil olahan backend (lihat backend/lib/mak.js) supaya
--    pengelompokan dan pengurutan di SQL tidak perlu memecah string.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `anggaran_realisasi` (
  `id`         BIGINT NOT NULL AUTO_INCREMENT,
  `tahun`      SMALLINT NOT NULL,
  `coa`        VARCHAR(160) NOT NULL,
  `mak`        VARCHAR(60) NOT NULL,
  `pagu`       DECIMAL(20,2) NOT NULL DEFAULT 0,
  `realisasi`  DECIMAL(20,2) NOT NULL DEFAULT 0,
  `sisa`       DECIMAL(20,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_anggaran_tahun` (`tahun`),
  -- Kunci penggabungan saat impor: satu COA hanya boleh muncul sekali per tahun.
  UNIQUE KEY `uq_anggaran_coa` (`tahun`, `coa`),
  KEY `idx_anggaran_mak` (`tahun`, `mak`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 3. Rekap per MAK (dipakai tabel utama halaman /anggaran-realisasi)
--    Persentase serapan dihitung di sini agar frontend dan LAURA tidak
--    menghitung sendiri-sendiri (sumber selisih angka yang sering terjadi).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW `v_anggaran_mak` AS
SELECT
  `tahun`,
  `mak`,
  SUBSTRING_INDEX(`mak`, '.', 1) AS `unit_kerja`,
  SUBSTRING_INDEX(SUBSTRING_INDEX(`mak`, '.', 2), '.', -1) AS `komponen`,
  SUBSTRING_INDEX(SUBSTRING_INDEX(`mak`, '.', 4), '.', -1) AS `seg12`,
  SUBSTRING_INDEX(SUBSTRING_INDEX(`mak`, '.', 5), '.', -1) AS `seg13`,
  -- `akun` = segmen ke-5. Sempat tertulis ke-6, sehingga kolomnya berisi
  -- huruf penutup (A/B/C) dan filter akun tidak pernah cocok.
  SUBSTRING_INDEX(SUBSTRING_INDEX(`mak`, '.', 5), '.', -1) AS `akun`,
  -- Segmen terakhir MAK adalah HURUF pembeda, bukan sub-unit satker
  -- (DR/WA sengaja tidak ikut masuk MAK). Dulu kolom ini bernama `sub_unit`
  -- sehingga tampilan menuliskan "3165.A" seolah A adalah sub-unit.
  SUBSTRING_INDEX(`mak`, '.', -1) AS `huruf`,
  SUM(`pagu`) AS `pagu`,
  SUM(`realisasi`) AS `realisasi`,
  SUM(`sisa`) AS `sisa`,
  CASE
    WHEN SUM(`pagu`) = 0 THEN 0
    ELSE ROUND(SUM(`realisasi`) / SUM(`pagu`) * 100, 2)
  END AS `persen_serapan`,
  COUNT(*) AS `jumlah_baris`
FROM `anggaran_realisasi`
GROUP BY `tahun`, `mak`;
