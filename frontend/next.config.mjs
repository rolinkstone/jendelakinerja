/** @type {import('next').NextConfig} */
// Template aplikasi baru — semua alias & redirect lama ke halaman fitur
// (laporanrusak, aset, dll.) sudah dihapus bersama halaman tersebut.
//
// Alamat lama dua halaman SETTING diarahkan ke alamat barunya. Tanpa ini,
// tautan/bookmark lama ke /beranda/integrasi-laura akan 404 setelah halamannya
// dipindah ke /setting/laura-ai. Redirect permanen (308) supaya peramban
// menyimpan alamat barunya.
const nextConfig = {
  async redirects() {
    return [
      { source: '/beranda/integrasi-laura', destination: '/setting/laura-ai', permanent: true },
      { source: '/beranda/narasi-presentasi', destination: '/setting/narasi-presentasi', permanent: true },
    ];
  },
};

export default nextConfig;
