// components/pendapatan/Container.js
/**
 * MODUL: PENDAPATAN — Container
 * -----------------------------
 * Rekap realisasi PENDAPATAN per bulan dan per akun dari export SAKTI
 * "ADK REALISASI PENDAPATAN (SUMBER DATA : SAKTI) PER SATKER".
 *
 * ==== KONVENSI STRUKTUR (sama dengan modul lain) ====
 *   pages/pendapatan/index.js        -> halaman TIPIS (pengaman sesi)
 *   components/pendapatan/Container.js -> logika & tampilan (file ini)
 *   components/pendapatan/helper.js  -> formatter
 *   backend/routes/pendapatan.js     -> router tipis
 *   backend/lib/pendapatan.js        -> mesin baca berkas + simpan
 * ===================================================
 *
 * HALAMAN INI INTERNAL (wajib login), seperti /data-realisasi. Alasannya sama:
 * angka per akun adalah rincian keuangan, bukan agregat publik.
 *
 * Angka ditulis penuh dengan pemisah ribuan Indonesia (565.593.844), bukan
 * disingkat ("565,6 jt"), supaya bisa dicocokkan langsung dengan dokumen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAksesPenuh } from '../../utils/peran';
import {
  FaCloudUploadAlt,
  FaCoins,
  FaFileExcel,
  FaHistory,
  FaInfoCircle,
  FaMoneyBillWave,
  FaSpinner,
  FaTrashAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChartBar,
  FaChartPie,
  FaTable,
  FaLock,
} from 'react-icons/fa';
import {
  BULAN_PENDEK,
  NAMA_BULAN,
  formatAngka,
  formatPersen,
  labelAkun,
  tahunSekarang,
} from './helper';

/** Ringkasan kosong agar render pertama tidak perlu null-check panjang. */
const RINGKASAN_KOSONG = {
  tahun: null,
  total: 0,
  per_akun: [],
  per_bulan: [],
  daftar_tahun: [],
  berkas: null,
};

/** Warna batang: biru untuk pendapatan, hijau bila akun terbesar. */
const WARNA_AKUN = [
  'from-accent-500 to-accent-400',
  'from-hijau-500 to-hijau-400',
  'from-sky-500 to-sky-400',
  'from-teal-500 to-teal-400',
  'from-indigo-500 to-indigo-400',
  'from-cyan-500 to-cyan-400',
];

/** Validasi berkas di sisi klien supaya kesalahan ketahuan sebelum diunggah. */
function validasiBerkas(berkas) {
  if (!berkas) return 'Pilih berkas CSV ADK Realisasi Pendapatan terlebih dahulu.';
  const nama = String(berkas.name || '').toLowerCase();
  if (!nama.endsWith('.csv') && !nama.endsWith('.txt')) {
    return 'Berkas harus CSV dari SAKTI (ADK Realisasi Pendapatan). Berkas Excel .xlsx harus disimpan sebagai CSV lebih dulu.';
  }
  if (berkas.size > 16 * 1024 * 1024) return 'Ukuran berkas melebihi 16 MB.';
  return null;
}

