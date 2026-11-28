// scripts/_cek-ikon.cjs — SEMENTARA. Cari ikon react-icons yang DIPAKAI di JSX
// tetapi TIDAK diimpor. Kasus seperti ini lolos dari build (Next tidak memeriksa
// simbol) dan baru meledak di peramban: "Application error: a client-side
// exception has occurred". Komponen undefined membuat React melempar saat render.
const fs = require('fs');
const path = require('path');

const akar = path.join(__dirname, '..', 'components');

/** Buang komentar blok dan baris agar isi impor bisa dibaca apa adanya. */
const tanpaKomentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function jelajah(dir) {
  const hasil = [];
  for (const nama of fs.readdirSync(dir)) {
    const p = path.join(dir, nama);
    const st = fs.statSync(p);
    if (st.isDirectory()) hasil.push(...jelajah(p));
    else if (nama.endsWith('.js')) hasil.push(p);
  }
  return hasil;
}

let masalah = 0;
for (const berkas of jelajah(akar)) {
  const asli = fs.readFileSync(berkas, 'utf8');
  if (!/react-icons/.test(asli)) continue;
  const s = tanpaKomentar(asli);

  // Semua nama yang diimpor dari react-icons/fa
  const diimpor = new Set();
  const re = /import\s*\{([^}]*)\}\s*from\s*'react-icons\/fa'/g;
  let m;
  while ((m = re.exec(s))) {
    m[1].split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => diimpor.add(x));
  }

  // Semua yang dipakai sebagai komponen <FaXxx
  const dipakai = new Set([...s.matchAll(/<((?:Fa|Md|Io|Bi)[A-Za-z0-9]+)/g)].map((x) => x[1]));

  const kurang = [...dipakai].filter((x) => !diimpor.has(x));
  if (kurang.length) {
    masalah++;
    console.log(`  ${path.relative(path.join(__dirname, '..'), berkas)}`);
    console.log(`     tidak diimpor: ${kurang.join(', ')}`);
  }
}

console.log(masalah === 0 ? 'OK: semua ikon yang dipakai sudah diimpor' : `${masalah} berkas bermasalah`);
process.exit(masalah === 0 ? 0 : 1);