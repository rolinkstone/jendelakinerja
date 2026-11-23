// components/jendela-kinerja/LauraAI.js
/**
 * WIDGET LAURA AI — presentasi bersuara + tanya jawab
 * ----------------------------------------------------
 * Maskot LAURA menempel di pojok kanan bawah halaman publik /jendela-kinerja.
 * SEMUA interaksi terjadi DI HALAMAN INI — tidak berpindah ke aplikasi LAURA;
 * LAURA hanya menjadi "mesin" di belakang (proxy /api/laura/* → backend LAURA).
 *
 * Alur Presentasi:
 *  1. Pengguna klik tombol "Presentasi Dashboard".
 *  2. Widget memakai data dashboard yang SAMA dengan yang tampil di layar
 *     (prop `dataDashboard` dari Container — state `ringkasan`).
 *  3. POST /api/laura/presentasi → naskah narasi ±1 menit (150 kata).
 *  4. Naskah dibacakan Web Speech API `speechSynthesis` (built-in browser,
 *     gratis, offline). Suara Indonesia dipilih bila tersedia.
 *  5. Setelah selesai bicara, panel tanya sudah terbuka di bawahnya.
 *
 * Alur Tanya:
 *  - Ketik pertanyaan, atau klik mic (Web Speech Recognition, Chrome/Edge).
 *  - Jawaban dari RAG knowledge base LAURA (termasuk 62 chunk data JK hasil
 *    sinkronisasi endpoint publik).
 *  - Jawaban tampil sebagai gelembung chat DAN dibacakan via TTS.
 *
 * Aset: public/images/maskot-bpom.png (RGBA 263x948, proporsi tinggi-sempit).
 */
import { useEffect, useRef, useState } from 'react';
import {
  FaTimes, FaPlay, FaStop, FaMicrophone, FaPaperPlane, FaVolumeUp,
  FaSpinner, FaCommentDots, FaChevronDown, FaKeyboard, FaCog,
} from 'react-icons/fa';
import { useSuaraLaura } from '../../lib/tts';
import PengaturanSuara from '../laura/PengaturanSuara';

const KUNCI_TUTUP = 'laura-balon-tutup';
const KUNCI_SESI = 'laura-jk-session-id';
/** Mode tanya terakhir (suara/teks) — diingat agar tidak dipilih ulang. */
const KUNCI_MODE = 'laura-jk-mode-tanya';

/** Kecepatan baca TTS — sedikit lebih lambat dari normal agar jelas. */
const LAJU_BICARA = 0.98;

/**
 * Bersihkan teks jawaban LAURA sebelum dibacakan.
 * Jawaban RAG sering memakai markdown (tabel, **tebal**, daftar [-]) — kalau
 * dibacakan apa adanya, mesin suara akan mengucapkan "garis tegak", "tanda
 * bintang", dan angka tabel berderet tanpa arti.
 */
