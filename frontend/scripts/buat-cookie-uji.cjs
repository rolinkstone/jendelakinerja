// BUAT COOKIE SESI UJI — untuk memverifikasi tampilan halaman ber-SSO.
// Memakai `encode` next-auth dengan authOptions aplikasi, jadi cookie-nya sah
// menurut NEXTAUTH_SECRET yang sedang dipakai. HANYA untuk pengujian lokal;
// accessToken di dalamnya palsu (backend akan menolaknya), karena halaman
// beranda tidak memanggil API.
//
// Pakai:  node scripts/buat-cookie-uji.cjs
// Keluaran: nama cookie + nilainya (satu baris JSON).
// .env dibaca manual: frontend tidak memasang paket dotenv.
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const baris of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const cocok = baris.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!cocok) continue;
    const nilai = cocok[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[cocok[1]]) process.env[cocok[1]] = nilai;
  }
}

const { encode } = require('next-auth/jwt');

(async () => {
  const prefix = process.env.AUTH_COOKIE_PREFIX || 'jk';
  const https = String(process.env.NEXTAUTH_URL || '').startsWith('https');
  const nama = `${https ? '__Secure-' : ''}${prefix}.session-token`;

  // PENTING: JANGAN memberi `salt`.
  // next-auth v4 menyandikan cookie sesi lewat encode() tanpa salt, dan
  // getToken() men-decode dengan salt kosong (lihat node_modules/next-auth/jwt
  // -> decode({token, secret}) dengan salt default ""). Memberi salt = nama
  // cookie membuat decode gagal ("decryption operation failed"), sehingga
  // middleware menganggapnya tidak login dan melempar ke /login.
  // Peran bisa dipilih lewat argumen pertama, mis.:
  //   node scripts/buat-cookie-uji.cjs user
  //   node scripts/buat-cookie-uji.cjs admin
  // Dipakai untuk memverifikasi pembedaan hak: `user` hanya boleh membaca.
  const peran = (process.argv[2] || 'admin').split(',').map((r) => r.trim()).filter(Boolean);

  const nilai = await encode({
    token: {
      name: `Uji ${peran.join('+')}`,
      email: 'uji@localhost',
      username: 'uji',
      sub: 'uji-lokal',
      roles: peran,
      role: peran[0],
      accessToken: 'palsu-untuk-uji',
    },
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 3600,
  });

  console.log(JSON.stringify({ nama, nilai, panjang: nilai.length }));
})();
