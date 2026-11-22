-- ============================================================================
--  MODUL SAMPEL — OBAT TRADISIONAL (OT)
--  TABEL IMPOR REKAP DATA SAMPEL PER TAHUN
-- ----------------------------------------------------------------------------
--  Sumber: "REKAP DATA SAMPEL" (export SIPT), satu sheet,
--  satu baris = SATU SAMPEL yang diperiksa laboratorium.
--
--  ATURAN IMPOR (per tahun) — sama dengan modul lain di aplikasi ini
--  ------------------------------------------------------------------
--  Setiap unggahan terikat pada SATU TAHUN data. Yang dihapus lalu diisi ulang
--  hanya baris milik tahun tersebut; data tahun lain tidak tersentuh. Jadi
--  impor 2024 dan 2025 bisa hidup berdampingan.
--
--  PERBEDAAN PENTING DENGAN MODUL PRODUKSI/DISTRIBUSI
--  --------------------------------------------------
--  Berkas sampel punya BANYAK BARIS PER SAMPEL: satu sampel ditulis beberapa
--  baris karena kolom Kategori (rincian kegunaan) dan Komposisi bisa memakan
--  lebih dari satu baris. Karena itu baris digabung di backend: penanda awal
--  sampel baru adalah kolom "Sampel" (Nomor › Sampel) yang terisi, sedangkan
--  baris lanjutan hanya punya kolom Kategori/Komposisi.
--  Di berkas contoh: 901 baris mentah → 303 sampel.
-- ============================================================================

USE `jendelakinerja`;

