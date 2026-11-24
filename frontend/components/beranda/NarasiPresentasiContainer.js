// components/beranda/NarasiPresentasiContainer.js
/**
 * KOREKSI NASKAH PRESENTASI 1 MENIT (dashboard ber-SSO)
 * -----------------------------------------------------
 * Halaman ini dipakai operator untuk MEMERIKSA dan MENGOREKSI naskah yang
 * dibacakan widget LAURA di halaman publik /jendela-kinerja.
 *
 * Alur:
 *   1. Pilih filter (tahun, bulan, kegiatan, jenis sarana, kab/kota).
 *   2. "Ambil data & buat naskah" → angka dashboard filter itu + naskah
 *      otomatis dari LAURA AI (LLM; kalau LLM mati, naskah template).
 *   3. Periksa angkanya di panel "Angka sumber naskah". Kalau ada yang salah,
 *      perbaiki di datanya (modul asal) — bukan di naskah.
 *   4. Koreksi kalimat/naskah di kotak teks, lalu "Simpan koreksi".
 *   5. Widget di /jendela-kinerja memakai naskah koreksi itu HANYA untuk
 *      kombinasi filter yang sama. Filter lain tetap naskah otomatis.
 *
 * Kenapa koreksi per filter: narasi "tahun 2026" berbeda dengan "tahun 2026 +
 * Kosmetika". Satu koreksi tidak boleh menimpa kombinasi lain.
 *
 * Data dashboard diambil dari route PUBLIK /api/publik/kinerja/* (sama dengan
 * yang dipakai halaman publik), jadi angka naskah tidak pernah berbeda dengan
 * yang tampil di layar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaFileAudio, FaSyncAlt, FaPlay, FaStop, FaSave, FaTrash, FaInfoCircle,
  FaCheckCircle, FaExclamationTriangle, FaMicrophoneAlt, FaListUl, FaEdit, FaCog, FaTimes,
} from 'react-icons/fa';
import { useSuaraLaura } from '../../lib/tts';
import PengaturanSuara from '../laura/PengaturanSuara';

/** Filter kosong — kunci harus sama dengan backend (lib/narasi.js). */
const FILTER_KOSONG = { tahun: '', bulan: '', kegiatan: '', jenis: '', kab: '' };

const angka = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x.toLocaleString('id-ID') : '0';
};

