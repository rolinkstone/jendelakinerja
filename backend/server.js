// backend/server.js
/**
 * ============================================================
 *  BACKEND MINIMAL (Template Aplikasi Baru)
 * ============================================================
 *  Yang dipertahankan:
 *    - POST /api/login    → login via Keycloak (password grant)
 *    - GET  /api/health   → health check
 *    - /api/keycloak      → router utility Keycloak (satu-satunya router fitur)
 *
 *  Seluruh router fitur lama (aset, laporanrusak, persediaan, dll.)
 *  sudah dihapus. Tambahkan router aplikasi baru di bagian "ROUTES".
 * ============================================================
 */
const express = require('express');
const cors = require('cors');
const https = require('https');
const qs = require('qs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// PENTING: dotenv HARUS dimuat sebelum modul lain yang membaca process.env.
// lib/verifikasi-token.js menyusun issuer & alamat JWKS saat di-require; bila
// dotenv dimuat setelahnya, issuer terbaca kosong dan SEMUA token asli ditolak
// (gejala: "Token tidak sah atau kedaluwarsa" padahal token Keycloak valid).
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { keycloakAuth } = require('./middleware/keycloakAuth');
const {
    verifikasiToken,
    penggunaDariPayload,
    bolehMenulis,
    ringkasan: ringkasanAuth,
    PERAN_TULIS,
} = require('./lib/verifikasi-token');

const app = express();
const PORT = process.env.PORT || 5006;

// Alamat dengar. Bawaannya 127.0.0.1 supaya layanan tidak terbuka ke seluruh
// jaringan lokal (temuan 3.7 laporan pentest). Set HOST=0.0.0.0 hanya bila
// memang perlu diakses dari perangkat lain — dan pakai HTTPS bila begitu.
const HOST = process.env.HOST || '127.0.0.1';

// ========== MIDDLEWARE DASAR ==========
// Matikan penanda teknologi (temuan 3.6).
app.disable('x-powered-by');
// Header keamanan. CSP tidak dipasang di API: seluruh respons di sini JSON,
// tidak ada halaman yang perlu dilindungi; CSP ditangani di frontend.
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== CORS TERBATAS ==========
// Sebelumnya `cors()` tanpa opsi = Access-Control-Allow-Origin: * (temuan 3.5).
// Sekarang hanya asal yang terdaftar. Permintaan tanpa Origin (curl, server ke
// server seperti LAURA memanggil API ini) tetap dilayani karena bukan
// permintaan lintas-asal dari peramban.
const ASAL_DIIZINKAN = String(process.env.CORS_ORIGIN || process.env.CORS_ASAL ||
    'http://localhost:3007,http://localhost:3006,https://jendela-kinerja.bbpompky.id,https://laura-ai.bbpompky.id')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

app.use(cors({
    origin(origin, cb) {
        if (!origin) return cb(null, true); // bukan permintaan peramban lintas-asal
        const bersih = origin.replace(/\/+$/, '');
        if (ASAL_DIIZINKAN.includes(bersih)) return cb(null, true);
        return cb(new Error(`Asal ${bersih} tidak diizinkan`));
    },
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false,
    maxAge: 600,
}));

// ========== PEMBATASAN LAJU ==========
// Temuan 3.3: tidak ada pembatasan sama sekali sebelumnya.
const pesanLaju = {
    success: false,
    message: 'Terlalu banyak permintaan. Coba lagi beberapa saat lagi.',
};

// Batas umum: cukup longgar untuk pemakaian normal, tetap menahan pengambilan
// data massal otomatis.
const lajuUmum = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: pesanLaju,
});

// Batas ketat: login (cegah tebak kata sandi), unggah & hapus (cegah penyalah-
// gunaan sumber daya; unggah memakan CPU dan memori untuk mengurai Excel).
const lajuLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.' },
});

const lajuTulis = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Terlalu banyak operasi tulis. Coba lagi beberapa menit lagi.' },
});

