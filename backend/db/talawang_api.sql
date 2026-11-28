-- ============================================================================
--  TALAWANG — AKSES API REALISASI (KHUSUS AKUN 524 / BELANJA PERJALANAN DINAS)
-- ----------------------------------------------------------------------------
--  Talawang (Sistem Perjalanan Dinas BBPOM Palangka Raya) perlu membaca angka
--  realisasi anggaran dari Jendela Kinerja. Yang dibutuhkan HANYA belanja
--  PERJALANAN DINAS (akun 524xxx: 524111 perjalanan biasa luar kota,
--  524113 perjalanan biasa dalam kota, 524114 paket meeting dalam kota,
--  524119 perjalanan lainnya) — bukan seluruh 46 akun — jadi aksesnya dibuat
--  sempit dan terkunci pada awalan akun itu.
--
--  KENAPA TABEL SENDIRI, BUKAN MEMAKAI `api_link`:
--    `api_link` menerbitkan token berisi modul rekap sarana (PBF/sampel) dan
--    tokennya hanya disimpan sebagai hash. Talawang butuh tiga hal yang tidak
--    dimiliki skema itu:
--      1. pembatasan akun (hanya 524xxx) yang tersimpan sebagai konfigurasi,
--      2. token yang bisa DIBACA ULANG di halaman Setting (operator Talawang
--         sering kehilangan salinan pertama), jadi disegel AES-256-GCM,
--      3. masa berlaku + pencabutan + jejak pemakaian.
--    Memaksakan semuanya ke `api_link` berarti menambah kolom yang tidak
--    relevan untuk modul sarana. Tabel terpisah lebih jujur.
--
--  KEAMANAN:
--    - token asli tidak pernah disimpan mentah: `token_hash` (sha256) dipakai
--      untuk pencarian cepat, `token_terenkripsi` (AES-256-GCM) agar bisa
--      ditampilkan ulang oleh operator yang sudah login.
--    - `akun_awalan` WAJIB berawalan '524' — ditegakkan juga di sisi kode
--      (lib/talawang-api.js), bukan hanya di kolom ini.
--    - token boleh DICABUT kapan saja; data tetap tersimpan supaya jejaknya
--      tidak hilang.
--
--  Idempoten — aman dijalankan berulang.
-- ============================================================================

USE `jendelakinerja`;

CREATE TABLE IF NOT EXISTS `talawang_api` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `nama`              VARCHAR(120) NOT NULL,   -- label bebas, mis. "Talawang Produksi"
  `akun_awalan`       VARCHAR(3)  NOT NULL DEFAULT '524',
  `token_hash`        CHAR(64)    NOT NULL UNIQUE,   -- sha256(token), untuk pencarian
  `token_terenkripsi` TEXT        NULL,              -- token disegel AES-256-GCM
  `masa_berlaku_hari` INT         NOT NULL DEFAULT 365,
  `terbit_pada`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `kedaluwarsa_pada`  DATETIME    NOT NULL,
  `dicabut_pada`      DATETIME    NULL,               -- terisi = token mati
  `dibuat_oleh`       VARCHAR(150) NULL,
  `jumlah_akses`      INT         NOT NULL DEFAULT 0,
  `akses_terakhir`    DATETIME    NULL,
  `created_at`        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_talawang_status` (`dicabut_pada`, `kedaluwarsa_pada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
--  MIGRASI: kolom yang ditambahkan setelah tabel ini pernah dipakai
-- ----------------------------------------------------------------------------
-- `CREATE TABLE IF NOT EXISTS` TIDAK menambah kolom ke tabel yang sudah ada.
-- Blok di bawah menjaga instalasi lama tetap mendapat kolom baru. Pola sama
-- dengan db/zz_migrasi_kolom.sql.
SET @ada_talawang := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'talawang_api');

SET @ada_awalan := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'talawang_api' AND column_name = 'akun_awalan');
SET @sql := IF(@ada_talawang = 1 AND @ada_awalan = 0,
  'ALTER TABLE `talawang_api`
     ADD COLUMN `akun_awalan` VARCHAR(3) NOT NULL DEFAULT ''524'' AFTER `nama`',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @ada_segel := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'talawang_api' AND column_name = 'token_terenkripsi');
SET @sql := IF(@ada_talawang = 1 AND @ada_segel = 0,
  'ALTER TABLE `talawang_api` ADD COLUMN `token_terenkripsi` TEXT NULL AFTER `token_hash`',
  'DO 0');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
