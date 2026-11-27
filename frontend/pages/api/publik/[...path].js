// pages/api/publik/[...path].js
/**
 * PROXY BACKEND \u2014 /api/publik/*
 * -----------------------------
 * Dipakai halaman PUBLIK /jendela-kinerja (di luar dashboard ber-SSO).
 *
 *   browser  \u2192  /api/publik/<path>          (tanpa cookie sesi, kecuali rincian)
 *             \u2192  backend /api/publik/<path> (route publik, tanpa token)
 *
 * Rekap (pilihan, ringkasan, sampel) memang publik: backend route-nya ada di
 * `publicRoutes` (backend/server.js) dan browser tidak perlu sesi.
 *
 * PENGECUALIAN \u2014 RINCIAN SARANA PERLU LOGIN
 * -----------------------------------------
 * `/api/publik/kinerja/sarana` membuka daftar NAMA sarana per baris (modal
 * "Rincian" pada tabel per kab/kota). Endpoint itu dibatasi untuk pengguna
 * yang sudah login: proxy memeriksa cookie sesi NextAuth (`ambilToken`) dan
 * meneruskan `Authorization: Bearer <accessToken>` ke backend, yang juga
 * menolak tanpa pengguna sah. Tamu tetap bisa melihat peta & tabel rekap.
 *
 * Hanya method GET yang diteruskan \u2014 dashboard publik bersifat read-only.
 */
import { ambilToken } from '../../../utils/authCookies';
import { BACKEND } from '../../../utils/backendUrl';
import { balasKosong } from '../../../utils/balasBackend';

/** Rute rincian yang mewajibkan sesi login (rekap tetap terbuka). */
const RUTE_WAJIB_LOGIN = ['kinerja/sarana'];

/** Satu balasan JSON baku \u2014 klien selalu memanggil res.json(). */
const balasJson = (res, status, isi) => {
  if (res.headersSent) return res.end();
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  return res.send(JSON.stringify(isi));
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Hanya method GET yang diizinkan' });
  }

  const bagian = [].concat(req.query.path || []).join('/');
  const indeksQuery = req.url.indexOf('?');
  const query = indeksQuery >= 0 ? req.url.slice(indeksQuery) : '';
  const url = `${BACKEND}/publik/${bagian}${query}`;

  const perluLogin = RUTE_WAJIB_LOGIN.some((r) => bagian === r || bagian.startsWith(`${r}/`));
  let token = null;
  if (perluLogin) {
    token = await ambilToken(req);
    if (!token?.accessToken) {
      return balasJson(res, 401, {
        success: false,
        code: 'TANPA_SESI',
        message: 'Rincian sarana hanya untuk pengguna yang sudah login. Silakan masuk terlebih dahulu.',
      });
    }
  }

  try {
    const opsi = { method: 'GET' };
    if (token?.accessToken) opsi.headers = { authorization: `Bearer ${token.accessToken}` };

    const jawaban = await fetch(url, opsi);
    const teks = await jawaban.text();

    if (req.method !== 'HEAD' && !teks.trim()) return balasKosong(res, jawaban, url);

    res.status(jawaban.status);
    res.setHeader('content-type', jawaban.headers.get('content-type') || 'application/json');
    if (perluLogin) {
      // Balasan berisi nama sarana per baris \u2014 jangan disimpan di cache bersama.
      res.setHeader('cache-control', 'private, no-store');
    } else {
      // Data publik boleh di-cache singkat di CDN/browser agar peta terasa cepat.
      res.setHeader('cache-control', 'public, max-age=60, stale-while-revalidate=300');
    }
    return res.send(teks);
  } catch (e) {
    return res.status(502).json({
      success: false,
      message: `Gagal menghubungi backend (${BACKEND}): ${e.message}`,
    });
  }
}