const tanggal = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Query string dari filter (nilai kosong tidak dikirim). */
const queryFilter = (filter) => {
  const p = new URLSearchParams();
  Object.entries(filter || {}).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

/**
 * Definisi lima filter (kunci = kolom backend, lihat lib/narasi.js).
 * Dibungkus array supaya JSX tidak menyalin blok <label>+<select> lima kali —
 * dan filter baru cukup ditambah di sini.
 */
const DAFTAR_FILTER = [
  { kunci: 'tahun', label: 'Tahun', semua: 'Semua tahun',
    opsi: (p) => (p?.tahun || []).map((t) => ({ nilai: t.tahun, label: `${t.tahun} (${angka(t.jumlah)})` })) },
  { kunci: 'bulan', label: 'Bulan', semua: 'Semua bulan',
    opsi: (p) => (p?.bulan_semua || []).map((b) => ({ nilai: b.nilai, label: b.nama })) },
  { kunci: 'kegiatan', label: 'Kegiatan', semua: 'Semua kegiatan',
    opsi: (p) => (p?.kegiatan || []).map((k) => ({ nilai: k.kegiatan, label: `${k.kegiatan} (${angka(k.jumlah)})` })) },
  { kunci: 'jenis', label: 'Jenis sarana', semua: 'Semua jenis',
    opsi: (p) => (p?.jenis_sarana || []).map((j) => ({ nilai: j.jenis_sarana, label: j.jenis_sarana })) },
  { kunci: 'kab', label: 'Kabupaten/Kota', semua: 'Semua wilayah',
    opsi: (p) => (p?.kab_kota || []).filter((k) => k.kab_kota !== '-').map((k) => ({ nilai: k.kab_kota, label: k.kab_kota })) },
];

/** Jumlah kata & perkiraan detik baca (150 kata/menit). */
const hitungKata = (teks) => String(teks || '').trim().split(/\s+/).filter(Boolean).length;
const perkiraanDetik = (teks) => Math.max(0, Math.round((hitungKata(teks) / 150) * 60));

export default function NarasiPresentasiContainer() {
  const [filter, setFilter] = useState(FILTER_KOSONG);
  const [pilihan, setPilihan] = useState(null);

  const [dashboard, setDashboard] = useState(null); // angka sumber naskah
  const [naskah, setNaskah] = useState('');
  const [sumber, setSumber] = useState(''); // llm | template | koreksi
  const [catatan, setCatatan] = useState('');

  const [koreksiTersimpan, setKoreksiTersimpan] = useState(null); // koreksi filter aktif
  const [daftar, setDaftar] = useState([]);

  const [memuat, setMemuat] = useState(false);
  const [membuat, setMembuat] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [bicara, setBicara] = useState(false);

  const [galat, setGalat] = useState('');
  const [pesan, setPesan] = useState('');

  // Pengaturan suara yang SAMA dengan widget publik (lib/tts.js) — supaya yang
  // didengar operator di sini persis yang akan didengar pengunjung.
  const suara = useSuaraLaura();
  const [panelSuara, setPanelSuara] = useState(false);

  // True bila minimal satu filter dipilih → tombol "Reset filter" tampil.
  // CATATAN: dihitung SETELAH `pilihan` dideklarasikan. Menaruhnya di atas
  // deklarasi useState `pilihan` membuat `pilihan` masih di zona TDZ
  // (ReferenceError: Cannot access 'pilihan' before initialization) — halaman
  // langsung "Application error" begitu filter diubah.
  const adaFilter = Object.values(filter).some((v) => v !== '' && v !== null && v !== undefined);

  // Chip ringkasan: label + nilai yang sedang dipilih (bukan nilai mentah).
  const ringkasanFilter = DAFTAR_FILTER
    .filter((fld) => filter[fld.kunci] !== '' && filter[fld.kunci] != null)
    .map((fld) => {
      const cocok = fld.opsi(pilihan).find((o) => String(o.nilai) === String(filter[fld.kunci]));
      return { kunci: fld.kunci, label: fld.label, nilai: cocok?.label || filter[fld.kunci] };
    });

  // ---- Pilihan filter (route publik) --------------------------------------
  const muatPilihan = useCallback(async () => {
    try {
      const r = await fetch('/api/publik/kinerja/pilihan');
      const j = await r.json();
      if (j.success) setPilihan(j.data);
    } catch (e) {
      setGalat(`Gagal memuat pilihan filter: ${e.message}`);
    }
  }, []);

  // ---- Daftar koreksi tersimpan (butuh sesi) ------------------------------
  const muatDaftar = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    try {
      const r = await fetch('/api/narasi?limit=100');
      const j = await r.json();
      if (!j.success) throw new Error(j.message || 'Gagal memuat daftar koreksi');
      setDaftar(j.data || []);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, []);

  // ---- Cek koreksi untuk filter aktif -------------------------------------
  const cekKoreksi = useCallback(async (f) => {
    try {
      const r = await fetch(`/api/narasi/aktif${queryFilter(f)}`);
      const j = await r.json();
      setKoreksiTersimpan(j.success ? j.data : null);
    } catch (e) {
      setKoreksiTersimpan(null);
    }
  }, []);

  useEffect(() => {
    muatPilihan();
    muatDaftar();
  }, [muatPilihan, muatDaftar]);

  useEffect(() => {
    cekKoreksi(filter);
    // Naskah lama tidak boleh tertinggal saat filter diganti — bisa
    // disimpan untuk filter yang salah tanpa disadari.
    setNaskah('');
    setSumber('');
    setDashboard(null);
    setPesan('');
  }, [filter, cekKoreksi]);

  // ---- Ambil data + buat naskah -------------------------------------------
  const buatNaskah = async () => {
    setMembuat(true);
    setGalat('');
    setPesan('');
    try {
      const rd = await fetch(`/api/publik/kinerja/ringkasan${queryFilter(filter)}`);
      const jd = await rd.json();
      if (!jd.success) throw new Error(jd.message || 'Gagal mengambil data dashboard');

      const data = jd.data;
      setDashboard(data);

      const rl = await fetch('/api/laura/presentasi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dashboard: data, filter, pakai_llm: true }),
      });
      const jl = await rl.json();
      if (!jl.success) throw new Error(jl.message || 'LAURA gagal membuat naskah');

      setNaskah(jl.data.naskah);
      setSumber(jl.data.sumber);
      setPesan(
        jl.data.sumber === 'llm'
          ? `Naskah dibuat LAURA AI (${jl.data.jumlah_kata} kata, ±${jl.data.perkiraan_detik} detik).`
          : `Naskah dibuat dari angka dashboard (LLM tidak tersedia: ${jl.data.catatan || '-'}).`
      );
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMembuat(false);
    }
  };

  // ---- Simpan koreksi ------------------------------------------------------
  const simpanKoreksi = async () => {
    setMenyimpan(true);
    setGalat('');
    setPesan('');
    try {
      const r = await fetch('/api/narasi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filter, naskah, catatan: catatan || null }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || 'Gagal menyimpan koreksi');
      setPesan(j.message);
      setCatatan('');
      await muatDaftar();
      await cekKoreksi(filter);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMenyimpan(false);
    }
  };

  // ---- Hapus koreksi -------------------------------------------------------
  const hapusKoreksi = async (id, label) => {
    if (typeof window !== 'undefined' && !window.confirm(`Hapus koreksi untuk "${label}"? Naskah otomatis akan dipakai lagi.`)) {
      return;
    }
    setGalat('');
    setPesan('');
    try {
      const r = await fetch(`/api/narasi/${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!j.success) throw new Error(j.message || 'Gagal menghapus koreksi');
      setPesan(j.message);
      await muatDaftar();
      await cekKoreksi(filter);
    } catch (e) {
      setGalat(e.message);
    }
  };

  // ---- Muat koreksi ke editor ---------------------------------------------
  const muatKeEditor = (row) => {
    setFilter({ ...FILTER_KOSONG, ...(row.filter || {}) });
    setNaskah(row.naskah);
    setSumber('koreksi');
    setCatatan('');
    setPesan(`Koreksi "${row.label || 'filter ini'}" dimuat ke editor.`);
  };

  // ---- Putar / hentikan TTS (lewat lib/tts.js) -----------------------------
  const putar = () => {
    if (!suara.tersedia) {
      setGalat('Browser ini tidak mendukung pembacaan suara (Web Speech API).');
      return;
    }
    if (bicara) {
      suara.berhenti();
      setBicara(false);
      return;
    }
    setBicara(true);
    suara.bacakan(naskah, { selesai: () => setBicara(false) });
  };

  // ---- Angka sumber naskah ------------------------------------------------
  const ringkas = useMemo(() => {
    const t = dashboard?.total || {};
    return [
      { label: 'Sarana diperiksa', nilai: t.sarana_diperiksa },
      { label: 'Distribusi', nilai: t.distribusi },
      { label: 'Produksi', nilai: t.produksi },
      { label: 'Sampel lab', nilai: t.sampel_lab },
      { label: 'Memenuhi', nilai: t.memenuhi },
      { label: 'Tidak memenuhi', nilai: t.tidak_memenuhi },
      { label: 'Temuan kritis', nilai: t.temuan_kritis },
      { label: 'Temuan mayor', nilai: t.temuan_mayor },
      { label: 'Temuan minor', nilai: t.temuan_minor },
    ];
  }, [dashboard]);

  const kata = hitungKata(naskah);
  const detik = perkiraanDetik(naskah);
  const terlaluPendek = naskah.trim().length > 0 && naskah.trim().length < 80;

  return (
    <div className="space-y-5">
      {/* ============ Judul ============ */}
      <section className="panel overflow-hidden">
        <div className="grid gap-4 p-5 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <span className="chip chip-accent">
              <FaFileAudio className="h-3 w-3" />
              Narasi presentasi
            </span>
            <h1 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Koreksi Naskah Presentasi 1 Menit
            </h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              Widget LAURA di halaman publik <strong>/jendela-kinerja</strong> membacakan ringkasan
              dashboard selama ±1 menit. Kalau ada angka atau kalimat yang belum sesuai, periksa di
              sini lalu simpan koreksinya. Koreksi berlaku untuk{' '}
              <strong>kombinasi filter yang sama saja</strong> — filter lain tetap memakai naskah
              otomatis.
            </p>
            <p className="mt-2 text-[11.5px] text-slate-400">
              Sumber angka: route publik <code>/api/publik/kinerja/*</code> — sama dengan yang tampil
              di halaman publik, jadi naskah tidak pernah memakai angka berbeda.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-paper-200 bg-paper-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            {[
              { label: 'Koreksi', nilai: daftar.length, kelas: 'text-accent-600' },
              { label: 'Kata', nilai: kata || '-', kelas: 'text-slate-700 dark:text-white' },
              { label: 'Detik', nilai: detik || '-', kelas: 'text-emerald-600' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-lg font-extrabold ${s.kelas}`}>{s.nilai}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {koreksiTersimpan && (
          <div className="flex items-start gap-2 border-t border-emerald-200 bg-emerald-50 px-5 py-2.5 text-[11.5px] text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            <FaCheckCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Filter ini sudah dikoreksi ({koreksiTersimpan.jumlah_kata} kata, oleh{' '}
              {koreksiTersimpan.diubah_oleh || 'operator'}, {tanggal(koreksiTersimpan.diubah_pada)}).
              Widget publik memakai naskah ini.
            </span>
          </div>
        )}
      </section>

      {/* ============ Filter ============ */}
      <section className="panel overflow-hidden">
        <div className="panel-head">
          <div>
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Filter dashboard</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pilih kombinasi data yang naskahnya ingin dikoreksi. Kosong = semua.
            </p>
          </div>
          {adaFilter && (
            <button
              type="button"
              onClick={() => setFilter(FILTER_KOSONG)}
              className="btn-ghost inline-flex items-center gap-1.5 text-[11px]"
              title="Kembalikan semua filter ke Semua"
            >
              <FaTimes className="h-2.5 w-2.5" />
              Reset filter
            </button>
          )}
        </div>

        <div className="grid gap-x-3 gap-y-4 px-5 pt-4 pb-5 sm:grid-cols-2 lg:grid-cols-5">
          {DAFTAR_FILTER.map((fld) => (
            <label key={fld.kunci} className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {fld.label}
              </span>
              <select
                value={filter[fld.kunci]}
                onChange={(e) => setFilter((f) => ({ ...f, [fld.kunci]: e.target.value }))}
                className="input-sm"
                data-kosong={filter[fld.kunci] === '' ? '1' : undefined}
              >
                <option value="">{fld.semua}</option>
                {fld.opsi(pilihan).map((o) => (
                  <option key={o.nilai} value={o.nilai}>{o.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {/* Ringkasan filter aktif: tanpa ini operator tidak tahu kombinasi apa
            yang sedang dipakai saat tombol ditekan. */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-paper-200 px-5 pt-3 dark:border-white/[0.08]">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Filter aktif
          </span>
          {ringkasanFilter.length === 0 ? (
            <span className="rounded-md bg-paper-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
              semua data (tanpa filter)
            </span>
          ) : (
            ringkasanFilter.map((r) => (
              <span
                key={r.kunci}
                className="inline-flex items-center gap-1 rounded-md bg-accent-500/10 px-2 py-0.5 text-[11px] font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-300"
              >
                <span className="text-accent-500/70 dark:text-accent-300/60">{r.label}:</span> {r.nilai}
              </span>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <button
            type="button"
            onClick={buatNaskah}
            disabled={membuat}
            className="btn-primary-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <FaSyncAlt className={membuat ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
            {membuat ? 'Menyiapkan naskah…' : 'Ambil data & buat naskah'}
          </button>
          <button
            type="button"
            onClick={muatDaftar}
            disabled={memuat}
            className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50"
          >
            <FaListUl className={memuat ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
            Muat ulang daftar
          </button>
          {sumber && (
            <span className={
              'ml-auto rounded-full px-2.5 py-1 text-[10.5px] font-bold ' +
              (sumber === 'koreksi'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : sumber === 'llm'
                  ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300')
            }>
              naskah: {sumber}
            </span>
          )}
        </div>
      </section>

      {galat && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
          <FaExclamationTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{galat}</span>
        </div>
      )}
      {pesan && !galat && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          <FaCheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{pesan}</span>
        </div>
      )}

      {/* ============ Angka sumber ============ */}
      {dashboard && (
        <section className="panel overflow-hidden">
          <div className="panel-head">
            <div>
              <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Angka sumber naskah</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Angka inilah yang dipakai narasi. Kalau ada yang salah, perbaiki di modul asalnya —
                bukan di naskah.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 p-5 sm:grid-cols-5 lg:grid-cols-9">
            {ringkas.map((s) => (
              <div key={s.label} className="rounded-lg border border-paper-200 bg-paper-50/60 px-2 py-1.5 text-center dark:border-white/[0.08] dark:bg-white/[0.03]">
                <p className="text-[13px] font-extrabold text-slate-800 dark:text-white">{angka(s.nilai)}</p>
                <p className="text-[9.5px] leading-tight text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ Editor naskah ============ */}
      <section className="panel overflow-hidden">
        <div className="panel-head">
          <div>
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Naskah presentasi</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ±150 kata = ±60 detik bicara. Sunting seperlunya, lalu simpan koreksi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPanelSuara((v) => !v)}
              title="Ganti suara, kecepatan, dan nada"
              className={
                'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold transition ' +
                (panelSuara
                  ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
                  : 'bg-paper-100 text-slate-600 hover:bg-paper-200 dark:bg-white/[0.07] dark:text-slate-300')
              }
            >
              <FaCog className="h-3 w-3" />
              Suara
            </button>
            <button
              type="button"
              onClick={putar}
              disabled={!naskah.trim()}
              className="btn-ghost inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              {bicara ? <FaStop className="h-3 w-3" /> : <FaPlay className="h-3 w-3" />}
              {bicara ? 'Hentikan' : 'Dengarkan'}
            </button>
            <button
              type="button"
              onClick={simpanKoreksi}
              disabled={!naskah.trim() || menyimpan || terlaluPendek}
              className="btn-primary-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              <FaSave className="h-3 w-3" />
              {menyimpan ? 'Menyimpan…' : 'Simpan koreksi'}
            </button>
          </div>
        </div>

        {panelSuara && (
          <div className="border-b border-paper-200 bg-paper-50/70 px-5 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
              Suara Laura di widget publik
            </p>
            <PengaturanSuara suara={suara} ringkas />
          </div>
        )}

        <div className="p-5">
          <textarea
            value={naskah}
            onChange={(e) => setNaskah(e.target.value)}
            rows={10}
            placeholder="Klik “Ambil data & buat naskah” untuk membuat naskah otomatis dari angka dashboard, atau tulis sendiri naskahnya di sini."
            className="w-full resize-y rounded-xl border border-paper-200 bg-white p-3 text-[12.5px] leading-relaxed text-slate-800 outline-none transition focus:border-accent-500 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-white"
          />

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span>{kata} kata · ±{detik} detik</span>
            <span className={detik < 40 || detik > 90 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
              {detik === 0 ? 'belum ada naskah' : detik < 40 ? 'terlalu singkat untuk 1 menit' : detik > 90 ? 'terlalu panjang untuk 1 menit' : 'panjang sesuai (±1 menit)'}
            </span>
            {terlaluPendek && (
              <span className="text-rose-600 dark:text-rose-400">minimal 80 karakter agar bisa disimpan</span>
            )}
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Catatan koreksi (opsional)
            </span>
            <input
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              maxLength={255}
              placeholder="mis. angka sampel diperbaiki setelah verifikasi ulang"
              className="input-sm w-full max-w-xl"
            />
          </label>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
            <FaInfoCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Koreksi disimpan untuk filter yang sedang dipilih. Widget publik memakainya hanya bila
              filter dashboard sama; kombinasi lain tetap memakai naskah otomatis dari LAURA AI.
            </span>
          </p>
        </div>
      </section>

      {/* ============ Daftar koreksi ============ */}
      <section className="panel overflow-hidden">
        <div className="panel-head">
          <div>
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">
              Koreksi tersimpan ({daftar.length})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Hapus koreksi → naskah otomatis dipakai lagi untuk filter itu.
            </p>
          </div>
        </div>

        {daftar.length === 0 ? (
          <p className="px-5 py-6 text-center text-[12px] text-slate-400">
            Belum ada koreksi. Semua filter masih memakai naskah otomatis dari angka dashboard.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead className="border-b border-paper-200 text-[10px] uppercase tracking-wide text-slate-400 dark:border-white/[0.08]">
                <tr>
                  <th className="px-4 py-2">Filter</th>
                  <th className="px-4 py-2">Kata</th>
                  <th className="px-4 py-2">Diubah oleh</th>
                  <th className="px-4 py-2">Waktu</th>
                  <th className="px-4 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((row) => (
                  <tr key={row.id} className="border-b border-paper-100 last:border-0 dark:border-white/[0.05]">
                    <td className="px-4 py-2">
                      <p className="font-semibold text-slate-800 dark:text-white">{row.label || 'tanpa filter'}</p>
                      <p className="line-clamp-1 text-[10.5px] text-slate-400">{row.naskah}</p>
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{row.jumlah_kata}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{row.diubah_oleh || '-'}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{tanggal(row.diubah_pada)}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => muatKeEditor(row)}
                          className="btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <FaEdit className="h-2.5 w-2.5" />
                          Sunting
                        </button>
                        <button
                          type="button"
                          onClick={() => hapusKoreksi(row.id, row.label)}
                          className="btn-ghost inline-flex items-center gap-1.5 whitespace-nowrap text-rose-600 hover:text-rose-700 dark:text-rose-400"
                        >
                          <FaTrash className="h-2.5 w-2.5" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============ Penjelasan ============ */}
      <section className="panel p-5">
        <h2 className="flex items-center gap-2 text-[13px] font-bold text-slate-900 dark:text-white">
          <FaMicrophoneAlt className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
          Bagaimana widget publik memakai koreksi ini
        </h2>
        <ol className="mt-2 space-y-1 pl-4 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
          <li className="list-decimal">
            Pengunjung membuka <code>/jendela-kinerja</code>, menekan maskot LAURA, lalu tombol{' '}
            <strong>Presentasi Dashboard</strong>.
          </li>
          <li className="list-decimal">
            Widget menanyakan koreksi untuk filter yang sedang aktif di halaman itu. Ada koreksi → yang
            dibacakan naskah koreksi; belum ada → naskah otomatis dari angka dashboard.
          </li>
          <li className="list-decimal">
            Setelah narasi selesai, panel <strong>Tanya Laura</strong> terbuka: pertanyaan diketik atau
            diucapkan (mic), dijawab dari knowledge base yang memuat data modul ini.
          </li>
        </ol>
      </section>
    </div>
  );
}
