-- ============================================================================
--  MODUL DISTRIBUSI — KOSMETIKA & OBAT TRADISIONAL
-- ----------------------------------------------------------------------------
--  Dua tabel pasangan (import + laporan) untuk tiap komoditi. Kolomnya
--  mengikuti BERKAS MASING-MASING, bukan memaksa sama dengan PBF:
--
--    Kosmetika        35 kolom — "Klasifikasi", "Tindak Lanjut" muncul DUA kali
--                     (11 = tindak lanjut UPT, 15 = tindak lanjut pusat),
--                     TIDAK ada blok temuan (Kategori/Observasi/Temuan), TIDAK
--                     ada M/m/C. Kesimpulan ada di `hasil_balai` (14).
--    Obat Tradisional 38 kolom — ada "Metode Inspeksi" (10), "Detil Tindak
--                     Lanjut" (13), "Detil Hasil Pemeriksaan" (14), "Detil
--                     Kesimpulan TMK" (15). Kesimpulan di `hasil_balai` (17).
--
--  Karena bentuknya berbeda, tiap modul punya tabel sendiri: kolom yang tidak
--  ada di satu berkas dibiarkan ada di tabel (nullable) tetapi tidak diisi.
--  Yang dipakai bersama hanya yang memang ada di keduanya.
--
--  ATURAN IMPOR: per tahun (ganti tahun yang dipilih saja).
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. DISTRIBUSI KOSMETIKA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dist_kos_import` (
  `id`                   INT NOT NULL AUTO_INCREMENT,
  `tahun`                INT NULL,
  `berkas`               VARCHAR(255) NOT NULL,
  `sheet`                VARCHAR(150) NULL,
  `jenis_sarana`         VARCHAR(255) NULL,
  `periode_awal`         VARCHAR(40)  NULL,
  `periode_akhir`        VARCHAR(40)  NULL,
  `tanggal_entri_awal`   VARCHAR(40)  NULL,
  `tanggal_entri_akhir`  VARCHAR(40)  NULL,
  `balai`                VARCHAR(150) NULL,
  `jumlah_laporan`       INT NOT NULL DEFAULT 0,
  `diunggah_oleh`        VARCHAR(150) NULL,
  `diunggah_pada`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dist_kos_import_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dist_kos_laporan` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `import_id`             INT NOT NULL,
  `tahun`                 INT NULL,
  `kegiatan`              VARCHAR(30)  NULL,
  `jenis_sarana`          VARCHAR(255) NULL,
  `bulan`                 INT NULL,
  `no_urut`               INT NULL,
  `nama_balai`            VARCHAR(150) NULL,
  `nama_sarana`           VARCHAR(255) NULL,
  `alamat`                VARCHAR(400) NULL,
  `kab_kota`              VARCHAR(120) NULL,
  `jenis_industri`        VARCHAR(150) NULL,
  `tgl_input`             VARCHAR(40)  NULL,
  `tgl_periksa_mulai`     VARCHAR(40)  NULL,
  `tgl_periksa_selesai`   VARCHAR(40)  NULL,
  `tujuan_pemeriksaan`    VARCHAR(255) NULL,
  `klasifikasi`           VARCHAR(255) NULL,
  `tindak_lanjut`         VARCHAR(255) NULL,
  `tindak_lanjut_pusat`   VARCHAR(255) NULL,
  `saran_tindak_lanjut`   TEXT NULL,
  `catatan`               TEXT NULL,
  `hasil_balai`           VARCHAR(150) NULL,
  `grading`               VARCHAR(60)  NULL,
  `operator`              VARCHAR(150) NULL,
  `petugas`               VARCHAR(150) NULL,
  `status_tarikan`        VARCHAR(80)  NULL,
  `kepala_balai`          VARCHAR(150) NULL,
  `tgl_kirim_ka_balai`    VARCHAR(40)  NULL,
  `verif_operator_pusat`  VARCHAR(150) NULL,
  `verif_tgl_operator`    VARCHAR(40)  NULL,
  `verif_supervisor_1`    VARCHAR(150) NULL,
  `verif_tgl_supervisor_1` VARCHAR(40) NULL,
  `verif_supervisor_2`    VARCHAR(150) NULL,
  `verif_tgl_supervisor_2` VARCHAR(40) NULL,
  `verif_direktur`        VARCHAR(150) NULL,
  `verif_tgl_direktur`    VARCHAR(40)  NULL,
  `just_kesimpulan`       TEXT NULL,
  `just_temuan`           TEXT NULL,
  `just_catatan`          TEXT NULL,
  `just_saran`            TEXT NULL,
  `just_detil`            TEXT NULL,
  `jumlah_sampel_lab`     INT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dist_kos_tahun` (`tahun`),
  KEY `idx_dist_kos_import` (`import_id`),
  KEY `idx_dist_kos_kab` (`kab_kota`),
  CONSTRAINT `fk_dist_kos_import` FOREIGN KEY (`import_id`)
    REFERENCES `dist_kos_import` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. DISTRIBUSI OBAT TRADISIONAL
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dist_ot_import` (
  `id`                   INT NOT NULL AUTO_INCREMENT,
  `tahun`                INT NULL,
  `berkas`               VARCHAR(255) NOT NULL,
  `sheet`                VARCHAR(150) NULL,
  `jenis_sarana`         VARCHAR(255) NULL,
  `periode_awal`         VARCHAR(40)  NULL,
  `periode_akhir`        VARCHAR(40)  NULL,
  `tanggal_entri_awal`   VARCHAR(40)  NULL,
  `tanggal_entri_akhir`  VARCHAR(40)  NULL,
  `balai`                VARCHAR(150) NULL,
  `jumlah_laporan`       INT NOT NULL DEFAULT 0,
  `diunggah_oleh`        VARCHAR(150) NULL,
  `diunggah_pada`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dist_ot_import_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dist_ot_laporan` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `import_id`             INT NOT NULL,
  `tahun`                 INT NULL,
  `kegiatan`              VARCHAR(30)  NULL,
  `jenis_sarana`          VARCHAR(255) NULL,
  `bulan`                 INT NULL,
  `no_urut`               INT NULL,
  `nama_balai`            VARCHAR(150) NULL,
  `nama_sarana`           VARCHAR(255) NULL,
  `alamat`                VARCHAR(400) NULL,
  `kab_kota`              VARCHAR(120) NULL,
  `jenis_industri`        VARCHAR(150) NULL,
  `tgl_input`             VARCHAR(40)  NULL,
  `tgl_periksa_mulai`     VARCHAR(40)  NULL,
  `tgl_periksa_selesai`   VARCHAR(40)  NULL,
  `tujuan_pemeriksaan`    VARCHAR(255) NULL,
  `metode_inspeksi`       VARCHAR(150) NULL,
  `klasifikasi`           VARCHAR(255) NULL,
  `saran_tindak_lanjut`   TEXT NULL,
  `detil_tindak_lanjut`   TEXT NULL,
  `detil_hasil_pemeriksaan` TEXT NULL,
  `detil_kesimpulan_tmk`  TEXT NULL,
  `catatan`               TEXT NULL,
  `hasil_balai`           VARCHAR(150) NULL,
  `tindak_lanjut`         VARCHAR(255) NULL,
  `grading`               VARCHAR(60)  NULL,
  `operator`              VARCHAR(150) NULL,
  `petugas`               VARCHAR(150) NULL,
  `status_tarikan`        VARCHAR(80)  NULL,
  `kepala_balai`          VARCHAR(150) NULL,
  `tgl_kirim_ka_balai`    VARCHAR(40)  NULL,
  `verif_operator_pusat`  VARCHAR(150) NULL,
  `verif_tgl_operator`    VARCHAR(40)  NULL,
  `verif_supervisor_1`    VARCHAR(150) NULL,
  `verif_tgl_supervisor_1` VARCHAR(40) NULL,
  `verif_supervisor_2`    VARCHAR(150) NULL,
  `verif_tgl_supervisor_2` VARCHAR(40) NULL,
  `verif_direktur`        VARCHAR(150) NULL,
  `verif_tgl_direktur`    VARCHAR(40)  NULL,
  `just_kesimpulan`       TEXT NULL,
  `just_temuan`           TEXT NULL,
  `just_catatan`          TEXT NULL,
  `just_saran`            TEXT NULL,
  `just_detil`            TEXT NULL,
  `jumlah_sampel_lab`     INT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dist_ot_tahun` (`tahun`),
  KEY `idx_dist_ot_import` (`import_id`),
  KEY `idx_dist_ot_kab` (`kab_kota`),
  CONSTRAINT `fk_dist_ot_import` FOREIGN KEY (`import_id`)
    REFERENCES `dist_ot_import` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
