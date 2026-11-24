// components/jendela-kinerja/Container.js
/**
 * DASHBOARD PUBLIK "JENDELA KINERJA" (di luar dashboard ber-SSO)
 * --------------------------------------------------------------
 * Halaman /jendela-kinerja: peta Kalimantan Tengah per kab/kota + filter
 * tahun, bulan, produksi/distribusi, dan jenis sarana.
 *
 * Data diambil dari route publik backend lewat proxy pages/api/publik/[...path].js
 * (backend/routes/publik.js) — hanya rekap angka & nama sarana, tanpa temuan.
 *
 * Konvensi modul tetap dipakai: logika + tampilan di Container, formatter di
 * helper, peta di Peta.js, halaman tipis di pages/jendela-kinerja/index.js.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FaSyncAlt,
  FaFilter,
  FaMapMarkedAlt,
  FaBuilding,
  FaTruck,
  FaIndustry,
  FaLayerGroup,
  FaExclamationTriangle,
  FaChartBar,
  FaClipboardList,
} from 'react-icons/fa';
import { BRAND, BrandMark } from '../Brand';
import Navbar from '../navbar/Navbar';
import LauraAI from './LauraAI';
import Peta from './Peta';
import RincianKabupatenModal from './Modal';
import SampelLab from './SampelLab';
import KepatuhanKomoditas from './KepatuhanKomoditas';
import {
  PETA,
  JUDUL,
  SUBJUDUL,
  FILTER_KOSONG,
  angka,
  formatAngka,
  formatPersen,
  gayaIndeks,
  indeksKepatuhan,
  namaPendek,
  petaKabupaten,
  maksimum,
  queryFilter,
  labelFilter,
} from './helper';

/** Batas jumlah sarana di modal rincian per kab/kota. */
const LIMIT_RINCIAN = 200;

