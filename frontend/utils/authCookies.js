// utils/authCookies.js
/**
 * NAMA COOKIE NEXTAUTH — DIPISAH PER APLIKASI
 * ------------------------------------------
 * Cookie browser dipisahkan berdasarkan HOST, bukan PORT. Dua aplikasi NextAuth
 * di mesin yang sama (Jendela Kinerja di localhost:3007 dan LAURA AI di
 * localhost:3006) akan memakai cookie yang SAMA bila namanya default
 * (`next-auth.session-token`). Login di satu aplikasi lalu menimpa cookie sesi
 * aplikasi lain — aplikasi yang tertimpa langsung terlempar ke /login.
 *
 * Solusi: awalan nama cookie sendiri per aplikasi (AUTH_COOKIE_PREFIX,
 * default 'jk'). Karena nama cookie berubah, setiap pembacaan token di sisi
 * server WAJIB lewat `ambilToken(req)` — jangan memanggil getToken() langsung,
 * sebab getToken() memakai nama default.
 */
import { getToken } from 'next-auth/jwt';

/** Awalan nama cookie aplikasi ini. */
export const AWALAN_COOKIE = process.env.AUTH_COOKIE_PREFIX || 'jk';

/** Cookie `__Secure-` hanya untuk HTTPS; di http://localhost harus mati. */
export const PAKAI_COOKIE_AMAN = (process.env.NEXTAUTH_URL || '').startsWith('https');

const awalanAman = PAKAI_COOKIE_AMAN ? '__Secure-' : '';

/** Opsi dasar semua cookie sesi. */
const dasar = { path: '/', sameSite: 'lax', secure: PAKAI_COOKIE_AMAN };

/** Konfigurasi cookie untuk NextAuth (dipakai di authOptions.cookies). */
export const authCookies = {
  sessionToken: {
    name: `${awalanAman}${AWALAN_COOKIE}.session-token`,
    options: { ...dasar, httpOnly: true },
  },
  callbackUrl: {
    name: `${AWALAN_COOKIE}.callback-url`,
    options: { ...dasar },
  },
  csrfToken: {
    name: `${awalanAman}${AWALAN_COOKIE}.csrf-token`,
    options: { ...dasar, httpOnly: true },
  },
  pkceCodeVerifier: {
    name: `${AWALAN_COOKIE}.pkce.code_verifier`,
    options: { ...dasar, httpOnly: true, maxAge: 900 },
  },
  state: {
    name: `${AWALAN_COOKIE}.state`,
    options: { ...dasar, httpOnly: true, maxAge: 900 },
  },
  nonce: {
    name: `${awalanAman}${AWALAN_COOKIE}.nonce`,
    options: { ...dasar, httpOnly: true },
  },
};

/** Nama cookie sesi — dipakai bila server perlu membaca cookie secara manual. */
export const NAMA_COOKIE_SESI = authCookies.sessionToken.name;

/**
 * Baca token sesi NextAuth dari request (server-side).
 * Wrapper ini WAJIB dipakai di route proxy; getToken() langsung akan mencari
 * nama cookie default dan selalu mengembalikan null.
 */
export const ambilToken = (req) =>
  getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: NAMA_COOKIE_SESI,
    secureCookie: PAKAI_COOKIE_AMAN,
  });
