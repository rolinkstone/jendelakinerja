-- ============================================================================
-- NARASI PRESENTASI — Jendela Kinerja
-- ----------------------------------------------------------------------------
-- Menyimpan NASKAH PRESENTASI 1 MENIT yang sudah DIKOREKSI operator.
--
-- Alur:
--   1. Widget LAURA di halaman publik /jendela-kinerja menampilkan tombol
--      "Presentasi Dashboard" dan membacakan naskah ±1 menit.
--   2. Naskah pertama dibuat otomatis dari angka dashboard (LLM / template).
--   3. Kalau ada angka atau kalimat yang belum sesuai, operator membukanya di
--      dashboard: Beranda → Narasi Presentasi, mengoreksi naskah, lalu menyimpan.
--   4. Koreksi disimpan PER KOMBINASI FILTER (tahun/bulan/kegiatan/jenis/kab).
--      Widget memakai koreksi itu hanya bila filter dashboard cocok; kombinasi
--      lain tetap memakai naskah otomatis.
--
-- Kunci filter dihitung di backend (lib/narasi.js → kunciFilter) dari filter
-- yang sudah dinormalkan. Kolom `filter` menyimpan bentuk aslinya agar bisa
-- ditampilkan kembali di tabel koreksi.
--
-- Idempoten — aman dijalankan berulang.
-- ============================================================================

USE `jendelakinerja`;

CREATE TABLE IF NOT EXISTS `narasi_presentasi` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kunci` CHAR(40) NOT NULL,                  -- sha1(filter ternormalisasi)
  `filter` JSON NULL,                          -- { tahun, bulan, kegiatan, jenis, kab }
  `label` VARCHAR(200) NULL,                   -- ringkasan filter untuk tabel
  `naskah` TEXT NOT NULL,                      -- naskah yang dibacakan TTS
  `sumber` VARCHAR(12) NOT NULL DEFAULT 'koreksi'
    COMMENT 'koreksi = disimpan operator, llm = hasil LLM, template = dari angka',
  `catatan` VARCHAR(255) NULL,                 -- alasan koreksi (opsional)
  `diubah_oleh` VARCHAR(160) NULL,              -- username operator
  `dibuat_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diubah_pada` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_narasi_kunci` (`kunci`),
  KEY `idx_narasi_diubah` (`diubah_pada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Naskah presentasi 1 menit yang dikoreksi operator per filter dashboard';