export default function Container() {
  const [pilihan, setPilihan] = useState(null);
  const [ringkasan, setRingkasan] = useState(null);
  const [detail, setDetail] = useState(null); // rincian sarana satu kab/kota (modal)
  // Hasil pengujian laboratorium (modul Sampel) — hanya ikut filter tahun,
  // karena berkas sampel tidak menggreding sarana per kab/kota.
  const [sampel, setSampel] = useState(null);
  const [filter, setFilter] = useState({ ...FILTER_KOSONG });
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState(null);
  // ---- Opsi filter (tahun/bulan/kegiatan/jenis/kab) ----
  const muatPilihan = useCallback(async (tahun) => {
    try {
      const r = await fetch(`/api/publik/kinerja/pilihan${tahun ? `?tahun=${tahun}` : ''}`);
      const j = await r.json();
      if (j.success) setPilihan(j.data);
    } catch (_) {
      /* opsi gagal dimuat: filter tetap bisa dipakai dengan nilai kosong */
    }
  }, []);

  // ---- Rekap (peta + kartu angka) ----
  const muatRingkasan = useCallback(async (f) => {
    const r = await fetch(`/api/publik/kinerja/ringkasan${queryFilter(f)}`);
    const j = await r.json();
    if (!j.success) throw new Error(j.message || 'Gagal memuat ringkasan');
    setRingkasan(j.data);
  }, []);

  // ---- Hasil pengujian laboratorium (seluruh modul Sampel) ----
  const muatSampel = useCallback(async (tahun) => {
    // Bagian ini pelengkap: kalau gagal, dashboard tetap tampil apa adanya.
    //
    // Tahun filter halaman ini milik modul SARANA (default = tahun sarana
    // terbaru, mis. 2026). Modul sampel baru punya data 2024 — kalau dipaksa
    // ikut tahun filter, bagian ini kosong padahal sampelnya ada. Jadi:
    // tahun filter dipakai selama benar-benar ada sampelnya; kalau tidak,
    // tampilkan seluruh tahun + tandai `lintas_tahun` supaya labelnya jujur.
    try {
      const ambil = async (q) => {
        const r = await fetch(`/api/publik/kinerja/sampel${q}`);
        const j = await r.json();
        return j.success ? j.data : null;
      };
      let d = await ambil(tahun ? `?tahun=${tahun}` : '');
      // Tanpa filter tahun, yang ditampilkan memang seluruh tahun — labelnya
      // harus bilang begitu, jangan mencomot tahun pertama sebagai judul.
      let lintas = !tahun;
      if (tahun && !angka(d?.total?.sampel) && (d?.daftar_tahun || []).length > 0) {
        d = await ambil('');
        lintas = true;
      }
      if (d) setSampel({ ...d, lintas_tahun: lintas });
    } catch (_) {
      /* diamkan: bukan data inti halaman */
    }
  }, []);

  // ---- Rincian sarana satu kab/kota (dipakai kolom Aksi) ----
  const bukaDetail = useCallback(
    async (kab) => {
      setDetail({ kab, memuat: true, galat: null, total: 0, baris: [] });
      try {
        const q = new URLSearchParams({
          ...filter,
          kab,
          page: '1',
          limit: String(LIMIT_RINCIAN),
        });
        const r = await fetch(`/api/publik/kinerja/sarana?${q.toString()}`);
        const j = await r.json();
        if (!j.success) throw new Error(j.message || 'Gagal memuat rincian sarana');
        setDetail({ kab, memuat: false, galat: null, total: j.data.total, baris: j.data.baris });
      } catch (e) {
        setDetail({ kab, memuat: false, galat: e.message, total: 0, baris: [] });
      }
    },
    [filter],
  );

  // Muat pertama: ambil opsi, lalu pilih tahun terbaru sebagai default.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/publik/kinerja/pilihan');
        const j = await r.json();
        if (!j.success) throw new Error(j.message || 'Gagal memuat pilihan filter');
        setPilihan(j.data);
        const tahunTerbaru = j.data.tahun?.[0]?.tahun ? String(j.data.tahun[0].tahun) : '';
        setFilter((f) => ({ ...f, tahun: tahunTerbaru }));
      } catch (e) {
        setGalat(e.message);
        setMemuat(false);
      }
    })();
  }, []);

  // Setiap filter berubah → muat ulang rekap (peta, kartu angka, tabel per kab/kota).
  useEffect(() => {
    if (pilihan === null) return undefined; // tunggu opsi siap (tahun default sudah dipasang)
    let batal = false;
    (async () => {
      setMemuat(true);
      setGalat(null);
      try {
        // Ringkasan + rekap sampel dijalankan bersamaan; kegagalan sampel
        // ditelan sendiri di dalam muatSampel, jadi `galat` tetap milik
        // ringkasan (data inti halaman).
        await Promise.all([muatRingkasan(filter), muatSampel(filter.tahun)]);
      } catch (e) {
        if (!batal) setGalat(e.message);
      } finally {
        if (!batal) setMemuat(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, [filter, pilihan, muatRingkasan, muatSampel]);

  const ubahFilter = (kunci, nilai) => {
    setFilter((f) => ({ ...f, [kunci]: nilai }));
    if (kunci === 'tahun') muatPilihan(nilai);
  };

  const perKab = useMemo(() => petaKabupaten(ringkasan?.per_kab_kota), [ringkasan]);
  const maks = useMemo(() => maksimum(ringkasan?.per_kab_kota), [ringkasan]);
  const total = ringkasan?.total || {};

  // Slot "temuan lain" berisi istilah berbeda per jenis sarana: berkas Obat
  // Tradisional memakai "Lainnya" (O), berkas Pangan IRT memakai "Serius" (S).
  const labelTemuanLain = String(filter?.jenis || '').toLowerCase().includes('pangan irt')
    ? 'Serius'
    : 'Lainnya';
  const kpi = [
    {
      label: 'Total Sarana Diperiksa',
      nilai: angka(total.sarana_diperiksa),
      ikon: FaBuilding,
      catatan: 'seluruh jenis sarana pada filter aktif',
    },
    {
      label: 'Sarana Distribusi',
      nilai: angka(total.distribusi),
      ikon: FaTruck,
      catatan: 'PBF, distributor, penyalur',
    },
    {
      label: 'Sarana Produksi',
      nilai: angka(total.produksi),
      ikon: FaIndustry,
      catatan: 'industri/unit produksi',
    },
    {
      label: 'Jenis Sarana',
      nilai: angka(total.jumlah_jenis_sarana),
      ikon: FaLayerGroup,
      catatan: 'jenis sarana yang tercatat',
    },
  ];

  const urutKab = useMemo(
    () => [...(ringkasan?.per_kab_kota || [])].sort((a, b) => angka(b.total) - angka(a.total)),
    [ringkasan],
  );

  // Total MK/TMK + sampel lab semua kab/kota (baris "Jumlah" di tabel).
  const jumlah = useMemo(() => {
    const t = ringkasan?.total || {};
    const produksi_mk = angka(t.produksi_mk);
    const produksi_tmk = angka(t.produksi_tmk);
    const distribusi_mk = angka(t.distribusi_mk);
    const distribusi_tmk = angka(t.distribusi_tmk);
    return {
      produksi_mk,
      produksi_tmk,
      distribusi_mk,
      distribusi_tmk,
      sampel_lab: angka(t.sampel_lab),
      indeks:
        indeksKepatuhan(produksi_mk + distribusi_mk, produksi_tmk + distribusi_tmk),
    };
  }, [ringkasan]);

  // Sebaran sarana dipotong jadi DUA kelompok: Distribusi dan Produksi.
  // `per_jenis_sarana` dari API memuat SEMUA jenis_sarana apa adanya —
  // termasuk komoditi sampel (Obat, Kosmetika, …) karena view memakai
  // kolom `jenis_sarana` untuk keduanya. Di panel ini baris sampel dibuang
  // (kegiatan 'Sampling' bukan sarana; jumlahnya sudah tampil di panel
  // "Hasil Pengujian Laboratorium" dan "Kepatuhan per Kelompok Komoditas").
  // Rincian jenis per kelompok ditaruh sebagai keterangan kecil.
  const kelompokSarana = useMemo(() => {
    const dasar = {
      Distribusi: { label: 'Sarana Distribusi', jumlah: 0, rincian: [], warnaTitik: 'bg-accent-500', warnaBar: 'bg-gradient-to-r from-accent-500 to-accent-400' },
      Produksi: { label: 'Sarana Produksi', jumlah: 0, rincian: [], warnaTitik: 'bg-hijau-500', warnaBar: 'bg-gradient-to-r from-hijau-500 to-hijau-400' },
    };
    for (const j of ringkasan?.per_jenis_sarana || []) {
      const kegiatan = String(j.kegiatan || '').trim().toLowerCase();
      const kunci = kegiatan === 'distribusi' ? 'Distribusi' : kegiatan === 'produksi' ? 'Produksi' : null;
      if (!kunci) continue;
      dasar[kunci].jumlah += angka(j.jumlah);
      dasar[kunci].rincian.push({ jenis_sarana: j.jenis_sarana, jumlah: j.jumlah });
    }
    return [dasar.Distribusi, dasar.Produksi];
  }, [ringkasan]);

  return (
    <div className="app-surface min-h-screen">
      {/* ================= Kepala ================= */}
      {/* Navbar publik dipakai bersama semua menu (Jendela Kinerja, Prestasi
          Unit Kerja, Anggaran, Dokumen PK/RAPK, Sumber Daya) — lihat
          components/navbar/Navbar.js. Menu aktif ditentukan dari pathname. */}
      <Navbar />

      {/* Tombol maskot Laura AI menempel di pojok kanan bawah, di luar <main>
          supaya posisi fixed-nya tidak terpengaruh kontainer scroll.
          `ringkasan` (data yang sedang tampil) dikirim agar narasi presentasi
          LAURA memakai angka yang sama persis dengan layar. */}
      <LauraAI dataDashboard={ringkasan} filterAktif={filter} />

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        {/* ================= Judul ================= */}
        <section className="panel window-pattern overflow-hidden">
          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.6fr_1fr]">
            <div>
              <span className="chip chip-accent">
                <FaMapMarkedAlt className="h-3 w-3" />
                Peta pengawasan
              </span>
              <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                <span className="text-gradient-accent">{JUDUL}</span>
              </h1>
              <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                {SUBJUDUL}
              </p>
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                Sedang menampilkan: <strong className="font-semibold">{labelFilter(filter, pilihan)}</strong>
                {ringkasan && ` — ${formatAngka(total.sarana_diperiksa)} sarana diperiksa`}
              </p>
            </div>

            {/* Sorotan temuan pada filter aktif */}
            <div className="rounded-xl border border-paper-200 bg-paper-50/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <p className="section-label">Sorotan Pemeriksaan</p>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {/* Satu slot dipakai dua istilah: berkas Obat Tradisional memakai
                    "Lainnya" (O), berkas Pangan IRT memakai "Serius" (S). */}
                <div>
                  <p className="stat-value text-lg">{formatAngka(total.temuan_lain)}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {labelTemuanLain}
                  </p>
                </div>
                <div>
                  <p className="stat-value text-lg">{formatAngka(total.temuan_mayor)}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Mayor
                  </p>
                </div>
                <div>
                  <p className="stat-value text-lg">{formatAngka(total.temuan_minor)}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Minor
                  </p>
                </div>
                <div>
                  <p className="stat-value text-lg text-rose-600 dark:text-rose-400">
                    {formatAngka(total.tidak_memenuhi)}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Tidak MK
                  </p>
                </div>
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
                <FaExclamationTriangle className="mt-0.5 shrink-0" />
                Rekap angka saja; rincian temuan hanya tersedia di dashboard internal.
              </p>
            </div>
          </div>
        </section>

        {/* ================= Filter ================= */}
        <section className="panel">
          <div className="panel-head">
            <div className="flex items-center gap-2">
              <FaFilter className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Filter Data</h3>
            </div>
            <div className="flex items-center gap-2">
              {memuat && (
                <span className="chip text-accent-600 dark:text-accent-300">
                  <FaSyncAlt className="h-3 w-3 animate-spin" /> memuat
                </span>
              )}
              <button type="button" onClick={() => setFilter({ ...FILTER_KOSONG })} className="btn-ghost">
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-5">
            <label className="block">
              <span className="stat-label">Tahun</span>
              <select
                className="input mt-1"
                value={filter.tahun}
                onChange={(e) => ubahFilter('tahun', e.target.value)}
              >
                <option value="">Semua tahun</option>
                {(pilihan?.tahun || []).map((t) => (
                  <option key={t.tahun} value={String(t.tahun)}>
                    {t.tahun} ({t.jumlah})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="stat-label">Bulan</span>
              <select
                className="input mt-1"
                value={filter.bulan}
                onChange={(e) => ubahFilter('bulan', e.target.value)}
              >
                <option value="">Semua bulan</option>
                {(pilihan?.bulan_semua || []).map((b) => (
                  <option key={b.nilai} value={String(b.nilai)}>
                    {b.nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="stat-label">Produksi / Distribusi</span>
              <select
                className="input mt-1"
                value={filter.kegiatan}
                onChange={(e) => ubahFilter('kegiatan', e.target.value)}
              >
                <option value="">Semua kegiatan</option>
                {(pilihan?.kegiatan || [])
                  .filter((k) => k.kegiatan !== '-')
                  .map((k) => (
                    <option key={k.kegiatan} value={k.kegiatan}>
                      {k.kegiatan} ({k.jumlah})
                    </option>
                  ))}
              </select>
            </label>

            <label className="block">
              <span className="stat-label">Jenis Sarana</span>
              <select className="input mt-1" value={filter.jenis} onChange={(e) => ubahFilter('jenis', e.target.value)}>
                <option value="">Semua jenis sarana</option>
                {/* Opsi mengikuti data yang masuk — impor jenis baru
                    (Kosmetik, Pangan MD, Pangan IRT, …) otomatis muncul. */}
                {(pilihan?.jenis_sarana || []).map((j) => (
                  <option key={j.jenis_sarana} value={j.jenis_sarana}>
                    {j.jenis_sarana} ({j.jumlah})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="stat-label">Kabupaten / Kota</span>
              <select className="input mt-1" value={filter.kab} onChange={(e) => ubahFilter('kab', e.target.value)}>
                <option value="">Seluruh Kalteng</option>
                {PETA.kabupaten.map((k) => (
                  <option key={k.nama} value={k.nama}>
                    {namaPendek(k.nama)}
                    {perKab[k.nama] ? ` (${perKab[k.nama].total})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {galat && (
          <section className="panel border-rose-300/60 p-4 dark:border-rose-500/30">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-rose-700 dark:text-rose-300">
              <FaExclamationTriangle className="h-3.5 w-3.5" />
              {galat}
            </p>
          </section>
        )}

        {/* ================= KPI ================= */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {kpi.map((k) => {
            const Ikon = k.ikon;
            return (
              <div key={k.label} className="panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="stat-label">{k.label}</p>
                    <p className="stat-value mt-1.5">{formatAngka(k.nilai)}</p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600 ring-1 ring-inset ring-accent-500/25 dark:text-accent-400">
                    <Ikon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">{k.catatan}</p>
              </div>
            );
          })}
        </section>

        {/* ================= Peta + peringkat kab/kota ================= */}
        <section className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <div className="panel">
            <div className="panel-head">
              <div className="flex items-center gap-2">
                <FaMapMarkedAlt className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Peta Kalimantan Tengah — per Kabupaten/Kota
                </h3>
              </div>
              <span className="chip hidden sm:inline-flex">klik wilayah untuk memfilter</span>
            </div>
            <div className="p-4">
              <Peta
                perKab={perKab}
                terpilih={filter.kab}
                maks={maks}
                onPilih={(nama) => ubahFilter('kab', nama)}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="flex items-center gap-2">
                <FaChartBar className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Peringkat Sarana Diperiksa</h3>
              </div>
              <span className="badge-primary">{urutKab.length}</span>
            </div>
            {/* Tanpa max-height/overflow: seluruh kabupaten/kota (10 wilayah)
                ditampilkan sekaligus. Sebelumnya daftar dibatasi 520px sehingga
                baris terakhir tersembunyi di balik scroll dan angkanya tidak
                bisa dibandingkan sekali lihat. */}
            <div className="px-4 py-2">
              {urutKab.length === 0 && (
                <p className="py-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
                  Tidak ada sarana pada kombinasi filter ini.
                </p>
              )}
              {urutKab.map((k) => {
                const nilai = angka(k.total);
                const persen = maks > 0 ? Math.round((nilai / maks) * 100) : 0;
                return (
                  <button
                    key={k.kab_kota}
                    type="button"
                    onClick={() => ubahFilter('kab', filter.kab === k.kab_kota ? '' : k.kab_kota)}
                    className={`w-full border-b border-paper-200 py-2 text-left transition-colors last:border-0 hover:bg-paper-50 dark:border-white/5 dark:hover:bg-white/[0.04] ${
                      filter.kab === k.kab_kota ? 'bg-accent-500/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                        {namaPendek(k.kab_kota)}
                      </span>
                      <span className="tnum shrink-0 text-[12.5px] font-bold text-slate-800 dark:text-white">
                        {formatAngka(nilai)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper-200 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-hijau-400 to-accent-600"
                        style={{ width: `${persen}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10.5px] text-slate-400 dark:text-slate-500">
                      Produksi {formatAngka(k.produksi)} · Distribusi {formatAngka(k.distribusi)}
                      {angka(k.tidak_memenuhi) > 0 && (
                        <span className="text-rose-500 dark:text-rose-400">
                          {' '}
                          · {formatAngka(k.tidak_memenuhi)} tidak MK
                        </span>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= Hasil pengujian laboratorium ================= */}
        {/* Ditaruh di bawah peta: peta adalah gambaran utama halaman, dan
            rekap sampel adalah rekap unit (bukan per wilayah) sehingga lebih
            pas dibaca setelahnya. Tabel per kelompok komoditas menyusul di
            bawah bagian ini. */}
        <SampelLab data={sampel} memuat={memuat} tahun={filter.tahun} />

        {/* ============ Kepatuhan mutu per kelompok komoditas ============ */}
        {/* Berdiri sendiri di bawah "Peringkat Sarana Diperiksa" (permintaan
            pemilik aplikasi) — bukan menempel di panel peta. */}
        <KepatuhanKomoditas data={sampel} memuat={memuat} />

        {/* ================= Sebaran jenis sarana + bulan ================= */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="panel">
            <div className="panel-head">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Sebaran Jenis Sarana</h3>
              <span className="chip">2 kelompok</span>
            </div>
            <div className="space-y-4 p-4">
              {/* Hanya dua kelompok yang ditampilkan — permintaan pemilik
                  aplikasi: "harusnya terbagi 2 Sarana Distribusi dan Sarana
                  Produksi". Baris SAMPEL_* (kegiatan "Sampling") sengaja TIDAK
                  masuk daftar ini: berkas sampel tidak menilai sarana, satu
                  sampel = satu produk, dan jumlahnya sudah tampil di panel
                  "Hasil Pengujian Laboratorium" + "Kepatuhan per Kelompok
                  Komoditas". Kalau sampel ikut dihitung, "jenis sarana" di
                  panel ini tercampur komoditi (Obat, Kosmetika, …) dengan
                  jenis sarana sungguhan (PBF, IRTP, CPOTB). */}
              {kelompokSarana.length === 0 && (
                <p className="py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">Belum ada data.</p>
              )}
              {kelompokSarana.map((k) => {
                const persen = angka(total.sarana_diperiksa)
                  ? Math.round((k.jumlah / angka(total.sarana_diperiksa)) * 100)
                  : 0;
                return (
                  <div key={k.label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-700 dark:text-slate-200">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${k.warnaTitik}`} />
                        {k.label}
                      </span>
                      <span className="tnum shrink-0 text-[13px] font-bold text-slate-800 dark:text-white">
                        {formatAngka(k.jumlah)}{' '}
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                          ({persen}%)
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper-200 dark:bg-white/10">
                      <div className={`h-full rounded-full ${k.warnaBar}`} style={{ width: `${persen}%` }} />
                    </div>
                    <p className="mt-1 text-[10.5px] leading-snug text-slate-400 dark:text-slate-500">
                      {k.rincian.length === 0
                        ? 'Belum ada data.'
                        : k.rincian
                            .map((r) => `${r.jenis_sarana} ${formatAngka(angka(r.jumlah))}`)
                            .join(' · ')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Sebaran per Bulan</h3>
              <span className="chip">{filter.tahun ? `tahun ${filter.tahun}` : 'semua tahun'}</span>
            </div>
            <div className="p-4">
              <div className="flex h-40 items-end gap-1.5">
                {Array.from({ length: 12 }).map((_, i) => {
                  const b = (ringkasan?.per_bulan || []).find((x) => angka(x.bulan) === i + 1);
                  const nilai = angka(b?.jumlah);
                  const tinggiMaks = (ringkasan?.per_bulan || []).reduce((m, x) => Math.max(m, angka(x.jumlah)), 0);
                  const persen = tinggiMaks ? Math.max(4, Math.round((nilai / tinggiMaks) * 100)) : 4;
                  const aktif = String(filter.bulan) === String(i + 1);
                  return (
                    <button
                      key={i}
                      type="button"
                      title={`${(pilihan?.bulan_semua || [])[i]?.nama || ''}: ${nilai} sarana`}
                      onClick={() => ubahFilter('bulan', aktif ? '' : String(i + 1))}
                      className="group flex h-full flex-1 flex-col justify-end gap-1"
                    >
                      <span className="tnum text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        {nilai || ''}
                      </span>
                      <span
                        className={`w-full rounded-t transition-all group-hover:opacity-80 ${
                          aktif
                            ? 'bg-gradient-to-t from-rose-400 to-rose-500'
                            : nilai
                              ? 'bg-gradient-to-t from-hijau-500 to-hijau-400'
                              : 'bg-paper-200 dark:bg-white/10'
                        }`}
                        style={{ height: `${persen}%` }}
                      />
                      <span className="text-center text-[9.5px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                        {(pilihan?.bulan_semua || [])[i]?.nama?.slice(0, 3) || `B${i + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ========== Tabel kinerja pengawasan per kabupaten/kota ========== */}
        <section className="panel overflow-hidden">
          <div className="panel-head">
            <div className="flex items-center gap-2">
              <FaClipboardList className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Data Kinerja Pengawasan Per Kabupaten/Kota
              </h3>
            </div>
            <span className="chip">{formatAngka(urutKab.length)} kab/kota</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-paper-200 bg-paper-50/70 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  {[
                    'No',
                    'Kabupaten/Kota',
                    'Sarana Produksi (MK / TMK)',
                    'Sarana Distribusi (MK/TMK)',
                    'Total Sampel Lab',
                    'Indeks Kepatuhan',
                    'Aksi',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {urutKab.map((k, i) => {
                  const indeks = indeksKepatuhan(
                    angka(k.produksi_mk) + angka(k.distribusi_mk),
                    angka(k.produksi_tmk) + angka(k.distribusi_tmk),
                  );
                  return (
                    <tr
                      key={k.kab_kota}
                      className="border-b border-paper-200 last:border-0 hover:bg-paper-50 dark:border-white/5 dark:hover:bg-white/[0.04]"
                    >
                      <td className="tnum px-4 py-2.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                        {namaPendek(k.kab_kota) || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5" title="MK / TMK sarana produksi">
                        <span className="tnum text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatAngka(k.produksi_mk)}
                        </span>
                        <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
                        <span className="tnum text-[13px] font-semibold text-rose-600 dark:text-rose-400">
                          {formatAngka(k.produksi_tmk)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5" title="MK / TMK sarana distribusi">
                        <span className="tnum text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatAngka(k.distribusi_mk)}
                        </span>
                        <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
                        <span className="tnum text-[13px] font-semibold text-rose-600 dark:text-rose-400">
                          {formatAngka(k.distribusi_tmk)}
                        </span>
                      </td>
                      <td className="tnum px-4 py-2.5 text-[12.5px] text-slate-600 dark:text-slate-300">
                        {formatAngka(k.sampel_lab)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={gayaIndeks(indeks)}>{formatPersen(indeks)}</span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-paper-200 dark:bg-white/10">
                            <span
                              className="block h-full rounded-full bg-gradient-to-r from-hijau-400 to-accent-600"
                              style={{ width: `${indeks === null ? 0 : Math.round(indeks)}%` }}
                            />
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => bukaDetail(k.kab_kota)}
                          className="btn-ghost"
                        >
                          Rincian
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {urutKab.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-slate-400 dark:text-slate-500">
                      Tidak ada data pada kombinasi filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
              {urutKab.length > 0 && (
                <tfoot>
                  <tr className="border-t border-paper-200 bg-paper-50/70 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Jumlah
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="tnum text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatAngka(jumlah.produksi_mk)}
                      </span>
                      <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
                      <span className="tnum text-[13px] font-semibold text-rose-600 dark:text-rose-400">
                        {formatAngka(jumlah.produksi_tmk)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className="tnum text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatAngka(jumlah.distribusi_mk)}
                      </span>
                      <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
                      <span className="tnum text-[13px] font-semibold text-rose-600 dark:text-rose-400">
                        {formatAngka(jumlah.distribusi_tmk)}
                      </span>
                    </td>
                    <td className="tnum px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                      {formatAngka(jumlah.sampel_lab)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className={gayaIndeks(jumlah.indeks)}>{formatPersen(jumlah.indeks)}</span>
                    </td>
                    <td className="px-4 py-2.5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-paper-200 px-4 py-3 dark:border-white/[0.08]">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              MK = Memenuhi Ketentuan, TMK = Tidak Memenuhi Ketentuan. Indeks kepatuhan =
              MK ÷ (MK + TMK) × 100.
            </p>
            <p className="text-[11.5px] text-slate-400 dark:text-slate-500">
              Menampilkan: {labelFilter(filter, pilihan)}
            </p>
          </div>
        </section>

        {/* ================= Kaki ================= */}
        <footer className="flex flex-col items-center gap-1.5 pb-4 pt-1 text-center">
          <BrandMark size="sm" glow={false} />
          <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            {BRAND.name} — Balai Besar POM di Palangka Raya
            <br />
            Data diperbarui{' '}
            {pilihan?.terakhir_diunggah
              ? new Date(pilihan.terakhir_diunggah).toLocaleString('id-ID', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })
              : '—'}
            . Halaman publik ini hanya menampilkan rekap; rincian temuan ada di dashboard internal.
          </p>
        </footer>
      </main>

      {/* ================= Modal rincian sarana per kab/kota ================= */}
      {detail && <RincianKabupatenModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