export default function PendapatanContainer() {
  // Hanya admin & admin_jendela_kinerja yang boleh mengubah data.
  const aksesPenuh = useAksesPenuh();
  // --- data ---
  const [ringkasan, setRingkasan] = useState(RINGKASAN_KOSONG);
  const [tahun, setTahun] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState(null);

  // --- unggah ---
  const [berkas, setBerkas] = useState(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [pesan, setPesan] = useState(null); // { jenis: 'sukses'|'galat', teks }
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [menghapus, setMenghapus] = useState(false);

  // --- tampilan ---
  const [tampilan, setTampilan] = useState('grafik'); // 'grafik' | 'tabel'
  const inputBerkas = useRef(null);

  /** Ambil ringkasan satu tahun. Tahun kosong = tahun terbaru yang ada datanya. */
  const muatRingkasan = useCallback(async (th) => {
    setMemuat(true);
    setGalat(null);
    try {
      const qs = th ? `?tahun=${th}` : '';
      const r = await fetch(`/api/pendapatan/ringkasan${qs}`, { cache: 'no-store' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${r.status}`);
      }
      const j = await r.json();
      if (!j.success) throw new Error(j.message || 'Respons tidak sah');
      setRingkasan(j.data);
      if (j.data.tahun) setTahun(j.data.tahun);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    muatRingkasan(null);
  }, [muatRingkasan]);

  /** Pindah tahun. */
  const gantiTahun = (th) => {
    setTahun(th);
    muatRingkasan(th);
  };

  /** Unggah berkas ADK pendapatan. */
  const unggah = async (e) => {
    e.preventDefault();
    const salah = validasiBerkas(berkas);
    if (salah) return setPesan({ jenis: 'galat', teks: salah });

    const fd = new FormData();
    fd.append('berkas', berkas);
    if (tahun) fd.append('tahun', String(tahun));

    setMengunggah(true);
    setPesan(null);
    try {
      const r = await fetch('/api/pendapatan/import', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message || `HTTP ${r.status}`);

      setPesan({ jenis: 'sukses', teks: j.message });
      setBerkas(null);
      if (inputBerkas.current) inputBerkas.current.value = '';
      setRingkasan(j.data.rekap ? { ...ringkasan, ...j.data.rekap, tahun: j.data.tahun } : ringkasan);
      await muatRingkasan(j.data.tahun);
    } catch (err) {
      setPesan({ jenis: 'galat', teks: err.message });
    } finally {
      setMengunggah(false);
    }
  };

  /** Hapus seluruh data satu tahun (untuk impor ulang dari nol). */
  const hapusTahun = async () => {
    if (!tahun) return;
    setMenghapus(true);
    setPesan(null);
    try {
      const r = await fetch(`/api/pendapatan/data?tahun=${tahun}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message || `HTTP ${r.status}`);
      setPesan({ jenis: 'sukses', teks: j.message });
      setKonfirmasiHapus(false);
      await muatRingkasan(null);
    } catch (err) {
      setPesan({ jenis: 'galat', teks: err.message });
    } finally {
      setMenghapus(false);
    }
  };

  // --- turunan ---
  const perAkun = ringkasan.per_akun || [];
  const perBulan = ringkasan.per_bulan || [];
  const total = Number(ringkasan.total) || 0;
  const adaData = total > 0;
  const akunTerbesar = perAkun.length ? Number(perAkun[0].total) || 0 : 0;
  const maksBulan = useMemo(
    () => perBulan.reduce((m, b) => Math.max(m, Number(b.nilai) || 0), 0),
    [perBulan],
  );
  const bulanTerisi = useMemo(
    () => perBulan.filter((b) => Number(b.nilai) > 0).length,
    [perBulan],
  );

  const kartu = [
    { label: 'Total Pendapatan', nilai: formatAngka(total), ikon: FaMoneyBillWave, warna: 'text-accent-600 dark:text-accent-400' },
    { label: 'Jumlah Akun', nilai: String(perAkun.length), ikon: FaCoins, warna: 'text-hijau-600 dark:text-hijau-400' },
    { label: 'Dokumen', nilai: ringkasan.berkas?.jumlah_dokumen ? formatAngka(ringkasan.berkas.jumlah_dokumen) : '—', ikon: FaFileExcel, warna: 'text-slate-600 dark:text-slate-300' },
    { label: 'Bulan Terisi', nilai: `${bulanTerisi} / 12`, ikon: FaChartBar, warna: 'text-sky-600 dark:text-sky-400' },
  ];

  return (
    // LEBAR PENUH. Dulu dibatasi max-w-[1180px] + padding sendiri, sehingga
    // halaman ini terlihat menyempit dibanding modul lain (yang isinya langsung
    // mengisi <main> DashboardLayout). Padding di sini dibuang karena <main>
    // sudah memberi p-4/sm:p-6/lg:p-8.
    <div className="space-y-4">
      {/* ================= Judul + filter ================= */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-bold tracking-tight text-slate-800 dark:text-white sm:text-[19px]">
            Realisasi Pendapatan
          </h1>
          <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
            Sumber: ADK Realisasi Pendapatan (SAKTI) per satker
            {ringkasan.berkas?.nama_berkas ? ` — ${ringkasan.berkas.nama_berkas}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Tahun
          </label>
          <select
            className="input-sm w-auto min-w-[90px]"
            value={tahun || ''}
            onChange={(e) => gantiTahun(Number(e.target.value))}
            disabled={!ringkasan.daftar_tahun?.length}
          >
            {ringkasan.daftar_tahun?.length ? (
              ringkasan.daftar_tahun.map((th) => (
                <option key={th} value={th}>
                  {th}
                </option>
              ))
            ) : (
              <option value="">—</option>
            )}
          </select>

          <button
            type="button"
            className="btn-primary-sm"
            onClick={() => setTampilan(tampilan === 'grafik' ? 'tabel' : 'grafik')}
            title={tampilan === 'grafik' ? 'Tampilkan sebagai tabel' : 'Tampilkan sebagai grafik'}
          >
            {tampilan === 'grafik' ? <FaTable className="h-3 w-3" /> : <FaChartPie className="h-3 w-3" />}
            {tampilan === 'grafik' ? 'Tabel' : 'Grafik'}
          </button>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() => muatRingkasan(tahun)}
            disabled={memuat}
          >
            {memuat ? <FaSpinner className="h-3 w-3 animate-spin" /> : <FaHistory className="h-3 w-3" />}
            Segarkan
          </button>
        </div>
      </div>

      {/* ================= Pesan ================= */}
      {pesan && (
        <div
          className={[
            'flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px] ring-1',
            pesan.jenis === 'sukses'
              ? 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-200'
              : 'bg-rose-500/10 text-rose-800 ring-rose-500/25 dark:text-rose-200',
          ].join(' ')}
          role="status"
        >
          {pesan.jenis === 'sukses' ? (
            <FaCheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <FaExclamationTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span className="leading-snug">{pesan.teks}</span>
        </div>
      )}

      {galat && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-800 ring-1 ring-rose-500/25 dark:text-rose-200">
          <FaExclamationTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="leading-snug">{galat}</span>
        </div>
      )}

      {/* ================= Unggah berkas =================
          Hanya untuk admin & admin_jendela_kinerja. Peran lain tetap bisa
          membaca seluruh angka di bawah; backend juga menolak impor/hapus. */}
      {!aksesPenuh && (
        <div className="panel flex items-start gap-2.5 px-3 py-2.5">
          <FaLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
          <p className="text-[12px] leading-snug text-slate-600 dark:text-slate-300">
            <strong className="font-bold text-slate-800 dark:text-white">Mode baca saja.</strong>{' '}
            Anda dapat membuka dan membaca semua modul, tetapi tidak dapat mengunggah, mengimpor,
            atau menghapus data.
          </p>
        </div>
      )}

      {aksesPenuh && (
      <div className="panel">
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <FaCloudUploadAlt className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Unggah ADK Realisasi Pendapatan</h2>
          </div>
          {ringkasan.berkas?.diunggah_pada && (
            <span className="badge-primary">
              diperbarui {new Date(ringkasan.berkas.diunggah_pada).toLocaleDateString('id-ID')}
            </span>
          )}
        </div>

        <form onSubmit={unggah} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Berkas CSV
            </label>
            <input
              ref={inputBerkas}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => setBerkas(e.target.files?.[0] || null)}
              className="input-sm w-full file:mr-3 file:rounded-lg file:border-0 file:bg-accent-500/15 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-accent-700 dark:file:text-accent-300"
            />
            {berkas && (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                <FaFileExcel className="h-3 w-3" /> {berkas.name}
              </p>
            )}
          </div>
          <button type="submit" className="btn-primary h-[34px]" disabled={mengunggah || !berkas}>
            {mengunggah ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaCloudUploadAlt className="h-3.5 w-3.5" />}
            {mengunggah ? 'Mengimpor…' : 'Impor'}
          </button>
          <button
            type="button"
            className="btn-danger-sm h-[34px]"
            onClick={() => setKonfirmasiHapus(true)}
            disabled={!adaData || menghapus}
            title={!adaData ? 'Belum ada data untuk dihapus' : 'Hapus seluruh data tahun ini'}
          >
            <FaTrashAlt className="h-3 w-3" /> Kosongkan
          </button>
        </form>

        <p className="border-t border-paper-200 px-4 py-2.5 text-[11px] leading-snug text-slate-400 dark:border-white/[0.08] dark:text-slate-500">
          Berkas: <em>ADK REALISASI PENDAPATAN SUMBER DATA SAKTI PER SATKER</em> (.csv) — memuat kolom{' '}
          <code className="rounded bg-paper-100 px-1 py-0.5 dark:bg-white/[0.06]">AKUN</code>,{' '}
          <code className="rounded bg-paper-100 px-1 py-0.5 dark:bg-white/[0.06]">REALISASI</code>, dan{' '}
          <code className="rounded bg-paper-100 px-1 py-0.5 dark:bg-white/[0.06]">TGLPOST</code>. Hanya bulan yang ada
          di berkas yang diganti; bulan lain tidak terhapus.
        </p>
      </div>
      )}

      {/* ================= Angka pokok ================= */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {kartu.map((k) => {
          const Ikon = k.ikon;
          return (
            <div key={k.label} className="panel px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <Ikon className={`h-3 w-3 ${k.warna}`} />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {k.label}
                </p>
              </div>
              <p className={`tnum mt-1 text-[15px] font-bold leading-tight ${k.warna}`}>{k.nilai}</p>
            </div>
          );
        })}
      </div>

      {/* ================= Status kosong ================= */}
      {!adaData && !memuat && (
        <div className="panel px-4 py-10 text-center">
          <FaInfoCircle className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            Belum ada data pendapatan{tahun ? ` untuk tahun ${tahun}` : ''}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-400 dark:text-slate-500">
            Unggah berkas ADK Realisasi Pendapatan di panel di atas.
          </p>
        </div>
      )}

      {adaData && (
        <>
          {/* ================= Rekap per akun ================= */}
          <div className="panel">
            <div className="panel-head">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Realisasi per Akun Pendapatan</h2>
              <span className="badge-primary tnum">{formatAngka(total)}</span>
            </div>

            {tampilan === 'tabel' ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[12px]">
                  <thead className="bg-paper-50 text-[10.5px] uppercase tracking-wider text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold">Akun</th>
                      <th className="px-3 py-2 text-left font-bold">Keterangan</th>
                      <th className="px-3 py-2 text-right font-bold">Realisasi</th>
                      <th className="px-3 py-2 text-right font-bold">Porsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-200 dark:divide-white/[0.07]">
                    {perAkun.map((a) => (
                      <tr key={a.akun}>
                        <td className="tnum px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200">{a.akun}</td>
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{labelAkun(a.akun, a.nama)}</td>
                        <td className="tnum px-3 py-1.5 text-right font-semibold text-slate-800 dark:text-white">
                          {formatAngka(a.total)}
                        </td>
                        <td className="tnum px-3 py-1.5 text-right text-slate-500 dark:text-slate-400">
                          {formatPersen(a.total, total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-paper-300 dark:border-white/15">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-[11.5px] font-bold text-slate-600 dark:text-slate-300">
                        Jumlah
                      </td>
                      <td className="tnum px-3 py-2 text-right text-[12.5px] font-bold text-accent-700 dark:text-accent-300">
                        {formatAngka(total)}
                      </td>
                      <td className="tnum px-3 py-2 text-right text-[11.5px] text-slate-500">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="space-y-2.5 px-4 py-4">
                {perAkun.map((a, i) => {
                  const lebar = akunTerbesar ? (Number(a.total) / akunTerbesar) * 100 : 0;
                  return (
                    <div key={a.akun}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <p className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300">
                          <span className="tnum mr-1.5 font-bold text-accent-700 dark:text-accent-300">{a.akun}</span>
                          {labelAkun(a.akun, a.nama)}
                        </p>
                        <p className="tnum shrink-0 text-[11.5px] font-bold text-slate-700 dark:text-slate-200">
                          {formatAngka(a.total)}
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-paper-100 dark:bg-white/[0.06]">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${WARNA_AKUN[i % WARNA_AKUN.length]}`}
                          style={{ width: `${Math.max(lebar, 1.5)}%` }}
                          aria-label={`${a.akun} total ${formatAngka(a.total)}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ================= Grafik per bulan ================= */}
          <div className="panel">
            <div className="panel-head">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Realisasi Pendapatan per Bulan</h2>
              <span className="badge-primary tnum">kumulatif {formatAngka(total)}</span>
            </div>

            <div className="px-3 py-4 sm:px-4">
              {/* Batang CSS, bukan recharts: tidak menambah dependensi dan tetap
                  terbaca di ponsel. Nilai muncul saat kursor menyentuh batang. */}
              <div className="flex items-end justify-between gap-1 sm:gap-1.5" style={{ height: 180 }}>
                {perBulan.map((b) => {
                  const tinggi = maksBulan ? (Number(b.nilai) / maksBulan) * 100 : 0;
                  return (
                    <div key={b.bulan} className="group flex h-full flex-1 flex-col items-center justify-end">
                      <div
                        className="relative w-full rounded-t-[3px] bg-gradient-to-t from-accent-600 to-accent-400 transition-all hover:from-accent-500 hover:to-accent-300"
                        style={{ height: `${Math.max(tinggi, Number(b.nilai) > 0 ? 2 : 0)}%` }}
                        title={`${NAMA_BULAN[b.bulan - 1]}: ${formatAngka(b.nilai)} (kumulatif ${formatAngka(b.kumulatif)})`}
                        aria-label={`${NAMA_BULAN[b.bulan - 1]} kumulatif ${formatAngka(b.kumulatif)}`}
                      >
                        <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-1.5 py-1 text-[9.5px] font-semibold text-white shadow-lg group-hover:block dark:bg-white dark:text-slate-900">
                          {formatAngka(b.nilai)}
                        </span>
                      </div>
                      <p className="mt-1 text-[9px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                        {BULAN_PENDEK[b.bulan - 1]}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-paper-200 pt-3 text-[11px] dark:border-white/[0.08] sm:grid-cols-4">
                <div>
                  <p className="text-slate-400 dark:text-slate-500">Bulan tertinggi</p>
                  <p className="tnum font-bold text-slate-700 dark:text-slate-200">
                    {(() => {
                      const puncak = perBulan.reduce((a, b) => (Number(b.nilai) > Number(a?.nilai || 0) ? b : a), null);
                      return puncak && Number(puncak.nilai) > 0
                        ? `${NAMA_BULAN[puncak.bulan - 1]} · ${formatAngka(puncak.nilai)}`
                        : '—';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-slate-500">Rata-rata per bulan aktif</p>
                  <p className="tnum font-bold text-slate-700 dark:text-slate-200">
                    {bulanTerisi ? formatAngka(total / bulanTerisi) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-slate-500">Semester 1</p>
                  <p className="tnum font-bold text-slate-700 dark:text-slate-200">
                    {formatAngka(perBulan.slice(0, 6).reduce((s, b) => s + Number(b.nilai), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 dark:text-slate-500">Semester 2</p>
                  <p className="tnum font-bold text-slate-700 dark:text-slate-200">
                    {formatAngka(perBulan.slice(6).reduce((s, b) => s + Number(b.nilai), 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================= Konfirmasi hapus ================= */}
      {konfirmasiHapus && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Kosongkan data pendapatan"
          onClick={(e) => {
            if (e.target === e.currentTarget) setKonfirmasiHapus(false);
          }}
        >
          <div className="w-full max-w-[430px] rounded-2xl bg-white p-5 shadow-xl dark:bg-[#0f172a]">
            <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">Kosongkan Data Pendapatan {tahun}</h3>
            <p className="mt-1 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
              Seluruh data pendapatan tahun {tahun} akan dihapus. Tindakan ini tidak bisa dibatalkan — impor ulang berkas
              ADK untuk memulihkannya.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="btn-primary-sm" onClick={() => setKonfirmasiHapus(false)}>
                Batal
              </button>
              <button type="button" className="btn-danger-sm h-[34px]" onClick={hapusTahun} disabled={menghapus}>
                {menghapus ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaTrashAlt className="h-3.5 w-3.5" />}
                {menghapus ? 'Menghapus…' : 'Kosongkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
