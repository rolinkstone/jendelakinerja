// scripts/apply-schema.js
// Menerapkan SEMUA file skema di backend/db/*.sql ke MySQL memakai kredensial
// dari backend/.env. Semua file bersifat idempoten (CREATE ... IF NOT EXISTS),
// jadi aman dijalankan berulang.
//
// Jalankan dari folder backend:  node scripts/apply-schema.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const dbDir = path.join(__dirname, '..', 'db');
  const files = fs.readdirSync(dbDir).filter((f) => f.endsWith('.sql')).sort();

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dbDir, f), 'utf8');
      await conn.query(sql);
      console.log('DITERAPKAN:', f);
    }

    const [tables] = await conn.query(
      'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name',
      [process.env.DB_NAME || 'jendelakinerja'],
    );
    console.log('TABEL:', tables.map((r) => r.t).join(', '));
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error('GAGAL:', err.code || '', err.message);
  process.exit(1);
});