-- ---------------------------------------------------------------------------
-- 1. Metadata berkas yang terakhir diunggah (satu baris per tahun)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sampel_ot_import` (
  `id`                   INT NOT NULL AUTO_INCREMENT,
  `tahun`                SMALLINT NULL,
  `berkas`               VARCHAR(255) NOT NULL,
  `sheet`                VARCHAR(150) NULL,
  `komoditi`             VARCHAR(100) NULL,
  `periode_awal`         VARCHAR(40)  NULL,
  `periode_akhir`        VARCHAR(40)  NULL,
  `balai`                VARCHAR(150) NULL,
  `anggaran_sampling`    VARCHAR(120) NULL,
  `tujuan_sampling`      VARCHAR(120) NULL,
  `asal_sampling`        VARCHAR(120) NULL,
  `jumlah_sampel`        INT NOT NULL DEFAULT 0,
  `jumlah_baris`         INT NOT NULL DEFAULT 0,
  `diunggah_oleh`        VARCHAR(150) NULL,
  `diunggah_pada`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sampel_ot_import_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2. Satu baris per sampel
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sampel_ot_laporan` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `import_id`           INT NOT NULL,
  `tahun`               SMALLINT NULL,
  -- kolom turunan supaya dashboard publik bisa menyaring tanpa join
  `kegiatan`            VARCHAR(30)  NULL,
  `komoditi`            VARCHAR(100) NULL,
  `bulan`               TINYINT NULL,
  `no_urut`             INT NULL,

  -- Nomor & kode
  `nama_balai`          VARCHAR(150) NULL,
  `nomor_manual`        VARCHAR(60)  NULL,
  `nomor_sampel`        VARCHAR(60)  NULL,
  `nomor_spu`           VARCHAR(60)  NULL,
  `nomor_sp`            VARCHAR(60)  NULL,
  `nomor_sps`           VARCHAR(60)  NULL,
  `nomor_spk`           VARCHAR(60)  NULL,
  `nomor_surat_tugas`   VARCHAR(60)  NULL,

  -- Kode sampling
  `tgl_sampling`        VARCHAR(40)  NULL,
  `bulan_anggaran`      VARCHAR(40)  NULL,
  `asal_sampel`         VARCHAR(150) NULL,

  -- Tempat sampling
  `kategori_sarana`     VARCHAR(150) NULL,
  `nama_sarana`         VARCHAR(200) NULL,
  `jenis_sarana`        VARCHAR(255) NULL,
  `kab_kota`            VARCHAR(120) NULL,

  -- Tujuan sampling
  `tujuan_sampling`     VARCHAR(255) NULL,

  -- Identitas sampel
  `jenis_pengujian`     VARCHAR(120) NULL,
  `anggaran_sampling`   VARCHAR(120) NULL,
  `kriteria_resiko`     VARCHAR(120) NULL,  -- hanya ada di berkas Obat
  `kondisi_sampling`    VARCHAR(120) NULL,
  `nama_sampel`         VARCHAR(255) NULL,
  `brand_produk`        VARCHAR(200) NULL,
  `url_produk`          VARCHAR(255) NULL,
  `cara_perolehan`      VARCHAR(60)  NULL,  -- Daring / Luring
  `komposisi`           TEXT NULL,
  `netto`               VARCHAR(80)  NULL,
  `harga`               VARCHAR(40)  NULL,
  `bentuk_sediaan`      VARCHAR(120) NULL,
  `no_reg`              VARCHAR(80)  NULL,
  `atc`                 VARCHAR(120) NULL,  -- hanya ada di berkas Obat
  `pabrik`              VARCHAR(400) NULL,
  `no_bets`             VARCHAR(80)  NULL,
  `keterangan_ed`       VARCHAR(80)  NULL,
  `importir`            VARCHAR(200) NULL,

  -- Komoditi & kategori
  `jumlah_sampel`       VARCHAR(60)  NULL,  -- mis. "7 Botol"
  `kategori`            TEXT NULL,          -- rincian kegunaan, gabungan baris lanjutan

  -- Status sampel
  `status_sampel`       VARCHAR(120) NULL,
  `operator`            VARCHAR(200) NULL,
  `verifikasi_oleh`     VARCHAR(200) NULL,
  `tgl_status`          VARCHAR(40)  NULL,

  -- Informasi UPT
  `upt_penyampling`     VARCHAR(150) NULL,
  `upt_penguji`         VARCHAR(150) NULL,

  -- Kesimpulan UPT
  `upt_kesimpulan_uji`  VARCHAR(255) NULL,
  `upt_kesimpulan_penandaan` VARCHAR(150) NULL,
  `upt_kesimpulan_akhir` VARCHAR(150) NULL,

  -- Kesimpulan Pusat
  `pusat_parameter_tms` VARCHAR(255) NULL,
  `pusat_kesimpulan_uji` VARCHAR(255) NULL,
  `pusat_kesimpulan_penandaan` VARCHAR(150) NULL,
  `pusat_kesimpulan_akhir` VARCHAR(150) NULL,

  -- Tindak lanjut
  `jenis_tindak_lanjut` VARCHAR(150) NULL,
  `nomor_surat`         VARCHAR(100) NULL,
  `tanggal_surat`       VARCHAR(40)  NULL,

  -- Metode & tanggal berkas
  `metode_pengambilan`  VARCHAR(80)  NULL,
  `tgl_spk`             VARCHAR(40)  NULL,
  `tgl_lhu`             VARCHAR(40)  NULL,

  -- Samaran dari nilai akhir, untuk menyaring cepat
  `kesimpulan_akhir`    VARCHAR(150) NULL,
  `sumber_kesimpulan`   VARCHAR(20)  NULL,  -- 'UPT' / 'Pusat'

  PRIMARY KEY (`id`),
  KEY `idx_sampel_ot_laporan_tahun` (`tahun`),
  KEY `idx_sampel_ot_laporan_sampel` (`nomor_sampel`),
  KEY `idx_sampel_ot_laporan_nama` (`nama_sampel`),
  KEY `idx_sampel_ot_laporan_kab` (`kab_kota`),
  KEY `idx_sampel_ot_laporan_sarana` (`nama_sarana`),
  KEY `idx_sampel_ot_laporan_kesimpulan` (`kesimpulan_akhir`),
  KEY `fk_sampel_ot_laporan_import` (`import_id`),
  CONSTRAINT `fk_sampel_ot_laporan_import` FOREIGN KEY (`import_id`)
    REFERENCES `sampel_ot_import` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
