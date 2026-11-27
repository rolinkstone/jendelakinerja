// pages/api/narasi/[[...path]].js
/**
 * PROXY BACKEND \u2014 /api/narasi-presentasi (dashboard ber-SSO)
 * ---------------------------------------------------------
 * Halaman Beranda \u2192 Narasi Presentasi memakai proxy ini untuk:
 *
 *   browser  \u2192  /api/narasi?limit=50          (cookie sesi NextAuth)
 *            \u2192  backend /api/narasi-presentasi (Authorization: Bearer ***)
 *
 * Token Keycloak tidak boleh sampai ke browser, dan nama route backend
 * (`narasi-presentasi`) sengaja dipendekkan jadi `/api/narasi` di frontend
 * supaya konsisten dengan proxy lain yang juga memakai nama pendek.
 *
 * CATATAN: jalur publik (widget di /jendela-kinerja) memakai backend langsung
 * lewat proxy /api/laura/*, bukan lewat sini \u2014 jadi halaman publik tidak
 * bergantung pada sesi ini.
 *
 * ATURAN: selalu balas JSON (lihat pages/api/link-api/[[...path]].js).
 */
import { ambilToken } from '../../../utils/authCookies';
import { BACKEND } from '../../../utils/backendUrl';
import { balasKosong } from '../../../utils/balasBackend';

export const config = { api: { bodyParser: false } };

const balasJson = (res, status, isi) => {
  if (res.headersSent) return res.end();
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  return res.send(JSON.stringify(isi));
};

const bacaBody = async (req) => {
  const potongan = [];
  for await (const bagian of req) potongan.push(bagian);
  return potongan.length ? Buffer.concat(potongan) : null;
};

const cuplik = (teks) =>
  String(teks || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

export default async function handler(req, res) {
  const token = await ambilToken(req);

  // BACA PUBLIK: daftar naskah aktif untuk satu filter dipakai juga oleh widget
  // di halaman publik /jendela-kinerja (tanpa sesi). Naskah presentasi bukan
  // data pribadi \u2014 memang dibacakan ke pengunjung. Tanpa pengecualian ini,
  // widget publik ditolak 401 dan koreksi operator tidak pernah terdengar.
  // TULIS (POST/DELETE) dan daftar penuh tetap WAJIB sesi.
  const bagian = [].concat(req.query.path || []).join('/');
  const bacaAktif = req.method === 'GET' && bagian === 'aktif';

  if (!bacaAktif && !token) {
    return balasJson(res, 401, {
      success: false,
      code: 'TANPA_SESI',
      message: 'Sesi tidak ditemukan. Silakan login ulang.',
    });
  }
  if (!bacaAktif && !token.accessToken) {
    return balasJson(res, 401, {
      success: false,
      code: 'TANPA_TOKEN',
      message: 'Token akses Keycloak tidak tersedia pada sesi. Silakan logout lalu login ulang.',
    });
  }

  const indeksQuery = req.url.indexOf('?');
  const query = indeksQuery >= 0 ? req.url.slice(indeksQuery) : '';
  const url = `${BACKEND}/narasi-presentasi${bagian ? `/${bagian}` : ''}${query}`;

  try {
    const opsi = {
      method: req.method,
      headers: { authorization: `Bearer ${token ? token.accessToken : ''}` },
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
    const tipe = jawaban.headers.get('content-type') || '';

    if (!tipe.includes('application/json')) {
      return balasJson(res, jawaban.status >= 400 ? jawaban.status : 502, {
        success: false,
        code: 'BALASAN_BUKAN_JSON',
        message: `Backend membalas ${jawaban.status} bukan JSON: ${cuplik(teks) || '(kosong)'}`,
      });
    }

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