app.use(lajuUmum);
app.post('/api/login', lajuLogin);


// ========== KEYCLOAK CONFIG ==========
const KEYCLOAK_CONFIG = {
    url: process.env.KEYCLOAK_URL || process.env.KEYCLOAK_SERVER_URL || 'https://auth.bbpompky.id',
    realm: process.env.KEYCLOAK_REALM || 'master',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'local-pengujian',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || ''
};

const httpsAgent = new https.Agent({ rejectUnauthorized: true });

// ========== AUTH MIDDLEWARE ==========
// Public route yang TIDAK membutuhkan token
// - /api/login, /api/health : utilitas dasar
// - /api/publik             : dashboard publik "Jendela Kinerja" (read-only,
//                             hanya rekap angka + nama sarana; tanpa login)
const publicRoutes = ['/api/login', '/api/health', '/api/publik',
    // Koreksi naskah presentasi 1 menit dibaca widget publik /jendela-kinerja.
    // Hanya GET /aktif yang dibuka (lihat routes/narasi-presentasi.js);
    // menyimpan/menghapus koreksi tetap wajib token.
    '/api/narasi-presentasi/aktif'];

// BACA PUBLIK — modul yang datanya memang publik (rekap sarana, sampel, PBF).
// Hanya metode BACA (GET/HEAD) yang dibuka; impor/ubah/hapus tetap wajib token.
// Kolom pribadi (operator, petugas, verifikator) dibuang oleh
// lib/saring-publik.js di endpoint detail, jadi yang keluar hanya data teknis.
// SENGAJA KOSONG.
// Dulu daftar ini membuka BACA untuk pbf/ifp/distribusi/produksi/sampel supaya
// dashboard publik bisa menampilkannya. Sekarang dashboard publik hanya membaca
// /api/publik/kinerja/*, sedangkan modul-modul di bawah adalah dashboard internal
// yang SELALU dipanggil lewat proxy ber-sesi (Authorization: Bearer ...).
// Membiarkan daftar ini terisi berarti data mentah tiap modul bisa diambil tanpa
// login - persis yang tidak diinginkan.
//
// PERKECUALIAN TUNGGAL: data dashboard publik ada di `publicRoutes`
// ('/api/publik'), plus '/api/login' dan '/api/health'.
const publicBacaRoutes = [];

// PREFIX API YANG BENAR-BENAR TERPASANG.
// Dipakai untuk membedakan dua hal yang sebelumnya tertukar:
//   - alamat yang ADA tapi tidak berhak  → 401
//   - alamat yang TIDAK ADA              → 404 (temuan 3.8)
// Tambahkan entri di sini bila memasang router baru.
const PREFIKS_API = [
    '/api/login', '/api/health', '/api/keycloak', '/api/publik',
    '/api/narasi-presentasi', '/api/api-link',
    '/api/pbf', '/api/ifp',
    '/api/distribusi-kos', '/api/distribusi-ot', '/api/distribusi-ipk',
    '/api/distribusi-sk', '/api/distribusi-ifk',
    '/api/produksi-ot', '/api/produksi-irt', '/api/produksi-pangan-md',
    '/api/sampel-ot', '/api/sampel-sk', '/api/sampel-ob', '/api/sampel-kos',
    '/api/sampel-pp', '/api/sampel-kp', '/api/sampel-ok',
    '/api/anggaran-realisasi',
];

const alamatDikenal = (path) => PREFIKS_API.some((p) => path.startsWith(p));

/**
 * Baca Bearer token dan VERIFIKASI tanda tangannya (lihat lib/verifikasi-token.js).
 * Mengembalikan pengguna bila sah, atau null bila tidak ada/tidak sah.
 * Sebelumnya fungsi ini memakai jwt.decode() sehingga token palsu diterima.
 */
const bacaBearer = async (req) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    try {
        const payload = await verifikasiToken(header.slice(7));
        const user = penggunaDariPayload(payload);
        req.user = user;
        return user;
    } catch (err) {
        // Token rusak, kedaluwarsa, tanda tangan salah, atau JWKS tidak terjangkau.
        // Semua kasus diperlakukan sama: tidak ada pengguna sah.
        req.galatToken = err.message;
        return null;
    }
};

