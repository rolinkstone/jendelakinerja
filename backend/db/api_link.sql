-- ============================================================================
-- API LINK — Jendela Kinerja
-- ----------------------------------------------------------------------------
-- Satu baris = satu LINK API yang diterbitkan dari dashboard untuk satu modul.
-- Link dipakai aplikasi lain (mis. LAURA AI) untuk menarik data modul TANPA
-- login SSO — token di dalam link itu sendiri yang menjadi kunci akses.
--
--   link  : URL lengkap siap tempel (berisi token)
--   token : HANYA hash SHA-256 (token asli tidak pernah disimpan)
--   masa_berlaku_hari : berapa lama link boleh dipakai
--
-- Konsumsi: GET /api/publik/link/:token  (publik, divalidasi token + masa berlaku)
-- Idempoten — aman dijalankan berulang.
-- ============================================================================

USE `jendelakinerja`;

CREATE TABLE IF NOT EXISTS `api_link` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `modul` VARCHAR(40) NOT NULL,               -- pbf | produksi-ot | produksi-irt | sampel-*
  `nama_modul` VARCHAR(120) NOT NULL,
  `label` VARCHAR(160) NULL,                   -- nama bebas dari operator
  `kolom` JSON NOT NULL,                       -- FIELD TERPILIH (whitelist publik)
  `filter` JSON NULL,                          -- penyaring tetap: { tahun, kesimpulan, q, limit }
  `visibilitas` VARCHAR(10) NOT NULL DEFAULT 'publik'
    COMMENT 'publik = tanpa token, private = wajib Bearer Keycloak',
  `token_hash` CHAR(64) NOT NULL UNIQUE,       -- sha256(token)
  `token_terenkripsi` TEXT NULL,               -- token disegel AES-256-GCM (agar bisa disalin ulang)
  `masa_berlaku_hari` INT NOT NULL DEFAULT 30,
  `terbit_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `kedaluwarsa_pada` DATETIME NOT NULL,
  `dicabut_pada` DATETIME NULL,                -- terisi = link tidak berlaku lagi
  `dibuat_oleh` VARCHAR(150) NULL,
  `jumlah_akses` INT NOT NULL DEFAULT 0,
  `akses_terakhir` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_api_link_modul` (`modul`),
  INDEX `idx_api_link_aktif` (`dicabut_pada`, `kedaluwarsa_pada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
