// lib/anggaran.js
/**
 * MESIN MODUL ANGGARAN & REALISASI
 * --------------------------------
 * Dipisah dari routes/anggaran-realisasi.js supaya:
 *   - aturan pembacaan berkas bisa diuji tanpa menyalakan server / login;
 *   - skrip pemuatan awal (scripts/muat-anggaran.cjs) memakai jalur yang SAMA
 *     dengan unggahan pengguna, jadi hasilnya tidak mungkin beda.
 *
 * Berkas sumber: export SAKTI "Realisasi FA berdasarkan SP2D".
 * Satu sheet ("Data"), empat kolom: KODE COA | PAGU | REALISASI | SISA PAGU.
 *
 * PENTING - angka di berkas bertipe TEKS berpemisah titik ribuan ("2.025.000").
 * `Number("2.025.000")` menghasilkan NaN, dan NaN yang disimpan ke kolom
 * DECIMAL berubah jadi 0 tanpa error apa pun. Karena itu `keAngka` wajib
 * dipakai, bukan `Number()` langsung.
 */
const XLSX = require('xlsx');
const db = require('../db');
const { makDariCoa } = require('./mak');

/** Teks angka Indonesia -> number. "2.025.000" -> 2025000; "1.234,50" -> 1234.5 */
function keAngka(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g, '').replace(/^Rp\.?/i, '');
  if (!s) return 0;
  // Koma desimal (format Indonesia) hanya bila diikuti 1-2 digit.
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Cari indeks kolom dari beberapa kemungkinan nama header. */
function cariKolom(header, kemungkinan) {
  const bersih = header.map((h) => String(h ?? '').trim().toUpperCase().replace(/\s+/g, ' '));
  for (const k of kemungkinan) {
    const i = bersih.indexOf(k.toUpperCase());
    if (i >= 0) return i;
  }
  for (const k of kemungkinan) {
    const i = bersih.findIndex((h) => h.includes(k.toUpperCase()));
    if (i >= 0) return i;
  }
  return -1;
}

