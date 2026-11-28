// components/realisasi-anggaran/helper.js
/**
 * HELPER — Dashboard Realisasi Keuangan (publik)
 * ----------------------------------------------
 * Formatter + label. Murni fungsi, tanpa state/API (konvensi
 * `components/<kelompok>/<modul>/helper.js`).
 *
 * Angka SELALU ditulis penuh dengan pemisah titik ribuan (16.816.295.000),
 * tidak disingkat "16,8 M" - permintaan pemilik aplikasi, karena angka
 * anggaran dipakai untuk mencocokkan dokumen.
 */

/** Nama bulan pendek untuk label grafik. */
export const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** 16816295000 -> "16.816.295.000" */
export function formatAngka(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return '0';
  const n = Number(nilai);
  if (!Number.isFinite(n)) return String(nilai);
  return n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

/** 99.44 -> "99,44%" */
/**
 * Versi ringkas untuk ruang sempit (mis. angka di tengah donat):
 * 565593844 -> "565,6 jt". Angka penuh selalu dipakai di tabel & tooltip.
 */
export function formatRingkas(nilai) {
  const n = Number(nilai) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 1 })} T`;
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return String(n);
}

export function formatPersen(nilai) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return '0%';
  // Bulatkan ke satu desimal. Tanpa ini, porsi donat tercetak sebagai
  // "99,27958462716224%" - angka panjang yang membuat baris legenda meluber
  // dan terasa mepet.
  const bulat = Math.round(n * 10) / 10;
  return `${String(bulat).replace('.', ',')}%`;
}

/** Tanggal pemutakhiran: 2026-11-27T09:00:52Z -> "27 November 2026" */
export function formatTanggal(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Uraian singkat kode akun belanja (jenis MAK). Bukan daftar resmi BAS -
 * hanya label bantu supaya pembaca awam tahu kelompok belanjanya.
 * Kode yang tidak dikenal ditampilkan apa adanya.
 */
export const URAIAN_AKUN = {
  511111: 'Belanja Gaji Pokok PNS',
  511119: 'Belanja Pembulatan Gaji PNS',
  511121: 'Belanja Tunj. Suami/Istri PNS',
  511122: 'Belanja Tunj. Anak PNS',
  511123: 'Belanja Tunj. Struktural PNS',
  511124: 'Belanja Tunj. Fungsional PNS',
  511125: 'Belanja Tunj. PPh PNS',
  511126: 'Belanja Tunj. Beras PNS',
  511129: 'Belanja Uang Makan PNS',
  511151: 'Belanja Tunjangan Umum PNS',
  521111: 'Belanja Keperluan Perkantoran',
  521114: 'Belanja Pengiriman Surat Dinas',
  521115: 'Belanja Honor Operasional Satuan Kerja',
  521119: 'Belanja Barang Operasional Lainnya',
  521211: 'Belanja Bahan',
  521213: 'Belanja Honor Output Kegiatan',
  521811: 'Belanja Barang Persediaan Barang Konsumsi',
  522141: 'Belanja Sewa',
  522151: 'Belanja Jasa Profesi',
  522191: 'Belanja Jasa Lainnya',
  523123: 'Belanja Pengadaan Barang',
  524111: 'Belanja Perjalanan Dinas Biasa',
  524113: 'Belanja Perjalanan Dinas Dalam Kota',
  524114: 'Belanja Perjalanan Dinas Paket Meeting Dalam Kota',
  524119: 'Belanja Perjalanan Dinas Paket Meeting Luar Kota',
  525111: 'Belanja Modal Peralatan dan Mesin',
  532111: 'Belanja Modal Peralatan dan Mesin - Lainnya',
};

/** Label untuk kode akun: "524111 - Belanja Perjalanan Dinas Biasa". */
export function labelAkun(kode) {
  const uraian = URAIAN_AKUN[kode];
  return uraian ? `${kode} - ${uraian}` : kode;
}

/** Potong label panjang untuk sumbu grafik. */
export function potong(teks, maks = 22) {
  const t = String(teks ?? '');
  return t.length > maks ? `${t.slice(0, maks - 1)}…` : t;
}