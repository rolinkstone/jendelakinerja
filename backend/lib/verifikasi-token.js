// lib/verifikasi-token.js
/**
 * VERIFIKASI TOKEN KEYCLOAK — PENGGANTI `jwt.decode()`
 * ====================================================
 * Sebelumnya backend hanya memanggil `jwt.decode()`: isi token dibaca tanpa
 * tanda tangannya diperiksa. Akibatnya token buatan sendiri dengan tanda tangan
 * apa pun diterima, dan seluruh operasi tulis (impor/hapus) terbuka untuk umum.
 * Temuan ini tercatat sebagai KRITIS pada laporan pengujian keamanan
 * (G:/SPBE/dokumen aplikasi/jendela-kinerja-laporan-pentest-sit-uat.docx).
 *
 * Modul ini memverifikasi token secara sungguhan:
 *   1. Tanda tangan diperiksa memakai kunci publik realm Keycloak (JWKS).
 *   2. Algoritma dibatasi RS256 saja — mencegah serangan "alg: none" dan
 *      penggantian algoritma (mis. token HS256 yang ditandatangani kunci publik).
 *   3. Masa berlaku (`exp`) dan penerbit (`iss`) diperiksa.
 *   4. Kunci publik di-cache agar tidak memanggil Keycloak tiap permintaan.
 *
 * Bila Keycloak tidak dapat dihubungi, permintaan DITOLAK (fail closed) —
 * bukan diloloskan. Kegagalan koneksi bukan alasan mempercayai token.
 *
 * Variabel lingkungan:
 *   AUTH_VERIFIKASI=aktif|nonaktif   (bawaan: aktif). 'nonaktif' HANYA untuk
 *                                    pengembangan tanpa jaringan; dicatat
 *                                    sebagai peringatan saat server menyala.
 *   AUTH_PERIKSA_ISSUER=aktif|nonaktif (bawaan: aktif)
 *   AUTH_AUDIENCE=<daftar dipisah koma> (bawaan: kosong = tidak diperiksa,
 *                                    karena token akses Keycloak sering tidak
 *                                    memuat client id di `aud`)
 *   PERAN_TULIS=<daftar dipisah koma> — peran yang boleh melakukan operasi
 *                                    tulis (impor/ubah/hapus). Bawaannya HANYA
 *                                    `admin` dan `admin_jendela_kinerja`; peran
 *                                    lain (termasuk `superadmin` dan `user`)
 *                                    hanya boleh membaca.
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const SERVER = String(
  process.env.KEYCLOAK_URL || process.env.KEYCLOAK_SERVER_URL || ''
).replace(/\/+$/, '');
const REALM = process.env.KEYCLOAK_REALM || 'master';

/**
 * Pengaman konfigurasi: bila issuer tidak bisa disusun, verifikasi MUSTAHIL
 * benar dan seluruh token asli akan ditolak. Lebih baik gagal saat menyala
 * dengan pesan jelas daripada diam-diam menolak semua orang.
 * Penyebab tersering: `require('dotenv').config()` dimuat SETELAH modul ini.
 */
if (!process.env.KEYCLOAK_ISSUER && !SERVER) {
  throw new Error(
    'Konfigurasi Keycloak belum terbaca (KEYCLOAK_SERVER_URL / KEYCLOAK_ISSUER kosong). ' +
    'Pastikan dotenv dimuat SEBELUM require lib/verifikasi-token.js.'
  );
}

/** Issuer realm: dipakai juga sebagai acuan pemeriksaan klaim `iss`. */
const ISSUER = (process.env.KEYCLOAK_ISSUER || `${SERVER}/realms/${REALM}`).replace(/\/+$/, '');
const JWKS_URI = `${ISSUER}/protocol/openid-connect/certs`;

const MODE = String(process.env.AUTH_VERIFIKASI || 'aktif').toLowerCase();
/** true = tanda tangan diperiksa (keadaan yang benar). */
const VERIFIKASI_AKTIF = MODE !== 'nonaktif';

