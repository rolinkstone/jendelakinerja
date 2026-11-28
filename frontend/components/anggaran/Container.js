// components/anggaran/Container.js
/**
 * MODUL: ANGGARAN & REALISASI — Container
 * ---------------------------------------
 * Impor export SAKTI "Realisasi FA berdasarkan SP2D" (KODE COA | PAGU |
 * REALISASI | SISA PAGU) lalu tampilkan rekap per MAK.
 *
 * MAK TIDAK dikirim dari berkas: ia dibentuk backend dari kode COA
 * (lib/mak.js) dan disimpan di kolom `mak`. Tampilan hanya membaca hasilnya,
 * jadi kalau aturan pembentukan MAK diperbaiki, cukup jalankan ulang impor -
 * tidak ada logika pemotongan string di frontend yang harus ikut diubah.
 *
 * ==== KONVENSI STRUKTUR (sama dengan modul lain) ====
 *   pages/data-realisasi/index.js         -> halaman TIPIS
 *   components/anggaran/Container.js      -> logika & tampilan (file ini)
 *   components/anggaran/helper.js         -> formatter (tanpa state/API)
 *   backend/routes/anggaran-realisasi.js  -> router tipis
 *   backend/lib/anggaran.js               -> mesin baca berkas + simpan
 *   backend/lib/mak.js                    -> aturan pembentukan MAK
 * ===================================================
 *
 * ATURAN IMPOR: satu unggahan = satu tahun anggaran. Data tahun itu DIGANTI
 * seluruhnya, tahun lain tidak disentuh (2025 dan 2026 bisa berdampingan).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAksesPenuh } from '../../utils/peran';
import {
  FaCloudUploadAlt,
  // Dipakai panel unggah ADK bulanan + judul ringkasan (lihat bagian unggah).
  FaCalendarAlt,
  FaEraser,
  FaPen,
  FaSave,
  FaHistory,
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
  FaWallet,
  FaCoins,
  FaPiggyBank,
  FaPercent,
  FaLayerGroup,
  FaFilter,
  FaTimes,
  FaLock,
} from 'react-icons/fa';
import {
  formatAngka,
  formatPersen,
  // Angka ditampilkan penuh (17.000.000); versi ringkas ("194,7 jt") tidak
  // dipakai lagi karena menyulitkan pencocokan dengan dokumen.
  formatUkuran,
  tahunSekarang,
  validasiBerkas,
  warnaserapan,
} from './helper';

const LIMIT = 50;

/** Label bulan untuk kisi status 12 bulan (3 huruf) dan tooltip (panjang). */
const BULAN_PENDEK_SEMPIT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_LENGKAP = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Ringkasan kosong supaya render pertama tidak perlu null-check panjang. */
const RINGKASAN_KOSONG = {
  tahun: null,
  baris: 0,
  pagu: 0,
  realisasi: 0,
  sisa: 0,
  persen_serapan: 0,
  jumlah_mak: 0,
  jumlah_komponen: 0,
  jumlah_akun: 0,
  berkas: null,
};

/** Warna batang serapan. */
function warnaBatang(persen) {
  const n = Number(persen) || 0;
  if (n >= 95) return 'bg-gradient-to-r from-hijau-500 to-hijau-400';
  return 'bg-gradient-to-r from-accent-500 to-accent-400';
}

