-- ============================================================================
--  JENDELA KINERJA — SKEMA DATABASE
-- ----------------------------------------------------------------------------
--  Cara pakai (dari folder backend, kredensial diambil dari .env):
--      node scripts/apply-schema.js
--
--  Catatan:
--  * Tabel `unit_kerja` … `perjanjian_kinerja` adalah skema domain kinerja
--    (dipakai slot KPI di beranda). Boleh ditambah/diubah saat modulnya dibangun.
--  * Skema modul Distribusi PBF ada di file terpisah: `db/pbf.sql`.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `jendelakinerja`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. Referensi organisasi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `unit_kerja` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `kode`        VARCHAR(30)  NOT NULL,
  `nama`        VARCHAR(150) NOT NULL,
  `induk_id`    INT NULL,
  `level`       TINYINT NOT NULL DEFAULT 1,
  `aktif`       TINYINT(1) NOT NULL DEFAULT 1,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_unit_kode` (`kode`),
  KEY `fk_unit_induk` (`induk_id`),
  CONSTRAINT `fk_unit_induk` FOREIGN KEY (`induk_id`)
    REFERENCES `unit_kerja` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pegawai` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `nip`            VARCHAR(30)  NULL,
  `nama`           VARCHAR(150) NOT NULL,
  `jabatan`        VARCHAR(150) NULL,
  `unit_id`        INT NULL,
  `status_pegawai` ENUM('PNS','PPPK','Honorer','Lainnya') NOT NULL DEFAULT 'PNS',
  `aktif`          TINYINT(1) NOT NULL DEFAULT 1,
  `dibuat_pada`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pegawai_nip` (`nip`),
  KEY `fk_pegawai_unit` (`unit_id`),
  CONSTRAINT `fk_pegawai_unit` FOREIGN KEY (`unit_id`)
    REFERENCES `unit_kerja` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Kinerja: IKU, target triwulan, realisasi triwulan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `iku` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `kode`        VARCHAR(30)  NOT NULL,
  `nama`        VARCHAR(255) NOT NULL,
  `satuan`      VARCHAR(50)  NULL,
  `polaritas`   ENUM('naik','turun') NOT NULL DEFAULT 'naik',
  `unit_id`     INT NULL,
  `tahun`       SMALLINT NOT NULL,
  `aktif`       TINYINT(1) NOT NULL DEFAULT 1,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_iku_kode_tahun` (`kode`, `tahun`),
  KEY `fk_iku_unit` (`unit_id`),
  CONSTRAINT `fk_iku_unit` FOREIGN KEY (`unit_id`)
    REFERENCES `unit_kerja` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iku_target` (
  `id`       INT NOT NULL AUTO_INCREMENT,
  `iku_id`   INT NOT NULL,
  `triwulan` TINYINT NOT NULL,
  `target`   DECIMAL(14,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_target_iku_tw` (`iku_id`, `triwulan`),
  CONSTRAINT `fk_target_iku` FOREIGN KEY (`iku_id`)
    REFERENCES `iku` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iku_realisasi` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `iku_id`     INT NOT NULL,
  `triwulan`   TINYINT NOT NULL,
  `realisasi`  DECIMAL(14,4) NOT NULL DEFAULT 0,
  `diisi_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diubah_pada` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_real_iku_tw` (`iku_id`, `triwulan`),
  CONSTRAINT `fk_real_iku` FOREIGN KEY (`iku_id`)
    REFERENCES `iku` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3. Anggaran (pagu vs realisasi per unit per triwulan)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `anggaran` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `unit_id`   INT NOT NULL,
  `tahun`     SMALLINT NOT NULL,
  `triwulan`  TINYINT NOT NULL,
  `pagu`      DECIMAL(18,2) NOT NULL DEFAULT 0,
  `realisasi` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `diubah_pada` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_anggaran_unit_tahun_tw` (`unit_id`, `tahun`, `triwulan`),
  CONSTRAINT `fk_anggaran_unit` FOREIGN KEY (`unit_id`)
    REFERENCES `unit_kerja` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4. Perjanjian kinerja (dokumen)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `perjanjian_kinerja` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `unit_id`    INT NOT NULL,
  `pegawai_id` INT NULL,
  `tahun`      SMALLINT NOT NULL,
  `nomor`      VARCHAR(100) NULL,
  `tanggal`    DATE NULL,
  `status`     ENUM('draft','final') NOT NULL DEFAULT 'draft',
  `berkas`     VARCHAR(255) NULL,
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_pk_unit` (`unit_id`),
  KEY `fk_pk_pegawai` (`pegawai_id`),
  CONSTRAINT `fk_pk_unit` FOREIGN KEY (`unit_id`)
    REFERENCES `unit_kerja` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pk_pegawai` FOREIGN KEY (`pegawai_id`)
    REFERENCES `pegawai` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

