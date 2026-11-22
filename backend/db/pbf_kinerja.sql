-- ============================================================================
--  pbf_kinerja.sql — kolom turunan untuk dashboard publik "Jendela Kinerja"
-- ============================================================================
--  Menambah kolom yang dipakai filter dashboard publik di pbf_laporan:
--    kegiatan       → 'Produksi' / 'Distribusi' (dari kepala berkas Excel)
--    jenis_sarana   → 'PBF', 'Pangan MD', 'Kosmetik', … (sisa setelah kegiatan)
--    bulan          → 1–12, dari tanggal periksa (fallback tanggal input)
--
--  Isi kolom-kolom ini oleh:
--    - routes/pbf.js (impor baru, lewat lib/kinerja.js)
--    - scripts/backfill-kinerja.js (baris lama)
--
--  ALTER dibuat idempoten lewat information_schema karena MySQL 8 tidak punya
--  "ADD COLUMN IF NOT EXISTS". Aman dijalankan berkali-kali (apply-schema.js).
-- ============================================================================

SET @ada_kolom := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'pbf_laporan' AND column_name = 'kegiatan'
);
SET @sql := IF(@ada_kolom = 0,
  'ALTER TABLE `pbf_laporan`
     ADD COLUMN `kegiatan` VARCHAR(20) NULL COMMENT ''Produksi / Distribusi'' AFTER `import_id`,
     ADD COLUMN `jenis_sarana` VARCHAR(80) NULL COMMENT ''jenis sarana dari kepala berkas'' AFTER `kegiatan`,
     ADD COLUMN `bulan` TINYINT UNSIGNED NULL COMMENT ''1-12, dari tanggal periksa'' AFTER `jenis_sarana`',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @ada_index := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'pbf_laporan' AND index_name = 'idx_pbf_kinerja'
);
SET @sql := IF(@ada_index = 0,
  'ALTER TABLE `pbf_laporan` ADD INDEX `idx_pbf_kinerja` (`tahun`, `bulan`, `kegiatan`, `jenis_sarana`)',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @ada_index_kab := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'pbf_laporan' AND index_name = 'idx_pbf_laporan_kab'
);
SET @sql := IF(@ada_index_kab = 0,
  'ALTER TABLE `pbf_laporan` ADD INDEX `idx_pbf_laporan_kab` (`kab_kota`)',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
