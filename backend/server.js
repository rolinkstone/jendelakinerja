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
const publicRoutes = ['/api/login', '/api/health', '/api/publik'];

const authMiddleware = async (req, res, next) => {
    if (publicRoutes.some(route => req.path.startsWith(route))) {
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

// Router Produksi — Obat Tradisional — impor laporan Excel per tahun (butuh
// Bearer token; frontend memanggilnya lewat proxy
// pages/api/produksi-ot/[...path].js).
app.use('/api/produksi-ot', require('./routes/produksi-ot'));

// Router Produksi — Pangan IRT (CPPB-IRT) — impor laporan Excel per tahun
// (butuh Bearer token; frontend memanggilnya lewat proxy
// pages/api/produksi-irt/[...path].js).
app.use('/api/produksi-irt', require('./routes/produksi-irt'));

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
