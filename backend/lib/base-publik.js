/**
 * ORIGIN PUBLIK JK — untuk merakit URL yang ditempel ke aplikasi lain.
 * ----------------------------------------------------------------
 * Dipakai route yang MENGHASILKAN tautan (Talawang, Link API). Bukan untuk
 * memanggil backend — itu urusan utils/backendUrl.js di frontend.
 *
 * MASALAH YANG DIPERBAIKI
 *   Dulu tiap route menyusun sendiri: `${PUBLIC_BASE_URL}/api/...`.
 *   Di production PUBLIC_BASE_URL berisi `https://host/api` (itu nilai
 *   NEXT_PUBLIC_API_URL yang dipakai docker-compose), sehingga hasilnya
 *   `https://host/api/api/...` — dobel `/api`, dan tautan yang dibagikan
 *   langsung 404 saat dibuka di browser. Preview di halaman tetap jalan
 *   karena lewat proxy ber-sesi, jadi bug ini hanya terlihat saat tautan
 *   diuji di browser.
 *
 * ATURAN
 *   Fungsi ini mengembalikan ORIGIN saja (skema + host + port), tanpa path.
 *   Semua route menyusun sendiri path lengkapnya dari situ.
 *
 *   Urutan sumber:
 *     1. PUBLIC_BASE_URL / JK_PUBLIC_URL  (dari .env, sudah berisi domain)
 *     2. X-Forwarded-Proto + X-Forwarded-Host  (diteruskan reverse proxy)
 *     3. req.protocol + req.get('host')   (akses langsung)
 *
 *   Untuk (2): proxy Next (`pages/api/**`) TIDAK meneruskan host asli secara
 *   bawaan, jadi originPublik() akan jatuh ke alamat backend internal. Itu
 *   yang benar untuk pemanggilan internal, tetapi salah untuk tautan yang
 *   dibagikan. Karena itu proxy meneruskan x-forwarded-host secara eksplisit.
 */

/** Buang akhiran `/api` dan garis miring berlebih. */
const bersihkanOrigin = (nilai) => {
  const teks = String(nilai || '').trim();
  if (!teks) return '';
  return teks
    .replace(/\/+$/, '')      // buang / di ujung
    .replace(/\/api$/i, '')   // buang akhiran /api (penyebab dobel)
    .replace(/\/+$/, '');
};

/** Ambil nilai pertama bila header berisi daftar (a, b). */
const pertama = (nilai) => String(nilai || '').split(',')[0].trim();

/**
 * Asal permintaan INI (domain yang sedang dibuka operator).
 * Didahulukan header, baru env. Dipakai bila tautan harus dijamin hidup di
 * domain yang sama dengan halaman yang menampilkannya.
 */
const originPermintaan = (req) => {
  const proto = pertama(req.headers['x-forwarded-proto']
    || req.headers['x-forwarded-protocol']
    || req.protocol
    || 'http') || 'http';

  const host = pertama(req.headers['x-forwarded-host'] || req.get('host'));
  if (host) return `${proto}://${host}`;

  // Tidak ada host sama sekali (mis. dipanggil dari skrip) — pakai env.
  return bersihkanOrigin(process.env.PUBLIC_BASE_URL || process.env.JK_PUBLIC_URL);
};

/**
 * Origin publik JK menurut konfigurasi.
 * Env didahulukan supaya tautan yang dibagikan tetap memakai domain kanonik.
 */
const originPublik = (req) => {
  const dariEnv = bersihkanOrigin(process.env.PUBLIC_BASE_URL || process.env.JK_PUBLIC_URL);
  if (dariEnv) return dariEnv;
  return originPermintaan(req);
};

module.exports = { originPublik, originPermintaan };
