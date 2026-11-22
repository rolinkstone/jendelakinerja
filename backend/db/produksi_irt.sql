-- ============================================================================
--  MODUL PRODUKSI — PANGAN IRT (CPPB - IRT)
--  TABEL IMPOR LAPORAN EXCEL PER TAHUN
-- ----------------------------------------------------------------------------
--  Sumber: "Laporan Hasil Pemeriksaan Sarana Produksi - Pangan IRT (CPPB-IRT)"
--  (export SIPT, satu sheet, satu baris = satu sarana produksi pangan IRT).
--
--  ATURAN IMPOR (per tahun) — sama dengan modul Distribusi PBF & Produksi OT
--  ------------------------------------------------------------------------
--  Setiap unggahan terikat pada SATU TAHUN data. Yang dihapus lalu diisi ulang
--  hanya baris milik tahun tersebut; data tahun lain tidak tersentuh. Jadi
--  impor 2025 dan 2026 bisa hidup berdampingan.
--
--  Beda dengan OT: berkas Pangan IRT memakai header DUA TINGKAT (baris 7-8)
--  dan punya kolom Penyimpangan/Kriteria/Timeline per baris — disimpan sebagai
--  teks panjang apa adanya supaya modal rincian bisa menampilkannya utuh.
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. Metadata berkas yang terakhir diunggah (satu baris per tahun)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `irt_import` (
  `id`                   INT NOT NULL AUTO_INCREMENT,
  `tahun`                SMALLINT NULL,
  `berkas`               VARCHAR(255) NOT NULL,
  `sheet`                VARCHAR(150) NULL,
  `jenis_sarana`         VARCHAR(100) NULL,
  `periode_awal`         VARCHAR(40)  NULL,
  `periode_akhir`        VARCHAR(40)  NULL,
  `tanggal_entri_awal`   VARCHAR(40)  NULL,
  `tanggal_entri_akhir`  VARCHAR(40)  NULL,
  `balai`                VARCHAR(150) NULL,
  `jumlah_laporan`       INT NOT NULL DEFAULT 0,
  `diunggah_oleh`        VARCHAR(150) NULL,
  `diunggah_pada`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_irt_import_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Laporan pemeriksaan per sarana produksi pangan IRT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `irt_laporan` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `import_id`              INT NOT NULL,
  `tahun`                  SMALLINT NULL,
  -- kolom turunan (dari kepala berkas & tanggal periksa) supaya dashboard
  -- publik bisa menyaring tanpa join — lihat backend/lib/kinerja.js
  `kegiatan`               VARCHAR(30)  NULL,
  `jenis_sarana`           VARCHAR(100) NULL,
  `bulan`                  TINYINT NULL,
  `no_urut`                INT NULL,
  `nama_balai`             VARCHAR(150) NULL,
  `nama_sarana`            VARCHAR(200) NULL,
  `alamat`                 VARCHAR(255) NULL,
  `kab_kota`               VARCHAR(120) NULL,
  `jenis_industri`         VARCHAR(120) NULL,
  `tgl_input`              VARCHAR(40)  NULL,
  `tgl_periksa_mulai`      VARCHAR(40)  NULL,
  `tgl_periksa_selesai`    VARCHAR(40)  NULL,
  `tujuan_pemeriksaan`     VARCHAR(150) NULL,
  `status_sarana`          VARCHAR(150) NULL,
  -- teks panjang: daftar penyimpangan, kriteria, dan timeline per baris
  `penyimpangan`           TEXT NULL,
  `kriteria`               VARCHAR(255) NULL,
  `timeline`               VARCHAR(255) NULL,
  -- M / m / S / C pada berkas Excel (mayor, minor, serius, kritis)
  `jumlah_mayor`           INT NULL,
  `jumlah_minor`           INT NULL,
  `jumlah_serius`          INT NULL,
  `jumlah_kritis`          INT NULL,
  `jumlah_sampel_lab`      INT NULL,
  `level_irtp`             VARCHAR(40)  NULL,
  `hasil_balai`            VARCHAR(150) NULL,
  `tindak_lanjut`          VARCHAR(255) NULL,
  `grading`                VARCHAR(150) NULL,
  `operator`               VARCHAR(200) NULL,
  `petugas`                VARCHAR(255) NULL,
  `status_tarikan`         VARCHAR(255) NULL,
  `kepala_balai`           VARCHAR(200) NULL,
  `tgl_kirim_ka_balai`     VARCHAR(40)  NULL,
  `verif_operator_pusat`   VARCHAR(200) NULL,
  `verif_tgl_operator`     VARCHAR(40)  NULL,
  `verif_supervisor_1`     VARCHAR(200) NULL,
  `verif_tgl_supervisor_1` VARCHAR(40)  NULL,
  `verif_supervisor_2`     VARCHAR(200) NULL,
  `verif_tgl_supervisor_2` VARCHAR(40)  NULL,
  `direktur`               VARCHAR(200) NULL,
  `verif_tgl_direktur`     VARCHAR(40)  NULL,
  `verif_hasil_kesimpulan` VARCHAR(150) NULL,
  `verif_hasil_temuan`     VARCHAR(255) NULL,
  `verif_catatan`          TEXT NULL,
  `verif_saran_tindak_lanjut` TEXT NULL,
  `verif_detil_tindak_lanjut` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_irt_laporan_import` (`import_id`),
  KEY `idx_irt_laporan_tahun` (`tahun`),
  KEY `idx_irt_laporan_nama_sarana` (`nama_sarana`),
  KEY `idx_irt_laporan_kab` (`kab_kota`),
  CONSTRAINT `fk_irt_laporan_import` FOREIGN KEY (`import_id`)
    REFERENCES `irt_import` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
