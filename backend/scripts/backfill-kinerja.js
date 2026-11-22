// backend/scripts/backfill-kinerja.js
/**
 * ============================================================================
 *  BACKFILL KOLOM TURUNAN DASHBOARD PUBLIK
 * ============================================================================
 *  Mengisi kolom `kegiatan`, `jenis_sarana`, dan `bulan` pada baris
 *  pbf_laporan yang belum punya nilai — baris yang diimpor SEBELUM kolom
 *  turunan ada (lihat db/pbf_kinerja.sql).
 *
 *  Sumber nilai:
 *    kegiatan + jenis_sarana → pbf_import.jenis_sarana milik baris tersebut
 *                              (mis. "Distribusi - PBF")
 *    bulan                   → tgl_periksa_mulai → tgl_periksa_selesai → tgl_input
 *
 *  Idempoten: hanya menyentuh baris yang kolomnya masih NULL, jadi aman
 *  dijalankan berkali-kali. Jalankan dari folder backend:
 *
 *      node scripts/apply-schema.js     # pastikan kolomnya ada
 *      node scripts/backfill-kinerja.js
 * ============================================================================
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../db');
const { lengkapiBaris } = require('../lib/kinerja');

(async () => {
  const [baris] = await pool.query(
    `SELECT l.id, l.tgl_periksa_mulai, l.tgl_periksa_selesai, l.tgl_input,
            i.jenis_sarana AS jenis_sarana_berkas
       FROM pbf_laporan l
       LEFT JOIN pbf_import i ON i.id = l.import_id
      WHERE l.kegiatan IS NULL OR l.jenis_sarana IS NULL OR l.bulan IS NULL
      ORDER BY l.id`,
  );

  if (!baris.length) {
    console.log('Tidak ada baris yang perlu di-backfill.');
    await pool.end();
    return;
  }

  let berubah = 0;
  for (const b of baris) {
    const t = lengkapiBaris(
      {
        tgl_periksa_mulai: b.tgl_periksa_mulai,
        tgl_periksa_selesai: b.tgl_periksa_selesai,
        tgl_input: b.tgl_input,
      },
      b.jenis_sarana_berkas,
    );
    const [hasil] = await pool.query(
      `UPDATE pbf_laporan
          SET kegiatan = COALESCE(kegiatan, ?),
              jenis_sarana = COALESCE(jenis_sarana, ?),
              bulan = COALESCE(bulan, ?)
        WHERE id = ?`,
      [t.kegiatan, t.jenis_sarana, t.bulan, b.id],
    );
    berubah += hasil.affectedRows;
  }

  const [rekap] = await pool.query(
    `SELECT COALESCE(kegiatan,'-') AS kegiatan,
            COALESCE(jenis_sarana,'-') AS jenis_sarana,
            COALESCE(CAST(bulan AS CHAR),'-') AS bulan,
            COUNT(*) AS jumlah
       FROM pbf_laporan GROUP BY 1,2,3 ORDER BY 1,2,3`,
  );

  console.log(`Backfill selesai: ${berubah} baris diperiksa dari ${baris.length} kandidat.`);
  console.log('Rekap sesudah backfill:');
  rekap.forEach((r) => console.log(`  ${r.kegiatan} | ${r.jenis_sarana} | bulan ${r.bulan} → ${r.jumlah}`));

  await pool.end();
})().catch(async (e) => {
  console.error('Backfill gagal:', e.message);
  try {
    await pool.end();
  } catch (_) {
    /* abaikan */
  }
  process.exitCode = 1;
});
