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