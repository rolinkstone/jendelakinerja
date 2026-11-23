// scripts/migrasi-link-visibilitas.js
/**
 * MIGRASI — kolom visibilitas & token terenkripsi pada `api_link`
 * ---------------------------------------------------------------
 * Menambah dua kolom yang dibutuhkan pengelolaan link di dashboard:
 *
 *   visibilitas        : 'publik'  → link bisa ditarik tanpa token apa pun
 *                        'private' → wajib Bearer Keycloak saat ditarik
 *   token_terenkripsi  : token link disegel AES-256-GCM, supaya dashboard
 *                        bisa menyalin ulang link tanpa menyimpan plaintext
 *                        di database.
 *
 * Idempoten: kolom hanya ditambah bila belum ada, jadi aman dijalankan
 * berulang. MySQL 8 tidak punya `ADD COLUMN IF NOT EXISTS`, karena itu
 * keberadaan kolom diperiksa lewat information_schema.
 *
 * Jalankan dari folder backend:  node scripts/migrasi-link-visibilitas.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { pool } = require('../db');

const adaKolom = async (nama) => {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_link' AND COLUMN_NAME = ?`,
    [nama]
  );
  return rows.length > 0;
};

(async () => {
  if (!(await adaKolom('visibilitas'))) {
    await pool.query(
      `ALTER TABLE api_link
         ADD COLUMN visibilitas VARCHAR(10) NOT NULL DEFAULT 'publik'
         COMMENT 'publik = tanpa token, private = wajib Bearer Keycloak'`
    );
    console.log('+ kolom visibilitas ditambahkan');
  } else {
    console.log('= kolom visibilitas sudah ada');
  }

  if (!(await adaKolom('token_terenkripsi'))) {
    await pool.query(
      `ALTER TABLE api_link
         ADD COLUMN token_terenkripsi TEXT NULL
         COMMENT 'token link disegel AES-256-GCM (agar bisa disalin ulang)'`
    );
    console.log('+ kolom token_terenkripsi ditambahkan');
  } else {
    console.log('= kolom token_terenkripsi sudah ada');
  }

  const [kolom] = await pool.query('SHOW COLUMNS FROM api_link');
  console.log('api_link:', kolom.map((k) => k.Field).join(', '));

  const [[jml]] = await pool.query('SELECT COUNT(*) AS n FROM api_link');
  console.log('jumlah baris:', jml.n);

  process.exit(0);
})().catch((e) => {
  console.error('MIGRASI GAGAL:', e.message);
  process.exit(1);
});
