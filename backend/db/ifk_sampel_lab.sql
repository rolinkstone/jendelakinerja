-- ============================================================================
--  ifk_sampel_lab.sql — kolom jumlah sampel laboratorium (kolom tabel publik)
-- ============================================================================
--  Tabel "Data Kinerja Pengawasan Per Kabupaten/Kota" di halaman publik
--  /jendela-kinerja menampilkan kolom "Total Sampel Lab". Nilainya diambil dari
--  kolom ini (jumlah sampel yang dikirim/diperiksa laboratorium per laporan).
--
--  Kolom ini OPSIONAL:
--    - impor berkas mengisinya bila di baris header ada kolom bernama memuat
--      "sampel" (routes/ifp.js), kalau tidak → NULL;
--    - baris lama tetap NULL dan dianggap 0 di dashboard publik.
--
--  ALTER idempoten lewat information_schema karena MySQL 8 tidak punya
--  "ADD COLUMN IF NOT EXISTS". Aman dijalankan berkali-kali (apply-schema.js).
-- ============================================================================

SET @ada_kolom := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'ifk_laporan' AND column_name = 'jumlah_sampel_lab'
);
SET @sql := IF(@ada_kolom = 0,
  'ALTER TABLE `ifk_laporan`
     ADD COLUMN `jumlah_sampel_lab` INT NULL COMMENT ''jumlah sampel yang diperiksa laboratorium'' AFTER `jumlah_kritis`',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
