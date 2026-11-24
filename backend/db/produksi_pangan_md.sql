-- ============================================================================
--  MODUL PRODUKSI — PANGAN MD (Pangan Olahan Makanan Dalam)
-- ----------------------------------------------------------------------------
--  Sumber: "Laporan Hasil Pemeriksaan Sarana Produksi - Pangan MD" (export SIPT).
--  Berkas contoh "produksi - pangan md.xlsx": **48 kolom**, 31 baris mentah →
--  22 laporan. Header dua tingkat di baris 8-9, data mulai baris 10.
--
--  CIRI KHAS dibanding modul sarana lain:
--    - TIDAK ada baris lanjutan (setiap baris ber-nomor, tidak ada rincian
--      fokus) — jadi tidak perlu tabel detail;
--    - identitas PRODUK disimpan di baris sarana: Nama Pangan (11),
--      Jenis Pangan (12), Merk Produk (13);
--    - blok SERTIFIKAT empat kolom (14-17): Jenis, Nomor, Masa Berlaku,
--      Lembaga Penerbit;
--    - Status Sarana (18), temuan ketidaksesuaian administrasi (19-20),
--      M/m/C (21-23), Tingkat Rating Unit Pengolahan (24);
--    - ada DUA kolom kesimpulan: `kesimpulan` (26) dan `hasil_balai` (27).
--      Yang dipakai dashboard sebagai kesimpulan akhir = `hasil_balai`.
--
--  ATURAN IMPOR: per tahun (ganti tahun yang dipilih saja).
--  Tahun kosong (0 baris) boleh didaftarkan bila tahun dipilih manual.
-- ============================================================================

USE `jendelakinerja`;

CREATE TABLE IF NOT EXISTS `prod_md_import` (
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
  KEY `idx_prod_md_import_tahun` (`tahun`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prod_md_laporan` (
  `id`                      INT NOT NULL AUTO_INCREMENT,
  `import_id`               INT NOT NULL,
  `tahun`                   INT NULL,
  `kegiatan`                VARCHAR(30)  NULL,
  `jenis_sarana`            VARCHAR(255) NULL,
  `bulan`                   INT NULL,
  `no_urut`                 INT NULL,
  `nama_balai`              VARCHAR(150) NULL,
  `nama_sarana`             VARCHAR(255) NULL,
  `alamat`                  VARCHAR(400) NULL,
  `kab_kota`                VARCHAR(120) NULL,
  `jenis_industri`          VARCHAR(150) NULL,
  `tgl_input`               VARCHAR(40)  NULL,
  `tgl_periksa_mulai`       VARCHAR(40)  NULL,
  `tgl_periksa_selesai`     VARCHAR(40)  NULL,
  `tujuan_pemeriksaan`      VARCHAR(255) NULL,
  `metode_inspeksi`         VARCHAR(150) NULL,
  -- Identitas produk pangan yang diperiksa
  `nama_pangan`             VARCHAR(255) NULL,
  `jenis_pangan`            VARCHAR(255) NULL,
  `merk_produk`             VARCHAR(255) NULL,
  -- Blok sertifikat
  `sert_jenis`              VARCHAR(100) NULL,
  `sert_nomor`              VARCHAR(150) NULL,
  `sert_masa_berlaku`       VARCHAR(60)  NULL,
  `sert_lembaga`            VARCHAR(150) NULL,
  `status_sarana`           VARCHAR(80)  NULL,
  -- Temuan ketidaksesuaian administrasi (bisa multi-nilai, dipisah ' ; ')
  `temuan_nomor`            TEXT NULL,
  `temuan_deskripsi`        TEXT NULL,
  `jumlah_mayor`            INT NULL,
  `jumlah_minor`            INT NULL,
  `jumlah_kritis`           INT NULL,
  `rating`                  VARCHAR(40)  NULL,
  `catatan`                 TEXT NULL,
  `kesimpulan`              VARCHAR(150) NULL,
  `hasil_balai`             VARCHAR(150) NULL,
  `tindak_lanjut`           VARCHAR(255) NULL,
  `grading`                 VARCHAR(60)  NULL,
  `operator`                VARCHAR(150) NULL,
  `petugas`                 VARCHAR(150) NULL,
  `status_tarikan`          VARCHAR(80)  NULL,
  `kepala_balai`            VARCHAR(150) NULL,
  `tgl_kirim_ka_balai`      VARCHAR(40)  NULL,
  `verif_operator_pusat`    VARCHAR(150) NULL,
  `verif_tgl_operator`      VARCHAR(40)  NULL,
  `verif_supervisor_1`      VARCHAR(150) NULL,
  `verif_tgl_supervisor_1`  VARCHAR(40)  NULL,
  `verif_supervisor_2`      VARCHAR(150) NULL,
  `verif_tgl_supervisor_2`  VARCHAR(40)  NULL,
  `verif_direktur`          VARCHAR(150) NULL,
  `verif_tgl_direktur`      VARCHAR(40)  NULL,
  `just_kesimpulan`         TEXT NULL,
  `just_temuan`             TEXT NULL,
  `just_catatan`            TEXT NULL,
  `just_saran`              TEXT NULL,
  `just_detil`              TEXT NULL,
  `jumlah_sampel_lab`       INT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prod_md_tahun` (`tahun`),
  KEY `idx_prod_md_import` (`import_id`),
  KEY `idx_prod_md_kab` (`kab_kota`),
  CONSTRAINT `fk_prod_md_import` FOREIGN KEY (`import_id`)
    REFERENCES `prod_md_import` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
