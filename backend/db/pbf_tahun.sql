-- ============================================================================
--  MODUL DISTRIBUSI PBF — DUKUNGAN DATA PER TAHUN (MIGRASI)
-- ----------------------------------------------------------------------------
--  Perubahan semantik impor:
--    sebelum  : setiap unggahan mengganti SELURUH data (satu periode saja)
--    sekarang : setiap unggahan mengganti data TAHUN YANG DIPILIH saja,
--               tahun lain tidak tersentuh.
--
--  Karena itu kolom `tahun` ditambahkan ke `pbf_import` (sumber kebenaran)
--  dan ke `pbf_laporan` (denormalisasi, supaya filter/daftar tahun tidak perlu
--  join). Baris lama diisi otomatis dari teks periode berkas.
--
--  File ini IDEMPOTEN dan aman dijalankan berulang:
--  `ALTER TABLE` dibungkus pengecekan information_schema + PREPARE, karena
--  MySQL 8 tidak mengenal `ADD COLUMN IF NOT EXISTS`.
--  Nama file sengaja `pbf_tahun.sql` (underscore) supaya diurutkan SESUDAH
--  `pbf.sql` oleh scripts/apply-schema.js.
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. pbf_import.tahun — tahun data yang dimiliki satu unggahan
-- ---------------------------------------------------------------------------
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
                    WHERE table_schema = DATABASE() AND table_name = 'pbf_import');
SET @ada_kolom := (SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                      AND table_name = 'pbf_import' AND column_name = 'tahun');
SET @sql := IF(@ada_tabel = 1 AND @ada_kolom = 0,
  'ALTER TABLE `pbf_import`
     ADD COLUMN `tahun` SMALLINT NULL AFTER `id`,
     ADD KEY `idx_pbf_import_tahun` (`tahun`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 2. pbf_laporan.tahun — disalin dari pbf_import saat impor
-- ---------------------------------------------------------------------------
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
                    WHERE table_schema = DATABASE() AND table_name = 'pbf_laporan');
SET @ada_kolom := (SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                      AND table_name = 'pbf_laporan' AND column_name = 'tahun');
SET @sql := IF(@ada_tabel = 1 AND @ada_kolom = 0,
  'ALTER TABLE `pbf_laporan`
     ADD COLUMN `tahun` SMALLINT NULL AFTER `import_id`,
     ADD KEY `idx_pbf_laporan_tahun` (`tahun`)',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 3. Isi tahun baris lama dari teks periode ("14 November 2026" → 2026)
-- ---------------------------------------------------------------------------
UPDATE `pbf_import`
   SET `tahun` = CAST(SUBSTRING_INDEX(TRIM(`periode_akhir`), ' ', -1) AS UNSIGNED)
 WHERE `tahun` IS NULL
   AND TRIM(COALESCE(`periode_akhir`, '')) REGEXP '[0-9]{4}$';

UPDATE `pbf_laporan` l
  JOIN `pbf_import` i ON i.`id` = l.`import_id`
   SET l.`tahun` = i.`tahun`
 WHERE l.`tahun` IS NULL
   AND i.`tahun` IS NOT NULL;
