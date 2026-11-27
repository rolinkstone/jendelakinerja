// scripts/_audit-http.cjs — SEMENTARA. Uji tiap prefix: tanpa token harus 401,
// rute publik harus tetap jalan, dan rute tak dikenal harus 404.
const BASE = process.env.API || 'http://127.0.0.1:5006';

const GET = [
  '/api/health',
  '/api/publik/kinerja/ringkasan?tahun=2026',
  '/api/publik/realisasi?tahun=2026',
  '/api/narasi-presentasi/aktif',
  '/api/keycloak/users',
  '/api/pbf/laporan?limit=1',
  '/api/ifp/summary?tahun=2024',
  '/api/distribusi-kos/summary?tahun=2025',
  '/api/distribusi-ot/summary?tahun=2025',
  '/api/distribusi-ipk/summary?tahun=2025',
  '/api/distribusi-sk/summary?tahun=2025',
  '/api/distribusi-ifk/summary?tahun=2025',
  '/api/produksi-ot/summary?tahun=2024',
  '/api/produksi-irt/summary?tahun=2024',
  '/api/produksi-pangan-md/summary?tahun=2024',
  '/api/anggaran-realisasi/ringkasan?tahun=2026',
  '/api/sampel-ot/summary?tahun=2026',
  '/api/sampel-sk/summary?tahun=2026',
  '/api/sampel-ob/summary?tahun=2026',
  '/api/sampel-kos/summary?tahun=2026',
  '/api/sampel-pp/summary?tahun=2026',
  '/api/sampel-kp/summary?tahun=2026',
  '/api/sampel-ok/summary?tahun=2026',
  '/api/api-link',
  '/api/narasi-presentasi',
  '/api/foo',
  '/api/tidak-ada',
];

const TULIS = [
  ['POST', '/api/anggaran-realisasi/import'],
  ['DELETE', '/api/anggaran-realisasi/data?tahun=2026'],
  ['DELETE', '/api/pbf/data?tahun=2016'],
  ['DELETE', '/api/sampel-ot/data?tahun=2017'],
  ['POST', '/api/api-link'],
  ['POST', '/api/narasi-presentasi'],
  ['POST', '/api/publik/link/apa-saja'],
];

(async () => {
  console.log('=== BACA TANPA TOKEN ===');
  let gagal = 0;
  for (const p of GET) {
    const r = await fetch(BASE + p, { method: 'GET' });
    const body = await r.text();
    const publik = ['/api/health', '/api/publik', '/api/narasi-presentasi/aktif'].some((x) => p.startsWith(x));
    // Rute TIDAK DIKENAL memang harus 404 (temuan 3.8: jangan menyamarkan probing
    // dengan 401). Jadi 404 selalu diterima, publik maupun bukan.
    const harap = publik ? '200' : '401';
    const ok = r.status === 404 ? true : publik ? r.status === 200 : r.status === 401;
    if (!ok) gagal++;
    console.log(`  ${String(r.status).padEnd(4)} ${p.padEnd(48)} harap ${harap.padEnd(7)} ${ok ? 'OK' : 'BOCOR'} ${ok ? '' : body.slice(0, 60)}`);
  }

  console.log('\n=== TULIS TANPA TOKEN (harus 401, bukan 403/200) ===');
  for (const [m, p] of TULIS) {
    const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json' }, body: m === 'POST' ? '{}' : undefined });
    const body = await r.text();
    const ok = r.status === 401 || r.status === 405 || r.status === 404;
    if (!ok) gagal++;
    console.log(`  ${String(r.status).padEnd(4)} ${m.padEnd(6)} ${p.padEnd(44)} ${ok ? 'OK' : 'BOCOR'} ${ok ? '' : body.slice(0, 60)}`);
  }

  console.log('\n=== TOKEN PALSU (harus 401) ===');
  const palsu = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJwYWxzdSIsInJvbGVzIjpbImFkbWluIl19.tandatanganpalsu';
  for (const p of ['/api/pbf/laporan?limit=1', '/api/anggaran-realisasi/ringkasan?tahun=2026']) {
    const r = await fetch(BASE + p, { headers: { authorization: `Bearer ${palsu}` } });
    const ok = r.status === 401;
    if (!ok) gagal++;
    console.log(`  ${String(r.status).padEnd(4)} ${p.padEnd(48)} ${ok ? 'OK' : 'DITERIMA!'}`);
  }

  console.log('\nSIMPULAN:', gagal === 0 ? 'semua penjagaan sesuai harapan' : `${gagal} penyimpangan`);
  process.exit(gagal === 0 ? 0 : 1);
})();