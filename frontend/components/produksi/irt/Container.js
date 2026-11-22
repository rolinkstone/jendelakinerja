// components/produksi/irt/Container.js
/**
 * MODUL: PRODUKSI — PANGAN IRT (CPPB - IRT) — Container
 * ----------------------------------------------------
 * Impor laporan hasil pemeriksaan sarana PRODUKSI (Pangan IRT / CPPB-IRT) dari
 * berkas Excel export SIPT, lalu tampilkan sebagai tabel + rincian per sarana.
 *
 * ==== KONVENSI STRUKTUR APLIKASI (sama dengan modul lain) ====
 *   pages/produksi/irt/index.js          -> halaman TIPIS (<Head> + layout + container)
 *   components/produksi/irt/Container.js -> seluruh logika & tampilan modul (file ini)
 *   components/produksi/irt/helper.js    -> konstanta & formatter (tanpa state/API)
 *   components/produksi/irt/Modal.js     -> dialog rincian laporan
 *   backend/routes/produksi-irt.js       -> parsing Excel + CRUD (prefix /api/produksi-irt)
 * ============================================================
 *
 * ATURAN IMPOR (PER TAHUN): data disimpan terpisah per tahun. Setiap unggahan
 * mengganti SELURUH data tahun yang dipilih (atau tahun yang terbaca dari
 * berkas) dan TIDAK menyentuh tahun lain. Penggantian dijalankan backend dalam
 * satu transaksi, jadi berkas gagal baca tidak pernah menghapus data lama.
 *
 * Berkas Pangan IRT memakai header dua tingkat dan memuat kolom penyimpangan
 * per baris (ditampilkan di modal rincian). Satu baris bernomor = satu sarana.
 *
 * Permintaan API lewat proxy server `pages/api/produksi-irt/[...path].js` —
 * token Keycloak tidak pernah menyentuh browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaCloudUploadAlt,
  FaFileExcel,
  FaSearch,
  FaSyncAlt,
  FaTrashAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaSpinner,
  FaChevronLeft,
  FaChevronRight,
  FaListAlt,
  FaCalendarAlt,
} from 'react-icons/fa';
import { DetailLaporanModal } from './Modal';
import {
  formatAngka,
  formatUkuran,
  kelasGrading,
  kelasKesimpulan,
  labelTahun,
  metaUnggahan,
  opsiTahun,
  ringkas,
  ringkasanTahun,
  TAHUN_OTOMATIS,
  TONE_TILE,
  validasiBerkas,
} from './helper';

const LIMIT = 25;

/** Ringkasan kosong supaya render pertama tidak perlu null-check panjang. */
const RINGKASAN_KOSONG = {
  tahun: null,
  impor_terakhir: null,
  total: { total_laporan: 0, serius: 0, mayor: 0, minor: 0, kritis: 0 },
  sebaran_grading: [],
  sebaran_hasil_balai: [],
  daftar_tahun: [],
};

/** Kelas tombol filter tahun (aktif / tidak aktif). */
function kelasChipTahun(aktif) {
  return [
    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold transition',
    aktif
      ? 'border-accent-400/70 bg-accent-500/10 text-accent-700 dark:text-accent-300'
      : 'border-paper-300 bg-white text-ink-600 hover:border-accent-400/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-ink-300',
  ].join(' ');
}

