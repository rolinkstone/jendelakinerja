// pages/api/talawang/[...path].js
/**
 * PROXY BACKEND — /api/talawang/*
 * -------------------------------
 * Halaman Setting memakai proxy ini supaya token Keycloak tidak pernah sampai
 * ke browser. Dua jenis permintaan lewat sini:
 *
 *   GET/POST/DELETE  /api/talawang/token       pengaturan token (wajib login)
 *   GET              /api/talawang/info        ringkasan konfigurasi
 *
 * Route konsumsi Talawang (/api/talawang/realisasi, /tahun) TIDAK lewat proxy
 * ini — Talawang memanggil backend langsung dengan tokennya sendiri.
 */
import { ambilToken } from '../../../utils/authCookies';
import { BACKEND } from '../../../utils/backendUrl';
import { balasKosong } from '../../../utils/balasBackend';

export const config = { api: { bodyParser: false } };

const bacaBody = async (req) => {
  const potongan = [];
  for await (const bagian of req) potongan.push(bagian);
  return potongan.length ? Buffer.concat(potongan) : null;
};

export default async function handler(req, res) {
  const token = await ambilToken(req);

  if (!token || !token.accessToken) {
    return res.status(401).json({ success: false, message: 'Sesi tidak ditemukan. Silakan login ulang.' });
  }

  const bagian = [].concat(req.query.path || []).join('/');
  const indeksQuery = req.url.indexOf('?');
  const query = indeksQuery >= 0 ? req.url.slice(indeksQuery) : '';
  const url = `${BACKEND}/talawang/${bagian}${query}`;

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

    const jawaban = await fetch(url, { ...opsi, cache: 'no-store' });
    const teks = await jawaban.text();

    if (req.method !== 'HEAD' && !teks.trim()) return balasKosong(res, jawaban, url);

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
