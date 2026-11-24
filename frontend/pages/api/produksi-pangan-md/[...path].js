// pages/api/produksi-pangan-md/[...path].js
/**
 * PROXY BACKEND — /api/produksi-pangan-md/*
 * --------------------------
 * Token Keycloak SENGAJA tidak pernah dikirim ke browser (lihat catatan di
 * utils/axiosInstance.js). Semua permintaan modul Distribusi KOS karena itu
 * lewat route server ini:
 *
 *   browser  →  /api/produksi-pangan-md/<path>          (cookie sesi NextAuth, httpOnly)
 *            →  backend /api/produksi-pangan-md/<path>  (header Authorization: Bearer <access_token>)
 *
 * Body multipart (unggah berkas) diteruskan apa adanya sebagai buffer, jadi
 * boundary dari browser tidak perlu diurai ulang.
 */
import { ambilToken } from '../../../utils/authCookies';

export const config = { api: { bodyParser: false } };

const BACKEND = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5006/api').replace(/\/+$/, '');

const bacaBody = async (req) => {
  const potongan = [];
  for await (const bagian of req) potongan.push(bagian);
  return potongan.length ? Buffer.concat(potongan) : null;
};

export default async function handler(req, res) {
  const token = await ambilToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Sesi tidak ditemukan. Silakan login ulang.' });
  }
  if (!token.accessToken) {
    return res.status(401).json({
      success: false,
      message: 'Token akses Keycloak tidak tersedia pada sesi. Silakan logout lalu login ulang.',
    });
  }

  const bagian = [].concat(req.query.path || []).join('/');
  const indeksQuery = req.url.indexOf('?');
  const query = indeksQuery >= 0 ? req.url.slice(indeksQuery) : '';
  const url = `${BACKEND}/produksi-pangan-md/${bagian}${query}`;

  try {
    const opsi = {
      method: req.method,
      headers: { authorization: `Bearer ${token.accessToken}` },
    };

    if (!['GET', 'HEAD'].includes(req.method)) {
      const body = await bacaBody(req);
      if (body) {
        opsi.body = body;
        if (req.headers['content-type']) opsi.headers['content-type'] = req.headers['content-type'];
      }
    }

    const jawaban = await fetch(url, opsi);
    const teks = await jawaban.text();

    res.status(jawaban.status);
    res.setHeader('content-type', jawaban.headers.get('content-type') || 'application/json');
    return res.send(teks);
  } catch (e) {
    return res.status(502).json({
      success: false,
      message: `Gagal menghubungi backend (${BACKEND}): ${e.message}`,
    });
  }
}
