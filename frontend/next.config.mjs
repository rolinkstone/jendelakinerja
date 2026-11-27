/** @type {import('next').NextConfig} */
// Template aplikasi baru — semua alias & redirect lama ke halaman fitur
// (laporanrusak, aset, dll.) sudah dihapus bersama halaman tersebut.
//
// Alamat lama dua halaman SETTING diarahkan ke alamat barunya. Tanpa ini,
// tautan/bookmark lama ke /beranda/integrasi-laura akan 404 setelah halamannya
// dipindah ke /setting/laura-ai. Redirect permanen (308) supaya peramban
// menyimpan alamat barunya.
const nextConfig = {
  // Sembunyikan penanda teknologi (temuan 3.6 laporan pentest).
  poweredByHeader: false,

  async redirects() {
    return [
      // Rute publik dulu bernama /jendela-kinerja. Nama itu mirip dengan
      // halaman internal /beranda sehingga membingungkan; rute publiknya kini
      // /dashboard. Alamat lama tetap hidup lewat redirect permanen (308) —
      // tautan yang sudah tersebar, bookmark, dan dokumen lama tidak rusak.
      // Modul anggaran dulu bernama /anggaran-realisasi. Rute barunya
      // /data-realisasi dan bersifat internal (wajib login). Redirect tetap
      // dipertahankan supaya bookmark lama tidak 404.
      { source: '/anggaran-realisasi', destination: '/data-realisasi', permanent: true },
      { source: '/jendela-kinerja', destination: '/dashboard', permanent: true },
      { source: '/jendela-kinerja/:path*', destination: '/dashboard', permanent: true },
      { source: '/beranda/integrasi-laura', destination: '/setting/laura-ai', permanent: true },
      { source: '/beranda/narasi-presentasi', destination: '/setting/narasi-presentasi', permanent: true },
    ];
  },

  /**
   * HEADER KEAMANAN (temuan 3.6).
   * Sebelumnya frontend tidak mengirim satu pun header keamanan, sehingga
   * halaman ini bisa dibingkai situs lain (clickjacking) dan jenis isi berkas
   * bisa ditebak peramban.
   *
   * Catatan tentang CSP: sebelumnya dipasang dalam mode LAPOR SAJA
   * (Content-Security-Policy-Report-Only) agar tidak mematahkan aplikasi.
   * Sekarang sudah DITEGAKKAN. Next.js menyisipkan skrip dan gaya sebaris di
   * setiap halaman, jadi 'unsafe-inline' dan 'unsafe-eval' masih diperlukan;
   * tanpa keduanya halaman akan kosong. Bila nanti ada waktu, ganti dengan
   * nonce/hash agar 'unsafe-inline' bisa dibuang.
   */
  async headers() {
    const headerUmum = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "media-src 'self' data: blob:",
          "connect-src 'self' http://localhost:5006 http://localhost:3006 https://laura-ai.bbpompky.id https://*.bbpompky.id",
          "frame-ancestors 'self'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    ];
    return [
      { source: '/(.*)', headers: headerUmum },
    ];
  },
};

export default nextConfig;