/** Tahun anggaran dari nama berkas bila formulir tidak mengirimkannya. */
function tahunDariNama(nama) {
  const m = String(nama || '').match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

/**
 * Baca buffer xlsx menjadi baris siap simpan.
 * @returns {{header: string[], pakai: Map<string,object>, tanpaMak: Array, dilewati: number}}
 */
function bacaBerkas(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const baris = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (!baris.length) throw new Error('Berkas kosong');

  const header = baris[0] || [];
  const iCoa = cariKolom(header, ['KODE COA', 'COA', 'KODE']);
  const iPagu = cariKolom(header, ['PAGU']);
  const iReal = cariKolom(header, ['REALISASI']);
  const iSisa = cariKolom(header, ['SISA PAGU', 'SISA']);
  if (iCoa < 0 || iPagu < 0) {
    throw new Error(`Kolom wajib tidak ditemukan. Header terbaca: ${JSON.stringify(header.slice(0, 6))}`);
  }

  const pakai = new Map(); // coa -> { mak, pagu, realisasi, sisa }
  const tanpaMak = [];
  let dilewati = 0;

  for (let i = 1; i < baris.length; i++) {
    const r = baris[i] || [];
    const coa = String(r[iCoa] ?? '').trim();
    if (!coa) {
      dilewati++;
      continue;
    }
    const mak = makDariCoa(coa);
    if (!mak) {
      // Jangan simpan MAK kosong: baris seperti ini dilaporkan, bukan didiamkan.
      tanpaMak.push({ baris: i + 1, coa: coa.slice(0, 80) });
      continue;
    }
    const nilai = {
      mak,
      pagu: keAngka(r[iPagu]),
      realisasi: iReal >= 0 ? keAngka(r[iReal]) : 0,
      sisa: iSisa >= 0 ? keAngka(r[iSisa]) : 0,
    };
    // COA ganda dalam satu berkas: JUMLAHKAN. Dua SP2D bisa jatuh pada COA
    // yang sama; membuang salah satunya membuat pagu lebih kecil dari aslinya.
    const ada = pakai.get(coa);
    if (ada) {
      ada.pagu += nilai.pagu;
      ada.realisasi += nilai.realisasi;
      ada.sisa += nilai.sisa;
    } else {
      pakai.set(coa, { ...nilai });
    }
  }

  return { header, pakai, tanpaMak, dilewati };
}

/** Ringkasan satu tahun anggaran (dipakai kartu KPI). */
async function ringkas(tahun, conn = db) {
  const [r] = await conn.query(
    `SELECT COUNT(*) AS baris,
            COALESCE(SUM(pagu), 0)      AS pagu,
            COALESCE(SUM(realisasi), 0) AS realisasi,
            COALESCE(SUM(sisa), 0)      AS sisa,
            COUNT(DISTINCT mak)         AS jumlah_mak,
            COUNT(DISTINCT SUBSTRING_INDEX(mak, '.', 2)) AS jumlah_komponen,
            COUNT(DISTINCT SUBSTRING_INDEX(SUBSTRING_INDEX(mak, '.', 5), '.', -1)) AS jumlah_akun
       FROM anggaran_realisasi WHERE tahun = ?`,
    [tahun],
  );
  const a = r[0] || {};
  const pagu = Number(a.pagu || 0);
  const realisasi = Number(a.realisasi || 0);
  const [meta] = await conn.query(
    'SELECT nama_berkas, diunggah_oleh, diunggah_pada FROM anggaran_import WHERE tahun = ? LIMIT 1',
    [tahun],
  );
  return {
    tahun: Number(tahun),
    baris: Number(a.baris || 0),
    pagu,
    realisasi,
    sisa: Number(a.sisa || 0),
    persen_serapan: pagu > 0 ? Math.round((realisasi / pagu) * 10000) / 100 : 0,
    jumlah_mak: Number(a.jumlah_mak || 0),
    jumlah_komponen: Number(a.jumlah_komponen || 0),
    jumlah_akun: Number(a.jumlah_akun || 0),
    berkas: meta[0] || null,
  };
}

/**
 * Simpan satu tahun anggaran: HAPUS dulu baris tahun itu, lalu isi ulang.
 * Tahun lain tidak tersentuh, jadi impor 2025 dan 2026 bisa berdampingan.
 */
async function simpanTahun({ tahun, namaBerkas, diunggahOleh, buffer }) {
  const t = Number(tahun);
  if (!t || t < 2000 || t > 2100) throw new Error('Tahun anggaran tidak sah (4 digit, mis. 2026)');

  const { pakai, tanpaMak, dilewati } = bacaBerkas(buffer);
  if (!pakai.size) {
    return { tahun: t, baris_tersimpan: 0, dilewati, tanpaMak, gagal: 'Tidak ada baris sah yang bisa diimpor' };
  }

  const daftar = [...pakai.entries()].map(([coa, v]) => [t, coa, v.mak, v.pagu, v.realisasi, v.sisa]);
  const total = daftar.reduce(
    (a, d) => ({ pagu: a.pagu + d[3], realisasi: a.realisasi + d[4], sisa: a.sisa + d[5] }),
    { pagu: 0, realisasi: 0, sisa: 0 },
  );

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [hapus] = await conn.query('DELETE FROM anggaran_realisasi WHERE tahun = ?', [t]);
    // Bertahap: satu INSERT raksasa bisa melampaui max_allowed_packet.
    const PER = 500;
    for (let i = 0; i < daftar.length; i += PER) {
      await conn.query(
        'INSERT INTO anggaran_realisasi (tahun, coa, mak, pagu, realisasi, sisa) VALUES ?',
        [daftar.slice(i, i + PER)],
      );
    }
    await conn.query(
      `INSERT INTO anggaran_import
         (tahun, nama_berkas, jumlah_baris, total_pagu, total_realisasi, total_sisa, diunggah_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nama_berkas = VALUES(nama_berkas), jumlah_baris = VALUES(jumlah_baris),
         total_pagu = VALUES(total_pagu), total_realisasi = VALUES(total_realisasi),
         total_sisa = VALUES(total_sisa), diunggah_oleh = VALUES(diunggah_oleh),
         diunggah_pada = CURRENT_TIMESTAMP`,
      [t, namaBerkas || '(tanpa nama)', daftar.length, total.pagu, total.realisasi, total.sisa, diunggahOleh || null],
    );
    await conn.commit();
    return {
      tahun: t,
      baris_tersimpan: daftar.length,
      baris_dihapus: Number(hapus.affectedRows || 0),
      dilewati,
      tanpaMak,
      jumlah_tanpa_mak: tanpaMak.length,
      total,
      ringkasan: await ringkas(t),
    };
  } catch (e) {
    await conn.rollback();
    throw new Error(`Impor gagal: ${e.message}`);
  } finally {
    conn.release();
  }
}

module.exports = { keAngka, cariKolom, tahunDariNama, bacaBerkas, ringkas, simpanTahun };