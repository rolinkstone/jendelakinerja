// pages/api/link-api/[[...path]].js
/**
 * PROXY BACKEND \u2014 /api/link-api/*
 * -------------------------------
 * Semua permintaan fitur "Link API" (pilih field -> terbitkan link -> ubah
 * visibilitas -> hapus) lewat sini:
 *
 *   browser  ->  /api/link-api/modul/sampel-ot      (cookie sesi NextAuth)
 *            ->  backend /api/api-link/modul/...   (Authorization: Bearer <keycloak>)
 *
 * Alasannya sama dengan proxy modul lain: token Keycloak tidak boleh sampai ke
 * browser. Browser hanya memegang cookie sesi httpOnly.
 *
 * ATURAN PENTING - SELALU BALAS JSON
 * ----------------------------------
 * Klien memanggil res.json() tanpa memeriksa content-type. Kalau proxy ini
 * membalas HTML (mis. halaman login hasil redirect middleware), browser
 * melempar "Unexpected token '<', '<!DOCTYPE '... is not valid JSON".
 * Karena itu setiap jalur keluar di sini WAJIB JSON, termasuk galat jaringan
 * dan balasan backend yang ternyata bukan JSON.
 */
import { ambilToken } from '../../../utils/authCookies';
import { BACKEND } from '../../../utils/backendUrl';
import { balasKosong } from '../../../utils/balasBackend';

export const config = { api: { bodyParser: false } };

/** Balas JSON dengan aman (jangan menimpa header yang sudah terkirim). */
const balasJson = (res, status, isi) => {
  if (res.headersSent) return res.end();
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  return res.send(JSON.stringify(isi));
};

/** Baca seluruh body (bodyParser dimatikan, jadi aliran harus dibaca manual). */
const bacaBody = async (req) => {
  const potongan = [];
  for await (const bagian of req) potongan.push(bagian);
  return potongan.length ? Buffer.concat(potongan) : null;
};

/** Ringkas HTML jadi potongan teks agar pesan galat tetap terbaca. */
const cuplik = (teks) =>
  String(teks || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

export default async function handler(req, res) {
  const token = await ambilToken(req);

  if (!token) {
    return balasJson(res, 401, {
      success: false,
      code: 'TANPA_SESI',
      message: 'Sesi tidak ditemukan. Silakan login ulang.',
    });
  }
  if (!token.accessToken) {
    return balasJson(res, 401, {
      success: false,
      code: 'TANPA_TOKEN',
      message: 'Token akses Keycloak tidak tersedia pada sesi. Silakan logout lalu login ulang.',
    });
  }

  // Optional catch-all: /api/link-api (tanpa segmen) juga masuk ke sini.
  // Dengan catch-all biasa, path kosong menghasilkan 404 HTML dari Next.
  const bagian = [].concat(req.query.path || []).join('/');
  const indeksQuery = req.url.indexOf('?');
  const query = indeksQuery >= 0 ? req.url.slice(indeksQuery) : '';
  const url = `${BACKEND}/api-link/${bagian}${query}`;

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

    if (req.method !== 'HEAD' && !teks.trim()) return balasKosong(res, jawaban, url);
    const tipe = jawaban.headers.get('content-type') || '';

    // Backend seharusnya selalu JSON. Kalau ternyata HTML/teks, bungkus jadi
    // galat JSON yang jelas alih-alih meneruskan HTML ke res.json() klien.
    if (!tipe.includes('application/json')) {
      return balasJson(res, jawaban.status >= 400 ? jawaban.status : 502, {
        success: false,
        code: 'BALASAN_BUKAN_JSON',
        message: `Backend membalas ${jawaban.status} bukan JSON: ${cuplik(teks) || '(kosong)'}`,
      });
    }

    // Sudah JSON - teruskan isinya (di-parse ulang agar klien tidak pernah
    // menerima potongan yang tidak bisa dibaca).
    try {
      return balasJson(res, jawaban.status, JSON.parse(teks));
    } catch {
      return balasJson(res, 502, {
        success: false,
        code: 'JSON_RUSAK',
        message: `Balasan backend tidak bisa dibaca sebagai JSON: ${cuplik(teks)}`,
      });
    }
  } catch (e) {
    return balasJson(res, 502, {
      success: false,
      code: 'BACKEND_MATI',
      message: `Gagal menghubungi backend (${BACKEND}): ${e.message}`,
    });
  }
}