const authMiddleware = async (req, res, next) => {
    // Alamat yang tidak ada diteruskan ke penangan 404, jangan dijawab 401.
    if (!alamatDikenal(req.path)) return next();

    if (publicRoutes.some(route => req.path.startsWith(route))) {
        // Route publik tetap publik, TETAPI bila klien mengirim Bearer token yang
        // sah, identitasnya dipakai. Diperlukan fitur Link API: link berlabel
        // 'private' ditolak tanpa token, sedangkan link 'publik' tetap jalan
        // tanpa token (lihat routes/link-api.js).
        await bacaBearer(req);
        return next();
    }

    // Modul data publik: cukup untuk BACA. Menulis (impor/ubah/hapus) tetap
    // harus lewat pemeriksaan token + peran di bawah.
    const bacaSaja = req.method === 'GET' || req.method === 'HEAD';
    if (bacaSaja && publicBacaRoutes.some(route => req.path.startsWith(route))) {
        await bacaBearer(req);
        return next();
    }

    // ---- Mulai bagian yang menuntut token sah ----
    const user = await bacaBearer(req);
    if (!user) {
        return res.status(401).json({
            success: false,
            message: req.headers.authorization
                ? 'Token tidak sah atau kedaluwarsa'
                : 'Unauthorized',
        });
    }

    // Operasi tulis dibatasi pada peran tertentu (temuan 3.1, bagian kedua).
    // Peran diatur lewat PERAN_TULIS; bawaannya admin,superadmin.
    if (!bacaSaja && !bolehMenulis(user)) {
        console.warn(
            `[auth] TOLAK tulis: ${req.method} ${req.path} oleh ${user.username || user.id} ` +
            `(peran: ${(user.roles || []).join(', ') || 'tidak ada'}; diizinkan: ${PERAN_TULIS.join(', ')})`
        );
        return res.status(403).json({
            success: false,
            message: 'Peran Anda tidak berhak mengubah data. Hubungi administrator.',
        });
    }

    // Batas laju lebih ketat untuk unggah dan hapus.
    if (!bacaSaja && (req.path.includes('/import') || req.method === 'DELETE')) {
        return lajuTulis(req, res, next);
    }

    return next();
};

app.use(authMiddleware);

// ========== PENJAGA KEYCLOAK GLOBAL ==========
// authMiddleware di atas hanya memastikan token SAH. Mulai titik ini setiap
// route yang bukan publik juga wajib punya `req.user` dan melewati
// middleware/keycloakAuth.js, yang menormalkan peran (extractedRoles, isAdmin,
// isPPK, isKabalai) supaya route mana pun bisa memakai checkRole() tanpa
// menebak bentuk payload Keycloak.
//
// YANG DIKECUALIKAN hanya:
//   - alamat tidak dikenal (dibiarkan jatuh ke penangan 404, bukan 401 - temuan 3.8)
//   - publicRoutes: /api/login, /api/health, /api/publik (data dashboard publik),
//     dan /api/narasi-presentasi/aktif (naskah yang dibacakan widget dashboard).
app.use((req, res, next) => {
    if (!alamatDikenal(req.path)) return next();
    if (publicRoutes.some((route) => req.path.startsWith(route))) return next();
    return keycloakAuth(req, res, next);
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server running', timestamp: new Date().toISOString() });
});

