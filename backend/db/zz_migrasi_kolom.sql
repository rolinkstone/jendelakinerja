-- ============================================================================
--  MIGRASI KOLOM — dijalankan TERAKHIR (awalan "zz" agar urutannya paling akhir)
-- ----------------------------------------------------------------------------
--  Berkas sampel tiap komoditi tidak selalu memakai kolom yang sama. Berkas
--  "Obat 2025.xlsx" menambah dua kolom yang tidak ada di berkas OT/SK:
--  Kriteria Resiko dan ATC. Dua kolom itu ikut disimpan supaya tidak hilang.
--
--  Di berkas ini juga: pelebaran kolom yang sudah ada (`tujuan_sampling`,
--  `pabrik`). Lebarnya diperiksa dari information_schema, jadi ALTER hanya
--  dijalankan kalau memang masih sempit — aman dijalankan berulang.
--
--  MySQL 8 tidak punya "ADD COLUMN IF NOT EXISTS", jadi keberadaannya diperiksa
--  lewat information_schema lalu ALTER dijalankan lewat PREPARE. Semua berkas
--  skema di folder ini aman dijalankan berulang; file ini mengikuti aturan itu.
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- sampel_ot_laporan
-- ---------------------------------------------------------------------------
SET @tabel := 'sampel_ot_laporan';
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = @tabel);
SET @ada_kolom := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @tabel AND column_name = 'atc');
SET @sql := IF(@ada_tabel = 1 AND @ada_kolom = 0,
  'ALTER TABLE `sampel_ot_laporan`
     ADD COLUMN `kriteria_resiko` VARCHAR(120) NULL AFTER `anggaran_sampling`,
     ADD COLUMN `atc` VARCHAR(120) NULL AFTER `no_reg`',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- sampel_sk_laporan
-- ---------------------------------------------------------------------------
SET @tabel := 'sampel_sk_laporan';
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = @tabel);
SET @ada_kolom := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @tabel AND column_name = 'atc');
SET @sql := IF(@ada_tabel = 1 AND @ada_kolom = 0,
  'ALTER TABLE `sampel_sk_laporan`
     ADD COLUMN `kriteria_resiko` VARCHAR(120) NULL AFTER `anggaran_sampling`,
     ADD COLUMN `atc` VARCHAR(120) NULL AFTER `no_reg`',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- sampel_ob_laporan (tabel baru sudah membawa kolomnya; blok ini untuk database
-- yang tabelnya dibuat sebelum kolom ditambahkan)
-- ---------------------------------------------------------------------------
SET @tabel := 'sampel_ob_laporan';
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = @tabel);
SET @ada_kolom := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @tabel AND column_name = 'atc');
SET @sql := IF(@ada_tabel = 1 AND @ada_kolom = 0,
  'ALTER TABLE `sampel_ob_laporan`
     ADD COLUMN `kriteria_resiko` VARCHAR(120) NULL AFTER `anggaran_sampling`,
     ADD COLUMN `atc` VARCHAR(120) NULL AFTER `no_reg`',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- Pelebaran kolom: berkas Kosmetika punya tujuan sampling panjang
-- ("Targeted » Dijual di online official store/reseller » Cluster A …" = 76
-- karakter) dan pabrik sampai 297 karakter (memuat alamat lengkap). Berkas
-- Obat 2024 punya tujuan sampling 211 karakter. Dengan lebar lama, impor gagal
-- "Data too long for column".
-- ---------------------------------------------------------------------------

SET @tabel := 'sampel_ot_laporan';
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = @tabel);
SET @perlu := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @tabel
    AND ((column_name = 'tujuan_sampling' AND character_maximum_length < 255)
      OR (column_name = 'jenis_sarana'    AND character_maximum_length < 255)
      OR (column_name = 'pabrik'          AND character_maximum_length < 400)));
SET @sql := IF(@ada_tabel = 1 AND @perlu > 0,
  CONCAT('ALTER TABLE `', @tabel, '`',
         ' MODIFY COLUMN `tujuan_sampling` VARCHAR(255) NULL,',
         ' MODIFY COLUMN `jenis_sarana` VARCHAR(255) NULL,',
         ' MODIFY COLUMN `pabrik` VARCHAR(400) NULL'),
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tabel := 'sampel_sk_laporan';
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = @tabel);
SET @perlu := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @tabel
    AND ((column_name = 'tujuan_sampling' AND character_maximum_length < 255)
      OR (column_name = 'jenis_sarana'    AND character_maximum_length < 255)
      OR (column_name = 'pabrik'          AND character_maximum_length < 400)));