function bersihkanUntukSuara(teks) {
  return String(teks || '')
    // tabel markdown → buang baris pemisah & pipa, sisakan isi sel
    .replace(/^\s*\|?[\s:|-]{4,}\|?\s*$/gm, '')
    .replace(/\|/g, ', ')
    // penanda format
    .replace(/[*_`#>]+/g, '')
    // tautan [teks](url) → teks
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // daftar berbutir di awal baris
    .replace(/^\s*[-•]\s+/gm, '')
    // baris baru → jeda kalimat
    .replace(/\s*\n+\s*/g, '. ')
    // sitasi [1], [2] tidak perlu diucapkan
    .replace(/\[\d+\]/g, '')
    // rapikan spasi & titik ganda
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function LauraAI({ dataDashboard = null, filterAktif = null }) {
  // ---- Panel & balon -------------------------------------------------------
  const [balon, setBalon] = useState(false);
  const [panel, setPanel] = useState(false); // panel utama (presentasi + chat)

  // ---- Presentasi ----------------------------------------------------------
  const [status, setStatus] = useState('siaga'); // siaga|menyiapkan|bicara|selesai
  const [naskah, setNaskah] = useState('');
  const [naskahSumber, setNaskahSumber] = useState(''); // koreksi|llm|template
  const [galat, setGalat] = useState('');

  // ---- Chat ----------------------------------------------------------------
  const [tanya, setTanya] = useState('');
  const [pesan, setPesan] = useState([]); // {peran:'saya'|'laura', teks}
  const [mengirim, setMengirim] = useState(false);
  const [bicaraMic, setBicaraMic] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  /**
   * MODE TANYA — ditentukan SETELAH presentasi selesai.
   *  - null    : belum dipilih; pengguna melihat dua tombol pilihan.
   *  - 'suara' : pertanyaan lewat mic, jawaban DIBACAKAN (tanpa teks panjang
   *              di layar; teks tetap disimpan agar bisa dibaca ulang).
   *  - 'teks'  : pertanyaan diketik, jawaban DITAMPILKAN sebagai teks dan
   *              TIDAK dibacakan sama sekali.
   * Mode bisa diganti kapan saja lewat tombol kecil di kepala panel chat.
   */
  const [mode, setMode] = useState(null);

  const [mikroTersedia, setMikroTersedia] = useState(false);

  // Suara Laura: satu sumber (lib/tts.js) — pilihan suara/laju/nada bisa
  // diubah pengguna lewat panel pengaturan dan tersimpan di perangkatnya.
  const suara = useSuaraLaura();
  const suaraTersedia = suara.tersedia;

  const [panelSuara, setPanelSuara] = useState(false);

  const pengenalRef = useRef(null);
  const daftarRef = useRef(null);

  // ---- Balon sapaan (sekali per sesi) --------------------------------------
  useEffect(() => {
    let sudahTutup = false;
    try {
      sudahTutup = window.sessionStorage.getItem(KUNCI_TUTUP) === '1';
    } catch (e) {
      // sessionStorage bisa diblokir (mode privat) — anggap belum ditutup.
    }
    if (sudahTutup) return;
    const t = setTimeout(() => setBalon(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Id sesi chat tamu — diingat agar percakapan lanjutan tetap nyambung.
  useEffect(() => {
    try {
      const lama = window.localStorage.getItem(KUNCI_SESI);
      if (lama) setSessionId(Number(lama));
    } catch (e) { /* abaikan */ }
  }, []);

  // Cek kemampuan mic (TTS dicek di useSuaraLaura).
  useEffect(() => {
    const SR = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setMikroTersedia(!!SR);
  }, []);

  // Mode tanya terakhir — dipulihkan agar pengguna tidak memilih ulang setiap buka panel.
  useEffect(() => {
    try {
      const lama = window.localStorage.getItem(KUNCI_MODE);
      if (lama === 'suara' || lama === 'teks') setMode(lama);
    } catch (e) { /* abaikan */ }
  }, []);

  const pilihMode = (m) => {
    setMode(m);
    try { window.localStorage.setItem(KUNCI_MODE, m); } catch (e) { /* abaikan */ }
    // Mode suara: langsung arahkan ke mic begitu dipilih.
    if (m === 'suara') mulaiMic();
  };

  // Auto-scroll daftar pesan ke bawah.
  useEffect(() => {
    if (daftarRef.current) daftarRef.current.scrollTop = daftarRef.current.scrollHeight;
  }, [pesan, mengirim]);

  // ---- Bicara (TTS) — diambil dari hook useSuaraLaura ----------------------
  const { bacakan, berhenti: hentikanBicara } = suara;

  /** Hentikan narasi presentasi DAN kembalikan tombol ke keadaan siap. */
  const hentikanPresentasi = () => {
    hentikanBicara();
    setStatus('siaga');
  };

  // ---- Presentasi ----------------------------------------------------------
  const jalankanPresentasi = async () => {
    setGalat('');
    setStatus('menyiapkan');
    hentikanBicara();

    try {
      // Data dashboard yang dikirim = data yang sedang tampil di halaman.
      // Tidak ada hitungan ulang di server; angka narasi = angka layar.
      // Kalau prop belum terisi (Container masih memuat / filter baru), ambil
      // sendiri dari endpoint publik yang sama — widget tetap jalan.
      let dashboard = dataDashboard;
      if (!dashboard) {
        const rd = await fetch('/api/publik/kinerja/ringkasan');
        const jd = await rd.json();
        dashboard = jd.data || jd;
      }

      const r = await fetch('/api/laura/presentasi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dashboard, filter: filterAktif || dashboard?.filter || null }),
      });
      const j = await r.json();

      if (!j.success) throw new Error(j.message || 'Gagal menyiapkan naskah');

      setNaskah(j.data.naskah);
      setNaskahSumber(j.data.sumber || '');
      setStatus('bicara');
      // Setelah selesai bicara → status jadi "selesai" (bisa putar ulang).
      bacakan(j.data.naskah, () => setStatus('selesai'));
    } catch (e) {
      setStatus('siaga');
      setGalat(e.message || 'Gagal menghubungi LAURA. Periksa koneksi atau coba lagi.');
    }
  };

  // ---- Mic (speech-to-text) ------------------------------------------------
  const mulaiMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    if (bicaraMic) {
      pengenalRef.current?.stop();
      setBicaraMic(false);
      return;
    }

    const p = new SR();
    p.lang = 'id-ID';
    p.interimResults = false;
    p.maxAlternatives = 1;

    p.onresult = (ev) => {
      const teks = ev.results?.[0]?.[0]?.transcript || '';
      if (teks) kirimPertanyaan(teks);
    };
    p.onend = () => setBicaraMic(false);
    p.onerror = () => setBicaraMic(false);

    pengenalRef.current = p;
    setBicaraMic(true);
    try { p.start(); } catch (e) { setBicaraMic(false); }
  };

  // ---- Chat ----------------------------------------------------------------
  const kirimPertanyaan = async (teksPaksa = null) => {
    const q = String(teksPaksa ?? tanya).trim();
    if (!q || mengirim) return;

    hentikanBicara();
    setTanya('');
    setPesan((l) => [...l, { peran: 'saya', teks: q }]);
    setMengirim(true);
    setGalat('');

    try {
      const r = await fetch('/api/laura/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, session_id: sessionId }),
      });
      const j = await r.json();

      if (!j.success) throw new Error(j.message || 'LAURA gagal menjawab');

      const jawaban = j.data?.answer || '(jawaban kosong)';
      const sid = j.data?.session_id;
      if (sid) {
        setSessionId(sid);
        try { window.localStorage.setItem(KUNCI_SESI, String(sid)); } catch (e) { /* abaikan */ }
      }

      setPesan((l) => [...l, { peran: 'laura', teks: jawaban }]);
      // Bentuk jawaban MENGIKUTI mode yang dipilih pengguna:
      //  - mode 'suara' → jawaban dibacakan (teks dibersihkan dari markdown).
      //  - mode 'teks'  → jawaban hanya tampil sebagai teks, tanpa suara.
      if (mode === 'suara') bacakan(bersihkanUntukSuara(jawaban));
    } catch (e) {
      setPesan((l) => [...l, {
        peran: 'laura',
        teks: `Maaf, terjadi kendala: ${e.message}. Silakan coba lagi atau ajukan pertanyaan lain.`,
      }]);
    } finally {
      setMengirim(false);
    }
  };

  const bukaPanel = () => {
    setBalon(false);
    setPanel((p) => !p);
    try { window.sessionStorage.setItem(KUNCI_TUTUP, '1'); } catch (e) { /* abaikan */ }
  };

  const statusLabel = {
    siaga: 'Putar presentasi dashboard (±1 menit)',
    menyiapkan: 'Menyiapkan naskah…',
    bicara: 'Sedang dibacakan — klik untuk berhenti',
    selesai: 'Putar ulang presentasi',
  }[status];

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {/* ================= Panel utama ================= */}
      {panel && (
        <div className="flex max-h-[70vh] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-paper-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/[0.12] dark:bg-ink-800">
          {/* Kepala panel */}
          <div className="flex items-center justify-between border-b border-paper-200 px-4 py-3 dark:border-white/[0.10]">
            <div>
              <p className="text-[13px] font-bold leading-tight text-slate-900 dark:text-white">
                Laura AI
              </p>
              <p className="text-[10.5px] leading-tight text-slate-500 dark:text-slate-400">
                Asisten data Jendela Kinerja
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPanelSuara((v) => !v)}
                aria-label="Pengaturan suara Laura"
                title="Ganti suara, kecepatan, dan nada Laura"
                className={
                  'rounded-md p-1.5 transition ' +
                  (panelSuara
                    ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
                    : 'text-slate-400 hover:bg-paper-100 hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white')
                }
              >
                <FaCog className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => { setPanel(false); setPanelSuara(false); hentikanBicara(); }}
                aria-label="Tutup panel Laura"
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-paper-100 hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white"
              >
                <FaTimes className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Pengaturan suara */}
          {panelSuara && (
            <div className="border-b border-paper-200 bg-paper-50/70 px-4 py-3 dark:border-white/[0.10] dark:bg-white/[0.03]">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                Pengaturan suara Laura
              </p>
              <PengaturanSuara suara={suara} />
            </div>
          )}

          {/* Presentasi */}
          <div className="border-b border-paper-200 px-4 py-3 dark:border-white/[0.10]">
            <button
              type="button"
              onClick={status === 'bicara' ? hentikanPresentasi : jalankanPresentasi}
              disabled={status === 'menyiapkan'}
              className="flex w-full items-center gap-2.5 rounded-xl bg-gradient-to-r from-accent-600 to-hijau-600 px-3.5 py-2.5 text-left text-white shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === 'menyiapkan' ? (
                <FaSpinner className="h-4 w-4 animate-spin" />
              ) : status === 'bicara' ? (
                <FaStop className="h-4 w-4" />
              ) : (
                <FaPlay className="h-4 w-4" />
              )}
              <span className="flex-1">
                <span className="block text-[12.5px] font-bold leading-tight">
                  {status === 'menyiapkan' ? 'Menyiapkan naskah…' : status === 'bicara' ? 'Sedang membacakan…' : 'Presentasi Dashboard'}
                </span>
                <span className="block text-[10.5px] leading-tight opacity-85">
                  {statusLabel}
                </span>
              </span>
            </button>

            {naskah && (
              <details className="mt-2">
                <summary className="flex cursor-pointer items-center gap-1.5 text-[10.5px] font-semibold text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                  Lihat naskah narasi
                  {naskahSumber === 'koreksi' && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      naskah terkoreksi
                    </span>
                  )}
                </summary>
                <p className="mt-1.5 max-h-24 overflow-y-auto rounded-lg bg-paper-50 p-2 text-[10.5px] leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                  {naskah}
                </p>
              </details>
            )}

            {galat && (
              <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10.5px] leading-snug text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {galat}
              </p>
            )}
          </div>

          {/* Chat */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-1.5 px-4 pt-3 pb-1.5">
              <FaCommentDots className="h-3 w-3 text-accent-600 dark:text-accent-400" />
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                Tanya Laura
              </p>
              {mode && (
                // Ganti mode kapan saja — kembali ke layar pilihan.
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  title="Ganti mode suara/teks"
                  className="ml-auto inline-flex items-center gap-1 rounded-full bg-paper-100 px-2 py-0.5 text-[9.5px] font-bold text-slate-500 transition hover:bg-paper-200 dark:bg-white/[0.07] dark:text-slate-300"
                >
                  {mode === 'suara' ? (
                    <><FaVolumeUp className="h-2 w-2" /> mode suara</>
                  ) : (
                    <><FaKeyboard className="h-2 w-2" /> mode teks</>
                  )}
                  <FaTimes className="h-1.5 w-1.5 opacity-60" />
                </button>
              )}
            </div>

            <div ref={daftarRef} className="min-h-[60px] flex-1 space-y-2 overflow-y-auto px-4 pb-2">
              {pesan.length === 0 && !mengirim && (
                <p className="rounded-lg bg-paper-50 px-2.5 py-2 text-[10.5px] leading-relaxed text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                  Contoh: &ldquo;Berapa sampel yang tidak memenuhi syarat tahun ini?&rdquo; atau
                  &ldquo;Kabupaten mana dengan pemeriksaan terbanyak?&rdquo;
                </p>
              )}
              {pesan.map((p, i) => (
                <div key={i} className={p.peran === 'saya' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={
                    p.peran === 'saya'
                      ? 'max-w-[85%] rounded-xl rounded-br-sm bg-accent-600 px-2.5 py-1.5 text-[11px] leading-relaxed text-white'
                      : 'max-w-[85%] rounded-xl rounded-bl-sm bg-paper-100 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-700 dark:bg-white/[0.07] dark:text-slate-200'
                  }>
                    {p.teks}
                  </div>
                </div>
              ))}
              {mengirim && (
                <div className="flex items-center gap-1.5 px-1 text-[10.5px] text-slate-400">
                  <FaSpinner className="h-2.5 w-2.5 animate-spin" />
                  Laura sedang berpikir…
                </div>
              )}
            </div>

            {/* ====== Pilih bentuk pertanyaan & jawaban (setelah presentasi) ====== */}
            {!mode ? (
              <div className="border-t border-paper-200 p-3 dark:border-white/[0.10]">
                <p className="mb-2 text-center text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                  Mau bertanya dengan suara atau teks?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => pilihMode('suara')}
                    disabled={!suaraTersedia}
                    title={suaraTersedia ? 'Pertanyaan lewat mic — jawaban dibacakan' : 'Browser ini tidak mendukung suara'}
                    className="flex flex-col items-center gap-1 rounded-xl border border-paper-200 bg-paper-50 px-2 py-2.5 text-center transition hover:border-hijau-500 hover:bg-hijau-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.12] dark:bg-white/[0.04] dark:hover:border-hijau-500/60 dark:hover:bg-hijau-500/10"
                  >
                    <FaVolumeUp className="h-4 w-4 text-hijau-600 dark:text-hijau-400" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Suara</span>
                    <span className="text-[9px] leading-tight text-slate-400">bicara → dijawab bersuara</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => pilihMode('teks')}
                    className="flex flex-col items-center gap-1 rounded-xl border border-paper-200 bg-paper-50 px-2 py-2.5 text-center transition hover:border-accent-500 hover:bg-accent-50 dark:border-white/[0.12] dark:bg-white/[0.04] dark:hover:border-accent-500/60 dark:hover:bg-accent-500/10"
                  >
                    <FaKeyboard className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Teks</span>
                    <span className="text-[9px] leading-tight text-slate-400">ketik → dijawab teks</span>
                  </button>
                </div>
              </div>
            ) : mode === 'teks' ? (
              /* ====== MODE TEKS: kotak ketik, jawaban hanya teks (tanpa suara) ====== */
              <div className="flex items-end gap-1.5 border-t border-paper-200 p-2.5 dark:border-white/[0.10]">
                <textarea
                  value={tanya}
                  onChange={(e) => setTanya(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter kirim; Shift+Enter baris baru (kebiasaan aplikasi chat).
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      kirimPertanyaan();
                    }
                  }}
                  rows={1}
                  autoFocus
                  placeholder="Tulis pertanyaan…"
                  className="max-h-20 min-h-[34px] flex-1 resize-none rounded-xl border border-paper-200 bg-white px-3 py-1.5 text-[11.5px] text-slate-800 outline-none transition focus:border-accent-500 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => kirimPertanyaan()}
                  disabled={!tanya.trim() || mengirim}
                  className="shrink-0 rounded-xl bg-accent-600 p-2 text-white transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Kirim pertanyaan"
                >
                  <FaPaperPlane className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              /* ====== MODE SUARA: tombol mic besar, jawaban dibacakan ====== */
              <div className="border-t border-paper-200 p-3 dark:border-white/[0.10]">
                <button
                  type="button"
                  onClick={mulaiMic}
                  disabled={!mikroTersedia || mengirim}
                  className={
                    'flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ' +
                    (bicaraMic
                      ? 'animate-pulse bg-red-500 hover:bg-red-600'
                      : 'bg-hijau-600 hover:bg-hijau-700')
                  }
                >
                  <FaMicrophone className="h-4 w-4" />
                  {bicaraMic ? 'Mendengarkan… (klik untuk berhenti)' : 'Tekan lalu ajukan pertanyaan'}
                </button>
                <p className="mt-1.5 text-center text-[9.5px] text-slate-400">
                  {!mikroTersedia
                    ? 'Speech recognition hanya di Chrome/Edge — atau ganti ke mode teks.'
                    : 'Jawaban akan dibacakan Laura setelah selesai.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= Balon sapaan ================= */}
      {!panel && balon && (
        <div className="relative max-w-[248px] rounded-2xl rounded-br-sm border border-paper-200 bg-white p-3 pr-8 shadow-lg shadow-slate-900/10 dark:border-white/[0.12] dark:bg-ink-800">
          <button
            type="button"
            onClick={() => {
              setBalon(false);
              try { window.sessionStorage.setItem(KUNCI_TUTUP, '1'); } catch (e) { /* abaikan */ }
            }}
            aria-label="Tutup sapaan"
            className="absolute right-1.5 top-1.5 rounded-md p-1 text-slate-400 transition hover:bg-paper-100 hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <FaTimes className="h-2.5 w-2.5" />
          </button>
          <p className="text-[12px] font-bold leading-snug text-slate-900 dark:text-white">
            Halo, saya Laura
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            Mau saya bacakan ringkasan dashboard ini, atau Anda ingin bertanya langsung?
          </p>
          <button
            type="button"
            onClick={bukaPanel}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-accent-700"
          >
            Buka Laura
            <FaChevronDown className="h-2 w-2" />
          </button>
        </div>
      )}

      {/* ================= Maskot ================= */}
      <button
        type="button"
        onClick={bukaPanel}
        aria-label={panel ? 'Tutup Laura AI' : 'Buka Laura AI'}
        title={suaraTersedia ? 'Laura AI — presentasi & tanya jawab' : 'Laura AI — tanya jawab'}
        className="group relative flex items-end justify-center rounded-2xl bg-gradient-to-b from-accent-500/10 to-hijau-500/15 p-2 shadow-lg shadow-accent-900/15 ring-1 ring-accent-500/25 transition hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 sm:rounded-3xl"
      >
        {/* Maskot aslinya 263x948 (rasio 1:3,6 — sangat jangkung). Dua percobaan
            sebelumnya SALAH: membatasi tinggi saja membuatnya kurus (±20px), dan
            memakai `absolute bottom-0` + `overflow-hidden` memotong bagian atas
            sehingga yang tampak hanya KAKI.
            Yang benar: gambar UTUH di dalam tombol (object-contain), dipaksa
            mengisi tinggi, dan lebar mengikuti proporsi asli. Tombol dibuat bulat
            panjang (bukan lingkaran penuh) supaya seluruh badan maskot masuk. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/maskot-bpom.png"
          alt="Maskot BBPOM — Laura AI"
          className="pointer-events-none h-40 w-auto max-w-none object-contain object-bottom drop-shadow sm:h-56"
        />
        {/* Indikator status: bicara = ikon speaker berdenyut. */}
        {(status === 'bicara' || suara.sedangBicara) ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-hijau-500 text-white ring-2 ring-white dark:ring-ink-900">
            <FaVolumeUp className="h-2.5 w-2.5 animate-pulse" />
          </span>
        ) : !panel && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-hijau-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-ink-900">
            ?
          </span>
        )}
      </button>
    </div>
  );
}
