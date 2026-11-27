// scripts/_warna.cjs — SEMENTARA. Membaca warna dari PNG tanpa pustaka:
// parse header, inflate IDAT (zlib bawaan Node), unfilter scanline, lalu
// laporkan warna dominan + warna di titik/area tertentu.
// Dipakai karena vision model dinonaktifkan - palet harus diambil dari piksel.
const fs = require('fs');
const zlib = require('zlib');

const berkas = process.argv[2];
if (!berkas) {
  console.error('pakai: node _warna.cjs <berkas.png>');
  process.exit(1);
}

const buf = fs.readFileSync(berkas);

// ---- 1. Parse chunk PNG ----
let pos = 8; // lewati signature
let lebar = 0;
let tinggi = 0;
let kedalaman = 0;
let tipeWarna = 0;
const idat = [];

while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const tipe = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (tipe === 'IHDR') {
    lebar = data.readUInt32BE(0);
    tinggi = data.readUInt32BE(4);
    kedalaman = data[8];
    tipeWarna = data[9];
  } else if (tipe === 'IDAT') {
    idat.push(data);
  } else if (tipe === 'IEND') {
    break;
  }
  pos += 12 + len;
}

if (kedalaman !== 8 || (tipeWarna !== 2 && tipeWarna !== 6)) {
  console.log(`DIPERLUKAN PNG 8-bit RGB/RGBA; berkas ini depth=${kedalaman} colorType=${tipeWarna}`);
  process.exit(2);
}

const kanal = tipeWarna === 6 ? 4 : 3;
const mentah = zlib.inflateSync(Buffer.concat(idat));
const lebarBaris = lebar * kanal;
const piksel = Buffer.alloc(tinggi * lebarBaris);

// ---- 2. Unfilter (tipe 0..4) ----
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

for (let y = 0; y < tinggi; y++) {
  const tipe = mentah[y * (lebarBaris + 1)];
  const asal = y * (lebarBaris + 1) + 1;
  for (let x = 0; x < lebarBaris; x++) {
    const nil = mentah[asal + x];
    const kiri = x >= kanal ? piksel[y * lebarBaris + x - kanal] : 0;
    const atas = y > 0 ? piksel[(y - 1) * lebarBaris + x] : 0;
    const kiriAtas = y > 0 && x >= kanal ? piksel[(y - 1) * lebarBaris + x - kanal] : 0;
    let hasil;
    switch (tipe) {
      case 0: hasil = nil; break;
      case 1: hasil = nil + kiri; break;
      case 2: hasil = nil + atas; break;
      case 3: hasil = nil + Math.floor((kiri + atas) / 2); break;
      case 4: hasil = nil + paeth(kiri, atas, kiriAtas); break;
      default: throw new Error(`tipe filter tidak dikenal: ${tipe}`);
    }
    piksel[y * lebarBaris + x] = hasil & 0xff;
  }
}

const rgbDi = (x, y) => {
  const i = y * lebarBaris + x * kanal;
  return [piksel[i], piksel[i + 1], piksel[i + 2]];
};
const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

// ---- 3. Warna dominan (kuantisasi 16 level per kanal) ----
const hitung = new Map();
for (let y = 0; y < tinggi; y += 2) {
  for (let x = 0; x < lebar; x += 2) {
    const [r, g, b] = rgbDi(x, y);
    const kunci = `${r >> 4},${g >> 4},${b >> 4}`;
    const v = hitung.get(kunci) || { n: 0, r: 0, g: 0, b: 0 };
    v.n++; v.r += r; v.g += g; v.b += b;
    hitung.set(kunci, v);
  }
}
const total = [...hitung.values()].reduce((a, v) => a + v.n, 0);
const dominan = [...hitung.values()]
  .sort((a, b) => b.n - a.n)
  .slice(0, 14)
  .map((v) => ({
    warna: hex([Math.round(v.r / v.n), Math.round(v.g / v.n), Math.round(v.b / v.n)]),
    persen: Math.round((v.n / total) * 1000) / 10,
  }));

console.log(`DIMENSI: ${lebar}x${tinggi} | kanal: ${kanal}`);
console.log('\n=== WARNA DOMINAN ===');
dominan.forEach((d) => console.log(`  ${d.warna}  ${String(d.persen).padStart(5)}%`));

// ---- 4. Contoh warna di titik penting ----
console.log('\n=== CONTOH TITIK (x,y -> warna) ===');
const titik = [
  [4, 4], [lebar - 5, 4], [4, tinggi - 5], [lebar - 5, tinggi - 5],
  [Math.round(lebar / 2), 4],
  [Math.round(lebar * 0.08), 120], [Math.round(lebar * 0.32), 120],
  [Math.round(lebar * 0.56), 120], [Math.round(lebar * 0.82), 120],
  [Math.round(lebar / 2), Math.round(tinggi * 0.55)],
  [Math.round(lebar / 2), Math.round(tinggi * 0.9)],
];
titik.forEach(([x, y]) => {
  const w = rgbDi(Math.min(x, lebar - 1), Math.min(y, tinggi - 1));
  console.log(`  ${String(x).padStart(4)},${String(y).padStart(4)} -> ${hex(w)}`);
});