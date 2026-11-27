// pages/api/auth/keycloak-logout.js
/**
 * LOGOUT SSO KEYCLOAK \u2014 dijalankan di sisi SERVER
 * -----------------------------------------------
 * Dipanggil browser dengan navigasi biasa:
 *     window.location.href = '/api/auth/keycloak-logout';
 *
 * Yang dikerjakan:
 *  1. Membaca `id_token` dari cookie sesi NextAuth (httpOnly) memakai getToken().
 *     => `id_token` TIDAK PERNAH dibaca/dibuat oleh JavaScript di halaman.
 *  2. Menghapus cookie sesi NextAuth supaya sesi lokal benar-benar berakhir.
 *  3. Mengalihkan browser ke endpoint logout Keycloak (RP-initiated logout)
 *     dengan `id_token_hint`, sehingga sesi SSO di Keycloak juga berakhir,
 *     lalu kembali ke /login.
 *
 * Kenapa tidak di browser seperti sebelumnya?
 *   Sebelumnya `session.idToken` dikirim ke browser lewat /api/auth/session
 *   (body JSON bisa dibaca skrip apa pun di halaman). Email/URL yang dibuat
 *   dari token itu juga masuk riwayat browser. Dengan route ini, token hanya
 *   berada di cookie JWE httpOnly dan di sisi server.
 *
 * Route ini publik (cookie sesi belum tentu ada) \u2014 middleware.js memang
 * mengecualikan seluruh path /api/auth.
 */
import { ambilToken } from '../../../utils/authCookies';

/**
 * Susun daftar Set-Cookie penghapus, nama mengikuti konvensi NextAuth.
 *
 * PENTING \u2014 cookie sesi BISA TERPECAH. next-auth memecah nilai cookie sesi
 * yang melebihi \xb14 KB menjadi `next-auth.session-token.0`, `.1`, `.2`, \u2026 dan
 * menyambungnya kembali saat membaca sesi. Sesi Keycloak (id_token +
 * access_token + refresh_token) hampir selalu melewati batas itu, jadi
 * menghapus HANYA `next-auth.session-token` menyisakan potongannya \u2192
 * sesi tetap dianggap sah dan pengguna masih bisa masuk dashboard setelah
 * menekan Logout. Karena itu semua nama berawalan `next-auth.session-token`
 * (dasar + potongan) ikut dihapus.
 */
function clearAuthCookies(req, res, useSecureCookies) {
  const prefix = useSecureCookies ? '__Secure-' : '';
  const csrfPrefix = useSecureCookies ? '__Host-' : '';
  const secure = useSecureCookies ? '; Secure' : '';
  const kedaluwarsa = 'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';

  // Nama yang benar-benar dikirim browser (potongan .0/.1/\u2026 ikut tertangkap).
  const namaSesi = new Set(
    Object.keys(req.cookies || {}).filter((nama) => nama.startsWith('next-auth.session-token'))
  );
  // Tambahan pengaman bila cookie gagal di-parse: dasar + sejumlah potongan umum.
  namaSesi.add('next-auth.session-token');
  for (let i = 0; i < 10; i += 1) namaSesi.add(`next-auth.session-token.${i}`);

  const daftar = [];
  for (const nama of namaSesi) {
    daftar.push(`${prefix}${nama}=; Path=/; HttpOnly${secure}; SameSite=Lax; ${kedaluwarsa}`);
  }
  daftar.push(`${csrfPrefix}next-auth.csrf-token=; Path=/; HttpOnly${secure}; SameSite=Lax; ${kedaluwarsa}`);
  daftar.push(`${prefix}next-auth.callback-url=; Path=/; HttpOnly${secure}; SameSite=Lax; ${kedaluwarsa}`);

  res.setHeader('Set-Cookie', daftar);
}

/**
 * Kirim 302 TANPA body.
 * `res.redirect()` bawaan Next.js menulis body HTML berisi URL tujuan \u2014 artinya
 * id_token_hint bisa ikut terbaca lewat fetch/XHR. Dengan status + Location saja,
 * token hanya ada di header Location (dipakai browser untuk navigasi biasa).
 */
function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const useSecureCookies = baseUrl.startsWith('https://');

  // 1. Baca sesi dari cookie httpOnly (tidak menyentuh response body).
  let token = null;
  try {
    token = await ambilToken(req);
  } catch (error) {
    console.error('\u274c [keycloak-logout] Gagal membaca sesi:', error.message);
  }

  // 2. Bersihkan sesi lokal apa pun kondisinya (termasuk cookie sesi terpecah).
  clearAuthCookies(req, res, useSecureCookies);

  const issuer = process.env.KEYCLOAK_ISSUER;
  const clientId = process.env.KEYCLOAK_CLIENT_ID || 'local-pengujian';
  const idToken = token?.idToken;

  // Tanpa id_token / issuer tidak ada yang bisa diteruskan ke Keycloak.
  if (!idToken || !issuer) {
    return redirect(res, '/login');
  }

  // 3. Teruskan ke logout SSO Keycloak, lalu kembali ke /login.
  const logoutUrl =
    `${issuer}/protocol/openid-connect/logout` +
    `?id_token_hint=${encodeURIComponent(idToken)}` +
    `&post_logout_redirect_uri=${encodeURIComponent(`${baseUrl}/login`)}` +
    `&client_id=${encodeURIComponent(clientId)}`;

  return redirect(res, logoutUrl);
}
