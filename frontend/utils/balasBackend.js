// utils/balasBackend.js
/**
 * PENJAGA BALASAN KOSONG DARI BACKEND
 * -----------------------------------
 * Semua proxy di `pages/api/**` meneruskan body backend apa adanya. Bila
 * backend membalas TANPA isi (mis. 404 kosong dari reverse proxy yang belum
 * dirutekan, 502 tunnel, atau upstream mati), klien menerima respons kosong
 * dan `res.json()` di browser gagal dengan pesan samar:
 *   "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
 *
 * `balasKosong` menggantinya dengan JSON yang jelas + menyebut URL tujuan agar
 * sumber masalah langsung terlihat (alamat backend salah / layanan mati /
 * route belum terpasang).
 */

/** Body dianggap kosong bila hanya whitespace. */
export const teksKosong = (teks) => !teks || !String(teks).trim();

/**
 * Balas 502 JSON untuk upstream yang tubuhnya kosong.
 * @param {import('http').ServerResponse} res
 * @param {Response} jawaban  respons fetch ke backend (untuk kode status)
 * @param {string} url        alamat backend yang dipanggil
 */
export const balasKosong = (res, jawaban, url) => {
  if (res.headersSent) return res.end();
  res.status(502);
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  return res.send(
    JSON.stringify({
      success: false,
      code: 'BALASAN_KOSONG',
      message:
        `Backend membalas ${jawaban?.status ?? '?'} tanpa isi untuk ${url}. ` +
        'Periksa alamat backend (BACKEND_API_URL / NEXT_PUBLIC_API_URL) dan pastikan ' +
        'layanan API hidup serta hostname-nya diarahkan ke backend.',
    }),
  );
};
