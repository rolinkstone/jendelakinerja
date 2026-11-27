// components/realisasi-anggaran/Container.js
/**
 * DASHBOARD REALISASI KEUANGAN — halaman PUBLIK /realisasi-anggaran
 * -----------------------------------------------------------------
 * Tata letak mengikuti desain acuan (tangkapan layar 851x719):
 *   1. Kepala: "BBPOM di Palangka Raya" kecil + judul besar, tanggal di kanan
 *   2. Empat kartu angka BERWARNA (navy, hijau, biru, cyan) berisi angka besar
 *      dan persentase dalam tanda kurung
 *   3. Dua panel tengah: perbandingan pagu/realisasi/sisa (batang) dan capaian
 *      serapan (cincin conic-gradient)
 *   4. Panel bawah: per jenis MAK, per kode kegiatan, per unit kerja
 *   5. Pita navy di kaki halaman
 *
 * Palet diambil dari PIKsel gambar acuan, bukan ditebak:
 *   navy #0b3d78 · hijau #006d30 · biru #005bac · cyan muda · latar #fdfdfe
 *
 * KENAPA CSS, BUKAN PUSTAKA CHART: proyek ini tidak memasang recharts, dan tiga
 * panel batang/cincin tidak sepadan dengan dependensi baru. Cincin memakai
 * `conic-gradient`; batang memakai lebar relatif terhadap nilai terbesar.
 *
 * ANGKA SELALU PENUH (16.816.295.000), tidak disingkat "16,8 M" - permintaan
 * pemilik aplikasi, karena angka anggaran dipakai mencocokkan dokumen.
 *
 * PUBLIK: hanya agregat. Kode COA & daftar MAK per baris ada di /data-realisasi
 * yang wajib login, dan endpoint-nya berbeda (/api/publik/realisasi).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FaWallet,
  FaCoins,
  FaPiggyBank,
  FaPercent,
  FaChartBar,
  FaBuilding,
  FaSpinner,
  FaSyncAlt,
  FaCalendarAlt,
  FaMoneyBillWave,
} from 'react-icons/fa';
import Navbar from '../navbar/Navbar';
import { BULAN_PENDEK, formatAngka, formatPersen, formatTanggal } from './helper';

/** Nilai kosong supaya render pertama tidak perlu null-check panjang. */
const KOSONG = {
  tahun: null,
  daftar_tahun: [],
  total: null,
  per_akun: [],
  per_komponen: [],
  per_unit: [],
  diperbarui: null,
};

/** Empat kartu angka — gradien diambil dari gambar acuan. */
const KARTU = [
  { label: 'Pagu Anggaran', ikon: FaWallet, dari: '#0b3d78', ke: '#14447d' },
  { label: 'Realisasi', ikon: FaCoins, dari: '#006d30', ke: '#16a34a' },
  { label: 'Sisa Pagu', ikon: FaPiggyBank, dari: '#005bac', ke: '#0066b3' },
  { label: 'Serapan', ikon: FaPercent, dari: '#0e7490', ke: '#22d3ee' },
];

