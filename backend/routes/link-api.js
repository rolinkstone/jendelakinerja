// routes/link-api.js
/**
 * ROUTER LINK API — Jendela Kinerja  (menggantikan routes/api-link.js)
 * -------------------------------------------------------------------
 * Alur yang dilayani:
 *
 *   1. Operator membuka modul (mis. Sampel Obat Tradisional) di dashboard.
 *   2. Menekan "Link API" → memilih sendiri FIELD mana yang boleh keluar.
 *   3. JK menerbitkan link publik berisi token:
 *        <base>/api/publik/link/<token>
 *   4. Link ditempel di LAURA AI → Sinkron → data (HANYA field terpilih)
 *      masuk knowledge.
 *
 * Endpoint:
 *   GET    /api/api-link/modul            daftar modul                     (admin)
 *   GET    /api/api-link/modul/:kode      katalog field satu modul          (admin)
 *   GET    /api/api-link                  daftar link terbit                (admin)
 *   POST   /api/api-link                  terbitkan link dari field pilihan (admin)
 *   DELETE /api/api-link/:id              cabut link                        (admin)
 *   GET    /api/publik/link/:token        konsumsi link                     (publik)
 *
 * Keamanan:
 *  - Nama kolom TIDAK pernah dipakai mentah dari body: divalidasi ke katalog
 *    (`lib/katalog-modul.js`), jadi tidak bisa dipakai menyelipkan SQL.
 *  - Token asli hanya tampil sekali saat diterbitkan; disimpan sha256.
 *  - Masa berlaku per link, bisa dicabut kapan saja, jumlah akses tercatat.
 *  - Konsumsi publik hanya mengembalikan kolom yang dipilih operator — jadi
 *    tidak ada kolom yang bocor tanpa sengaja.
 */
const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');
const { daftarModul, katalogField, validasiKolom, MODUL } = require('../lib/katalog-modul');
const { segel, bukaSegel, siap: segelSiap } = require('../lib/crypto-link');

const router = express.Router();

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const batasi = (v, maks) => String(v ?? '').slice(0, maks);

/**
 * Origin publik JK — dipakai saat merakit link yang ditempel ke aplikasi lain.
 * Memakai lib/base-publik.js supaya PUBLIC_BASE_URL yang berakhiran `/api`
 * tidak menghasilkan tautan dobel (`.../api/api/publik/link/...`). Domain kanonik
 * (env) sengaja didahulukan: tautan ini dikonsumsi aplikasi LAIN lewat domain
 * API publik, bukan lewat domain halaman yang sedang dibuka operator.
 */
const basePublic = (req) => originPublik(req);

/** Penyaring yang boleh disimpan di link (sisanya dibuang). */
const bersihkanFilter = (filter) => {
  const f = filter && typeof filter === 'object' ? filter : {};
  const hasil = {};
  if (f.tahun) hasil.tahun = Number(f.tahun) || batasi(f.tahun, 4);
  if (f.kesimpulan) hasil.kesimpulan = batasi(f.kesimpulan, 80);
  if (f.q) hasil.q = batasi(f.q, 120);
  // Batas baris per tarikan: cukup untuk knowledge, tidak membebani server.
  const limit = Number(f.limit);
  hasil.limit = Math.min(Math.max(limit || 500, 1), 2000);
  return hasil;
};

/**
 * Visibilitas link:
 *   'publik'  → siapa pun yang memegang link boleh menarik data (tanpa token).
 *   'private' → wajib Bearer Keycloak saat menarik data.
 * Data publik di halaman /jendela-kinerja TIDAK terpengaruh: itu route
 * /api/publik/kinerja/*, terpisah dari fitur link ini.
 */
const bersihkanVisibilitas = (v) =>
  String(v || '').toLowerCase() === 'private' ? 'private' : 'publik';

/** Status satu baris link (dipakai daftar & respons ubah). */
const statusLink = (l) => {
  if (l.dicabut_pada) return 'dicabut';
  if (l.kedaluwarsa_pada && new Date(l.kedaluwarsa_pada) <= new Date()) return 'kedaluwarsa';
  if (l.kedaluwarsa_pada && new Date(l.kedaluwarsa_pada) <= new Date(Date.now() + 3 * 864e5)) {
    return 'segera_kedaluwarsa';
  }
  return 'aktif';
};

/** Rakit link siap tempel dari token asli. */
const rakitLink = (req, token) => `${basePublic(req)}/api/publik/link/${token}`;

