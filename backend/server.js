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
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5006;

// ========== MIDDLEWARE DASAR ==========
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

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
const publicBacaRoutes = [
    '/api/pbf',
    '/api/ifp',
    '/api/distribusi-kos',
    '/api/distribusi-ot',
    '/api/distribusi-ipk',
    '/api/distribusi-sk',
    '/api/distribusi-ifk',
    '/api/produksi-ot',
    '/api/produksi-irt',
    '/api/produksi-pangan-md',
    '/api/sampel' // mencakup sampel-ot, -sk, -ob, -kos, -pp, -kp
];

/** Isi req.user bila klien mengirim Bearer sah; kembalikan false bila tidak. */
const bacaBearer = (req) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return false;
    try {
        const decoded = jwt.decode(header.slice(7));
        if (decoded && (!decoded.exp || decoded.exp > Date.now() / 1000)) {
            req.user = {
                id: decoded.sub,
                username: decoded.preferred_username || decoded.email,
                email: decoded.email,
                name: decoded.name,
                roles: decoded.realm_access?.roles || []
            };
            return true;
        }
    } catch {
        // Token rusak → diperlakukan sebagai tamu
    }
    return false;
};

const authMiddleware = async (req, res, next) => {
    if (publicRoutes.some(route => req.path.startsWith(route))) {
        // Route publik tetap publik, TETAPI bila klien mengirim Bearer token yang
        // sah, identitasnya dipakai. Diperlukan fitur Link API: link berlabel
        // 'private' ditolak tanpa token, sedangkan link 'publik' tetap jalan
        // tanpa token (lihat routes/link-api.js).
        bacaBearer(req);
        return next();
    }

    // Modul data publik: cukup untuk BACA. Menulis (impor/ubah/hapus) tetap
    // harus lewat pemeriksaan token di bawah.
    const bacaSaja = req.method === 'GET' || req.method === 'HEAD';
    if (bacaSaja && publicBacaRoutes.some(route => req.path.startsWith(route))) {
        bacaBearer(req);
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = authHeader.slice(7);
    try {
        const decoded = jwt.decode(token);
        if (!decoded || (decoded.exp && decoded.exp < Date.now() / 1000)) {
            return res.status(401).json({ success: false, message: 'Token invalid or expired' });
        }

        req.user = {
            id: decoded.sub,
            username: decoded.preferred_username || decoded.email,
            email: decoded.email,
            name: decoded.name,
            roles: decoded.realm_access?.roles || []
        };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

app.use(authMiddleware);

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
app.listen(PORT, () => {
    console.log(`
    ════════════════════════════════════════
    🚀 Server running on port ${PORT}
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
});

module.exports = app;
