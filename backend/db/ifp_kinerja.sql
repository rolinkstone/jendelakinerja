-- ============================================================================
--  ifp_kinerja.sql — kolom turunan untuk dashboard publik "Jendela Kinerja"
-- ============================================================================
--  Menambah kolom yang dipakai filter dashboard publik di ifp_laporan:
--    kegiatan       → 'Produksi' / 'Distribusi' (dari kepala berkas Excel)
--    jenis_sarana   → 'IFP', 'Pangan MD', 'Kosmetik', … (sisa setelah kegiatan)
--    bulan          → 1–12, dari tanggal periksa (fallback tanggal input)
--
--  Isi kolom-kolom ini oleh:
--    - routes/ifp.js (impor baru, lewat lib/kinerja.js)
--    - scripts/backfill-kinerja.js (baris lama)
--
--  ALTER dibuat idempoten lewat information_schema karena MySQL 8 tidak punya
--  "ADD COLUMN IF NOT EXISTS". Aman dijalankan berkali-kali (apply-schema.js).
-- ============================================================================

SET @ada_kolom := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'ifp_laporan' AND column_name = 'kegiatan'
);
SET @sql := IF(@ada_kolom = 0,
  'ALTER TABLE `ifp_laporan`
     ADD COLUMN `kegiatan` VARCHAR(20) NULL COMMENT ''Produksi / Distribusi'' AFTER `import_id`,
     ADD COLUMN `jenis_sarana` VARCHAR(80) NULL COMMENT ''jenis sarana dari kepala berkas'' AFTER `kegiatan`,
     ADD COLUMN `bulan` TINYINT UNSIGNED NULL COMMENT ''1-12, dari tanggal periksa'' AFTER `jenis_sarana`',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- Kolom `tahun` ditambahkan di sini juga (idempoten) SEBELUM indeks dibuat.
-- Alasannya urutan berkas: `*_kinerja.sql` diurutkan SEBELUM `*_tahun.sql`,
-- sedangkan indeks di bawah menyebut kolom `tahun`. Tanpa blok ini, apply-schema
-- berhenti dengan "Key column 'tahun' doesn't exist in table".
-- Sumber utama kolom ini tetap `<tabel>_tahun.sql`; blok ini hanya jaring aman.
-- ---------------------------------------------------------------------------
SET @ada_tahun := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'ifp_laporan' AND column_name = 'tahun'
);
SET @sql_tahun := IF(@ada_tahun = 0,
  'ALTER TABLE `ifp_laporan` ADD COLUMN `tahun` SMALLINT UNSIGNED NULL COMMENT ''tahun data'' AFTER `import_id`',
  'DO 0');
PREPARE st FROM @sql_tahun; EXECUTE st; DEALLOCATE PREPARE st;

SET @ada_index := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'ifp_laporan' AND index_name = 'idx_ifp_kinerja'
);
SET @sql := IF(@ada_index = 0,
  'ALTER TABLE `ifp_laporan` ADD INDEX `idx_ifp_kinerja` (`tahun`, `bulan`, `kegiatan`, `jenis_sarana`)',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @ada_index_kab := (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'ifp_laporan' AND index_name = 'idx_ifp_laporan_kab'
);
SET @sql := IF(@ada_index_kab = 0,
  'ALTER TABLE `ifp_laporan` ADD INDEX `idx_ifp_laporan_kab` (`kab_kota`)',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
