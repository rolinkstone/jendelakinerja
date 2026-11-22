// pages/index.js
/**
 * GERBANG APLIKASI — "/"
 * ----------------------
 * Membuka `localhost:3007` langsung menampilkan **Jendela Kinerja** (halaman
 * publik, tanpa login), bukan form login. Form login hanya muncul bila
 * pengguna menekan "Masuk dashboard" di navbar.
 *
 * Dikerjakan dengan `redirect` di `getServerSideProps` (bukan komponen yang
 * memanggil router.replace) supaya pengalihannya terjadi di server: browser
 * menerima 307 sebelum React dijalankan, jadi tidak ada kedipan halaman kosong
 * dan tidak ada kesempatan middleware menahan di `/login`.
 *
 * Beranda dashboard (kartu KPI + daftar modul) kini ada di `/beranda`.
 */
export default function Root() {
  // Tidak pernah dirender — permintaan selalu dialihkan di server.
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/jendela-kinerja',
      permanent: false,
    },
  };
}