export default function RealisasiAnggaranContainer() {
  const [data, setData] = useState(KOSONG);
  const [tahun, setTahun] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  // Bulan yang sedang disorot kursor di grafik bulanan (null = tidak ada).
  const [hoverBulan, setHoverBulan] = useState(null);

  const muat = useCallback(async (th) => {
    setMemuat(true);
    setGalat('');
    try {
      const qs = th ? `?tahun=${th}` : '';
      const r = await fetch(`/api/publik/realisasi${qs}`);
      const j = await r.json();
      if (!j.success) throw new Error(j.message || `HTTP ${r.status}`);
      setData(j.data);
      setTahun(String(j.data?.tahun ?? ''));
    } catch (e) {
      setGalat(`Data realisasi belum bisa dimuat: ${e.message}`);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    muat('');
  }, [muat]);

  const total = data.total || {};
  const adaData = !!data.total;

  // Nilai & catatan tiap kartu; persentase di dalam tanda kurung seperti desain.
  const nilaiKartu = [
    formatAngka(total.pagu),
    formatAngka(total.realisasi),
    formatAngka(total.sisa),
    formatPersen(total.persen_serapan),
  ];
  const catatanKartu = [
    'pagu awal',
    `(${formatPersen(total.persen_serapan)})`,
    // Dibulatkan dulu: 100 - 99.44 menghasilkan 0.5600000000000023 di JS
    // dan langsung tercetak di kartu kalau tidak dibulatkan.
    `(${formatPersen(Math.round((100 - (Number(total.persen_serapan) || 0)) * 100) / 100)})`,
    `${formatAngka(total.jumlah_mak)} MAK`,
  ];

  // ---- Grafik "Realisasi Terhadap Pagu per Jenis Belanja" ----
  // Panel ini membandingkan PAGU dengan REALISASI pada TAHUN AKTIF saja
  // (bukan antar tahun). Setiap jenis belanja punya dua batang:
  //   biru  = pagu
  //   hijau = realisasi
  const perJenis = (data.per_jenis_belanja || []).map((k) => {
    // Ambil baris tahun yang sedang aktif; kalau tidak ada, pakai yang terakhir.
    const t = k.tahun.find((x) => String(x.tahun) === String(data.tahun)) || k.tahun[k.tahun.length - 1] || {};
    return {
      kode: k.kode,
      label: k.label,
      pagu: Number(t.pagu) || 0,
      realisasi: Number(t.realisasi) || 0,
      persen_serapan: Number(t.persen_serapan) || 0,
    };
  });
  // Skala batang memakai PAGU terbesar, supaya realisasi selalu tampak lebih
  // pendek dari pagunya dan sisa ruang terbaca sebagai belum terserap.
  const maksJenis = Math.max(1, ...perJenis.map((k) => Math.max(k.pagu, k.realisasi)));
  // Skala grafik bulanan: nilai kumulatif terbesar (biasanya Desember).
  const maksBulan = Math.max(
    1,
    ...(data.per_bulan_belanja || []).map((b) => Number(b.kumulatif) || 0),
  );

  const maksAkun = Math.max(1, ...data.per_akun.map((a) => Number(a.pagu) || 0));

  return (
    <div className="flex min-h-screen flex-col bg-[#fdfdfe] dark:bg-[#0b1220]">
      <Navbar />

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-8 pt-6 sm:px-6">
        {/* ================= Kepala ================= */}
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e7ebf1] pb-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3c6493] dark:text-slate-400">
              BBPOM di Palangka Raya
            </p>
            <h1 className="mt-1 text-[25px] font-bold leading-tight text-[#0b3d78] dark:text-white sm:text-[27px]">
              Dashboard Realisasi Keuangan
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data.daftar_tahun.length > 0 && (
              <label className="flex items-center gap-1.5 rounded-full border border-[#e7ebf1] bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
                <FaCalendarAlt className="h-3 w-3 text-[#3c6493]" />
                <select
                  className="tnum bg-transparent text-[12px] font-semibold text-[#0b3d78] outline-none dark:text-slate-200"
                  value={tahun}
                  onChange={(e) => {
                    setTahun(e.target.value);
                    muat(e.target.value);
                  }}
                >
                  {data.daftar_tahun.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {data.diperbarui && (
              <span className="rounded-full bg-[#eef4fa] px-3 py-1.5 text-[11.5px] font-semibold text-[#30619c] dark:bg-white/[0.06] dark:text-slate-300">
                {formatTanggal(data.diperbarui)}
              </span>
            )}
            <button
              type="button"
              onClick={() => muat(tahun)}
              className="rounded-full border border-[#e7ebf1] bg-white p-2 text-[#3c6493] transition hover:bg-[#eef4fa] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              title="Muat ulang"
            >
              <FaSyncAlt className={`h-3 w-3 ${memuat ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {galat && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {galat}
          </p>
        )}

        {/* ================= Empat kartu angka ================= */}
        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KARTU.map((k, i) => {
            const Ikon = k.ikon;
            return (
              <div
                key={k.label}
                className="relative overflow-hidden rounded-2xl px-4 py-3.5 shadow-sm ring-1 ring-black/[0.03]"
                style={{ backgroundImage: `linear-gradient(135deg, ${k.dari} 0%, ${k.ke} 100%)` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/80">{k.label}</p>
                  <Ikon className="h-3.5 w-3.5 shrink-0 text-white/75" />
                </div>
                <p className="tnum mt-1.5 text-[19px] font-bold leading-tight text-white">
                  {memuat && !adaData ? '…' : nilaiKartu[i]}
                </p>
                <p className="tnum mt-0.5 text-[11px] font-medium text-white/75">
                  {memuat && !adaData ? '' : catatanKartu[i]}
                </p>
              </div>
            );
          })}
        </section>

        {!adaData && memuat && (
          <p className="mt-6 flex items-center justify-center gap-2 py-12 text-[13px] text-slate-400">
            <FaSpinner className="h-4 w-4 animate-spin" /> Memuat data realisasi…
          </p>
        )}
        {!adaData && !memuat && !galat && (
          <p className="mt-6 rounded-2xl bg-white py-12 text-center text-[13px] text-slate-400 ring-1 ring-black/[0.03]">
            Belum ada data realisasi anggaran yang diunggah.
          </p>
        )}

        {adaData && (
          <>
            {/* ================= Dua panel tengah ================= */}
            <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
              {/* --- Realisasi terhadap pagu per jenis belanja ---
                  Dua batang per jenis: PAGU (biru) dan REALISASI (hijau).
                  Tinggi relatif terhadap pagu terbesar, jadi sisa ruang di atas
                  batang hijau terbaca sebagai bagian yang belum terserap.
                  Angka penuh ditulis di tabel bawah - 12 digit tidak muat di
                  atas batang. */}
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03] dark:bg-white/[0.03] dark:ring-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[13px] font-bold text-[#0b3d78] dark:text-white">
                    Realisasi Belanja per Jenis Belanja
                  </h2>
                  <span className="rounded-full bg-[#eef4fa] px-2.5 py-1 text-[10.5px] font-semibold text-[#30619c] dark:bg-white/[0.06] dark:text-slate-300">
                    Tahun {data.tahun}
                  </span>
                </div>

                {/* Legenda: biru pagu, hijau realisasi */}
                <div className="mt-2 flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#0b3d78' }} />
                    Pagu
                  </span>
                  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#006d30' }} />
                    Realisasi
                  </span>
                </div>

                {/* Grafik batang */}
                <div
                  className="mt-4 flex items-end justify-around gap-3 border-b border-[#eef4fa] pb-1 dark:border-white/10"
                  style={{ height: 180 }}
                >
                  {perJenis.map((k) => (
                    <div key={k.kode} className="flex h-full flex-1 items-end justify-center gap-1.5">
                      {[
                        { nama: 'Pagu', nilai: k.pagu, warna: '#0b3d78' },
                        { nama: 'Realisasi', nilai: k.realisasi, warna: '#006d30' },
                      ].map((b) => (
                        <div
                          key={b.nama}
                          className="w-[26px] rounded-t-md"
                          style={{ height: `${Math.max(2, (b.nilai / maksJenis) * 100)}%`, backgroundColor: b.warna }}
                          title={`${k.label} — ${b.nama}: ${formatAngka(b.nilai)}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Label jenis belanja */}
                <div className="mt-1.5 flex justify-around gap-3">
                  {perJenis.map((k) => (
                    <div key={k.kode} className="flex-1 text-center">
                      <p className="truncate text-[10.5px] font-semibold text-slate-600 dark:text-slate-300" title={k.label}>
                        {k.label}
                      </p>
                      <p className="text-[9.5px] font-medium uppercase tracking-wider text-slate-400">({k.kode})</p>
                    </div>
                  ))}
                </div>

                {/* Tabel angka penuh: pagu, realisasi, serapan */}
                <table className="mt-3 w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#eef4fa] dark:border-white/10">
                      <th className="py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Jenis</th>
                      <th className="py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pagu</th>
                      <th className="py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Realisasi</th>
                      <th className="py-1 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Serapan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perJenis.map((k) => (
                      <tr key={k.kode} className="border-b border-[#eef4fa] last:border-0 dark:border-white/[0.06]">
                        <td className="py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{k.label}</td>
                        <td className="tnum py-1.5 text-right text-[11px] font-semibold text-[#0b3d78] dark:text-slate-100">
                          {formatAngka(k.pagu)}
                        </td>
                        <td className="tnum py-1.5 text-right text-[11px] font-bold text-[#006d30]">
                          {formatAngka(k.realisasi)}
                        </td>
                        <td className="tnum py-1.5 text-right text-[11px] text-slate-500 dark:text-slate-400">
                          {formatPersen(k.persen_serapan)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* --- Realisasi Pendapatan per Akun (MASIH KOSONG) ---
                  Dikosongkan dengan sengaja: berkas "Realisasi FA berdasarkan SP2D"
                  hanya memuat BELANJA (pagu, realisasi, sisa), tidak ada pendapatan.
                  Data pendapatan ada di ekspor SAKTI terpisah (ADK REALISASI
                  PENDAPATAN) yang belum diimpor ke aplikasi ini.
                  Jangan mengisi panel ini dengan angka belanja atau angka karangan -
                  pendapatan dan belanja adalah dua hal berbeda. Begitu tabel
                  pendapatan tersedia di backend, ganti placeholder di bawah dengan
                  daftar akun + nilai realisasinya. */}
              <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03] dark:bg-white/[0.03] dark:ring-white/10">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[13px] font-bold text-[#0b3d78] dark:text-white">
                    Realisasi Pendapatan per Akun
                  </h2>
                  <span className="rounded-full bg-[#f1f3f6] px-2.5 py-1 text-[10.5px] font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                    Belum tersedia
                  </span>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                  <FaMoneyBillWave className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                  <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                    Data pendapatan belum diunggah
                  </p>
                  <p className="max-w-[240px] text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                    Panel ini akan menampilkan realisasi pendapatan per akun setelah data SAKTI
                    pendapatan diimpor.
                  </p>
                </div>

                <p className="border-t border-[#eef4fa] pt-2.5 text-[10.5px] leading-snug text-slate-400 dark:border-white/10 dark:text-slate-500">
                  Sumber berkas: ekspor SAKTI <em>Realisasi Pendapatan</em> (belum tersedia).
                </p>
              </div>
            </section>

            {/* ================= Realisasi per bulan (2 kolom) =================
                KIRI: belanja - bersumber berkas ADK SAKTI yang punya TGLPOST,
                      jadi sebaran bulanannya nyata, bukan karangan.
                      Nilainya KUMULATIF (bertambah tiap bulan sampai Des).
                KANAN: pendapatan - sengaja kosong, data SAKTI pendapatan belum
                      diimpor. Jangan diisi angka belanja: pendapatan bukan
                      belanja. */}
            <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* ---------- KIRI: belanja per bulan ---------- */}
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03] dark:bg-white/[0.03] dark:ring-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[13px] font-bold text-[#0b3d78] dark:text-white">
                    Realisasi Belanja per Bulan
                  </h2>
                  <span className="rounded-full bg-[#eef4fa] px-2.5 py-1 text-[10.5px] font-semibold text-[#30619c] dark:bg-white/[0.06] dark:text-slate-300">
                    Kumulatif {data.tahun}
                  </span>
                </div>

                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                  Arahkan kursor (atau tekan Tab) ke batang untuk melihat angkanya.
                </p>

                {/* Grafik batang Jan-Des. Tinggi relatif terhadap nilai kumulatif
                    terbesar (biasanya Desember), bukan terhadap 100%. */}
                <div
                  className="relative mt-4 flex items-end justify-between gap-[3px] border-b border-[#eef4fa] pb-1 dark:border-white/10"
                  style={{ height: 170 }}
                  onMouseLeave={() => setHoverBulan(null)}
                >
                  {(data.per_bulan_belanja || []).map((b) => {
                    const tinggi = Math.max(1.5, (Number(b.kumulatif) / maksBulan) * 100);
                    const disorot = hoverBulan === b.bulan;
                    return (
                      <div
                        key={b.bulan}
                        className="group relative flex h-full flex-1 cursor-default items-end"
                        onMouseEnter={() => setHoverBulan(b.bulan)}
                        // Fokus keyboard: pengguna tanpa tetikus tetap bisa melihat angka.
                        tabIndex={0}
                        onFocus={() => setHoverBulan(b.bulan)}
                        onBlur={() => setHoverBulan(null)}
                        aria-label={`${BULAN_PENDEK[b.bulan - 1]}: kumulatif ${formatAngka(b.kumulatif)}`}
                      >
                        {/* Balon angka: muncul saat disorot, menggantung di atas batang. */}
                        {disorot && (
                          <div
                            className={[
                              'pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-lg bg-[#0b3d78] px-2 py-1.5 text-center shadow-lg',
                              // Batang pertama & terakhir tidak boleh memakai
                              // posisi tengah: balonnya akan keluar layar di
                              // ponsel (Jan kiri -8px, Des kanan 395px > 390px).
                              b.bulan === 1 ? 'left-0' : b.bulan === 12 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                            ].join(' ')}
                          >
                            <p className="text-[9.5px] font-semibold uppercase tracking-wider text-white/70">
                              {BULAN_PENDEK[b.bulan - 1]} {data.tahun}
                            </p>
                            <p className="tnum text-[11.5px] font-bold leading-tight text-white">
                              {formatAngka(b.kumulatif)}
                            </p>
                            <p className="tnum text-[9.5px] leading-tight text-white/70">
                              bulan ini {formatAngka(b.nilai)}
                            </p>
                          </div>
                        )}
                        <div
                          className={`w-full rounded-t-sm transition-colors ${
                            disorot ? 'bg-[#0b3d78]' : 'bg-[#006d30]'
                          }`}
                          style={{ height: `${tinggi}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Label bulan */}
                <div className="mt-1.5 flex justify-between gap-[3px]">
                  {BULAN_PENDEK.map((nama, idx) => (
                    <span key={nama} className="flex-1 text-center text-[8.5px] font-semibold uppercase tracking-tight text-slate-400">
                      {nama}
                    </span>
                  ))}
                </div>

                <p className="mt-2 border-t border-[#eef4fa] pt-2 text-[10.5px] leading-snug text-slate-400 dark:border-white/10 dark:text-slate-500">
                  Nilai kumulatif Jan s.d. Des — total s.d. Desember{' '}
                  <span className="tnum font-semibold text-[#006d30]">
                    {formatAngka((data.per_bulan_belanja || [])[11]?.kumulatif || 0)}
                  </span>
                  . Sumber: ADK Realisasi Belanja SAKTI (punya tanggal transaksi), sehingga
                  totalnya bisa sedikit berbeda dengan tabel MAK yang berasal dari berkas SP2D.
                </p>
              </div>

              {/* ---------- KANAN: pendapatan per bulan (KOSONG) ---------- */}
              <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03] dark:bg-white/[0.03] dark:ring-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[13px] font-bold text-[#0b3d78] dark:text-white">
                    Realisasi Pendapatan per Bulan
                  </h2>
                  <span className="rounded-full bg-[#f1f3f6] px-2.5 py-1 text-[10.5px] font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                    Belum tersedia
                  </span>
                </div>

                {/* Kerangka grafik kosong dengan sumbu bulan, supaya bentuknya
                    sudah sama dengan panel kiri saat datanya nanti masuk. */}
                <div className="relative mt-4 border-b border-[#eef4fa] dark:border-white/10" style={{ height: 170 }}>
                  <div className="flex h-full items-end justify-between gap-[3px]">
                    {BULAN_PENDEK.map((nama) => (
                      <div key={nama} className="flex-1 rounded-t-sm bg-[#eef4fa] dark:bg-white/[0.05]" style={{ height: '6%' }} />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <FaMoneyBillWave className="mx-auto h-5 w-5 text-slate-300 dark:text-slate-600" />
                      <p className="mt-1 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                        Data pendapatan belum diunggah
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-1.5 flex justify-between gap-[3px]">
                  {BULAN_PENDEK.map((nama) => (
                    <span key={nama} className="flex-1 text-center text-[8.5px] font-semibold uppercase tracking-tight text-slate-400">
                      {nama}
                    </span>
                  ))}
                </div>

                <p className="mt-2 border-t border-[#eef4fa] pt-2 text-[10.5px] leading-snug text-slate-400 dark:border-white/10 dark:text-slate-500">
                  Sumber berkas: ekspor SAKTI <em>ADK Realisasi Pendapatan</em> (belum diimpor).
                </p>
              </div>
            </section>

            {/* ================= Per unit kerja ================= */}
            <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.per_unit.map((u) => (
                <div
                  key={u.unit_kerja}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.03] dark:bg-white/[0.03] dark:ring-white/10"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                      <FaBuilding className="h-2.5 w-2.5" /> Unit {u.unit_kerja}
                    </p>
                    <p className="tnum mt-1 truncate text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                      {formatAngka(u.realisasi)}
                      <span className="font-normal text-slate-400"> / {formatAngka(u.pagu)}</span>
                    </p>
                  </div>
                  <p className="tnum shrink-0 text-[16px] font-bold text-[#006d30]">{formatPersen(u.persen_serapan)}</p>
                </div>
              ))}
            </section>
          </>
        )}
      </main>

      {/* ================= Kaki halaman ================= */}
      <footer className="bg-[#0b3d78] px-4 py-3">
        <p className="mx-auto max-w-[1180px] text-center text-[11px] leading-relaxed text-white/80">
          Rekap agregat anggaran dan realisasi — Balai Besar POM di Palangka Raya. Rincian per MAK hanya tersedia di
          dashboard internal (wajib login).
        </p>
      </footer>
    </div>
  );
}