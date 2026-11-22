-- ============================================================================
--  MODUL DISTRIBUSI PBF — TABEL IMPOR LAPORAN EXCEL
-- ----------------------------------------------------------------------------
--  Semantik impor: SETIAP UNGGAHAN MENGGANTI SELURUH DATA LAMA (replace total).
--  Tabel di bawah ini dikosongkan lalu diisi ulang dalam satu transaksi.
--
--  Sumber: "Laporan Hasil Pemeriksaan Sarana Distribusi - PBF" (export SIPT).
--  Satu baris berkas Excel dengan kolom A berisi nomor  = 1 laporan (pbf_laporan).
--  Baris lanjutan (kolom M/N/O saja)                    = rincian fokus (pbf_laporan_detail).
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. Metadata berkas yang terakhir diunggah
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pbf_import` (
  `id`                   INT NOT NULL AUTO_INCREMENT,
  `berkas`               VARCHAR(255) NOT NULL,
  `sheet`                VARCHAR(150) NULL,
  `jenis_sarana`         VARCHAR(100) NULL,
  `periode_awal`         VARCHAR(40)  NULL,
  `periode_akhir`        VARCHAR(40)  NULL,
  `tanggal_entri_awal`   VARCHAR(40)  NULL,
  `tanggal_entri_akhir`  VARCHAR(40)  NULL,
  `balai`                VARCHAR(150) NULL,
  `jumlah_laporan`       INT NOT NULL DEFAULT 0,
  `jumlah_rincian`       INT NOT NULL DEFAULT 0,
  `diunggah_oleh`        VARCHAR(150) NULL,
  `diunggah_pada`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Laporan pemeriksaan per sarana (satu baris per nomor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pbf_laporan` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `import_id`             INT NOT NULL,
  `no_urut`               INT NULL,
  `nama_balai`            VARCHAR(150) NULL,
  `nama_sarana`           VARCHAR(200) NULL,
  `alamat`                VARCHAR(255) NULL,
  `kab_kota`              VARCHAR(120) NULL,
  `jenis_industri`        VARCHAR(120) NULL,
  `tgl_input`             VARCHAR(40)  NULL,
  `tgl_periksa_mulai`     VARCHAR(40)  NULL,
  `tgl_periksa_selesai`   VARCHAR(40)  NULL,
  `tujuan_pemeriksaan`    VARCHAR(255) NULL,
  `fokus_pemeriksaan`     VARCHAR(255) NULL,
  `jenis_komoditi`        VARCHAR(255) NULL,
  `kategori`              VARCHAR(150) NULL,
  `observasi`             TEXT NULL,
  `temuan`                TEXT NULL,
  `analisa`               TEXT NULL,
  `kesimpulan_kekritisan` VARCHAR(150) NULL,
  `penetapan_sanksi`      VARCHAR(150) NULL,
  `kesimpulan_akhir`      VARCHAR(150) NULL,
  `rekomendasi`           TEXT NULL,
  `jumlah_mayor`          INT NULL,
  `jumlah_minor`          INT NULL,
  `jumlah_kritis`         INT NULL,
  `hasil_balai`           VARCHAR(150) NULL,
  `tindak_lanjut`         VARCHAR(255) NULL,
  `grading`               VARCHAR(150) NULL,
  `operator`              VARCHAR(200) NULL,
  `petugas`               VARCHAR(255) NULL,
  `status_tarikan`        VARCHAR(120) NULL,
  `kepala_balai`          VARCHAR(200) NULL,
  `tgl_kirim_ka_balai`    VARCHAR(40)  NULL,
  `verif_operator_pusat`  VARCHAR(200) NULL,
  `verif_tgl_operator`    VARCHAR(40)  NULL,
  `verif_supervisor_1`    VARCHAR(200) NULL,
  `verif_tgl_supervisor_1` VARCHAR(40) NULL,
  `verif_supervisor_2`    VARCHAR(200) NULL,
  `verif_tgl_supervisor_2` VARCHAR(40) NULL,
  `verif_direktur`        VARCHAR(200) NULL,
  `verif_tgl_direktur`    VARCHAR(40)  NULL,
  `just_kesimpulan`       VARCHAR(200) NULL,
  `just_temuan`           TEXT NULL,
  `just_catatan`          TEXT NULL,
  `just_saran`            TEXT NULL,
  `just_detil`            TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pbf_laporan_import` (`import_id`),
  KEY `idx_pbf_nama_sarana` (`nama_sarana`),
  CONSTRAINT `fk_pbf_laporan_import` FOREIGN KEY (`import_id`)
    REFERENCES `pbf_import` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. Rincian per fokus pemeriksaan (kolom M/N/O pada berkas Excel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pbf_laporan_detail` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `laporan_id` INT NOT NULL,
  `no_urut`    INT NOT NULL DEFAULT 0,
  `kategori`   VARCHAR(255) NULL,
  `observasi`  TEXT NULL,
  `temuan`     TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pbf_detail_laporan` (`laporan_id`),
  CONSTRAINT `fk_pbf_detail_laporan` FOREIGN KEY (`laporan_id`)
    REFERENCES `pbf_laporan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
