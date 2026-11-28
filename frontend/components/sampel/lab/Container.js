// components/sampel/lab/Container.js
/**
 * MODUL: SAMPEL \u2014 Container (dipakai semua komoditi)
 * --------------------------------------------------
 * Impor "REKAP DATA SAMPEL" (export SIPT) dari berkas Excel, lalu tampilkan
 * sebagai tabel + rincian per SAMPEL yang diuji laboratorium.
 *
 * Satu komponen untuk SEMUA komoditi (Obat Tradisional, Suplemen Kesehatan, \u2026):
 * halaman cukup mengirim `jenis` ("ot" / "sk") dan sisa perbedaannya
 * (prefix API, judul) dibaca dari components/sampel/lab/config.js. Menyalin
 * folder komponen per komoditi = jaminan perbaikannya hanya mendarat di satu
 * tempat.
 *
 * ==== KONVENSI STRUKTUR APLIKASI (sama dengan modul lain) ====
 *   pages/sampel/<segmen>/index.js       -> halaman TIPIS (<Head> + layout + container)
 *   components/sampel/lab/Container.js   -> seluruh logika & tampilan modul (file ini)
 *   components/sampel/lab/helper.js      -> konstanta & formatter (tanpa state/API)
 *   components/sampel/lab/Modal.js       -> dialog rincian sampel
 *   components/sampel/lab/config.js      -> perbedaan antar komoditi
 *   backend/lib/sampel.js                -> parsing Excel + CRUD (engine bersama)
 *   backend/routes/sampel-<segmen>.js    -> konfigurasi engine per komoditi
 * ============================================================
 *
 * ATURAN IMPOR (PER TAHUN): data disimpan terpisah per tahun. Setiap unggahan
 * mengganti SELURUH data tahun yang dipilih (atau tahun yang terbaca dari
 * berkas) dan TIDAK menyentuh tahun lain. Penggantian dijalankan backend dalam
 * satu transaksi, jadi berkas gagal baca tidak pernah menghapus data lama.
 *
 * BEDA dengan modul Produksi/Distribusi: satu SAMPEL bisa memakan beberapa baris
 * di berkas Excel (kolom Kategori & Komposisi berlanjut). Penggabungan baris
 * dikerjakan backend \u2014 di sini baris sudah bersih: satu baris = satu sampel.
 *
 * Permintaan API lewat proxy server `pages/api/sampel/[...path].js` \u2014
 * token Keycloak tidak pernah menyentuh browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAksesPenuh } from '../../../utils/peran';
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
  FaFlask,
  FaLock,
} from 'react-icons/fa';
import { DetailSampelModal } from './Modal';
import { konfig } from './config';
import {
  formatAngka,
  formatUkuran,
  kelasKesimpulan,
  kesimpulanPenuh,
  labelTahun,
  metaUnggahan,
  opsiTahun,
  ringkas,
  ringkasanTahun,
  OPSI_KESIMPULAN,
  TAHUN_OTOMATIS,
  TONE_TILE,
  validasiBerkas,
} from './helper';

const LIMIT = 25;

/** Ringkasan kosong supaya render pertama tidak perlu null-check panjang. */
const RINGKASAN_KOSONG = {
  tahun: null,
  impor_terakhir: null,
  total: {
    total_sampel: 0,
    memenuhi: 0,
    tidak_memenuhi: 0,
    jumlah_kab: 0,
    jumlah_sarana: 0,
    jumlah_produk: 0,
  },
  sebaran_kesimpulan: [],
  sebaran_sediaan: [],
  sebaran_tujuan: [],
  per_kab_kota: [],
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

export default function SampelContainer({ jenis = 'ot' }) {
  // Hanya admin & admin_jendela_kinerja yang boleh mengubah data.
  const aksesPenuh = useAksesPenuh();
  /** Perbedaan antar komoditi: prefix API + judul halaman. */
  const konf = konfig(jenis);
  const API = konf.api;

  // --- data ---
  const [ringkasan, setRingkasan] = useState(RINGKASAN_KOSONG);
  const [tabel, setTabel] = useState({ rows: [], total: 0, page: 1, total_halaman: 1 });
  const [memuatData, setMemuatData] = useState(true);

  // --- filter ---
  const [tahun, setTahun] = useState(null); // null = semua tahun
  const [kesimpulan, setKesimpulan] = useState('');
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
  const adaData = (ringkasan.total?.total_sampel || 0) > 0;
  const daftarPilihanTahun = opsiTahun(ringkasan.daftar_tahun);
  const isiTahunDipilih = ringkasanTahun(ringkasan.daftar_tahun, tahunImpor);

  // ------------------------------------------------------------------
  // Muat data
  // ------------------------------------------------------------------
  const muatRingkasan = useCallback(async (tahunPilih) => {
    const q = tahunPilih ? `?tahun=${tahunPilih}` : '';
    const r = await fetch(`${API}/summary${q}`, { headers: { accept: 'application/json' } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || 'Gagal memuat ringkasan');
    setRingkasan({ ...RINGKASAN_KOSONG, ...(j.data || {}) });
  }, [API]);

  const muatTabel = useCallback(async (halamanTujuan = 1, kataKunci = '', tahunPilih = null, kesimpulanPilih = '') => {
    const q = new URLSearchParams({
      page: String(halamanTujuan),
      limit: String(LIMIT),
      ...(kataKunci ? { q: kataKunci } : {}),
      ...(tahunPilih ? { tahun: String(tahunPilih) } : {}),
      ...(kesimpulanPilih ? { kesimpulan: kesimpulanPilih } : {}),
    });
    const r = await fetch(`${API}/sampel?${q.toString()}`, { headers: { accept: 'application/json' } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || 'Gagal memuat daftar sampel');
    setTabel({ rows: [], total: 0, page: 1, total_halaman: 1, ...(j.data || {}) });
  }, [API]);

  const muatSemua = useCallback(async (
    halamanTujuan = halaman,
    kataKunci = cariAktif,
    tahunPilih = tahun,
    kesimpulanPilih = kesimpulan,
  ) => {
    setMemuatData(true);
    try {
      await Promise.all([
        muatRingkasan(tahunPilih),
        muatTabel(halamanTujuan, kataKunci, tahunPilih, kesimpulanPilih),
      ]);
    } catch (e) {
      setPesan({ tipe: 'galat', teks: e.message });
    } finally {
      setMemuatData(false);
    }
  }, [cariAktif, halaman, tahun, kesimpulan, muatRingkasan, muatTabel]);

  useEffect(() => {
    muatSemua(1, '', null, '');
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
    muatSemua(1, cariAktif, tahunBaru, kesimpulan);
  };

  const gantiKesimpulan = (nilai) => {
    setKesimpulan(nilai);
    setHalaman(1);
    muatSemua(1, cariAktif, tahun, nilai);
  };

  const terapkanCari = (e) => {
    e.preventDefault();
    setHalaman(1);
    setCariAktif(cari.trim());
    muatSemua(1, cari.trim(), tahun, kesimpulan);
  };

  const pindahHalaman = (tujuan) => {
    const t = Math.min(Math.max(1, tujuan), tabel.total_halaman || 1);
    if (t === halaman) return;
    setHalaman(t);
    muatTabel(t, cariAktif, tahun, kesimpulan).catch((err) => setPesan({ tipe: 'galat', teks: err.message }));
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
      const r = await fetch(`${API}/import`, { method: 'POST', body: fd });
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
      setKesimpulan('');
      await muatSemua(1, '', tahunHasil, '');
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
      const r = await fetch(`${API}/data${tahun ? `?tahun=${tahun}` : ''}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Gagal menghapus data');
      setPesan({ tipe: 'sukses', teks: j.message });
      setHalaman(1);
      setCariAktif('');
      setCari('');
      setKesimpulan('');
      setKonfirmasiHapus(false);
      await muatSemua(1, '', tahun, '');
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
      const r = await fetch(`${API}/sampel/${id}`, { headers: { accept: 'application/json' } });
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
    { label: 'Sampel Diuji', nilai: ringkasan.total?.total_sampel, tone: TONE_TILE.accent },
    { label: 'Memenuhi Syarat', nilai: ringkasan.total?.memenuhi, tone: TONE_TILE.emerald },
    { label: 'Tidak Memenuhi', nilai: ringkasan.total?.tidak_memenuhi, tone: TONE_TILE.rose },
    { label: 'Produk Berbeda', nilai: ringkasan.total?.jumlah_produk, tone: TONE_TILE.amber },
  ];

  // Kolom "Tahun" hanya relevan saat melihat gabungan semua tahun.
  // Kolom "Sampel" memuat KODE SAMPEL di baris pertama (bisa disalin/dicari
  // persis seperti tertulis di berkas), baru nama produk & pabrik di bawahnya.
  const kolomTabel = tahun
    ? ['No', 'Kode Sampel / Produk', 'Sarana / Kab-Kota', 'Tgl Sampling', 'Sediaan', 'Kesimpulan', '']
    : ['No', 'Tahun', 'Kode Sampel / Produk', 'Sarana / Kab-Kota', 'Tgl Sampling', 'Sediaan', 'Kesimpulan', ''];

  const totalTahunTersedia = (ringkasan.daftar_tahun || []).length;
  const judulHalaman = konf.judul;

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
              {formatAngka(
                tahun === null
                  ? ringkasan.total?.total_sampel
                  : (ringkasan.daftar_tahun || []).reduce((t, d) => t + Number(d.jumlah_sampel || 0), 0),
              )}
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
              <span className="tnum text-[11px] font-bold opacity-70">{formatAngka(d.jumlah_sampel)}</span>
            </button>
          ))}
          {totalTahunTersedia === 0 && (
            <span className="text-[11px] font-medium text-ink-400 dark:text-ink-500">
              belum ada data tersimpan
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-500 dark:text-ink-300">
          Data disimpan terpisah per tahun. Mengunggah berkas sampel 2024 hanya mengganti data 2024 \u2014
          data tahun lain tetap utuh.
        </p>
      </section>

      {/* Pengguna tanpa akses penuh (mis. peran `user`) tetap bisa membaca
          seluruh data modul, tetapi berkas tidak boleh diubah: panel unggah,
          impor, dan tombol kosongkan disembunyikan. Backend juga menolak
          (403) bila ada yang mencoba memanggil API tulis langsung. */}
      {!aksesPenuh && (
        <section className="panel flex items-start gap-2.5 p-3.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">
            <FaLock size={13} />
          </span>
          <div>
            <p className="text-[12px] font-bold text-ink-900 dark:text-ink-50">Mode baca saja</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500 dark:text-ink-300">
              Peran Anda dapat membuka dan membaca semua modul, tetapi tidak dapat mengunggah,
              mengimpor, atau menghapus data. Hubungi administrator bila data perlu diperbarui.
            </p>
          </div>
        </section>
      )}

      {/* ============ UNGGAH BERKAS ============ */}
      {aksesPenuh && (
      <section className="panel animate-rise p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Dropzone */}
          <div>
            <p className="section-label">Impor Rekap Data Sampel (Excel)</p>
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
                    {formatUkuran(berkas.size)} \xb7 klik untuk mengganti berkas
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-semibold text-ink-800 dark:text-ink-100">
                    Lepas berkas di sini atau klik untuk memilih
                  </p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-300">
                    .xlsx / .xls / .xlsm \xb7 maksimal 15 MB
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
                <option value={TAHUN_OTOMATIS}>Otomatis \u2014 dibaca dari isi berkas</option>
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
                  Tahun data dibaca dari tanggal sampling terbanyak di dalam berkas. Data tahun
                  lain tidak tersentuh \u2014 tidak ada riwayat versi untuk tahun yang sama.
                </p>
                <p className="mt-1.5 text-[11px] font-medium text-ink-500 dark:text-ink-300">
                  {tahunImpor === TAHUN_OTOMATIS
                    ? `Tersimpan sekarang: ${formatAngka(
                        (ringkasan.daftar_tahun || []).reduce((t, d) => t + Number(d.jumlah_sampel || 0), 0),
                      )} sampel dari ${totalTahunTersedia} tahun.`
                    : isiTahunDipilih
                      ? `Tahun ${tahunImpor} saat ini berisi ${formatAngka(isiTahunDipilih.jumlah_sampel)} sampel.`
                      : `Tahun ${tahunImpor} belum punya data \u2014 unggahan ini akan jadi data pertamanya.`}
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-ink-500 dark:text-ink-300">
                  <FaFlask className="mt-0.5 shrink-0" />
                  <span>
                    Satu sampel di berkas bisa memakan beberapa baris (Kategori &amp; Komposisi
                    berlanjut). Baris tersebut digabung otomatis \u2014 jumlah yang tersimpan adalah
                    jumlah SAMPEL, bukan jumlah baris.
                  </span>
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
                {mengunggah ? 'Mengimpor\u2026' : 'Unggah & Ganti Data Tahun Ini'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => muatSemua(halaman, cariAktif, tahun, kesimpulan)}
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

              {/* Konfirmasi hapus dua langkah \u2014 sengaja di dalam UI, bukan dialog
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
                      {menghapus ? 'Menghapus\u2026' : 'Ya, hapus'}
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
      )}

      {/* ============ STATISTIK ============ */}
      <section className="space-y-2">
        <p className="section-label">
          Ringkasan {labelTahun(tahun)}
          {tahun && <span className="ml-1 font-normal text-ink-400 dark:text-ink-500">\u2014 dikunci ke satu tahun</span>}
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

      {/* ============ SEBARAN (hanya bila ada data) ============ */}
      {adaData && (ringkasan.sebaran_sediaan?.length > 0 || ringkasan.per_kab_kota?.length > 0) && (
        <section className="grid gap-3 lg:grid-cols-2">
          <div className="panel animate-rise-1 p-4">
            <p className="section-label">Bentuk Sediaan Terbanyak</p>
            <ul className="mt-2 space-y-1.5">
              {(ringkasan.sebaran_sediaan || []).slice(0, 8).map((s) => {
                const maks = Math.max(...(ringkasan.sebaran_sediaan || []).map((x) => Number(x.jumlah) || 1), 1);
                return (
                  <li key={s.label}>
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate font-medium text-ink-800 dark:text-ink-100">{s.label}</span>
                      <span className="tnum shrink-0 font-bold text-ink-500 dark:text-ink-300">
                        {formatAngka(s.jumlah)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-200 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-hijau-400 to-accent-600"
                        style={{ width: `${Math.round((Number(s.jumlah) / maks) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="panel animate-rise-2 p-4">
            <p className="section-label">Sebaran per Kabupaten/Kota</p>
            <ul className="mt-2 divide-y divide-paper-200 dark:divide-white/10">
              {(ringkasan.per_kab_kota || []).map((k) => (
                <li key={k.kab_kota} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate text-[12px] font-medium text-ink-800 dark:text-ink-100">
                    {k.kab_kota}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {Number(k.tidak_memenuhi) > 0 && (
                      <span className="inline-flex items-center rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300">
                        {formatAngka(k.tidak_memenuhi)} TMS
                      </span>
                    )}
                    <span className="tnum text-[12px] font-bold text-ink-600 dark:text-ink-300">
                      {formatAngka(k.jumlah)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

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
              <span className="chip">{formatAngka(ringkasan.impor_terakhir.jumlah_sampel)} sampel</span>
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
                ? `Belum ada berkas yang diunggah untuk tahun ${tahun}. Pilih berkas rekap data sampel di panel atas.`
                : 'Belum ada berkas yang diunggah. Pilih berkas rekap data sampel di panel atas.'}
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
                    {formatAngka(d.jumlah_sampel)} sampel
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

      {/* ============ DAFTAR SAMPEL ============ */}
      <section className="panel animate-rise-2 overflow-hidden">
        <div className="panel-head flex-wrap gap-3">
          <div>
            <p className="section-label">Daftar Sampel {labelTahun(tahun)}</p>
            <h2 className="text-[15px] font-bold text-ink-900 dark:text-ink-50">
              {judulHalaman}
              <span className="ml-2 text-[11px] font-semibold text-ink-400 dark:text-ink-500">
                {formatAngka(tabel.total)} sampel
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kesimpulan}
              onChange={(e) => gantiKesimpulan(e.target.value)}
              className="rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-800 outline-none transition focus:border-accent-400/70 focus:ring-2 focus:ring-accent-400/25 dark:border-white/10 dark:bg-ink-900 dark:text-ink-100"
            >
              {OPSI_KESIMPULAN.map((o) => (
                <option key={o.nilai} value={o.nilai}>{o.label}</option>
              ))}
            </select>

            <form onSubmit={terapkanCari} className="flex items-center gap-2">
              <div className="relative">
                <FaSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-400" />
                <input
                  type="search"
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  placeholder="Cari kode sampel, nama, pabrik\u2026"
                  className="w-56 rounded-lg border border-paper-300 bg-white py-1.5 pl-7 pr-2 text-[12px] text-ink-800 outline-none transition focus:border-accent-400/70 focus:ring-2 focus:ring-accent-400/25 dark:border-white/10 dark:bg-ink-900 dark:text-ink-100"
                />
              </div>
              <button type="submit" className="btn-ghost">
                Cari
              </button>
            </form>
          </div>
        </div>

        {memuatData ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-[12px] font-medium text-ink-500 dark:text-ink-300">
            <FaSpinner className="animate-spin" /> Memuat data\u2026
          </div>
        ) : tabel.rows.length === 0 ? (
          <div className="empty-track m-4">
            <FaListAlt className="mx-auto mb-2 text-ink-300 dark:text-ink-600" size={22} />
            <p className="text-[12px] font-medium text-ink-500 dark:text-ink-300">
              {cariAktif || kesimpulan
                ? `Tidak ada sampel yang cocok${cariAktif ? ` dengan "${cariAktif}"` : ''}${kesimpulan ? ` (kesimpulan: ${kesimpulan})` : ''}${tahun ? ` di tahun ${tahun}` : ''}.`
                : tahun
                  ? `Belum ada sampel tahun ${tahun}. Unggah berkas Excel-nya di panel atas.`
                  : 'Belum ada sampel tersimpan. Unggah berkas Excel di panel atas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-y border-paper-200 bg-paper-50 dark:border-white/10 dark:bg-white/[0.03]">
                  {kolomTabel.map((h, i) => (
                    <th
                      key={`${h}-${i}`}
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
                    <td className="max-w-[320px] px-3 py-2">
                      {/* Kode sampel ditaruh paling depan supaya bisa dicari
                          langsung dari nomor yang tertulis di berkas/SPK. */}
                      <p className="truncate font-mono text-[12px] font-bold tracking-tight text-accent-700 dark:text-accent-300">
                        {row.nomor_sampel || '-'}
                      </p>
                      <p className="truncate text-[12px] font-semibold text-ink-900 dark:text-ink-50">
                        {row.nama_sampel || '-'}
                      </p>
                      <p className="truncate text-[11px] text-ink-500 dark:text-ink-300">
                        {row.no_reg ? `${row.no_reg} \xb7 ` : ''}
                        {ringkas(row.pabrik, 40)}
                      </p>
                    </td>
                    <td className="max-w-[240px] px-3 py-2">
                      <p className="truncate text-[12px] text-ink-700 dark:text-ink-200">
                        {ringkas(row.nama_sarana, 40)}
                      </p>
                      <p className="truncate text-[11px] text-ink-500 dark:text-ink-300">
                        {row.kab_kota || '-'}
                        {/* Tujuan sampling tidak ada di semua berkas (berkas Obat
                            tidak punya kolomnya) \u2014 jangan tampilkan "\xb7 -" kosong. */}
                        {row.tujuan_sampling ? ` \xb7 ${row.tujuan_sampling}` : ''}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-ink-600 dark:text-ink-300">
                      {row.tgl_sampling || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-ink-600 dark:text-ink-300">
                      {row.bentuk_sediaan || '-'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${kelasKesimpulan(row.kesimpulan_akhir)}`}>
                        {kesimpulanPenuh(row.kesimpulan_akhir)}
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
              Halaman {tabel.page} dari {tabel.total_halaman} \xb7 {formatAngka(tabel.total)} sampel
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
      {detail && <DetailSampelModal sampel={detail} onTutup={tutupDetail} />}
      {memuatDetail && !detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-[12px] font-medium text-ink-600 shadow-lg dark:bg-ink-900 dark:text-ink-200">
            <FaSpinner className="animate-spin" /> Memuat rincian sampel\u2026
          </div>
        </div>
      )}
    </div>
  );
}
