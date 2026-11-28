-- ============================================================================
--  REALISASI BULANAN (belanja) — untuk grafik kumulatif Jan–Des
-- ----------------------------------------------------------------------------
--  Sumber: ekspor SAKTI "ADK REALISASI BELANJA SUMBER DATA SAKTI PER SATKER".
--  Berkas itu satu baris = satu dokumen/akun dengan kolom TGLPOST, sehingga
--  sebaran per bulan bisa dihitung.
--
--  KENAPA TABEL TERPISAH, bukan kolom di `anggaran_realisasi`:
--  berkas "Realisasi FA berdasarkan SP2D" (yang dipakai tabel MAK) TIDAK memuat
--  tanggal, jadi tidak mungkin diturunkan jadi bulanan. Dua sumber, dua tabel.
--  Karena itu total bulanan bisa berbeda tipis dengan total tabel MAK (waktu
--  ekspor berbeda); halaman publik menuliskan sumbernya supaya jelas.
--
--  ATURAN IMPOR: ganti-per-tahun, sama seperti modul lain.
-- ============================================================================

USE `jendelakinerja`;

CREATE TABLE IF NOT EXISTS `realisasi_bulanan` (
  `id`        BIGINT NOT NULL AUTO_INCREMENT,
  `tahun`     SMALLINT NOT NULL,
  `bulan`     TINYINT NOT NULL,
  -- 2 digit kode akun: 51 pegawai, 52 barang, 53 modal. '00' = total semua jenis.
  `jenis`     CHAR(2) NOT NULL,
  `nilai`     DECIMAL(20,2) NOT NULL DEFAULT 0,
  -- Pagu bulan ini. Ditambahkan saat realisasi bulanan bisa DIKETIK manual
  -- (lihat panel "Isi Realisasi Bulanan" di /data-realisasi). Impor berkas ADK
  -- hanya mengisi `nilai`, TIDAK menyentuh `pagu`.
  `pagu`      DECIMAL(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bulanan` (`tahun`, `bulan`, `jenis`),
  KEY `idx_bulanan_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `realisasi_bulanan_import` (
  `tahun`         SMALLINT NOT NULL,
  `nama_berkas`   VARCHAR(255) NOT NULL,
  `jumlah_baris`  INT NOT NULL DEFAULT 0,
  `total`         DECIMAL(20,2) NOT NULL DEFAULT 0,
  `diunggah_oleh` VARCHAR(150) NULL,
  `diunggah_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- MIGRASI: kolom `pagu`
-- ----------------------------------------------------------------------------
-- `CREATE TABLE IF NOT EXISTS` TIDAK menambah kolom pada tabel yang sudah ada.
-- Server production sudah memiliki realisasi_bulanan dari versi sebelumnya
-- (tanpa `pagu`), sehingga form "Isi Realisasi Bulanan" gagal di sana walau
-- jalan di lokal. Blok ini menambahkannya dengan aman: keberadaan kolom
-- diperiksa lewat information_schema, jadi bisa dijalankan berulang.
--
-- Pola sama dengan db/zz_migrasi_kolom.sql: MySQL 8 tidak punya
-- "ADD COLUMN IF NOT EXISTS".
SET @ada_tabel := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'realisasi_bulanan');
SET @ada_pagu := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'realisasi_bulanan' AND column_name = 'pagu');
SET @sql := IF(@ada_tabel = 1 AND @ada_pagu = 0,
  'ALTER TABLE `realisasi_bulanan`
     ADD COLUMN `pagu` DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER `nilai`',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- ----------------------------------------------------------------------------
-- MIGRASI: indeks unik untuk UPSERT
-- ----------------------------------------------------------------------------
-- `simpanBulananManual` memakai INSERT ... ON DUPLICATE KEY UPDATE. Tanpa indeks
-- unik pada (tahun, bulan, jenis), MySQL tidak mengenali baris yang bentrok dan
-- setiap penyimpanan MENAMBAH baris baru alih-alih memperbarui. Instalasi baru
-- sudah mendapat `uq_bulanan` dari CREATE TABLE di atas; blok ini menutup
-- kemungkinan tabel lama yang indeksnya pernah terhapus.
SET @ada_idx := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'realisasi_bulanan'
    AND index_name = 'uq_bulanan');
SET @sql := IF(@ada_tabel = 1 AND @ada_idx = 0,
  'ALTER TABLE `realisasi_bulanan`
     ADD UNIQUE KEY `uq_bulanan` (`tahun`, `bulan`, `jenis`)',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
