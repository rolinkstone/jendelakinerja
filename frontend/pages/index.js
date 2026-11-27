// pages/index.js
/**
 * GERBANG APLIKASI \u2014 "/"
 * ----------------------
 * Membuka `localhost:3007` langsung dialihkan ke halaman /dashboard (publik,
 * tanpa login), bukan form login. Form login hanya muncul bila
 * pengguna menekan "Masuk dashboard" di navbar.
 *
 * Dikerjakan dengan `redirect` di `getServerSideProps` (bukan komponen yang
 * memanggil router.replace) supaya pengalihannya terjadi di server: browser
 * menerima 307 sebelum React dijalankan, jadi tidak ada kedipan halaman kosong
 * dan tidak ada kesempatan middleware menahan di `/login`.
 *
 * Beranda dashboard internal (kartu KPI + daftar modul, ber-SSO) ada di `/beranda`.
 * Alamat lama `/jendela-kinerja` dialihkan permanen ke `/dashboard` di next.config.mjs.
 */
export default function Root() {
  // Tidak pernah dirender \u2014 permintaan selalu dialihkan di server.
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/dashboard',
      permanent: false,
    },
  };
}
