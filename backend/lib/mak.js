// lib/mak.js
/**
 * PEMBENTUK KODE MAK (Mata Anggaran Kegiatan) DARI KODE COA SAKTI
 * ----------------------------------------------------------------
 * Satu-satunya tempat aturan ini ditulis. Dipakai oleh:
 *   - routes/anggaran-realisasi.js   (saat impor, kolom `mak` diisi)
 *   - lib/anggaran.js                (saat membaca rekap)
 * Kalau aturan berubah, ubah di sini lalu jalankan ulang impor / backfill -
 * jangan menyalin fungsi ini ke tempat lain (dulu tabel kepatuhan pernah
 * digandakan dan gayanya langsung melenceng satu sama lain).
 *
 * Bentuk kode COA SAKTI: 16 segmen dipisah titik.
 *   0   432872        kode K/L
 *   1   043           kode Eselon I
 *   2   524111        KODE AKUN (6 digit)
 *   3   06301DR       5 digit kode satker + 2 huruf sub-unit (DR / WA)
 *   4   3165BDB       4 digit unit kerja + 3 huruf KOMPONEN (BDB, QCD, ...)
 *   5   A000000001
 *   6   00000
 *   7   2
 *   8   1451
 *   9   2
 *   10  000000
 *   11  000000
 *   12  001           3 karakter (bisa U32 / 994)
 *   13  051           3 digit
 *   14  0A            2 karakter (0A..0Z)
 *   15  000019        nomor urut
 *
 * Contoh:
 *   MASUKAN  432872.043.524111.06301DR.3165BDB.A000000001.00000.2.1451.2.000000.000000.001.051.0A.000019
 *   KELUARAN 3165.BDB.001.051.524111.A
 *             |    |   |   |   |     +-- huruf dari segmen 14 ("0A" -> "A")
 *             |    |   |   |   +-------- kode akun, segmen 2, apa adanya
 *             |    |   |   +------------ segmen 13
 *             |    |   +---------------- segmen 12
 *             |    +-------------------- 3 huruf komponen, segmen 4
 *             +------------------------- 4 digit unit kerja, segmen 4
 *
 * Huruf penutup (A/B/C/...) dipakai sebagai pembeda terakhir. Ia diambil dari
 * SEGMEN 14 (bukan dari kode akun), jadi dua baris dengan unit, komponen, dan
 * akun sama tetap bisa dibedakan bila segmen 14-nya berbeda.
 */

/** Ambil segmen ke-`i` (0-based); string kosong bila tidak ada. */
function segmen(bagian, i) {
  return bagian[i] || '';
}

/**
 * Ubah satu kode COA menjadi kode MAK.
 * Mengembalikan null bila COA tidak bisa dipecah dengan benar - pemanggil
 * wajib memperlakukannya sebagai baris bermasalah, bukan diam-diam menyimpan
 * MAK kosong.
 */
function makDariCoa(coa) {
  const kode = String(coa ?? '').trim();
  if (!kode) return null;

  const b = kode.split('.');
  // Segmen 2, 3, 4, 12, 13, 14 wajib ada. Kalau kurang, jangan menebak.
  if (b.length < 15) return null;

  const akun = segmen(b, 2);          // 524111
  const satkerUnit = segmen(b, 3);    // 06301DR
  const unitKomponen = segmen(b, 4);  // 3165BDB
  const seg12 = segmen(b, 12);        // 001
  const seg13 = segmen(b, 13);        // 051
  const seg14 = segmen(b, 14);        // 0A

  const unitKerja = unitKomponen.slice(0, 4);     // 3165
  const komponen = unitKomponen.slice(4);         // BDB / QCD / ...
  // Huruf penutup: ambil huruf TERAKHIR dari segmen 14, jadi "0A" -> "A",
  // "0B" -> "B". Kalau segmen 14 tidak memuat huruf sama sekali, pakai apa
  // adanya supaya hasilnya tetap bisa dilacak.
  const huruf = /[A-Za-z]/.test(seg14) ? seg14.match(/[A-Za-z]/g).pop().toUpperCase() : seg14;

  const bagian = [unitKerja, komponen, seg12, seg13, akun, huruf].filter((x) => x !== '');
  if (bagian.length < 6) return null;
  return bagian.join('.');
}

/** Pecah MAK kembali jadi kolom-kolomnya (untuk pengurutan / pengelompokan). */
function pecahMak(mak) {
  const b = String(mak ?? '').split('.');
  return {
    mak: String(mak ?? ''),
    unit_kerja: b[0] || '',
    komponen: b[1] || '',
    seg12: b[2] || '',
    seg13: b[3] || '',
    akun: b[4] || '',
    huruf: b[5] || '',
  };
}

module.exports = { makDariCoa, pecahMak };
