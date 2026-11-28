// scripts/ubah-skema-bulanan.cjs
// Menambahkan kolom `pagu` pada realisasi_bulanan supaya realisasi bulanan bisa
// diisi manual (ketik) per bulan: pagu dan realisasi. Idempoten - aman
// dijalankan berulang kali.
require('dotenv').config();
const db = require('../db');

(async () => {
  try {
    const [kolom] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'realisasi_bulanan'`,
    );
    const ada = new Set(kolom.map((k) => k.COLUMN_NAME));

    if (!ada.has('pagu')) {
      await db.query(
        'ALTER TABLE realisasi_bulanan ADD COLUMN pagu DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER nilai',
      );
      console.log('kolom pagu DITAMBAHKAN');
    } else {
      console.log('kolom pagu sudah ada');
    }

    // Nilai unik per (tahun, bulan, jenis) supaya input manual bisa memakai
    // upsert dan tidak pernah menghasilkan baris ganda untuk bulan yang sama.
    const [idx] = await db.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'realisasi_bulanan'
         AND INDEX_NAME = 'uniq_tahun_bulan_jenis' LIMIT 1`,
    );
    if (!idx.length) {
      await db.query(
        'ALTER TABLE realisasi_bulanan ADD UNIQUE KEY uniq_tahun_bulan_jenis (tahun, bulan, jenis)',
      );
      console.log('indeks unik uniq_tahun_bulan_jenis DITAMBAHKAN');
    } else {
      console.log('indeks unik sudah ada');
    }

    const [akhir] = await db.query('SHOW COLUMNS FROM realisasi_bulanan');
    console.log('kolom sekarang:', akhir.map((c) => c.Field).join(', '));
  } catch (e) {
    console.error('GAGAL:', e.message);
    process.exitCode = 1;
  } finally {
    await db.end?.();
    setTimeout(() => process.exit(process.exitCode || 0), 200);
  }
})();