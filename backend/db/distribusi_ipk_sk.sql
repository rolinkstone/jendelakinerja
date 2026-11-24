-- ============================================================================
--  MODUL DISTRIBUSI — IPK & SUPLEMEN KESEHATAN
-- ----------------------------------------------------------------------------
--  Dua tabel pasangan (import + laporan). Kolom mengikuti BERKAS MASING-MASING:
--
--    IPK (Intensifikasi Pengawasan Khusus)  32 kolom
--      Paling ringkas di keluarga distribusi. TIDAK punya blok temuan, M/m/C,
--      `klasifikasi`, maupun kolom detil. Yang khas: "Tindakan Terhadap
--      Produk" (10). Kesimpulan ada di "Hasil Balai" (11).
--
--    Suplemen Kesehatan  38 kolom
--      Ada "Metode Inspeksi" (10), "Klasifikasi" (11), "Detil Hasil
--      Pemeriksaan" (14), "Detil Kesimpulan TMK" (15). Judul "Tindak Lanjut"
--      muncul DUA kali: kolom 12 (UPT) dan 18 (setelah Hasil Balai) —
--      disimpan ke kolom berbeda agar tidak saling menimpa.
--      Kesimpulan ada di "Hasil Balai" (17).
--
--  ATURAN IMPOR: per tahun (ganti tahun yang dipilih saja).
--  Tahun kosong (0 baris) boleh didaftarkan bila tahun dipilih manual.
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. DISTRIBUSI IPK (Intensifikasi Pengawasan Khusus)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dist_ipk_import` (
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
  KEY `idx_dist_ipk_import_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dist_ipk_laporan` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `import_id`              INT NOT NULL,
  `tahun`                  INT NULL,
  `kegiatan`               VARCHAR(30)  NULL,
  `jenis_sarana`           VARCHAR(255) NULL,
  `bulan`                  INT NULL,
  `no_urut`                INT NULL,
  `nama_balai`             VARCHAR(150) NULL,
  `nama_sarana`            VARCHAR(255) NULL,
  `alamat`                 VARCHAR(400) NULL,
  `kab_kota`               VARCHAR(120) NULL,
  `jenis_industri`         VARCHAR(150) NULL,
  `tgl_input`              VARCHAR(40)  NULL,
  `tgl_periksa_mulai`      VARCHAR(40)  NULL,
  `tgl_periksa_selesai`    VARCHAR(40)  NULL,
  `tujuan_pemeriksaan`     VARCHAR(255) NULL,
  -- Khas IPK: tindakan yang diambil terhadap produk (tidak ada di komoditi lain)
  `tindakan_terhadap_produk` VARCHAR(400) NULL,
  `hasil_balai`            VARCHAR(150) NULL,
  `tindak_lanjut`          VARCHAR(255) NULL,
  `grading`                VARCHAR(60)  NULL,
  `operator`               VARCHAR(150) NULL,
  `petugas`                VARCHAR(150) NULL,
  `status_tarikan`         VARCHAR(80)  NULL,
  `kepala_balai`           VARCHAR(150) NULL,
  `tgl_kirim_ka_balai`     VARCHAR(40)  NULL,
  `verif_operator_pusat`   VARCHAR(150) NULL,
  `verif_tgl_operator`     VARCHAR(40)  NULL,
  `verif_supervisor_1`     VARCHAR(150) NULL,
  `verif_tgl_supervisor_1` VARCHAR(40)  NULL,
  `verif_supervisor_2`     VARCHAR(150) NULL,
  `verif_tgl_supervisor_2` VARCHAR(40)  NULL,
  `verif_direktur`         VARCHAR(150) NULL,
  `verif_tgl_direktur`     VARCHAR(40)  NULL,
  `just_kesimpulan`        TEXT NULL,
  `just_temuan`            TEXT NULL,
  `just_catatan`           TEXT NULL,
  `just_saran`             TEXT NULL,
  `just_detil`             TEXT NULL,
  `jumlah_sampel_lab`      INT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dist_ipk_tahun` (`tahun`),
  KEY `idx_dist_ipk_import` (`import_id`),
  KEY `idx_dist_ipk_kab` (`kab_kota`),
  CONSTRAINT `fk_dist_ipk_import` FOREIGN KEY (`import_id`)
    REFERENCES `dist_ipk_import` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. DISTRIBUSI SUPLEMEN KESEHATAN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dist_sk_import` (
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
  KEY `idx_dist_sk_import_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dist_sk_laporan` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `import_id`              INT NOT NULL,
  `tahun`                  INT NULL,
  `kegiatan`               VARCHAR(30)  NULL,
  `jenis_sarana`           VARCHAR(255) NULL,
  `bulan`                  INT NULL,
  `no_urut`                INT NULL,
  `nama_balai`             VARCHAR(150) NULL,
  `nama_sarana`            VARCHAR(255) NULL,
  `alamat`                 VARCHAR(400) NULL,
  `kab_kota`               VARCHAR(120) NULL,
  `jenis_industri`         VARCHAR(150) NULL,
  `tgl_input`              VARCHAR(40)  NULL,
  `tgl_periksa_mulai`      VARCHAR(40)  NULL,
  `tgl_periksa_selesai`    VARCHAR(40)  NULL,
  `tujuan_pemeriksaan`     VARCHAR(255) NULL,
  `metode_inspeksi`        VARCHAR(150) NULL,
  `klasifikasi`            VARCHAR(255) NULL,
  -- "Tindak Lanjut" kolom 12 (UPT)
  `tindak_lanjut`          VARCHAR(255) NULL,
  `saran_tindak_lanjut`    TEXT NULL,
  `detil_hasil_pemeriksaan` TEXT NULL,
  `detil_kesimpulan_tmk`   TEXT NULL,
  `catatan`                TEXT NULL,
  `hasil_balai`            VARCHAR(150) NULL,
  -- "Tindak Lanjut" kolom 18 (setelah Hasil Balai) — kolom TERPISAH
  `tindak_lanjut_pusat`    VARCHAR(255) NULL,
  `grading`                VARCHAR(60)  NULL,
  `operator`               VARCHAR(150) NULL,
  `petugas`                VARCHAR(150) NULL,
  `status_tarikan`         VARCHAR(80)  NULL,
  `kepala_balai`           VARCHAR(150) NULL,
  `tgl_kirim_ka_balai`     VARCHAR(40)  NULL,
  `verif_operator_pusat`   VARCHAR(150) NULL,
  `verif_tgl_operator`     VARCHAR(40)  NULL,
  `verif_supervisor_1`     VARCHAR(150) NULL,
  `verif_tgl_supervisor_1` VARCHAR(40)  NULL,
  `verif_supervisor_2`     VARCHAR(150) NULL,
  `verif_tgl_supervisor_2` VARCHAR(40)  NULL,
  `verif_direktur`         VARCHAR(150) NULL,
  `verif_tgl_direktur`     VARCHAR(40)  NULL,
  `just_kesimpulan`        TEXT NULL,
  `just_temuan`            TEXT NULL,
  `just_catatan`           TEXT NULL,
  `just_saran`             TEXT NULL,
  `just_detil`             TEXT NULL,
  `jumlah_sampel_lab`      INT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dist_sk_tahun` (`tahun`),
  KEY `idx_dist_sk_import` (`import_id`),
  KEY `idx_dist_sk_kab` (`kab_kota`),
  CONSTRAINT `fk_dist_sk_import` FOREIGN KEY (`import_id`)
    REFERENCES `dist_sk_import` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
