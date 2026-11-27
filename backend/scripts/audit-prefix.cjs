// scripts/_audit-prefix.cjs — SEMENTARA. Pastikan SETIAP router yang di-mount
// juga terdaftar di PREFIKS_API. Kalau tidak, authMiddleware menganggapnya
// "alamat tidak dikenal" lalu meneruskan tanpa token — router itu terbuka.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

// Hanya baris yang TIDAK diawali komentar.
const barisKode = server.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');

const mount = [...barisKode.matchAll(/app\.use\(\s*'(\/api\/[^']+)'\s*,\s*require\('\.\/routes\/([^']+)'\)/g)].map((m) => ({
  prefix: m[1],
  berkas: m[2],
}));

const daftar = (nama) => {
  const m = barisKode.match(new RegExp(`const ${nama} = \\[([\\s\\S]*?)\\];`));
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};
const prefiks = daftar('PREFIKS_API');
const publik = daftar('publicRoutes');

console.log('router di-mount :', mount.length);
console.log('PREFIKS_API     :', prefiks.length);
console.log('publicRoutes    :', publik.length);

let lubang = 0;
console.log('\n=== COCOKAN PREFIX ===');
mount.forEach((m) => {
  const ada = prefiks.some((p) => p === m.prefix || m.prefix.startsWith(p + '/'));
  if (!ada) lubang++;
  console.log(`  ${m.prefix.padEnd(28)} ${ada ? 'terdaftar' : '>>> TIDAK TERDAFTAR — TANPA PENJAGA <<<'}`);
});

console.log('\n=== PREFIX TERDAFTAR TAPI TIDAK ADA ROUTER-NYA (sisa/palsu) ===');
prefiks.forEach((p) => {
  const ada = mount.some((m) => m.prefix === p || m.prefix.startsWith(p + '/'));
  if (!ada) console.log('  ', p);
});

console.log('\nSIMPULAN:', lubang === 0 ? 'semua router terdaftar → semua lewat authMiddleware + keycloakAuth' : `${lubang} router TIDAK terdaftar`);
process.exit(lubang === 0 ? 0 : 1);