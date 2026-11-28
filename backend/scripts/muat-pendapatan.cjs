// scripts/muat-pendapatan.cjs
// Memuat berkas ADK Realisasi Pendapatan langsung ke database, tanpa lewat HTTP.
// Dipakai untuk pemuatan awal dan untuk menguji parser tanpa perlu sesi Keycloak.
//
//   node scripts/muat-pendapatan.cjs "C:/path/ADK REALISASI PENDAPATAN ....csv"
require('dotenv').config();
const fs = require('fs');
const { simpanPendapatan, rekapPendapatan, NAMA_AKUN } = require('../lib/pendapatan');

const berkas = process.argv[2];
if (!berkas) {
  console.error('Pemakaian: node scripts/muat-pendapatan.cjs "<berkas.csv>"');
  process.exit(1);
}

(async () => {
  try {
    const isi = fs.readFileSync(berkas, 'utf8');
    const hasil = await simpanPendapatan({ isi, namaBerkas: berkas.split(/[\\/]/).pop(), diunggahOleh: 'skrip' });

    console.log('berkas     :', berkas.split(/[\\/]/).pop());
    console.log('tahun      :', hasil.tahun);
    console.log('rentang    :', hasil.rentang || '-');
    console.log('dokumen    :', hasil.dokumen);
    console.log('baris sah  :', hasil.barisSah, '| dilewati:', hasil.dilewati);
    console.log('bulan      :', hasil.bulan.join(', '));
    console.log('total      :', hasil.total.toLocaleString('id-ID'));

    const rekap = await rekapPendapatan(hasil.tahun);
    console.log('\nper akun:');
    for (const a of rekap.perAkun) {
      console.log(`  ${a.akun}  ${String(a.total.toLocaleString('id-ID')).padStart(16)}  ${a.nama}`);
    }
    console.log('\nper bulan (kumulatif):');
    const NM = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    for (const b of rekap.perBulan) {
      if (b.nilai || b.kumulatif) {
        console.log(`  ${NM[b.bulan - 1]}  ${String(b.nilai.toLocaleString('id-ID')).padStart(15)}  kum ${b.kumulatif.toLocaleString('id-ID')}`);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error('GAGAL:', e.message);
    process.exit(1);
  }
})();