const PERIKSA_ISSUER = String(process.env.AUTH_PERIKSA_ISSUER || 'aktif').toLowerCase() !== 'nonaktif';
const AUDIENCE = String(process.env.AUTH_AUDIENCE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * DUA peran yang punya akses penuh: `admin` dan `admin_jendela_kinerja`.
 * Selain keduanya HANYA BOLEH MEMBACA — termasuk mengunggah berkas, menghapus
 * data, dan membuka menu Setting (yang darinya token aplikasi lain bisa diambil).
 */
const PERAN_ADMIN = ['admin', 'admin_jendela_kinerja'];

/** Peran yang boleh menulis data. Lihat catatan di kepala berkas. */
const PERAN_TULIS = String(process.env.PERAN_TULIS || PERAN_ADMIN.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const klien = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000, // kunci publik jarang berubah
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  timeout: 8000,
});

/** Ambil kunci publik yang cocok dengan `kid` pada kepala token. */
const ambilKunci = (header, cb) => {
  if (!header || !header.kid) {
    // Token tanpa `kid` tidak bisa dipastikan kuncinya → tolak.
    return cb(new Error('Token tidak memuat kid'));
  }
  return klien.getSigningKey(header.kid, (err, kunci) => {
    if (err) return cb(err);
    try {
      return cb(null, kunci.getPublicKey());
    } catch (e) {
      return cb(e);
    }
  });
};

/**
 * Verifikasi token. Mengembalikan payload bila sah; melempar galat bila tidak.
 * Selalu asinkron supaya pemanggil tidak lupa menunggu.
 */
const verifikasiToken = (token) =>
  new Promise((resolve, reject) => {
    const opsi = {
      // Batasi ke RS256: menolak 'none' dan mencegah penggantian algoritma.
      algorithms: ['RS256'],
      clockTolerance: 30, // toleransi selisih jam antar mesin
    };
    if (PERIKSA_ISSUER) opsi.issuer = ISSUER;
    if (AUDIENCE.length) opsi.audience = AUDIENCE;

    if (!VERIFIKASI_AKTIF) {
      // Mode pengembangan: isi dibaca tanpa diperiksa. Tidak aman — hanya
      // dipakai bila jaringan ke Keycloak memang tidak ada.
      const isi = jwt.decode(token, { complete: true });
      if (!isi || !isi.payload) return reject(new Error('Token tidak terbaca'));
      const { payload } = isi;
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return reject(new Error('Token kedaluwarsa'));
      }
      return resolve(payload);
    }

    return jwt.verify(token, ambilKunci, opsi, (err, payload) =>
      err ? reject(err) : resolve(payload)
    );
  });

/** Susun objek pengguna dari payload token. */
const penggunaDariPayload = (payload) => ({
  id: payload.sub,
  username: payload.preferred_username || payload.email,
  email: payload.email,
  name: payload.name,
  roles: payload.realm_access?.roles || [],
  clientRoles: payload.resource_access || {},
});

/**
 * true bila pengguna punya salah satu peran tulis.
 * Entri yang berakhiran `*` diperlakukan sebagai awalan, mis. `admin_*` cocok
 * dengan `admin_tambun_raya`. Peran kustom per-satker seperti itu memang ada
 * di realm ini, jadi daftarnya tidak boleh hanya nama pasti.
 */
const bolehMenulis = (user) => {
  if (!Array.isArray(user?.roles)) return false;
  return user.roles.some((peran) =>
    PERAN_TULIS.some((pola) =>
      pola.endsWith('*') ? peran.startsWith(pola.slice(0, -1)) : peran === pola
    )
  );
};

/** Ringkasan mode untuk dicatat saat server menyala. */
const ringkasan = () => ({
  verifikasi: VERIFIKASI_AKTIF ? 'AKTIF (tanda tangan diperiksa)' : 'NONAKTIF (TIDAK AMAN — khusus pengembangan)',
  issuer: PERIKSA_ISSUER ? ISSUER : '(tidak diperiksa)',
  jwks: JWKS_URI,
  audience: AUDIENCE.length ? AUDIENCE.join(', ') : '(tidak diperiksa)',
  peranTulis: PERAN_TULIS.join(', '),
});

/**
 * Apakah pengguna punya salah satu peran ADMIN penuh.
 * Dipakai rute yang menyentuh konfigurasi/token, bukan sekadar data.
 */
const apakahAdmin = (user) => {
  if (!Array.isArray(user?.roles)) return false;
  return user.roles.some((peran) => PERAN_ADMIN.includes(peran));
};

module.exports = {
  verifikasiToken,
  penggunaDariPayload,
  bolehMenulis,
  apakahAdmin,
  PERAN_ADMIN,
  ringkasan,
  PERAN_TULIS,
  VERIFIKASI_AKTIF,
  ISSUER,
  JWKS_URI,
};