export default function AnggaranRealisasiContainer() {
  // Hanya admin & admin_jendela_kinerja yang boleh mengubah data.
  const aksesPenuh = useAksesPenuh();
  // --- data ---
  const [ringkasan, setRingkasan] = useState(RINGKASAN_KOSONG);
  const [tabel, setTabel] = useState({ rows: [], total: 0, page: 1, total_halaman: 1 });
  const [daftarTahun, setDaftarTahun] = useState([]);
  const [memuatData, setMemuatData] = useState(true);

  // --- filter ---
  // tahun  : tahun anggaran
  // kode   : KODE (komponen) - AEA, BAH, BDB, QCD, ...
  // jenis  : JENIS MAK (akun belanja) - 524111, 521211, 511123, ...
  const [tahun, setTahun] = useState(null); // null = belum ditentukan
  const [kode, setKode] = useState('');
  const [jenis, setJenis] = useState('');
  const [pilihan, setPilihan] = useState({ komponen: [], akun: [] });
  const [cari, setCari] = useState('');
  const [cariAktif, setCariAktif] = useState('');
  const [halaman, setHalaman] = useState(1);

  // --- unggah ---
  const [berkas, setBerkas] = useState(null);
  const [tahunImpor, setTahunImpor] = useState(String(tahunSekarang()));
  const [mengunggah, setMengunggah] = useState(false);
  // --- unggah ADK bulanan (sumber yang punya tanggal transaksi) ---
  // Form ketikan realisasi bulanan: nilai mentah (string) per bulan agar
  // pengguna bisa mengetik bebas, lalu dirapikan saat disimpan.
  const [ketikBulanan, setKetikBulanan] = useState(() => Array.from({ length: 12 }, () => ({ pagu: '', realisasi: '' })));
  const [menyimpanBulanan, setMenyimpanBulanan] = useState(false);
  const [statusBulanan, setStatusBulanan] = useState(null); // { tahun, total, daftar_tahun, kumulatif, bulan_terisi }
  const [modalBulanan, setModalBulanan] = useState(false);
  // --- kosongkan realisasi bulanan (semua bulan atau satu bulan) ---
  const [modalKosong, setModalKosong] = useState(false);
  const [bulanKosong, setBulanKosong] = useState(''); // '' = semua bulan
  const [mengosongkan, setMengosongkan] = useState(false);
  const [pesan, setPesan] = useState(null); // { jenis: 'sukses'|'galat'|'info', teks }
  const inputBerkas = useRef(null);

  /**
   * Muat isi ketiga dropdown (tahun, kode, jenis MAK) dalam SATU permintaan.
   * Kalau dipecah tiga fetch, dropdown terisi bergantian dan terlihat berkedip
   * saat halaman pertama dibuka.
   */
  const muatPilihan = useCallback(async (th) => {
    try {
      const qs = th ? `?tahun=${th}` : '';
      const r = await fetch(`/api/anggaran-realisasi/pilihan${qs}`);
      const j = await r.json();
      if (!j.success) return;
      const d = j.data || {};
      setDaftarTahun(d.tahun || []);
      setPilihan({ komponen: d.komponen || [], akun: d.akun || [] });
      // Tahun terbaru dipakai sebagai awal supaya halaman tidak kosong padahal
      // datanya ada.
      setTahun((t) => t ?? d.dipakai ?? null);
    } catch (_) {
      /* diamkan: dropdown bukan data inti */
    }
  }, []);

  /** Muat ringkasan satu tahun. */
  const muatRingkasan = useCallback(async (th) => {
    if (!th) {
      setRingkasan(RINGKASAN_KOSONG);
      return;
    }
    try {
      const r = await fetch(`/api/anggaran-realisasi/ringkasan?tahun=${th}`);
      const j = await r.json();
      if (j.success) setRingkasan(j.data);
    } catch (_) {
      /* diamkan */
    }
  }, []);

  /** Muat tabel MAK (server-side paging). */
  const muatTabel = useCallback(async (th, hal, q, komp, akun) => {
    if (!th) {
      setTabel({ rows: [], total: 0, page: 1, total_halaman: 1 });
      return;
    }
    setMemuatData(true);
    try {
      // Urut dari pagu TERBESAR. Di berkas SP2D ada 1.115 baris ber-pagu 0
      // (record tanpa anggaran); kalau diurut abjad MAK, halaman pertama penuh
      // angka nol dan pembaca mengira impornya gagal.
      const qs = new URLSearchParams({
        tahun: String(th),
        page: String(hal),
        limit: String(LIMIT),
        urut: 'pagu',
        arah: 'desc',
      });
      if (q) qs.set('q', q);
      // Filter KODE = komponen MAK (AEA/BAH/BDB). Filter JENIS = akun (524111).
      if (komp) qs.set('komponen', komp);
      if (akun) qs.set('akun', akun);
      const r = await fetch(`/api/anggaran-realisasi/detail?${qs.toString()}`);
      const j = await r.json();
      if (j.success) setTabel(j.data);
    } catch (e) {
      setPesan({ jenis: 'galat', teks: `Gagal memuat data: ${e.message}` });
    } finally {
      setMemuatData(false);
    }
  }, []);

  useEffect(() => {
    muatPilihan(tahun);
  }, [muatPilihan, tahun]);

  useEffect(() => {
    if (!tahun) return;
    muatRingkasan(tahun);
    muatTabel(tahun, halaman, cariAktif, kode, jenis);
    muatBulanan(tahun);
  }, [tahun, halaman, cariAktif, kode, jenis, muatRingkasan, muatTabel]);

  /** Kirim pencarian: kembali ke halaman 1 supaya hasil tidak kosong. */
  const kirimCari = (e) => {
    e.preventDefault();
    setHalaman(1);
    setCariAktif(cari.trim());
  };

  /** Status sebaran bulanan (berapa tahun yang sudah punya data ADK). */
  const muatBulanan = useCallback(async (th) => {
    try {
      const qs = th ? `?tahun=${th}` : '';
      const r = await fetch(`/api/anggaran-realisasi/bulanan${qs}`);
      const j = await r.json();
      if (j.success) setStatusBulanan(j.data);
    } catch (_) {
      /* diamkan: panel pendukung */
    }
  }, []);

  /**
   * Simpan realisasi bulanan hasil KETIKAN (pagu + realisasi per bulan).
   * Bulan yang kedua kolomnya dikosongkan/diisi 0 akan dihapus di backend,
   * supaya kisi 12 bulan menampilkan keadaan sebenarnya.
   */
  const simpanBulananKetik = async (e) => {
    e?.preventDefault?.();
    if (!tahun) return;

    // Rapikan angka Indonesia: "1.250.000" / "1,250,000" / "1250000" -> 1250000
    const angka = (t) => {
      const bersih = String(t ?? '').replace(/[^\d-]/g, '');
      return bersih === '' || bersih === '-' ? 0 : Number(bersih);
    };

    // Hanya kirim bulan yang memang diisi, agar bulan lain tidak tersentuh.
    const baris = ketikBulanan
      .map((r, i2) => ({ bulan: i2 + 1, pagu: angka(r.pagu), realisasi: angka(r.realisasi) }))
      .filter((r) => r.pagu !== 0 || r.realisasi !== 0);
    const adaKosong = ketikBulanan.some((r, i2) => {
      const b = baris.find((x) => x.bulan === i2 + 1);
      return !b && (r.pagu !== '' || r.realisasi !== '');
    });
    if (adaKosong) {
      return setPesan({
        jenis: 'galat',
        teks: 'Ada bulan yang diisi 0 - kosongkan kedua kolomnya bila ingin menghapus bulan itu.',
      });
    }
    if (!baris.length) return setPesan({ jenis: 'galat', teks: 'Isi minimal satu bulan.' });

    setMenyimpanBulanan(true);
    setPesan(null);
    try {
      const r = await fetch('/api/anggaran-realisasi/bulanan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tahun: Number(tahun), baris }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message || `HTTP ${r.status}`);

      setPesan({ jenis: 'sukses', teks: j.message });
      setModalBulanan(false);
      setKetikBulanan(Array.from({ length: 12 }, () => ({ pagu: '', realisasi: '' })));
      setStatusBulanan((lama) => ({
        ...(lama || {}),
        tahun: Number(tahun),
        kumulatif: j.data.kumulatif,
        total: (j.data.kumulatif || []).at(-1)?.kumulatif || 0,
        daftar_tahun: [...new Set([Number(tahun), ...(lama?.daftar_tahun || [])])].sort((x, y) => y - x),
      }));
    } catch (err) {
      setPesan({ jenis: 'galat', teks: err.message });
    } finally {
      setMenyimpanBulanan(false);
    }
  };

  /** Isi form ketikan dari angka yang sudah tersimpan (untuk koreksi). */
  const isiFormDariTersimpan = () => {
    const sumber = statusBulanan?.kumulatif || [];
    setKetikBulanan(
      Array.from({ length: 12 }, (_, i2) => {
        const b = sumber[i2] || {};
        return {
          pagu: Number(b.pagu) ? String(Number(b.pagu)) : '',
          realisasi: Number(b.nilai) ? String(Number(b.nilai)) : '',
        };
      }),
    );
  };

  /**
   * Kosongkan realisasi bulanan.
   * `bulanKosong` kosong berarti SELURUH bulan tahun terpilih dihapus; kalau
   * diisi 1-12 hanya bulan itu yang dihapus dan bulan lain tetap tersimpan.
   * Keduanya memakai endpoint yang sama, pembedaannya parameter `bulan`.
   */
  const kosongkanBulanan = async () => {
    if (!tahun) return;
    setMengosongkan(true);
    setPesan(null);
    try {
      const qs = `?tahun=${tahun}${bulanKosong ? `&bulan=${bulanKosong}` : ''}`;
      const r = await fetch(`/api/anggaran-realisasi/bulanan${qs}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message || `HTTP ${r.status}`);

      setPesan({ jenis: 'sukses', teks: j.message });
      setStatusBulanan((lama) => ({
        ...(lama || {}),
        tahun: tahun,
        kumulatif: j.data.kumulatif,
        total: (j.data.kumulatif || []).at(-1)?.kumulatif || 0,
      }));
      setModalKosong(false);
      setBulanKosong('');
    } catch (err) {
      setPesan({ jenis: 'galat', teks: err.message });
    } finally {
      setMengosongkan(false);
    }
  };

  const unggah = async (e) => {
    e.preventDefault();
    const galat = validasiBerkas(berkas);
    if (galat) return setPesan({ jenis: 'galat', teks: galat });
    if (!/^\d{4}$/.test(tahunImpor)) return setPesan({ jenis: 'galat', teks: 'Tahun anggaran harus 4 digit (mis. 2026).' });

    const fd = new FormData();
    fd.append('berkas', berkas);
    fd.append('tahun', tahunImpor);

    setMengunggah(true);
    setPesan(null);
    try {
      const r = await fetch('/api/anggaran-realisasi/import', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.message || `HTTP ${r.status}`);

      const d = j.data || {};
      setPesan({
        jenis: 'sukses',
        teks:
          `${j.message}. Pagu ${formatAngka(d.total?.pagu)} · realisasi ${formatAngka(d.total?.realisasi)}.` +
          (d.jumlah_tanpa_mak ? ` ${d.jumlah_tanpa_mak} baris tidak bisa dibentuk MAK-nya (dilewati).` : ''),
      });
      setBerkas(null);
      if (inputBerkas.current) inputBerkas.current.value = '';
      setTahun(Number(tahunImpor));
      setHalaman(1);
      await muatPilihan(Number(tahunImpor));
      await muatRingkasan(Number(tahunImpor));
      await muatTabel(Number(tahunImpor), 1, cariAktif, kode, jenis);
    } catch (err) {
      setPesan({ jenis: 'galat', teks: err.message });
    } finally {
      setMengunggah(false);
    }
  };

  const hapusTahun = async () => {
    if (!tahun) return;
    if (!window.confirm(`Hapus seluruh data anggaran tahun ${tahun}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const r = await fetch(`/api/anggaran-realisasi/data?tahun=${tahun}`, { method: 'DELETE' });
      const j = await r.json();
      if (!j.success) throw new Error(j.message);
      setPesan({ jenis: 'sukses', teks: j.message });
      setTahun(null);
      setKode('');
      setJenis('');
      await muatPilihan();
      setTabel({ rows: [], total: 0, page: 1, total_halaman: 1 });
      setRingkasan(RINGKASAN_KOSONG);
    } catch (e) {
      setPesan({ jenis: 'galat', teks: e.message });
    }
  };

  // Empat angka pokok.
  // Angka ditulis PENUH dengan pemisah ribuan (17.000.000), bukan disingkat
  // ("194,7 jt"): nilai anggaran dipakai untuk pencocokan dokumen, jadi angka
  // yang sudah dibulatkan justru menyulitkan pembaca.
  // Bulan yang benar-benar punya nilai (bukan sekadar tercatat 0). Dipakai
  // modal impor untuk memberi tahu bulan mana yang sudah masuk.
  const bulanTerisi = (statusBulanan?.kumulatif || [])
    .filter((b) => Number(b.nilai) > 0)
    .map((b) => b.bulan);

  const angkaPokok = [
    { label: 'Pagu', nilai: formatAngka(ringkasan.pagu), penuh: 'rupiah', ikon: FaWallet, warna: 'text-accent-600 dark:text-accent-400' },
    { label: 'Realisasi', nilai: formatAngka(ringkasan.realisasi), penuh: 'rupiah', ikon: FaCoins, warna: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Sisa Pagu', nilai: formatAngka(ringkasan.sisa), penuh: 'rupiah', ikon: FaPiggyBank, warna: 'text-slate-600 dark:text-slate-300' },
    { label: 'Serapan', nilai: formatPersen(ringkasan.persen_serapan), penuh: `${formatAngka(ringkasan.jumlah_mak)} MAK`, ikon: FaPercent, warna: warnaserapan(ringkasan.persen_serapan) },
  ];

  return (
    <div className="space-y-4">
      {/* ================= Judul halaman ================= */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Data Realisasi</h1>
          <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">
            Pagu, realisasi, dan sisa anggaran per MAK dari export SAKTI
            <em> Realisasi FA berdasarkan SP2D</em>.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary-sm"
          onClick={() => { muatPilihan(tahun); muatRingkasan(tahun); muatTabel(tahun, halaman, cariAktif, kode, jenis); }}
        >
          <FaSyncAlt className="h-3 w-3" /> Muat ulang
        </button>
      </div>

      {/* ================= Pesan ================= */}
      {pesan && (
        <div
          className={[
            'flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-snug',
            pesan.jenis === 'sukses'
              ? 'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300'
              : pesan.jenis === 'galat'
                ? 'border-rose-300/60 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:text-rose-300'
                : 'border-accent-300/60 bg-accent-500/10 text-accent-700 dark:border-accent-500/30 dark:text-accent-300',
          ].join(' ')}
        >
          {pesan.jenis === 'sukses' ? (
            <FaCheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : pesan.jenis === 'galat' ? (
            <FaExclamationTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <FaInfoCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1">{pesan.teks}</span>
        </div>
      )}

      {/* ================= Filter =================
          Tiga dropdown terpisah sesuai istilah yang dipakai di SAKTI:
            Tahun     : tahun anggaran
            Kode      : komponen MAK - AEA, BAH, BDB, QCD, ...
            Jenis MAK : akun belanja - 524111, 521211, 511123, ...
          Isinya berasal dari satu permintaan /pilihan supaya tidak berkedip. */}
      <div className="panel">
        <div className="panel-head flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FaFilter className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Filter</h2>
            {(kode || jenis || cariAktif) && (
              <span className="badge-primary">aktif</span>
            )}
          </div>
          <form onSubmit={kirimCari} className="flex flex-wrap items-center gap-2">
            {/* ---- Tahun ---- */}
            <label className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tahun</span>
              <select
                className="input-sm w-[104px]"
                value={tahun ?? ''}
                onChange={(e) => {
                  setHalaman(1);
                  setKode('');
                  setJenis('');
                  setTahun(e.target.value ? Number(e.target.value) : null);
                }}
              >
                <option value="">Semua</option>
                {daftarTahun.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            {/* ---- Kode (komponen) ---- */}
            <label className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Kode</span>
              <select
                className="input-sm w-[92px]"
                value={kode}
                onChange={(e) => {
                  setHalaman(1);
                  setKode(e.target.value);
                }}
              >
                <option value="">Semua</option>
                {pilihan.komponen.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            {/* ---- Jenis MAK (akun) ---- */}
            <label className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Jenis MAK</span>
              <select
                className="input-sm w-[112px]"
                value={jenis}
                onChange={(e) => {
                  setHalaman(1);
                  setJenis(e.target.value);
                }}
              >
                <option value="">Semua</option>
                {pilihan.akun.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            {/* ---- Pencarian bebas ---- */}
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari MAK / akun / komponen"
                className="input-sm w-[196px] pl-7"
              />
            </div>

            <button type="submit" className="btn-primary-sm">
              <FaSearch className="h-3 w-3" /> Cari
            </button>

            {(kode || jenis || cariAktif) && (
              <button
                type="button"
                className="btn-primary-sm"
                onClick={() => {
                  setKode('');
                  setJenis('');
                  setCari('');
                  setCariAktif('');
                  setHalaman(1);
                }}
              >
                <FaTimes className="h-3 w-3" /> Reset
              </button>
            )}
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-paper-200 px-4 py-2.5 text-[11px] text-slate-400 dark:border-white/[0.08] dark:text-slate-500">
          <span>
            Kode = komponen MAK (<code className="rounded bg-paper-100 px-1 dark:bg-white/[0.06]">AEA</code>,{' '}
            <code className="rounded bg-paper-100 px-1 dark:bg-white/[0.06]">BDC</code>)
          </span>
          <span>
            Jenis MAK = akun belanja (<code className="rounded bg-paper-100 px-1 dark:bg-white/[0.06]">524111</code>,{' '}
            <code className="rounded bg-paper-100 px-1 dark:bg-white/[0.06]">521211</code>)
          </span>
        </div>
      </div>

      {/* ================= Unggah berkas =================
          Hanya untuk admin & admin_jendela_kinerja. Peran lain (mis. `user`)
          tetap membaca seluruh angka; backend juga menolak impor/hapus. */}
      {!aksesPenuh && (
        <div className="panel flex items-start gap-2.5 px-3 py-2.5">
          <FaLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
          <p className="text-[12px] leading-snug text-slate-600 dark:text-slate-300">
            <strong className="font-bold text-slate-800 dark:text-white">Mode baca saja.</strong>{' '}
            Anda dapat membuka dan membaca semua modul, tetapi tidak dapat mengunggah, mengimpor,
            mengubah realisasi bulanan, atau menghapus data.
          </p>
        </div>
      )}

      {aksesPenuh && (
      <div className="panel">
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <FaCloudUploadAlt className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Unggah Realisasi FA berdasarkan SP2D</h2>
          </div>
          {ringkasan.berkas && (
            <span className="badge-primary truncate max-w-[240px]" title={ringkasan.berkas.nama_berkas}>
              {ringkasan.berkas.nama_berkas}
            </span>
          )}
        </div>

        <form onSubmit={unggah} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Berkas Excel
            </label>
            <input
              ref={inputBerkas}
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setBerkas(f);
                setPesan(f ? null : pesan);
              }}
              className="input-sm w-full file:mr-3 file:rounded-lg file:border-0 file:bg-accent-500/15 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-accent-700 dark:file:text-accent-300"
            />
            {berkas && (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                <FaFileExcel className="h-3 w-3" /> {berkas.name} · {formatUkuran(berkas.size)}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tahun anggaran
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={tahunImpor}
              onChange={(e) => setTahunImpor(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input-sm w-[110px] text-center tnum"
            />
          </div>
          <button type="submit" className="btn-primary h-[34px]" disabled={mengunggah || !berkas}>
            {mengunggah ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaCloudUploadAlt className="h-3.5 w-3.5" />}
            {mengunggah ? 'Mengimpor…' : 'Impor'}
          </button>
        </form>

        <p className="border-t border-paper-200 px-4 py-2.5 text-[11px] leading-snug text-slate-400 dark:border-white/[0.08] dark:text-slate-500">
          Impor mengganti <strong>seluruh</strong> data tahun yang dipilih; tahun lain tidak tersentuh. Kode COA
          disimpan utuh, sedangkan kode MAK dibentuk otomatis dari COA — contoh{' '}
          <code className="rounded bg-paper-100 px-1 py-0.5 dark:bg-white/[0.06]">3165.BDB.001.051.524111.A</code>.
        </p>
      </div>
      )}

      {/* ================= Data bulanan: status + pemicu modal =================
          Berkas ADK diunggah PER BULAN (mis. "Tanggal,2026-01-01 s.d 2026-01-31"),
          jadi panel ini menampilkan bulan mana yang sudah masuk dan membuka
          modal untuk mengunggah bulan berikutnya. */}
      <div className="panel">
        <div className="panel-head flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FaCalendarAlt className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Realisasi Bulanan</h2>
          </div>
          <div className="flex items-center gap-2">
            {statusBulanan?.total > 0 && (
              <span className="badge-primary tnum hidden sm:inline-flex">
                {statusBulanan.tahun} · {formatAngka(statusBulanan.total)}
              </span>
            )}
            {aksesPenuh && (
            <>
            <button
              type="button"
              className="btn-primary-sm"
              onClick={() => {
                // Form langsung terisi angka tersimpan supaya pengguna tinggal
                // mengoreksi, bukan mengetik ulang dari nol.
                isiFormDariTersimpan();
                setPesan(null);
                setModalBulanan(true);
              }}
            >
              <FaPen className="h-3 w-3" /> Isi bulanan
            </button>
            <button
              type="button"
              className="btn-danger-sm"
              onClick={() => {
                setBulanKosong('');
                setPesan(null);
                setModalKosong(true);
              }}
              disabled={!statusBulanan?.total}
              title={!statusBulanan?.total ? 'Belum ada data bulanan untuk dikosongkan' : 'Kosongkan realisasi bulanan'}
            >
              <FaEraser className="h-3 w-3" /> Kosongkan
            </button>
            </>
            )}
          </div>
        </div>

        {/* Peta 12 bulan: hijau = sudah ada datanya, abu = belum. */}
        <div className="grid grid-cols-6 gap-1.5 px-4 py-3 sm:grid-cols-12">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((b) => {
            const terisi = (statusBulanan?.kumulatif?.[b - 1]?.nilai || 0) > 0;
            const kum = statusBulanan?.kumulatif?.[b - 1]?.kumulatif || 0;
            return (
              <div
                key={b}
                className={[
                  'rounded-lg px-1.5 py-1.5 text-center',
                  terisi
                    ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300'
                    : 'bg-paper-100 text-slate-400 ring-1 ring-paper-200 dark:bg-white/[0.04] dark:text-slate-500 dark:ring-white/10',
                ].join(' ')}
                title={terisi ? `${BULAN_LENGKAP[b - 1]}: kumulatif ${formatAngka(kum)}` : `${BULAN_LENGKAP[b - 1]}: belum ada data`}
              >
                <p className="text-[9.5px] font-bold uppercase tracking-wide">{BULAN_PENDEK_SEMPIT[b - 1]}</p>
                <p className="tnum text-[9px] leading-tight">{terisi ? '✓' : '–'}</p>
              </div>
            );
          })}
        </div>

        <p className="border-t border-paper-200 px-4 py-2.5 text-[11px] leading-snug text-slate-400 dark:border-white/[0.08] dark:text-slate-500">
          Pagu dan realisasi diisi manual per bulan. Mengisi satu bulan TIDAK menghapus bulan lain; mengosongkan kedua
          kolom sebuah bulan akan menghapus bulan itu.
        </p>
      </div>

      {/* ================= Modal isi realisasi bulanan (ketik) =================
          Pengganti unggah berkas: pagu dan realisasi per bulan diketik langsung.
          Bulan yang dikosongkan tidak dikirim, jadi angka lama bulan lain utuh. */}
      {modalBulanan && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Isi realisasi bulanan"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalBulanan(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-[#0f172a]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">Isi Realisasi Bulanan</h3>
                <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                  Tahun {tahun}. Ketik pagu dan realisasi tiap bulan — bulan yang dibiarkan kosong tidak diubah.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalBulanan(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-paper-100 dark:hover:bg-white/10"
                aria-label="Tutup"
              >
                <FaTimes className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bulan bertanda <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓</span> sudah ada
                datanya.
              </p>
              <button type="button" className="btn-primary-sm" onClick={isiFormDariTersimpan}>
                <FaHistory className="h-3 w-3" /> Muat angka tersimpan
              </button>
            </div>

            <form onSubmit={simpanBulananKetik} className="mt-3">
              <div className="overflow-hidden rounded-xl ring-1 ring-paper-200 dark:ring-white/10">
                <table className="w-full text-[12px]">
                  <thead className="bg-paper-50 text-[10.5px] uppercase tracking-wider text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
                    <tr>
                      <th className="px-2.5 py-2 text-left font-bold">Bulan</th>
                      <th className="px-2.5 py-2 text-right font-bold">Pagu</th>
                      <th className="px-2.5 py-2 text-right font-bold">Realisasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-200 dark:divide-white/[0.07]">
                    {BULAN_LENGKAP.map((nm, i2) => {
                      const terisi = bulanTerisi.includes(i2 + 1);
                      return (
                        <tr key={nm} className="last:border-0">
                          <td className="whitespace-nowrap px-2.5 py-1.5 font-semibold text-slate-600 dark:text-slate-300">
                            {nm}
                            {terisi && <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">✓</span>}
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={ketikBulanan[i2]?.pagu ?? ''}
                              onChange={(e) =>
                                setKetikBulanan((lama) =>
                                  lama.map((r, k) => (k === i2 ? { ...r, pagu: e.target.value } : r)),
                                )
                              }
                              className="tnum w-full rounded-lg border border-paper-300 bg-white px-2 py-1.5 text-right text-[12px] text-slate-700 outline-none focus:border-accent-400/70 focus:ring-2 focus:ring-accent-400/25 dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={ketikBulanan[i2]?.realisasi ?? ''}
                              onChange={(e) =>
                                setKetikBulanan((lama) =>
                                  lama.map((r, k) => (k === i2 ? { ...r, realisasi: e.target.value } : r)),
                                )
                              }
                              className="tnum w-full rounded-lg border border-paper-300 bg-white px-2 py-1.5 text-right text-[12px] text-slate-700 outline-none focus:border-accent-400/70 focus:ring-2 focus:ring-accent-400/25 dark:border-white/10 dark:bg-ink-900 dark:text-slate-100"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button type="button" className="btn-primary-sm" onClick={() => setModalBulanan(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary h-[34px]" disabled={menyimpanBulanan}>
                  {menyimpanBulanan ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaSave className="h-3.5 w-3.5" />}
                  {menyimpanBulanan ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= Modal kosongkan realisasi bulanan ================= */}
      {modalKosong && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Kosongkan realisasi bulanan"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalKosong(false);
          }}
        >
          <div className="w-full max-w-[460px] rounded-2xl bg-white p-5 shadow-xl dark:bg-[#0f172a]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">Kosongkan Realisasi Bulanan</h3>
                <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                  Tahun {tahun}. Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalKosong(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-paper-100 dark:hover:bg-white/10"
                aria-label="Tutup"
              >
                <FaTimes className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Cakupan
                </label>
                <select
                  className="input-sm w-full"
                  value={bulanKosong}
                  onChange={(e) => setBulanKosong(e.target.value)}
                >
                  <option value="">Semua bulan (Januari–Desember)</option>
                  {BULAN_LENGKAP.map((nm, i) => (
                    <option key={nm} value={i + 1}>
                      Bulan {nm}
                      {bulanTerisi.includes(i + 1) ? ' — ada data' : ' — kosong'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-[11px] leading-snug text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-200">
                {bulanKosong
                  ? `Hanya data bulan ${BULAN_LENGKAP[Number(bulanKosong) - 1]} yang dihapus. Bulan lain tetap tersimpan.`
                  : 'SELURUH data bulanan tahun ini dihapus. Grafik "Realisasi Belanja per Bulan" menjadi kosong sampai diunggah ulang.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" className="btn-primary-sm" onClick={() => setModalKosong(false)}>
                  Batal
                </button>
                <button type="button" className="btn-danger-sm h-[34px] px-3" onClick={kosongkanBulanan} disabled={mengosongkan}>
                  {mengosongkan ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaEraser className="h-3.5 w-3.5" />}
                  {mengosongkan ? 'Menghapus…' : bulanKosong ? `Kosongkan ${BULAN_LENGKAP[Number(bulanKosong) - 1]}` : 'Kosongkan semua'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= Angka pokok ================= */}
      <div className="panel">
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <FaWallet className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">
              Ringkasan {ringkasan.tahun ? `Tahun Anggaran ${ringkasan.tahun}` : ''}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip chip-accent hidden sm:inline-flex">
              <FaLayerGroup className="h-3 w-3" />
              {formatAngka(ringkasan.jumlah_mak)} MAK · {ringkasan.jumlah_komponen} komponen · {ringkasan.jumlah_akun} akun
            </span>
            {tahun && aksesPenuh && (
              <button type="button" className="btn-primary-sm !text-rose-600 dark:!text-rose-400" onClick={hapusTahun} title={`Hapus data tahun ${tahun}`}>
                <FaTrashAlt className="h-3 w-3" /> Kosongkan
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4">
          {angkaPokok.map((k, i) => {
            const Ikon = k.ikon;
            return (
              <div
                key={k.label}
                className={[
                  'px-3 py-3.5 sm:px-4 sm:py-4',
                  i === 1 ? 'border-l border-paper-200 dark:border-white/[0.08]' : '',
                  i === 2 ? 'border-t border-paper-200 dark:border-white/[0.08] sm:border-l sm:border-t-0' : '',
                  i === 3 ? 'border-l border-t border-paper-200 dark:border-white/[0.08] sm:border-t-0' : '',
                ].join(' ')}
              >
                <p className="flex items-start gap-1.5 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-400 dark:text-slate-500">
                  <Ikon className={`mt-[1px] h-3 w-3 shrink-0 ${k.warna}`} />
                  <span className="min-w-0">{k.label}</span>
                </p>
                <p className={`stat-value mt-1.5 text-[15px] leading-tight sm:text-lg ${k.warna}`} title={k.penuh}>
                  {memuatData && !ringkasan.tahun ? '…' : k.nilai}
                </p>
                <p className="mt-1 text-[10.5px] leading-snug text-slate-400 dark:text-slate-500 sm:text-[11px]">{k.penuh}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= Tabel MAK ================= */}
      <div className="panel">
        <div className="panel-head flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FaLayerGroup className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Rekap per MAK</h2>
            <span className="badge-primary">{formatAngka(tabel.total)} MAK</span>
          </div>
          {/* Pencarian & filter ada di panel Filter di atas; di sini hanya
              penanda supaya jelas tabel ini sedang tersaring. */}
          <div className="flex items-center gap-1.5">
            {tahun && <span className="chip">{tahun}</span>}
            {kode && <span className="chip">Kode {kode}</span>}
            {jenis && <span className="chip">Jenis {jenis}</span>}
            {cariAktif && <span className="chip">“{cariAktif}”</span>}
          </div>
        </div>

        {/* ---- Ponsel: kartu bertumpuk (tabel 6 kolom tidak terbaca di 390 px) ---- */}
        <ul className="divide-y divide-paper-200 md:hidden dark:divide-white/[0.06]">
          {tabel.rows.map((r) => (
            <li key={r.mak} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="break-all text-[12.5px] font-bold leading-snug text-slate-800 dark:text-white">{r.mak}</p>
                <span className={`tnum shrink-0 text-[12.5px] font-bold ${warnaserapan(r.persen_serapan)}`}>
                  {formatPersen(r.persen_serapan)}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">Pagu</dt>
                  <dd className="tnum break-words text-[12.5px] font-semibold text-slate-800 dark:text-white">{formatAngka(r.pagu)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">Realisasi</dt>
                  <dd className="tnum break-words text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">{formatAngka(r.realisasi)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">Sisa pagu</dt>
                  <dd className="tnum break-words text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">{formatAngka(r.sisa)}</dd>
                </div>
              </dl>
              <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-paper-200 dark:bg-white/10">
                <span className={`block h-full rounded-full ${warnaBatang(r.persen_serapan)}`} style={{ width: `${Math.min(Number(r.persen_serapan) || 0, 100)}%` }} />
              </span>
            </li>
          ))}
          {tabel.rows.length === 0 && (
            <li className="px-4 py-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
              {memuatData ? 'Memuat data…' : 'Belum ada data MAK untuk tahun ini.'}
            </li>
          )}
        </ul>

        {/* ---- Layar sedang ke atas: tabel penuh ---- */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-paper-200 bg-paper-50/70 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <th className="th min-w-[150px] text-left">MAK</th>
                <th className="th w-[82px] text-center">Komponen</th>
                <th className="th w-[78px] text-center">Akun</th>
                <th className="th w-[132px] text-right">Pagu</th>
                <th className="th w-[132px] text-right">Realisasi</th>
                <th className="th w-[118px] text-right">Sisa</th>
                <th className="th w-[132px] text-left">Serapan</th>
              </tr>
            </thead>
            <tbody>
              {tabel.rows.map((r) => (
                <tr
                  key={r.mak}
                  className="border-b border-paper-200 last:border-0 even:bg-paper-50/40 hover:bg-accent-500/[0.05] dark:border-white/[0.06] dark:even:bg-white/[0.02] dark:hover:bg-accent-500/[0.08]"
                >
                  <td className="px-4 py-2.5">
                    <p className="break-all text-[12px] font-semibold leading-snug text-slate-700 dark:text-slate-200">{r.mak}</p>
                    <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-slate-500">
                      unit {r.unit_kerja} · huruf {r.huruf} · {r.jumlah_baris} baris COA
                    </p>
                  </td>
                  <td className="px-2 py-2.5 text-center text-[12px] font-semibold text-accent-600 dark:text-accent-400">{r.komponen}</td>
                  <td className="tnum px-2 py-2.5 text-center text-[12px] text-slate-600 dark:text-slate-300">{r.akun}</td>
                  <td className="tnum px-3 py-2.5 text-right text-[11.5px] font-semibold text-slate-800 dark:text-white">
                    {formatAngka(r.pagu)}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatAngka(r.realisasi)}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-[11.5px] text-slate-600 dark:text-slate-300">
                    {formatAngka(r.sisa)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`tnum w-[46px] shrink-0 text-right text-[11.5px] font-bold ${warnaserapan(r.persen_serapan)}`}>
                        {formatPersen(r.persen_serapan)}
                      </span>
                      <span className="h-1.5 w-full max-w-[110px] overflow-hidden rounded-full bg-paper-200 dark:bg-white/10">
                        <span className={`block h-full rounded-full ${warnaBatang(r.persen_serapan)}`} style={{ width: `${Math.min(Number(r.persen_serapan) || 0, 100)}%` }} />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {tabel.rows.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
                    {memuatData ? 'Memuat data…' : 'Belum ada data MAK untuk tahun ini.'}
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>

        {/* ================= Paging ================= */}
        <div className="flex items-center justify-between gap-2 border-t border-paper-200 px-4 py-2.5 dark:border-white/[0.08]">
          <p className="text-[11.5px] text-slate-400 dark:text-slate-500">
            Halaman {tabel.page || 1} dari {tabel.total_halaman || 1} · {formatAngka(tabel.total)} MAK
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="btn-primary-sm"
              disabled={(tabel.page || 1) <= 1}
              onClick={() => setHalaman((h) => Math.max(1, h - 1))}
            >
              <FaChevronLeft className="h-3 w-3" /> Sebelumnya
            </button>
            <button
              type="button"
              className="btn-primary-sm"
              disabled={(tabel.page || 1) >= (tabel.total_halaman || 1)}
              onClick={() => setHalaman((h) => h + 1)}
            >
              Berikutnya <FaChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}