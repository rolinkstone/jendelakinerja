// middleware.js
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { authCookies } from "./utils/authCookies";

// Peran yang dianggap administrator aplikasi (sama dengan [...nextauth].js).
const PERAN_ADMIN = ['admin', 'admin_jendela_kinerja'];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (token) {
      // You can add role-based access control here
      if (path.startsWith('/admin') && !PERAN_ADMIN.includes(token.role)) {
        const url = new URL('/unauthorized', req.url);
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    // Halaman yang dituju saat sesi tidak ada \u2014 HARUS /login (halaman SSO
    // aplikasi ini), bukan halaman bawaan NextAuth. Tanpa baris ini withAuth
    // mengarahkan ke /api/auth/signin, yang menjawab dengan redirect HTML;
    // fetch() di browser lalu menerima HTML, bukan JSON, dan muncul galat
    // "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON".
    pages: {
      signIn: '/login',
    },
    // Nama cookie sesi dipakai middleware (withAuth) untuk membaca token \u2014
    // harus sama dengan authOptions.cookies supaya tidak selalu "tidak login".
    cookies: authCookies,
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        
        // Public paths - no auth required
        const publicPaths = [
          '/login',
          '/api/auth',
          '/_next',
          '/favicon.ico',
          '/images',
          '/css',
          '/js',
          '/public',
          // Dashboard publik "Jendela Kinerja" \u2014 dibuka tanpa login
          // (peta Kalteng + rekap pemeriksaan sarana). Proxy API-nya juga
          // publik karena backend route /api/publik tidak memakai token.
          '/dashboard',
          // Dashboard realisasi keuangan PUBLIK: hanya angka agregat.
          // Rinciannya ada di /data-realisasi yang tetap wajib login.
          '/realisasi-anggaran',
          // Alamat lama (dialihkan 308 di next.config.mjs) tetap diloloskan
          // supaya redirect-nya dieksekusi Next, bukan ditahan middleware.
          '/jendela-kinerja',
          // Proxy LAURA AI dari halaman publik /dashboard (presentasi
          // bersuara + tanya jawab). Endpoint backend-nya publik, dan daftar
          // rute yang diizinkan dijaga ketat di pages/api/laura/[[...path]].js.
          '/api/laura',
          // Proxy koreksi narasi presentasi (Beranda \u2192 Narasi Presentasi).
          // Wajib masuk publicPaths: kalau tidak, middleware mengalihkan ke
          // /login dan klien menerima HTML, bukan JSON. Otorisasi sesungguhnya
          // ada DI DALAM proxy (utils/authCookies \u2192 ambilToken).
          '/api/narasi',
          // ATURAN UMUM: semua route WAJIB login, KECUALI data dashboard publik.
          // Halaman "segera hadir" (Prestasi Unit Kerja, Dokumen PK-RAPK, Sumber
          // Daya) sudah TIDAK diloloskan di sini - dulu terbuka karena modulnya
          // belum selesai, sekarang harus login seperti modul lain.
          // '/data-realisasi' juga tidak ada di sini: pagu/realisasi internal.
          //
          // Yang tetap publik hanya data untuk /dashboard:
          '/api/publik',
          // Proxy Link API ikut dilewatkan: route ini SELALU membalas JSON
          // (401 bila sesi tidak ada). Kalau middleware yang mencegatnya, ia
          // membalas redirect ke halaman login berisi HTML \u2014 fetch() di
          // browser lalu melempar "Unexpected token '<'". Penjagaan sesi
          // tetap ada, tapi di dalam proxy (lihat pages/api/link-api/[...path].js).
          '/api/link-api'
        ];
        
        // Akar aplikasi "/" SELALU publik: halaman itu hanya mengalihkan
        // (307) ke /dashboard lewat getServerSideProps. Kalau middleware
        // lebih dulu menahannya di signin, permintaan "localhost:3007" akan
        // mendarat di form login \u2014 persis yang tidak diinginkan.
        // Perhatikan: `startsWith('/')` akan cocok dengan SEMUA path, jadi akar
        // harus diperiksa dengan perbandingan persis.
        if (path === '/') {
          return true;
        }

        const isPublicPath = publicPaths.some(publicPath =>
          path.startsWith(publicPath) || path.includes('.')
        );
        
        if (isPublicPath) {
          return true;
        }
        
        // Beranda TIDAK lagi dikecualikan. Dulu `path === '/'` selalu
        // dikembalikan true, akibatnya tamu (sudah logout) tetap menerima
        // kerangka halaman beranda dari server dan hanya bergantung pada
        // pemeriksaan sesi di sisi klien \u2014 kalau sesi masih tersisa, dashboard
        // langsung terbuka. Sekarang beranda ikut aturan protected paths.
        
        // Protected paths require authentication.
        // Catatan: kembalikan `false` (BUKAN NextResponse.redirect) \u2014 pada
        // next-auth v4 + Next 16 respons redirect dari callback `authorized`
        // diabaikan sehingga halaman tetap terkirim dengan status 200.
        // Dengan `false`, withAuth sendiri yang mengalihkan ke halaman
        // `signIn` (/login) beserta `callbackUrl`.
        if (!token) {
          return false;
        }
        
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Cocokkan semua path KECUALI yang diawali:
     * - api/auth            (route autentikasi NextAuth)
     * - _next/static        (berkas statis hasil build)
     * - _next/image         (optimasi gambar)
     * - _next/webpack-hmr   (kanal HMR dev \u2014 WAJIB dikecualikan)
     * - favicon.ico
     *
     * PENTING: `_next/webpack-hmr` harus dikecualikan. Jika middleware
     * (withAuth) ikut menangani koneksi HMR di mode dev, runtime Next tidak
     * pernah menyelesaikan pendaftaran entrypoint halaman sehingga React
     * TIDAK PERNAH terhidrasi (halaman tampak dari SSR tetapi semua tombol,
     * dropdown, dan fetch sisi klien mati tanpa pesan galat apa pun).
     * `_next/data` sengaja TIDAK dikecualikan agar data getServerSideProps
     * tetap melewati pemeriksaan autentikasi.
     */
    '/((?!api/auth|_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)',
  ],
};