SET @sql := IF(@ada_tabel = 1 AND @perlu > 0,
  CONCAT('ALTER TABLE `', @tabel, '`',
         ' MODIFY COLUMN `tujuan_sampling` VARCHAR(255) NULL,',
         ' MODIFY COLUMN `jenis_sarana` VARCHAR(255) NULL,',
         ' MODIFY COLUMN `pabrik` VARCHAR(400) NULL'),
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tabel := 'sampel_ob_laporan';
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = @tabel);
SET @perlu := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @tabel
    AND ((column_name = 'tujuan_sampling' AND character_maximum_length < 255)
      OR (column_name = 'jenis_sarana'    AND character_maximum_length < 255)
      OR (column_name = 'pabrik'          AND character_maximum_length < 400)));
SET @sql := IF(@ada_tabel = 1 AND @perlu > 0,
  CONCAT('ALTER TABLE `', @tabel, '`',
         ' MODIFY COLUMN `tujuan_sampling` VARCHAR(255) NULL,',
         ' MODIFY COLUMN `jenis_sarana` VARCHAR(255) NULL,',
         ' MODIFY COLUMN `pabrik` VARCHAR(400) NULL'),
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @tabel := 'sampel_kos_laporan';
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = @tabel);
SET @perlu := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @tabel
    AND ((column_name = 'tujuan_sampling' AND character_maximum_length < 255)
      OR (column_name = 'jenis_sarana'    AND character_maximum_length < 255)
      OR (column_name = 'pabrik'          AND character_maximum_length < 400)));
SET @sql := IF(@ada_tabel = 1 AND @perlu > 0,
  CONCAT('ALTER TABLE `', @tabel, '`',
         ' MODIFY COLUMN `tujuan_sampling` VARCHAR(255) NULL,',
         ' MODIFY COLUMN `jenis_sarana` VARCHAR(255) NULL,',
         ' MODIFY COLUMN `pabrik` VARCHAR(400) NULL'),
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- Berkas PRODUK PANGAN (sampel_pp) punya medan yang lebih panjang dari
-- komoditi lain: `no_reg` bisa 93 karakter (beberapa nomor registrasi
-- digabung dalam satu sel) dan `importir` 125 karakter. Tanpa pelebaran ini
-- impornya gagal "Data too long for column 'no_reg' at row 1".
-- ---------------------------------------------------------------------------
SET @tabel := 'sampel_pp_laporan';
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = @tabel);
SET @perlu := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @tabel
    AND ((column_name = 'no_reg'   AND character_maximum_length < 255)
      OR (column_name = 'importir' AND character_maximum_length < 255)));
SET @sql := IF(@ada_tabel = 1 AND @perlu > 0,
  CONCAT('ALTER TABLE `', @tabel, '`',
         ' MODIFY COLUMN `no_reg` VARCHAR(255) NULL,',
         ' MODIFY COLUMN `importir` VARCHAR(255) NULL'),
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- ---------------------------------------------------------------------------
-- Berkas KOSMETIKA 2024 (sampel_kos) punya `no_reg` sampai 100 karakter —
-- beberapa nomor notifikasi digabung dalam satu sel, sedangkan kolomnya baru
-- VARCHAR(80), sehingga impor gagal "Data too long for column 'no_reg'".
-- `importir` (berkas: 73 char, DB 200) dan `komposisi` (1.323 char, sudah TEXT)
-- aman; hanya no_reg yang perlu dilebarkan.
-- ---------------------------------------------------------------------------
SET @tabel := 'sampel_kos_laporan';
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = @tabel);
SET @perlu := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @tabel
    AND column_name = 'no_reg' AND character_maximum_length < 255);
SET @sql := IF(@ada_tabel = 1 AND @perlu > 0,
  CONCAT('ALTER TABLE `', @tabel, '` MODIFY COLUMN `no_reg` VARCHAR(255) NULL'),
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Modul sampel lain yang memakai pola berkas sama (54 kolom) dibuat dgn no_reg
-- VARCHAR(80) juga: lebarkan supaya berkas tahun lain tidak gagal.
SET @perlu2 := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name IN ('sampel_ot_laporan', 'sampel_sk_laporan', 'sampel_ob_laporan')
    AND column_name = 'no_reg' AND character_maximum_length < 255);
SET @sql2 := IF(@perlu2 > 0,
  'ALTER TABLE `sampel_ot_laporan` MODIFY COLUMN `no_reg` VARCHAR(255) NULL',
  'DO 0');
PREPARE st2 FROM @sql2; EXECUTE st2; DEALLOCATE PREPARE st2;
SET @sql3 := IF(@perlu2 > 0,
  'ALTER TABLE `sampel_sk_laporan` MODIFY COLUMN `no_reg` VARCHAR(255) NULL',
  'DO 0');
PREPARE st3 FROM @sql3; EXECUTE st3; DEALLOCATE PREPARE st3;
SET @sql4 := IF(@perlu2 > 0,
  'ALTER TABLE `sampel_ob_laporan` MODIFY COLUMN `no_reg` VARCHAR(255) NULL',
  'DO 0');
PREPARE st4 FROM @sql4; EXECUTE st4; DEALLOCATE PREPARE st4;
