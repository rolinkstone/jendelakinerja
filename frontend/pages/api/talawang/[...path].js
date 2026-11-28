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
  const bagian = [].concat(req.query.path || []).join('/');

  /**
   * RUTE KONSUMSI TALAWANG — lolos TANPA SESI.
   *
   * Talawang (aplikasi lain) tidak punya sesi Keycloak JK; penjaganya adalah
   * token API yang dikirim di query/header. Kalau proxy ini menuntut sesi,
   * URL yang dibagikan operator selalu gagal saat dibuka di browser — persis
   * keluhan "pratinjau muncul tapi URL tidak".
   *
   * Keamanan tidak berkurang: backend tetap memeriksa token lewat
   * periksaToken() (routes/talawang.js) dan mengunci datanya pada akun 524.
   * Yang TIDAK boleh lolos adalah /token dan /info — keduanya tetap butuh sesi
   * karena mengembalikan token asli dan mengubah konfigurasi.
   */
  const konsumsi = bagian === 'realisasi' || bagian === 'tahun';
  const token = konsumsi ? null : await ambilToken(req);

  if (!konsumsi && (!token || !token.accessToken)) {
    return res.status(401).json({ success: false, message: 'Sesi tidak ditemukan. Silakan login ulang.' });
  }

  const indeksQuery = req.url.indexOf('?');
  const query = indeksQuery >= 0 ? req.url.slice(indeksQuery) : '';
  const url = `${BACKEND}/talawang/${bagian}${query}`;

  try {
    // Teruskan host publik ke backend. Tanpa ini, /info merakit tautan dari
    // req.get('host') di sisi backend, yaitu alamat internal container
    // (mis. host.docker.internal:5006) - tautan yang disalin operator lalu
    // tidak bisa dibuka di browser. Reverse proxy luar sudah mengirim
    // x-forwarded-host asli; kalau tidak ada, pakai Host permintaan ini.
    const hostPublik = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const protoPublik = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();

    const opsi = {
      method: req.method,
      headers: {},
    };

    if (!['GET', 'HEAD'].includes(req.method)) {
      const body = await bacaBody(req);
      if (body) {
        opsi.body = body;
        if (req.headers['content-type']) opsi.headers['content-type'] = req.headers['content-type'];
      }
    }

    if (token?.accessToken) opsi.headers.authorization = `Bearer ${token.accessToken}`;
    else delete opsi.headers.authorization;

    if (hostPublik) opsi.headers['x-forwarded-host'] = hostPublik;
    opsi.headers['x-forwarded-proto'] = protoPublik;

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