// ---------------------------------------------------------------------------
// GET /api/api-link/modul[?modul=kode] — daftar modul / katalog field
// ---------------------------------------------------------------------------
router.get('/modul', keycloakAuth, (req, res) => {
  const modul = String(req.query.modul || '').trim();
  if (modul) {
    const katalog = katalogField(modul);
    if (!katalog) {
      return res.status(404).json({ success: false, message: `Modul tidak dikenal: ${modul}` });
    }
    return res.json({ success: true, data: katalog });
  }
  return res.json({ success: true, data: { modul: daftarModul() } });
});

// ---------------------------------------------------------------------------
// GET /api/api-link/modul/:kode — katalog field satu modul
// ---------------------------------------------------------------------------
router.get('/modul/:kode', keycloakAuth, (req, res) => {
  const katalog = katalogField(req.params.kode);
  if (!katalog) {
    return res.status(404).json({ success: false, message: `Modul tidak dikenal: ${req.params.kode}` });
  }
  return res.json({ success: true, data: katalog });
});

// ---------------------------------------------------------------------------
// POST /api/api-link — terbitkan link dari FIELD PILIHAN operator
// Body: { modul, kolom: [...], filter?: {}, label?, masa_berlaku_hari? }
// ---------------------------------------------------------------------------
router.post('/', keycloakAuth, async (req, res) => {
  const modul = batasi(req.body?.modul, 40);
  const masaBerlaku = Math.min(Math.max(Number(req.body?.masa_berlaku_hari) || 30, 1), 3650);

  // Gerbang keamanan: hanya kolom yang ada di katalog yang lolos.
  const cek = validasiKolom(modul, req.body?.kolom);
  if (!cek.ok) {
    return res.status(400).json({
      success: false,
      message: cek.pesan,
      pilihan_modul: daftarModul().map((m) => m.kode)
    });
  }

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const kedaluwarsa = new Date(Date.now() + masaBerlaku * 24 * 3600 * 1000);
    const filter = bersihkanFilter(req.body?.filter);
    const visibilitas = bersihkanVisibilitas(req.body?.visibilitas);

    // Token disegel supaya dashboard bisa menyalin ulang link nanti tanpa
    // menyimpan plaintext di database (lihat lib/crypto-link.js).
    const tersegel = segelSiap() ? segel(token) : null;

    const [hasil] = await db.query(
      `INSERT INTO api_link (modul, nama_modul, label, kolom, filter, token_hash,
                             token_terenkripsi, visibilitas, masa_berlaku_hari,
                             kedaluwarsa_pada, dibuat_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        modul,
        cek.modul.nama,
        batasi(req.body?.label, 160) || null,
        JSON.stringify(cek.kolom),
        JSON.stringify(filter),
        sha256(token),
        tersegel,
        visibilitas,
        masaBerlaku,
        kedaluwarsa.toISOString().slice(0, 19).replace('T', ' '),
        getUsername(req.user)
      ]
    );

    return res.status(201).json({
      success: true,
      message:
        visibilitas === 'private'
          ? 'Link API diterbitkan (private — butuh Bearer Keycloak saat ditarik)'
          : 'Link API diterbitkan (publik)',
      data: {
        id: hasil.insertId,
        modul,
        nama_modul: cek.modul.nama,
        link: rakitLink(req, token),
        visibilitas,
        kolom: cek.kolom,
        filter,
        masa_berlaku_hari: masaBerlaku,
        kedaluwarsa_pada: kedaluwarsa.toISOString()
      }
    });
  } catch (e) {
    console.error('Gagal menerbitkan link API:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/api-link — daftar link terbit (link utuh disalin ulang dari segel)
// ---------------------------------------------------------------------------
router.get('/', keycloakAuth, async (req, res) => {
  const modul = String(req.query.modul || '').trim();
  const semua = req.query.semua === '1' || req.query.semua === 'true';
  try {
    const [rows] = await db.query(
      `SELECT id, modul, nama_modul, label, kolom, filter, visibilitas,
              token_terenkripsi, masa_berlaku_hari,
              terbit_pada, kedaluwarsa_pada, dicabut_pada, dibuat_oleh,
              jumlah_akses, akses_terakhir
         FROM api_link
        ${modul ? 'WHERE modul = ?' : ''}
        ORDER BY terbit_pada DESC
        LIMIT 300`,
      modul ? [modul] : []
    );

    const link = rows
      // Baris yang sudah dihapus/dicabut disembunyikan kecuali diminta (?semua=1)
      .filter((l) => semua || !l.dicabut_pada)
      .map((l) => {
        const token = l.token_terenkripsi ? bukaSegel(l.token_terenkripsi) : null;
        return {
          id: l.id,
          modul: l.modul,
          nama_modul: l.nama_modul,
          label: l.label,
          visibilitas: l.visibilitas || 'publik',
          jumlah_kolom: Array.isArray(l.kolom) ? l.kolom.length : (JSON.parse(l.kolom || '[]') || []).length,
          kolom: l.kolom,
          filter: l.filter,
          link: token ? rakitLink(req, token) : null,
          bisa_disalin: Boolean(token),
          masa_berlaku_hari: l.masa_berlaku_hari,
          terbit_pada: l.terbit_pada,
          kedaluwarsa_pada: l.kedaluwarsa_pada,
          dibuat_oleh: l.dibuat_oleh,
          jumlah_akses: l.jumlah_akses,
          akses_terakhir: l.akses_terakhir,
          status: statusLink(l)
        };
      });

    return res.json({
      success: true,
      data: { daftar_modul: daftarModul(), link }
    });
  } catch (e) {
    console.error('Gagal membaca daftar link API:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/api-link/:id — ubah visibilitas (publik ⇄ private) / label / masa
// Body: { visibilitas?: 'publik'|'private', label?, masa_berlaku_hari? }
// ---------------------------------------------------------------------------
router.patch('/:id', keycloakAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: 'ID link tidak valid' });
  }

  const set = [];
  const params = [];

  if (req.body?.visibilitas !== undefined) {
    set.push('visibilitas = ?');
    params.push(bersihkanVisibilitas(req.body.visibilitas));
  }
  if (req.body?.label !== undefined) {
    set.push('label = ?');
    params.push(batasi(req.body.label, 160) || null);
  }
  if (req.body?.masa_berlaku_hari !== undefined) {
    const hari = Math.min(Math.max(Number(req.body.masa_berlaku_hari) || 30, 1), 3650);
    set.push('masa_berlaku_hari = ?', 'kedaluwarsa_pada = DATE_ADD(terbit_pada, INTERVAL ? DAY)');
    params.push(hari, hari);
  }

  if (!set.length) {
    return res.status(400).json({ success: false, message: 'Tidak ada perubahan yang dikirim' });
  }

  try {
    params.push(id);
    const [hasil] = await db.query(
      `UPDATE api_link SET ${set.join(', ')} WHERE id = ? AND dicabut_pada IS NULL`,
      params
    );
    if (!hasil.affectedRows) {
      return res.status(404).json({ success: false, message: 'Link tidak ditemukan / sudah dihapus' });
    }

    const [rows] = await db.query(
      `SELECT id, modul, nama_modul, label, visibilitas, masa_berlaku_hari,
              terbit_pada, kedaluwarsa_pada, dicabut_pada
         FROM api_link WHERE id = ?`,
      [id]
    );
    console.log(`🔗 Link #${id} diubah oleh ${getUsername(req.user)}:`, set.join(', '));
    return res.json({
      success: true,
      message: 'Link diperbarui',
      data: { ...rows[0], status: statusLink(rows[0]) }
    });
  } catch (e) {
    console.error('Gagal mengubah link API:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/api-link/:id — hapus link
//   ?permanen=1 → baris dibuang (token_hash hilang, link langsung mati)
//   tanpa itu   → dicabut (tetap tersimpan untuk jejak audit, tak tampil lagi)
// ---------------------------------------------------------------------------
router.delete('/:id', keycloakAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: 'ID link tidak valid' });
  }
  const permanen = ['1', 'true', 'ya'].includes(String(req.query.permanen || '').toLowerCase());

  try {
    if (permanen) {
      const [hasil] = await db.query('DELETE FROM api_link WHERE id = ?', [id]);
      if (!hasil.affectedRows) {
        return res.status(404).json({ success: false, message: 'Link tidak ditemukan' });
      }
      console.log(`🗑️  Link #${id} dihapus permanen oleh ${getUsername(req.user)}`);
      return res.json({ success: true, message: 'Link dihapus permanen' });
    }

    const [hasil] = await db.query(
      'UPDATE api_link SET dicabut_pada = NOW(), token_terenkripsi = NULL WHERE id = ? AND dicabut_pada IS NULL',
      [id]
    );
    if (!hasil.affectedRows) {
      return res.status(404).json({ success: false, message: 'Link tidak ditemukan / sudah dihapus' });
    }
    console.log(`🚫 Link #${id} dicabut oleh ${getUsername(req.user)}`);
    return res.json({ success: true, message: 'Link dihapus (dicabut)' });
  } catch (e) {
    console.error('Gagal menghapus link API:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ---------------------------------------------------------------------------
// KONSUMSI LINK (publik) — GET /api/publik/link/:token
// ---------------------------------------------------------------------------

/** Ambil nilai JSON dari kolom MySQL (bisa sudah objek atau string). */
const bacaJson = (v, cadangan) => {
  if (v === null || v === undefined) return cadangan;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return cadangan;
  }
};

const konsumsiLink = async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ success: false, message: 'Token tidak valid' });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, modul, nama_modul, label, kolom, filter, visibilitas, masa_berlaku_hari,
              terbit_pada, kedaluwarsa_pada, dicabut_pada
         FROM api_link WHERE token_hash = ?`,
      [sha256(token)]
    );
    const link = rows[0];
    if (!link) return res.status(404).json({ success: false, message: 'Link tidak dikenal' });
    if (link.dicabut_pada) return res.status(410).json({ success: false, message: 'Link sudah dihapus' });
    if (new Date(link.kedaluwarsa_pada) <= new Date()) {
      return res.status(410).json({ success: false, message: 'Link sudah kedaluwarsa' });
    }

    // Link 'private' wajib Bearer Keycloak. Data publik di halaman
    // /jendela-kinerja memakai route /api/publik/kinerja/* yang terpisah,
    // jadi tetap terbuka tanpa token.
    if ((link.visibilitas || 'publik') === 'private' && !req.user) {
      return res.status(401).json({
        success: false,
        code: 'LINK_PRIVATE',
        message: 'Link ini private — sertakan header Authorization: Bearer <token Keycloak>',
      });
    }

    // Kolom dibaca ulang lewat katalog: kalau katalog berubah (kolom dihapus),
    // link lama tidak boleh menghasilkan query rusak.
    const cek = validasiKolom(link.modul, bacaJson(link.kolom, []));
    if (!cek.ok) {
      return res.status(422).json({ success: false, message: `Link tidak bisa dipakai: ${cek.pesan}` });
    }

    const filter = bacaJson(link.filter, {}) || {};
    const syarat = [];
    const params = [];
    if (filter.tahun) {
      syarat.push('tahun = ?');
      params.push(filter.tahun);
    }
    if (filter.kesimpulan && cek.kolom.includes('kesimpulan_akhir')) {
      syarat.push('kesimpulan_akhir = ?');
      params.push(filter.kesimpulan);
    }
    if (filter.q) {
      const kolomCari = ['nama_sampel', 'nomor_sampel', 'nama_sarana', 'kab_kota']
        .filter((k) => cek.kolom.includes(k));
      if (kolomCari.length) {
        syarat.push(`(${kolomCari.map((k) => `\`${k}\` LIKE ?`).join(' OR ')})`);
        params.push(...Array(kolomCari.length).fill(`%${filter.q}%`));
      }
    }
    const where = syarat.length ? `WHERE ${syarat.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(filter.limit) || 500, 1), 2000);

    await db.query(
      'UPDATE api_link SET jumlah_akses = jumlah_akses + 1, akses_terakhir = NOW() WHERE id = ?',
      [link.id]
    );

    // Kolom sudah lolos whitelist katalog → aman dirangkai ke SQL.
    const daftarKolom = cek.kolom.map((k) => `\`${k}\``).join(', ');
    const [data] = await db.query(
      `SELECT ${daftarKolom} FROM \`${cek.modul.tabel}\` ${where}
        ORDER BY id ASC LIMIT ?`,
      [...params, limit]
    );

    // Daftar tahun tersedia — supaya pemakai tahu cakupan data.
    const [tahun] = await db.query(
      `SELECT tahun, COUNT(*) AS jumlah FROM \`${cek.modul.tabel}\`
        WHERE tahun IS NOT NULL GROUP BY tahun ORDER BY tahun DESC`
    );

    return res.json({
      success: true,
      data: {
        modul: link.modul,
        nama_modul: link.nama_modul,
        label: link.label,
        kolom: cek.kolom.map((k) => ({
          nama: k,
          label: cek.modul.kolom[k]?.label || k,
          tipe: cek.modul.kolom[k]?.tipe || 'text'
        })),
        filter,
        tahun_tersedia: tahun,
        jumlah_baris: data.length,
        diterbitkan: link.terbit_pada,
        kedaluwarsa_pada: link.kedaluwarsa_pada,
        diambil_pada: new Date().toISOString(),
        rows: data
      }
    });
  } catch (e) {
    console.error('Konsumsi link API gagal:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = router;
module.exports.konsumsiLink = konsumsiLink;
module.exports.MODUL = MODUL;
