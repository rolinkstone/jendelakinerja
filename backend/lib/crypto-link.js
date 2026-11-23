// lib/crypto-link.js
/**
 * SEGEL TOKEN LINK API — AES-256-GCM
 * ----------------------------------
 * Token link perlu bisa DITAMPILKAN LAGI di dashboard (operator sering
 * kehilangan link hasil salinan pertama). Menyimpan token sebagai plaintext
 * berarti siapa pun yang bisa membaca tabel `api_link` otomatis memegang
 * seluruh link yang berlaku. Karena itu token disegel:
 *
 *   - kunci diturunkan dari SESSION_SECRET (fallback JWT_SECRET) + label tetap;
 *   - IV acak 12 byte per segel;
 *   - GCM memberi jaminan keutuhan, jadi segel yang diubah akan gagal dibuka.
 *
 * Yang disimpan di database hanya hasil segel. Saat dashboard meminta daftar
 * link, segel dibuka di server (route dijaga keycloakAuth) lalu dikirim ke
 * klien — nilai tersegel tidak pernah keluar dari server.
 */
const crypto = require('crypto');

const RAHASIA = process.env.API_LINK_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET;

/** Kunci 32 byte tetap, diturunkan dari rahasia aplikasi. */
const kunci = () =>
  crypto.createHash('sha256').update(`api-link:v1:${RAHASIA || ''}`).digest();

/** Apakah penyegelan bisa dipakai (rahasia aplikasi tersedia). */
const siap = () => Boolean(RAHASIA);

/** Segel token → string base64 (iv.tag.ciphertext). */
const segel = (token) => {
  if (!siap()) throw new Error('Rahasia aplikasi belum diisi (SESSION_SECRET/JWT_SECRET)');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', kunci(), iv);
  const ciphertext = Buffer.concat([c.update(String(token), 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
};

/** Buka segel → token asli; null bila segel rusak/tidak cocok. */
const bukaSegel = (segelStr) => {
  if (!segelStr || !siap()) return null;
  const bagian = String(segelStr).split('.');
  if (bagian.length !== 3) return null;
  try {
    const [iv, tag, ciphertext] = bagian.map((b) => Buffer.from(b, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', kunci(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ciphertext), d.final()]).toString('utf8');
  } catch {
    return null;
  }
};

module.exports = { segel, bukaSegel, siap };
