// pages/api/publik/[...path].js
/**
 * PROXY BACKEND — /api/publik/*
 * -----------------------------
 * Dipakai halaman PUBLIK /jendela-kinerja (di luar dashboard ber-SSO).
 *
 *   browser  →  /api/publik/<path>          (tanpa cookie sesi)
 *             →  backend /api/publik/<path> (route publik, tanpa token)
 *
 * Berbeda dengan proxy /api/pbf/*, route ini TIDAK memerlukan sesi NextAuth
 * karena backend-nya memang publik (`publicRoutes` di backend/server.js).
 * Tetap lewat server Next supaya browser tidak perlu tahu alamat backend dan
 * supaya tidak terbuka CORS tambahan.
 *
 * Hanya method GET yang diteruskan — dashboard publik bersifat read-only.
 */
const BACKEND = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5006/api').replace(/\/+$/, '');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Hanya method GET yang diizinkan' });
  }

  const bagian = [].concat(req.query.path || []).join('/');
  const indeksQuery = req.url.indexOf('?');
  const query = indeksQuery >= 0 ? req.url.slice(indeksQuery) : '';
  const url = `${BACKEND}/publik/${bagian}${query}`;

  try {
    const jawaban = await fetch(url, { method: 'GET' });
    const teks = await jawaban.text();

    res.status(jawaban.status);
    res.setHeader('content-type', jawaban.headers.get('content-type') || 'application/json');
    // Data publik boleh di-cache singkat di CDN/browser agar peta terasa cepat.
    res.setHeader('cache-control', 'public, max-age=60, stale-while-revalidate=300');
    return res.send(teks);
  } catch (e) {
    return res.status(502).json({
      success: false,
      message: `Gagal menghubungi backend (${BACKEND}): ${e.message}`,
    });
  }
}