// ========== LOGIN (Keycloak password grant) ==========
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username dan password required' });
    }

    try {
        const response = await axios.post(
            `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`,
            qs.stringify({
                grant_type: 'password',
                client_id: KEYCLOAK_CONFIG.clientId,
                client_secret: KEYCLOAK_CONFIG.clientSecret,
                username,
                password,
                scope: 'openid profile email'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, httpsAgent }
        );

        const decoded = jwt.decode(response.data.access_token);
        res.json({
            success: true,
            data: {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                user: {
                    id: decoded?.sub,
                    username: decoded?.preferred_username || username,
                    email: decoded?.email,
                    name: decoded?.name,
                    roles: decoded?.realm_access?.roles || []
                }
            }
        });
    } catch (error) {
        const status = error.response?.status === 401 ? 401 : 500;
        res.status(status).json({
            success: false,
            message: error.response?.status === 401 ? 'Username atau password salah' : 'Login failed'
        });
    }
});

// ========== ROUTES ==========
// Satu-satunya router fitur yang dipertahankan: Keycloak utility.
// Tambahkan router aplikasi baru Anda di sini, mis.:
//   app.use('/api/foo', require('./routes/foo'));
app.use('/api/keycloak', require('./routes/keycloak'));

// Router Distribusi PBF — impor laporan Excel (butuh Bearer token; frontend
// memanggilnya lewat proxy pages/api/pbf/[...path].js).
app.use('/api/pbf', require('./routes/pbf'));

// Router Distribusi — IFP (Instalasi Farmasi Pemerintah): impor laporan Excel
// per tahun. Struktur berkasnya IDENTIK dengan PBF (44 kolom, header dua
// tingkat), jadi router-nya kembar; yang beda hanya tabel & jenis sarana.
app.use('/api/ifp', require('./routes/ifp'));

// Router Distribusi — Kosmetika & Obat Tradisional. Tata letak berkasnya
// BERBEDA dari PBF (35 & 38 kolom, tanpa blok temuan/M-m-C), jadi memakai
// engine `lib/distribusi.js` dengan pemetaan kolom per komoditi.
app.use('/api/distribusi-kos', require('./routes/distribusi-kos'));
app.use('/api/distribusi-ot', require('./routes/distribusi-ot'));
app.use('/api/distribusi-ipk', require('./routes/distribusi-ipk'));
app.use('/api/distribusi-sk', require('./routes/distribusi-sk'));
// Distribusi IFK — kembar PBF/IFP (44 kolom dengan rincian fokus).
app.use('/api/distribusi-ifk', require('./routes/distribusi-ifk'));

// Router Produksi — Obat Tradisional — impor laporan Excel per tahun (butuh
// Bearer token; frontend memanggilnya lewat proxy
// pages/api/produksi-ot/[...path].js).
app.use('/api/produksi-ot', require('./routes/produksi-ot'));

// Router Produksi — Pangan IRT (CPPB-IRT) — impor laporan Excel per tahun
// (butuh Bearer token; frontend memanggilnya lewat proxy
// pages/api/produksi-irt/[...path].js).
app.use('/api/produksi-irt', require('./routes/produksi-irt'));

// Router Produksi — Pangan MD (Pangan Olahan Makanan Dalam). Berkasnya 48
// kolom (beda dari IRT/OT), jadi memakai mesin lib/distribusi.js dengan
// pemetaan kolom sendiri.
app.use('/api/produksi-pangan-md', require('./routes/produksi-pangan-md'));

// Router Anggaran & Realisasi - impor export SAKTI "Realisasi FA berdasarkan SP2D"
// per tahun anggaran. COA disimpan utuh; kolom `mak` diisi hasil olahan
// lib/mak.js (3165.BDB.001.051.524111.A). Rekap per MAK dibaca dari
// view v_anggaran_mak.
app.use('/api/anggaran-realisasi', require('./routes/anggaran-realisasi'));

// Sampel: impor "REKAP DATA SAMPEL" per tahun (satu baris = satu sampel;
// baris lanjutan di berkas digabung di backend/lib/sampel.js).
// Satu komoditi = satu prefix + satu pasang tabel, tapi engine-nya sama.
// Token Bearer disuntik oleh proxy frontend pages/api/sampel/[...path].js.
app.use('/api/sampel-ot', require('./routes/sampel-ot'));   // Obat Tradisional
app.use('/api/sampel-sk', require('./routes/sampel-sk'));   // Suplemen Kesehatan
app.use('/api/sampel-ob', require('./routes/sampel-ob'));     // Obat
app.use('/api/sampel-kos', require('./routes/sampel-kos'));   // Kosmetika
app.use('/api/sampel-pp', require('./routes/sampel-pp'));     // Produk Pangan
app.use('/api/sampel-kp', require('./routes/sampel-kp'));     // Kemasan Pangan
app.use('/api/sampel-ok', require('./routes/sampel-ok'));     // Obat Kuasi

