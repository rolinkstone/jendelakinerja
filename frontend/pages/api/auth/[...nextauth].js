// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { authCookies, PAKAI_COOKIE_AMAN } from "../../../utils/authCookies";

// Peran aplikasi yang dianggap ADMIN. Hanya dua ini yang boleh memberi
// hak admin — peran lain (pic_*, ppk, kabag_tu, …) TIDAK pernah jadi admin.
const PERAN_ADMIN = ['admin', 'admin_jendela_kinerja'];

// Peran yang dikenali & disimpan di sesi. `admin_jendela_kinerja` WAJIB ada
// di sini; tanpa itu, pengguna yang hanya punya peran tersebut jatuh ke
// peran lain (mis. `pic_gudang`) yang kebetulan ikut terbawa di token.
const PERAN_DIKENAL = [
  ...PERAN_ADMIN,
  'superadmin',
  'ppk',
  'pic_ruangan',
  'pic',
  'kabag_tu',
  'kabalai',
  'bendahara',
  'pic_persediaan',
  'pic_gudang',
  'pic_lab',
  'katim',
  'mt',
];

/**
 * Kumpulkan peran Keycloak dari realm DAN client aplikasi ini.
 * Urutan `realm_access.roles` dari Keycloak tidak dijamin, jadi peran tidak
 * boleh diambil "yang pertama" begitu saja (itu sebabnya pengguna berperan
 * ganda bisa tampil sebagai `pic_gudang`).
 */
function peranDariProfil(profile) {
  const realmRoles = Array.isArray(profile?.realm_access?.roles) ? profile.realm_access.roles : [];
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const clientRoles = clientId
    ? profile?.resource_access?.[clientId]?.roles || []
    : Object.values(profile?.resource_access || {}).flatMap((c) => c?.roles || []);

  const semua = [...realmRoles, ...clientRoles].map((r) => String(r).toLowerCase());
  return [...new Set(semua)].filter((r) => PERAN_DIKENAL.includes(r));
}

export const authOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER,

      authorization: {
        params: {
          scope: "openid profile email roles",
        },
      },

      profile(profile) {
        const roles = peranDariProfil(profile);
        // Peran admin menang atas peran lain supaya pengguna berperan ganda
        // (admin + pic_gudang) tetap tampil & diberi hak sebagai admin.
        const primaryRole = roles.find((r) => PERAN_ADMIN.includes(r)) || roles[0] || 'user';

        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          role: primaryRole,
          roles: roles,
          username: profile.preferred_username,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.roles = user.roles;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id,
        name: token.name,
        email: token.email,
        role: token.role,
        roles: token.roles || [],
      };

      const userRoles = token.roles || [];
      // Admin HANYA `admin` atau `admin_jendela_kinerja`. `superadmin` sengaja
      // tidak lagi dihitung sebagai admin aplikasi (ia tetap boleh menulis di
      // backend lewat PERAN_TULIS, tapi UI admin mengikuti dua peran di atas).
      session.user.isAdmin = userRoles.some((r) => PERAN_ADMIN.includes(r));
      session.user.isPICRuangan = userRoles.includes('pic_ruangan') || userRoles.includes('pic');
      session.user.isPPK = userRoles.includes('ppk');
      session.user.isKabagTU = userRoles.includes('kabag_tu');
      session.user.isKabalai = userRoles.includes('kabalai');
      session.user.isBendahara = userRoles.includes('bendahara');
      session.user.isPicLab = userRoles.includes('pic_lab');
      session.user.isPicGudang = userRoles.includes('pic_gudang');
      session.user.isPicPersediaan = userRoles.includes('pic_persediaan');
      session.user.isKatim = userRoles.includes('katim');
      session.user.isMt = userRoles.includes('mt');

      // ===== CATATAN KEAMANAN (jangan diubah tanpa alasan kuat) =====
      // accessToken / idToken / refreshToken SENGAJA TIDAK dimasukkan ke objek
      // session. Cookie sesi NextAuth memang httpOnly, tetapi objek session
      // dikirim ke browser sebagai BODY JSON (/api/auth/session) sehingga
      // JavaScript di halaman (termasuk XSS/ekstensi) bisa membacanya.
      // Token tetap tersimpan di cookie JWE httpOnly dan hanya dibaca di sisi
      // server, mis. oleh pages/api/auth/keycloak-logout.js untuk logout SSO.
      session.clientId = process.env.KEYCLOAK_CLIENT_ID || 'local-pengujian';
      session.expires = token.expiresAt
        ? new Date(token.expiresAt * 1000).toISOString()
        : null;

      return session;
    },
  },

  events: {
    async signOut({ token }) {
      // Hancurkan Keycloak SSO session saat NextAuth logout
      if (token?.idToken) {
        const issuer = process.env.KEYCLOAK_ISSUER;
        const clientId = process.env.KEYCLOAK_CLIENT_ID || 'local-pengujian';
        const logoutUrl = `${issuer}/protocol/openid-connect/logout?id_token_hint=${token.idToken}&post_logout_redirect_uri=${process.env.NEXTAUTH_URL}/login&client_id=${clientId}`;
        try {
          await fetch(logoutUrl);
        } catch (error) {
          console.error('❌ Keycloak SSO logout error:', error);
        }
      }
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 4 * 60 * 60,
  },

  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,

  // Nama cookie DIPISAH dari aplikasi lain di host yang sama (lihat
  // utils/authCookies.js): cookie dipisah per host, bukan per port, sehingga
  // nama default akan saling menimpa antar aplikasi NextAuth di localhost.
  cookies: authCookies,
  useSecureCookies: PAKAI_COOKIE_AMAN,
};

export default NextAuth(authOptions);