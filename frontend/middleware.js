// middleware.js
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    
    console.log("🛡️ Middleware - Path:", path);
    console.log("🛡️ Middleware - Hostname:", req.nextUrl.hostname);
    console.log("🛡️ Middleware - Token present:", !!token);
    
    if (token) {
      console.log("🛡️ Middleware - User:", token.name);
      console.log("🛡️ Middleware - Role:", token.role);
      
      // You can add role-based access control here
      if (path.startsWith('/admin') && token.role !== 'admin') {
        const url = new URL('/unauthorized', req.url);
        return NextResponse.redirect(url);
      }
    }
    
    return NextResponse.next();
  },
  {
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
          // Dashboard publik "Jendela Kinerja" — dibuka tanpa login
          // (peta Kalteng + rekap pemeriksaan sarana). Proxy API-nya juga
          // publik karena backend route /api/publik tidak memakai token.
          '/jendela-kinerja',
          // Menu navbar publik lain — halaman "segera hadir" selama modulnya
          // belum selesai. Semuanya di luar SSO, sama seperti Jendela Kinerja.
          '/prestasi-unit-kerja',
          '/anggaran-realisasi',
          '/dokumen-pk-rapk',
          '/sumber-daya',
          '/api/publik'
        ];
        
        // Akar aplikasi "/" SELALU publik: halaman itu hanya mengalihkan
        // (307) ke /jendela-kinerja lewat getServerSideProps. Kalau middleware
        // lebih dulu menahannya di signin, permintaan "localhost:3007" akan
        // mendarat di form login — persis yang tidak diinginkan.
        // Perhatikan: `startsWith('/')` akan cocok dengan SEMUA path, jadi akar
        // harus diperiksa dengan perbandingan persis.
        if (path === '/') {
          return true;
        }

        const isPublicPath = publicPaths.some(publicPath =>
          path.startsWith(publicPath) || path.includes('.')
        );
        
        if (isPublicPath) {
          console.log("🛡️ Middleware - Public path:", path);
          return true;
        }
        
        // Beranda TIDAK lagi dikecualikan. Dulu `path === '/'` selalu
        // dikembalikan true, akibatnya tamu (sudah logout) tetap menerima
        // kerangka halaman beranda dari server dan hanya bergantung pada
        // pemeriksaan sesi di sisi klien — kalau sesi masih tersisa, dashboard
        // langsung terbuka. Sekarang beranda ikut aturan protected paths.
        
        // Protected paths require authentication.
        // Catatan: kembalikan `false` (BUKAN NextResponse.redirect) — pada
        // next-auth v4 + Next 16 respons redirect dari callback `authorized`
        // diabaikan sehingga halaman tetap terkirim dengan status 200.
        // Dengan `false`, withAuth sendiri yang mengalihkan ke halaman
        // `signIn` (/login) beserta `callbackUrl`.
        if (!token) {
          console.log("🛡️ Middleware - No token, redirecting to login");
          return false;
        }
        
        console.log(`✅ Access granted for ${path} - User: ${token.name}, Role: ${token.role}`);
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
     * - _next/webpack-hmr   (kanal HMR dev — WAJIB dikecualikan)
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