// Router LINK API — penerbitan link publik per modul dengan FIELD PILIHAN.
// Dipakai tombol "Link API" di dashboard JK; linknya ditempel ke LAURA AI.
// Konsumsi link (publik) dipasang di routes/publik.js → /api/publik/link/:token
app.use('/api/api-link', require('./routes/link-api'));

// Router NARASI PRESENTASI — koreksi naskah 1 menit yang dibacakan widget
// LAURA di halaman publik /jendela-kinerja. GET /aktif dibaca widget (publik),
// POST/DELETE dipakai dashboard Beranda → Narasi Presentasi (wajib token).
app.use('/api/narasi-presentasi', require('./routes/narasi-presentasi'));

// Router publik — dashboard "Jendela Kinerja" di luar SSO (read-only).
// Dipanggil frontend lewat proxy pages/api/publik/[...path].js.
app.use('/api/publik', require('./routes/publik'));

// ========== 404 HANDLER ==========
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.path} tidak ditemukan` });
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
    // Body JSON tidak valid (mis. body terpotong / bukan JSON) → jawab 400 +
    // alasannya, bukan 500, supaya bedanya jelas:
    //   400 = permintaan dari klien yang salah
    //   500 = kesalahan di server
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
        return res.status(400).json({
            success: false,
            message: 'Body JSON tidak valid',
            detail: err.message,
        });
    }
    console.error('Global error:', err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// ========== START SERVER ==========
app.listen(PORT, HOST, () => {
    const info = ringkasanAuth();
    console.log(`
    ════════════════════════════════════════
    🚀 Server running on ${HOST}:${PORT}
    🔐 Verifikasi token : ${info.verifikasi}
       Issuer           : ${info.issuer}
       JWKS             : ${info.jwks}
       Audience         : ${info.audience}
       Peran boleh tulis: ${info.peranTulis}
    🌐 CORS asal        : ${ASAL_DIIZINKAN.join(', ')}
    ⛔ Pembatasan laju  : umum 300/menit · login 10/15 menit · tulis 30/5 menit
    📋 Routes:
    - POST  /api/login
    - GET   /api/health
    - GET   /api/keycloak/*
    - POST  /api/pbf/import   (Excel Distribusi PBF — ganti data tahun terpilih)
    - GET   /api/pbf/summary | /laporan | /laporan/:id
    - POST  /api/produksi-ot/import  (Excel Produksi OT — ganti data tahun terpilih)
    - GET   /api/produksi-ot/summary | /laporan | /laporan/:id
    - POST  /api/produksi-irt/import  (Excel Produksi Pangan IRT — ganti data tahun terpilih)
    - GET   /api/produksi-irt/summary | /laporan | /laporan/:id
    - POST  /api/sampel-ot/import  (Excel Sampel OT — ganti data tahun terpilih)
    - GET   /api/sampel-ot/summary | /sampel | /sampel/:id
    - POST  /api/sampel-sk/import  (Excel Sampel Suplemen Kesehatan)
    - GET   /api/sampel-sk/summary | /sampel | /sampel/:id
    - GET   /api/publik/kinerja/pilihan | /ringkasan | /sarana   (publik)
    ════════════════════════════════════════
    `);
    if (!info.verifikasi.startsWith('AKTIF')) {
        console.warn('    ⚠️  AUTH_VERIFIKASI=nonaktif — token TIDAK diperiksa. Jangan pakai di luar pengembangan.\n');
    }
});

module.exports = app;
