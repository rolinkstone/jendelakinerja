-- ============================================================================
--  MODUL PRODUKSI — OBAT TRADISIONAL (OT)
--  TABEL IMPOR LAPORAN EXCEL PER TAHUN
-- ----------------------------------------------------------------------------
--  Sumber: "Laporan Hasil Pemeriksaan Sarana Produksi - Obat Tradisional"
--  (export SIPT, satu sheet, satu baris = satu sarana produksi OT).
--
--  ATURAN IMPOR (per tahun) — sama dengan modul Distribusi PBF
--  -----------------------------------------------------------
--  Setiap unggahan terikat pada SATU TAHUN data. Yang dihapus lalu diisi ulang
--  hanya baris milik tahun tersebut; data tahun lain tidak tersentuh. Jadi
--  impor 2025 dan 2026 bisa hidup berdampingan.
--
--  Berbeda dengan PBF, berkas OT TIDAK punya baris rincian fokus pemeriksaan
--  (kolom M/m/O/C sudah berupa angka per sarana), jadi tidak ada tabel detail.
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. Metadata berkas yang terakhir diunggah (satu baris per tahun)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ot_import` (
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
  `jumlah_rincian`       INT NOT NULL DEFAULT 0,
  `diunggah_oleh`        VARCHAR(150) NULL,
  `diunggah_pada`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ot_import_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Laporan pemeriksaan per sarana produksi (satu baris per nomor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ot_laporan` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `import_id`             INT NOT NULL,
  `tahun`                 SMALLINT NULL,
  -- kolom turunan (dari kepala berkas & tanggal periksa) supaya dashboard
  -- publik bisa menyaring tanpa join — lihat backend/lib/kinerja.js
  `kegiatan`              VARCHAR(30)  NULL,
  `jenis_sarana`          VARCHAR(100) NULL,
  `bulan`                 TINYINT NULL,
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
  `metode_inspeksi`       VARCHAR(150) NULL,
  `status_sarana`         VARCHAR(150) NULL,
  -- M / m / O / C pada berkas Excel (mayor, minor, lainnya, kritis)
  `jumlah_mayor`          INT NULL,
  `jumlah_minor`          INT NULL,
  `jumlah_lain`           INT NULL,
  `jumlah_kritis`         INT NULL,
  `jumlah_sampel_lab`     INT NULL,
  `catatan`               TEXT NULL,
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
  PRIMARY KEY (`id`),
  KEY `fk_ot_laporan_import` (`import_id`),
  KEY `idx_ot_laporan_tahun` (`tahun`),
  KEY `idx_ot_laporan_nama_sarana` (`nama_sarana`),
  KEY `idx_ot_laporan_kab` (`kab_kota`),
  CONSTRAINT `fk_ot_laporan_import` FOREIGN KEY (`import_id`)
    REFERENCES `ot_import` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
