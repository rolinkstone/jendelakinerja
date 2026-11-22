// pages/api/sampel/[...path].js
/**
 * PROXY BACKEND — /api/sampel/<komoditi>/*
 * ----------------------------------------
 * Satu proxy untuk SEMUA sub menu modul Sampel:
 *
 *   browser  →  /api/sampel/ot/summary            (cookie sesi NextAuth, httpOnly)
 *            →  backend /api/sampel-ot/summary    (header Authorization: ***
 *
 *   browser  →  /api/sampel/sk/summary
 *            →  backend /api/sampel-sk/summary
 *
 *   browser  →  /api/sampel/ob/summary
 *            →  backend /api/sampel-ob/summary
 *
 * Token Keycloak SENGAJA tidak pernah dikirim ke browser (lihat catatan di
 * utils/axiosInstance.js). Segmen pertama WAJIB ada di daftar `SEGMEN` supaya
 * proxy ini tidak bisa dipakai memanggil router backend sembarangan.
 *
 * Body multipart (unggah berkas Excel) diteruskan apa adanya sebagai buffer,
 * jadi boundary dari browser tidak perlu diurai ulang.
 */
import { getToken } from 'next-auth/jwt';

export const config = { api: { bodyParser: false } };

const BACKEND = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5006/api').replace(/\/+$/, '');

/** Komoditi yang boleh dipanggil. Harus sama dengan prefix router di backend. */
const SEGMEN = ['ot', 'sk', 'ob', 'kos', 'pp', 'kp', 'ok'];

const bacaBody = async (req) => {
  const potongan = [];
  for await (const bagian of req) potongan.push(bagian);
  return potongan.length ? Buffer.concat(potongan) : null;
};

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return res.status(401).json({ success: false, message: 'Sesi tidak ditemukan. Silakan login ulang.' });
  }
  if (!token.accessToken) {
    return res.status(401).json({
      success: false,
      message: 'Token akses Keycloak tidak tersedia pada sesi. Silakan logout lalu login ulang.',
    });
  }

  const bagian = [].concat(req.query.path || []);
  const segmen = String(bagian[0] || '').toLowerCase();
  if (!SEGMEN.includes(segmen)) {
    return res.status(404).json({
      success: false,
      message: `Komoditi sampel "${segmen || '(kosong)'}" tidak dikenal. Pilihan: ${SEGMEN.join(', ')}.`,
    });
  }

  const sisa = bagian.slice(1).join('/');
  const indeksQuery = req.url.indexOf('?');
  const query = indeksQuery >= 0 ? req.url.slice(indeksQuery) : '';
  const url = `${BACKEND}/sampel-${segmen}/${sisa}${query}`;

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
