// utils/backendUrl.js
/**
 * ALAMAT BACKEND UNTUK PROXY `pages/api/**`
 * -----------------------------------------
 * Dipakai HANYA di server (tidak pernah di-bake ke bundle browser). Urutan:
 *
 *   1. BACKEND_API_URL     -> alamat internal, mis. http://host.docker.internal:5006/api
 *   2. NEXT_PUBLIC_API_URL -> cadangan: alamat publik dari build (perilaku lama)
 *   3. http://localhost:5006/api -> pengembangan lokal
 *
 * Mengapa dipisah dari NEXT_PUBLIC_API_URL: nilai NEXT_PUBLIC_* di-inline saat
 * `next build` dan diarahkan ke domain API PUBLIK. Kalau domain itu belum
 * dirutekan (mis. hostname Cloudflare tunnel belum didaftarkan), proxy menerima
 * 404 kosong dan browser melempar
 * "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
 * Dengan BACKEND_API_URL, server Next bisa memanggil backend lewat alamat
 * internal tanpa bergantung pada domain publik.
 */
const alamat =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5006/api';

export const BACKEND = alamat.replace(/\/+$/, '');