export default function ProduksiIrtContainer() {
  // --- data ---
  const [ringkasan, setRingkasan] = useState(RINGKASAN_KOSONG);
  const [tabel, setTabel] = useState({ rows: [], total: 0, page: 1, total_halaman: 1 });
  const [memuatData, setMemuatData] = useState(true);

  // --- filter ---
  const [tahun, setTahun] = useState(null); // null = semua tahun
  const [cari, setCari] = useState('');
  const [cariAktif, setCariAktif] = useState('');
  const [halaman, setHalaman] = useState(1);

  // --- unggah ---
  const berkasRef = useRef(null);
  const [berkas, setBerkas] = useState(null);
  const [tahunImpor, setTahunImpor] = useState(TAHUN_OTOMATIS);
  const [menyeret, setMenyeret] = useState(false);
  const [mengunggah, setMengunggah] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  const [pesan, setPesan] = useState(null); // { tipe: 'sukses' | 'galat', teks }

  // --- dialog ---
  const [detail, setDetail] = useState(null);
  const [memuatDetail, setMemuatDetail] = useState(false);

  const galatBerkas = validasiBerkas(berkas);
  const adaData = (ringkasan.total?.total_laporan || 0) > 0;
  const daftarPilihanTahun = opsiTahun(ringkasan.daftar_tahun);
  const isiTahunDipilih = ringkasanTahun(ringkasan.daftar_tahun, tahunImpor);

  // ------------------------------------------------------------------
  // Muat data
  // ------------------------------------------------------------------
  const muatRingkasan = useCallback(async (tahunPilih) => {
    const q = tahunPilih ? `?tahun=${tahunPilih}` : '';
    const r = await fetch(`/api/produksi-irt/summary${q}`, { headers: { accept: 'application/json' } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || 'Gagal memuat ringkasan');
    setRingkasan(j.data);
  }, []);

  const muatTabel = useCallback(async (halamanTujuan = 1, kataKunci = '', tahunPilih = null) => {
    const q = new URLSearchParams({
      page: String(halamanTujuan),
      limit: String(LIMIT),
      ...(kataKunci ? { q: kataKunci } : {}),
      ...(tahunPilih ? { tahun: String(tahunPilih) } : {}),
    });
    const r = await fetch(`/api/produksi-irt/laporan?${q.toString()}`, { headers: { accept: 'application/json' } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || 'Gagal memuat daftar laporan');
    setTabel(j.data);
  }, []);

  const muatSemua = useCallback(async (
    halamanTujuan = halaman,
    kataKunci = cariAktif,
    tahunPilih = tahun,
  ) => {
    setMemuatData(true);
    try {
      await Promise.all([
        muatRingkasan(tahunPilih),
        muatTabel(halamanTujuan, kataKunci, tahunPilih),
      ]);
    } catch (e) {
      setPesan({ tipe: 'galat', teks: e.message });
    } finally {
      setMemuatData(false);
    }
  }, [cariAktif, halaman, tahun, muatRingkasan, muatTabel]);

  useEffect(() => {
    muatSemua(1, '', null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // Aksi
  // ------------------------------------------------------------------
  const gantiTahun = (tahunBaru) => {
    if (tahunBaru === tahun) return;
    setKonfirmasiHapus(false);
    setTahun(tahunBaru);
    setHalaman(1);
    muatSemua(1, cariAktif, tahunBaru);
  };

  const terapkanCari = (e) => {
    e.preventDefault();
    setHalaman(1);
    setCariAktif(cari.trim());
    muatSemua(1, cari.trim(), tahun);
  };

  const pindahHalaman = (tujuan) => {
    const t = Math.min(Math.max(1, tujuan), tabel.total_halaman || 1);
    if (t === halaman) return;
    setHalaman(t);
    muatTabel(t, cariAktif, tahun).catch((err) => setPesan({ tipe: 'galat', teks: err.message }));
  };

  const pilihBerkas = (file) => {
    setPesan(null);
    setBerkas(file || null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setMenyeret(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) pilihBerkas(file);
  };

  const unggah = async () => {
    if (!berkas || galatBerkas || mengunggah) return;
    setMengunggah(true);
    setPesan(null);
    try {
      const fd = new FormData();
      fd.append('berkas', berkas);
      fd.append('tahun', tahunImpor);
      const r = await fetch('/api/produksi-irt/import', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message || 'Impor gagal');

      setPesan({ tipe: 'sukses', teks: j.message });
      setBerkas(null);
      if (berkasRef.current) berkasRef.current.value = '';

      // Langsung pindah ke tahun yang baru diimpor supaya hasilnya terlihat.
      const tahunHasil = j.data?.tahun ? Number(j.data.tahun) : null;
      setTahun(tahunHasil);
      setHalaman(1);
      setCari('');
      setCariAktif('');
      await muatSemua(1, '', tahunHasil);
    } catch (e) {
      setPesan({ tipe: 'galat', teks: e.message });
    } finally {
      setMengunggah(false);
    }
  };

  const kosongkanData = async () => {
    // Konfirmasi dua langkah DI DALAM UI (bukan window.confirm): klik pertama
    // hanya membuka panel konfirmasi, klik kedua baru menghapus. Aman dari klik
    // tak sengaja dan tetap bisa diuji lewat otomasi browser.
    if (!konfirmasiHapus) {
      setKonfirmasiHapus(true);
      return;
    }
    setMenghapus(true);
    try {
      const r = await fetch(`/api/produksi-irt/data${tahun ? `?tahun=${tahun}` : ''}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Gagal menghapus data');
      setPesan({ tipe: 'sukses', teks: j.message });
      setHalaman(1);
      setCariAktif('');
      setCari('');
      setKonfirmasiHapus(false);
      await muatSemua(1, '', tahun);
    } catch (e) {
      setPesan({ tipe: 'galat', teks: e.message });
    } finally {
      setMenghapus(false);
    }
  };

  const bukaDetail = async (id) => {
    setDetail(null);
    setMemuatDetail(true);
    try {
      const r = await fetch(`/api/produksi-irt/laporan/${id}`, { headers: { accept: 'application/json' } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Gagal memuat rincian');
      setDetail(j.data);
    } catch (e) {
      setPesan({ tipe: 'galat', teks: e.message });
      setMemuatDetail(false);
      return;
    }
    setMemuatDetail(false);
  };

  const tutupDetail = () => {
    setDetail(null);
    setMemuatDetail(false);
  };

  // ------------------------------------------------------------------
  // Tampilan
  // ------------------------------------------------------------------
  const kartuStatistik = [
    { label: 'Laporan', nilai: ringkasan.total?.total_laporan, tone: TONE_TILE.accent },
    { label: 'Temuan Serius', nilai: ringkasan.total?.serius, tone: TONE_TILE.rose },
    { label: 'Temuan Minor', nilai: ringkasan.total?.minor, tone: TONE_TILE.amber },
    { label: 'Temuan Kritis', nilai: ringkasan.total?.kritis, tone: TONE_TILE.emerald },
  ];

  // Kolom "Tahun" hanya relevan saat melihat gabungan semua tahun.
  const kolomTabel = tahun
    ? ['No', 'Sarana', 'Kab/Kota', 'Tgl Periksa', 'Level', 'Grading', 'Temuan (S/M/m/C)', 'Hasil Balai', '']
    : ['No', 'Tahun', 'Sarana', 'Kab/Kota', 'Tgl Periksa', 'Level', 'Grading', 'Temuan (S/M/m/C)', 'Hasil Balai', ''];

  const totalTahunTersedia = (ringkasan.daftar_tahun || []).length;

  return (
    <div className="space-y-4">
      {/* ============ FILTER TAHUN ============ */}
      <section className="panel animate-rise p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="section-label mr-1 flex items-center gap-1.5">
            <FaCalendarAlt /> Tahun Data
          </p>
          <button type="button" onClick={() => gantiTahun(null)} className={kelasChipTahun(tahun === null)}>
            Semua tahun
            <span className="tnum text-[11px] font-bold opacity-70">
              {formatAngka(tahun === null ? ringkasan.total?.total_laporan : ringkasan.daftar_tahun.reduce((t, d) => t + Number(d.jumlah_laporan || 0), 0))}
            </span>
          </button>
          {(ringkasan.daftar_tahun || []).map((d) => (
            <button
              key={d.tahun}
              type="button"
              onClick={() => gantiTahun(Number(d.tahun))}
              className={kelasChipTahun(Number(tahun) === Number(d.tahun))}
            >
              {d.tahun}
              <span className="tnum text-[11px] font-bold opacity-70">{formatAngka(d.jumlah_laporan)}</span>
            </button>
          ))}
          {totalTahunTersedia === 0 && (
            <span className="text-[11px] font-medium text-ink-400 dark:text-ink-500">
              belum ada data tersimpan
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-500 dark:text-ink-300">
          Data disimpan terpisah per tahun. Mengunggah berkas tahun 2025 hanya mengganti data 2025 —
          data tahun lain tetap utuh.
        </p>
      </section>

      {/* ============ UNGGAH BERKAS ============ */}
      <section className="panel animate-rise p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Dropzone */}
          <div>
            <p className="section-label">Impor Laporan Excel</p>
            <div
              role="button"
              tabIndex={0}
              onClick={() => berkasRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') berkasRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setMenyeret(true);
              }}
              onDragLeave={() => setMenyeret(false)}
              onDrop={onDrop}
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
                menyeret
                  ? 'border-accent-500 bg-accent-500/10'
                  : 'border-paper-300 bg-paper-50 hover:border-accent-400/70 hover:bg-accent-500/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-accent-500/40'
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600 dark:text-accent-300">
                <FaCloudUploadAlt size={20} />
              </span>
              {berkas ? (
                <>
                  <p className="text-[13px] font-bold text-ink-900 dark:text-ink-50">{berkas.name}</p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-300">
                    {formatUkuran(berkas.size)} · klik untuk mengganti berkas
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-semibold text-ink-800 dark:text-ink-100">
                    Lepas berkas di sini atau klik untuk memilih
                  </p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-300">
                    .xlsx / .xls / .xlsm · maksimal 15 MB
                  </p>
                </>
              )}
            </div>

            <input
              ref={berkasRef}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              className="hidden"
              onChange={(e) => pilihBerkas(e.target.files?.[0] || null)}
            />

            {berkas && galatBerkas && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-300">
                <FaExclamationTriangle /> {galatBerkas}
              </p>
            )}

            {/* Pemilih tahun data berkas */}
            <label className="mt-3 block">
              <span className="stat-label">Tahun data berkas ini</span>
              <select
                value={tahunImpor}
                onChange={(e) => setTahunImpor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-800 outline-none transition focus:border-accent-400/70 focus:ring-2 focus:ring-accent-400/25 dark:border-white/10 dark:bg-ink-900 dark:text-ink-100"
              >
                <option value={TAHUN_OTOMATIS}>Otomatis — dibaca dari isi berkas</option>
                {daftarPilihanTahun.map((t) => (
                  <option key={t} value={String(t)}>Tahun {t}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Aksi + peringatan */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-paper-200 bg-paper-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex gap-2">
              <FaInfoCircle className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="text-[12px] font-bold text-ink-800 dark:text-ink-100">
                  {tahunImpor === TAHUN_OTOMATIS
                    ? 'Hanya tahun yang terbaca dari berkas yang diganti'
                    : `Hanya data tahun ${tahunImpor} yang diganti`}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500 dark:text-ink-300">
                  {tahunImpor === TAHUN_OTOMATIS ? (
                    <>
                      Tahun data dibaca dari periode pemeriksaan di dalam berkas. Data tahun lain
                      tidak tersentuh — tidak ada riwayat versi untuk tahun yang sama.
                    </>
                  ) : (
                    <>
                      Seluruh data <b>tahun {tahunImpor}</b> akan diganti isi berkas ini. Data tahun
                      lain tidak tersentuh — tidak ada riwayat versi untuk tahun yang sama.
                    </>
                  )}
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-ink-500 dark:text-ink-300">
                  {tahunImpor === TAHUN_OTOMATIS
                    ? `Tersimpan sekarang: ${formatAngka(ringkasan.daftar_tahun.reduce((t, d) => t + Number(d.jumlah_laporan || 0), 0))} laporan dari ${totalTahunTersedia} tahun.`
                    : isiTahunDipilih
                      ? `Tahun ${tahunImpor} saat ini berisi ${formatAngka(isiTahunDipilih.jumlah_laporan)} laporan.`
                      : `Tahun ${tahunImpor} belum punya data — unggahan ini akan jadi data pertamanya.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={unggah}
                disabled={!berkas || !!galatBerkas || mengunggah}
                className="btn-primary w-full"
              >
                {mengunggah ? <FaSpinner className="animate-spin" /> : <FaFileExcel />}
                {mengunggah ? 'Mengimpor…' : 'Unggah & Ganti Data Tahun Ini'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => muatSemua(halaman, cariAktif, tahun)}
                  disabled={memuatData}
                  className="btn-ghost flex-1"
                >
                  <FaSyncAlt className={memuatData ? 'animate-spin' : ''} /> Muat ulang
                </button>
                {!konfirmasiHapus && (
                  <button
                    type="button"
                    onClick={kosongkanData}
                    disabled={!adaData}
                    className="btn-ghost flex-1 hover:border-rose-400/70 hover:text-rose-600 dark:hover:border-rose-500/40 dark:hover:text-rose-300"
                  >
                    <FaTrashAlt /> {tahun ? `Kosongkan ${tahun}` : 'Kosongkan semua'}
                  </button>
                )}
              </div>

              {/* Konfirmasi hapus dua langkah — sengaja di dalam UI, bukan dialog
                  bawaan browser, supaya tidak terhapus karena klik tak sengaja. */}
              {konfirmasiHapus && (
                <div className="rounded-lg border border-rose-400/60 bg-rose-500/5 p-2 dark:border-rose-500/40">
                  <p className="flex items-start gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                    <FaExclamationTriangle className="mt-0.5 shrink-0" />
                    {tahun
                      ? `Hapus seluruh data tahun ${tahun}? Data tahun lain tetap aman.`
                      : 'Hapus data dari SEMUA tahun? Tindakan ini tidak bisa dibatalkan.'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={kosongkanData}
                      disabled={menghapus}
                      className="btn-ghost flex-1 border-rose-400/70 text-rose-600 hover:bg-rose-500/10 dark:border-rose-500/40 dark:text-rose-300"
                    >
                      {menghapus ? <FaSpinner className="animate-spin" /> : <FaTrashAlt />}
                      {menghapus ? 'Menghapus…' : 'Ya, hapus'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setKonfirmasiHapus(false)}
                      disabled={menghapus}
                      className="btn-ghost flex-1"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {pesan && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] font-medium ${
              pesan.tipe === 'sukses'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}
            role="status"
          >
            {pesan.tipe === 'sukses' ? <FaCheckCircle className="mt-0.5" /> : <FaExclamationTriangle className="mt-0.5" />}
            <span>{pesan.teks}</span>
          </div>
        )}
      </section>

      {/* ============ STATISTIK ============ */}
      <section className="space-y-2">
        <p className="section-label">
          Ringkasan {labelTahun(tahun)}
          {tahun && <span className="ml-1 font-normal text-ink-400 dark:text-ink-500">— dikunci ke satu tahun</span>}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kartuStatistik.map((k, i) => (
            <div key={k.label} className={`panel animate-rise-${Math.min(i + 1, 4)} p-3`}>
              <p className="stat-label">{k.label}</p>
              <p className="stat-value mt-1.5 tnum">{formatAngka(k.nilai)}</p>
              <span className={`mt-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${k.tone}`}>
                {adaData ? 'terisi' : 'kosong'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ============ META UNGGAHAN ============ */}
      <section className="panel animate-rise-1 p-4 sm:p-5">
        <div className="panel-head -mx-4 -mt-4 mb-3 sm:-mx-5 sm:-mt-5">
          <div>
            <p className="section-label">Sumber Data</p>
            <h2 className="text-[15px] font-bold text-ink-900 dark:text-ink-50">Unggahan Terakhir</h2>
          </div>
          {ringkasan.impor_terakhir && (
            <div className="flex flex-wrap items-center gap-2">
              {ringkasan.impor_terakhir.tahun && (
                <span className="chip chip-accent">Tahun {ringkasan.impor_terakhir.tahun}</span>
              )}
              <span className="chip">
                {ringkasan.impor_terakhir.jumlah_laporan} laporan
              </span>
            </div>
          )}
        </div>

        {ringkasan.impor_terakhir ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metaUnggahan(ringkasan.impor_terakhir).map((m) => (
              <div key={m.label}>
                <dt className="stat-label">{m.label}</dt>
                <dd className="mt-0.5 text-[13px] font-medium text-ink-800 dark:text-ink-100">{m.nilai || '-'}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="empty-track">
            <FaFileExcel className="mx-auto mb-2 text-ink-300 dark:text-ink-600" size={22} />
            <p className="text-[12px] font-medium text-ink-500 dark:text-ink-300">
              {tahun
                ? `Belum ada berkas yang diunggah untuk tahun ${tahun}. Pilih berkas Excel laporan Produksi Pangan IRT di panel atas.`
                : 'Belum ada berkas yang diunggah. Pilih berkas Excel laporan Produksi Pangan IRT di panel atas.'}
            </p>
          </div>
        )}

        {/* Ikhtisar semua tahun */}
        {totalTahunTersedia > 0 && (
          <div className="mt-4 border-t border-paper-200 pt-3 dark:border-white/10">
            <p className="stat-label">Isi Tiap Tahun</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(ringkasan.daftar_tahun || []).map((d) => (
                <button
                  key={d.tahun}
                  type="button"
                  onClick={() => gantiTahun(Number(d.tahun))}
                  className={`flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition ${
                    Number(tahun) === Number(d.tahun)
                      ? 'border-accent-400/70 bg-accent-500/10'
                      : 'border-paper-200 bg-paper-50 hover:border-accent-400/60 dark:border-white/10 dark:bg-white/[0.03]'
                  }`}
                >
                  <span className="text-[12px] font-bold text-ink-800 dark:text-ink-100">Tahun {d.tahun}</span>
                  <span className="text-[11px] text-ink-500 dark:text-ink-300">
                    {formatAngka(d.jumlah_laporan)} laporan
                  </span>
                  {d.berkas_terakhir && (
                    <span className="text-[10px] text-ink-400 dark:text-ink-500">{ringkas(d.berkas_terakhir, 34)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============ DAFTAR LAPORAN ============ */}
      <section className="panel animate-rise-2 overflow-hidden">
        <div className="panel-head flex-wrap gap-3">
          <div>
            <p className="section-label">Daftar Laporan {labelTahun(tahun)}</p>
            <h2 className="text-[15px] font-bold text-ink-900 dark:text-ink-50">
              Sarana Produksi Pangan IRT
              <span className="ml-2 text-[11px] font-semibold text-ink-400 dark:text-ink-500">
                {formatAngka(tabel.total)} baris
              </span>
            </h2>
          </div>

          <form onSubmit={terapkanCari} className="flex items-center gap-2">
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-400" />
              <input
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari sarana, kota, grading…"
                className="w-56 rounded-lg border border-paper-300 bg-white py-1.5 pl-7 pr-2 text-[12px] text-ink-800 outline-none transition focus:border-accent-400/70 focus:ring-2 focus:ring-accent-400/25 dark:border-white/10 dark:bg-ink-900 dark:text-ink-100"
              />
            </div>
            <button type="submit" className="btn-ghost">
              Cari
            </button>
          </form>
        </div>

        {memuatData ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-[12px] font-medium text-ink-500 dark:text-ink-300">
            <FaSpinner className="animate-spin" /> Memuat data…
          </div>
        ) : tabel.rows.length === 0 ? (
          <div className="empty-track m-4">
            <FaListAlt className="mx-auto mb-2 text-ink-300 dark:text-ink-600" size={22} />
            <p className="text-[12px] font-medium text-ink-500 dark:text-ink-300">
              {cariAktif
                ? `Tidak ada laporan yang cocok dengan "${cariAktif}"${tahun ? ` di tahun ${tahun}` : ''}.`
                : tahun
                  ? `Belum ada laporan tahun ${tahun}. Unggah berkas Excel-nya di panel atas.`
                  : 'Belum ada laporan tersimpan. Unggah berkas Excel di panel atas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-y border-paper-200 bg-paper-50 dark:border-white/10 dark:bg-white/[0.03]">
                  {kolomTabel.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabel.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-paper-200 transition-colors last:border-0 hover:bg-accent-500/[0.04] dark:border-white/5"
                  >
                    <td className="px-3 py-2 text-[12px] font-semibold tnum text-ink-500 dark:text-ink-300">
                      {row.no_urut}
                    </td>
                    {!tahun && (
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="inline-flex items-center rounded-md bg-accent-500/10 px-1.5 py-0.5 text-[10px] font-bold tnum text-accent-700 dark:text-accent-300">
                          {row.tahun || '-'}
                        </span>
                      </td>
                    )}
                    <td className="max-w-[300px] px-3 py-2">
                      <p className="truncate text-[12px] font-semibold text-ink-900 dark:text-ink-50">
                        {row.nama_sarana || '-'}
                      </p>
                      <p className="truncate text-[11px] text-ink-500 dark:text-ink-300">
                        {ringkas(row.alamat, 60)}
                        {row.jenis_industri ? ` · ${row.jenis_industri}` : ''}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[12px] text-ink-700 dark:text-ink-200">
                      {row.kab_kota || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-ink-600 dark:text-ink-300">
                      {row.tgl_periksa_mulai || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] font-medium text-ink-600 dark:text-ink-300">
                      {row.level_irtp || '-'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${kelasGrading(row.grading)}`}>
                        {row.grading || '-'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] font-medium tnum text-ink-700 dark:text-ink-200">
                      {formatAngka(row.jumlah_serius)}/{formatAngka(row.jumlah_mayor)}/{formatAngka(row.jumlah_minor)}/{formatAngka(row.jumlah_kritis)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${kelasKesimpulan(row.hasil_balai)}`}>
                        {row.hasil_balai || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => bukaDetail(row.id)} className="btn-ghost">
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginasi */}
        {tabel.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-paper-200 px-4 py-3 dark:border-white/10">
            <p className="text-[11px] font-medium text-ink-500 dark:text-ink-300">
              Halaman {tabel.page} dari {tabel.total_halaman} · {formatAngka(tabel.total)} laporan
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => pindahHalaman(halaman - 1)}
                disabled={halaman <= 1}
                className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaChevronLeft /> Sebelumnya
              </button>
              <button
                type="button"
                onClick={() => pindahHalaman(halaman + 1)}
                disabled={halaman >= (tabel.total_halaman || 1)}
                className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
              >
                Berikutnya <FaChevronRight />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ============ DIALOG ============ */}
      {(detail || memuatDetail) && (
        <DetailLaporanModal data={detail} loading={memuatDetail} onClose={tutupDetail} />
      )}
    </div>
  );
}
