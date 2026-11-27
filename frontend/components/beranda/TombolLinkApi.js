// components/beranda/TombolLinkApi.js
/**
 * TOMBOL "LINK API" PER MODUL \u2014 muncul di top bar dashboard.
 * ------------------------------------------------------------
 * Membaca path halaman yang sedang dibuka (mis. /sampel/ot), lalu menanyakan
 * katalog backend: GET /api/publik/kinerja/api-modul?modul=sampel/ot
 *
 * Hasilnya ditampilkan sebagai panel link siap salin. Link inilah yang
 * ditempel ke menu "Integrasi JK" di LAURA AI, lalu ditekan Sinkron.
 *
 * Kenapa per modul, bukan satu daftar panjang: operator yang sedang membuka
 * modul Sampel OT hanya perlu link modul itu; link modul lain jadi derau.
 *
 * Modul yang butuh Bearer (semua modul internal) diberi tanda kunci \u2014
 * LAURA AI-lah yang menerbitkan tokennya beserta masa berlaku, bukan JK.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  FaLink,
  FaCopy,
  FaCheck,
  FaTimes,
  FaSyncAlt,
  FaLock,
  FaGlobe,
  FaDownload,
} from 'react-icons/fa';

const BADGE = {
  public: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  bearer: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

export default function TombolLinkApi() {
  const router = useRouter();
  // Modul diturunkan dari path: /sampel/ot \u2192 sampel/ot
  const modul = (router.pathname || '').replace(/^\/+|\/+$/g, '');

  const [buka, setBuka] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);
  const [data, setData] = useState(null);
  const [tersalin, setTersalin] = useState(null);

  // Jangan tampilkan tombol di halaman tanpa modul (mis. /beranda)
  const tampil = Boolean(modul) && modul !== 'beranda' && !modul.startsWith('setting/');

  const ambil = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch(
        `/api/publik/kinerja/api-modul?modul=${encodeURIComponent(modul)}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Gagal memuat katalog API');
      setData(json.data);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemuat(false);
    }
  }, [modul]);

  useEffect(() => {
    if (buka && !data) ambil();
  }, [buka, data, ambil]);

  if (!tampil) return null;

  const salin = async (teks, kunci) => {
    try {
      await navigator.clipboard.writeText(teks);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = teks;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setTersalin(kunci);
    setTimeout(() => setTersalin((k) => (k === kunci ? null : k)), 1600);
  };

  const daftar = data?.modul || [];

  const unduhJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `link-api-${modul.replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:border-accent-400 hover:text-accent-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300"
        title="Keluarkan link API modul ini untuk LAURA AI"
      >
        <FaLink className="h-3 w-3" />
        <span className="hidden sm:inline">Link API</span>
      </button>

      {buka && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setBuka(false)}
        >
          <div className="my-8 w-full max-w-3xl overflow-hidden rounded-xl border border-paper-300 bg-white shadow-xl dark:border-white/[0.08] dark:bg-ink-950">
            <div className="flex items-start justify-between gap-4 border-b border-paper-200 p-4 dark:border-white/[0.08]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Integrasi knowledge
                </p>
                <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  Link API \u2014 {modul}
                </h2>
                <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                  Salin link modul ini, lalu tempel di <strong>LAURA AI \u2192 Integrasi JK</strong> dan
                  tekan Sinkron. Token & masa berlakunya diatur di LAURA.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBuka(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-paper-100 hover:text-slate-700 dark:hover:bg-white/5"
                aria-label="Tutup"
              >
                <FaTimes />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-paper-200 px-4 py-2.5 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={ambil}
                disabled={memuat}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-accent-700 disabled:opacity-50"
              >
                <FaSyncAlt className={memuat ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
                Muat ulang
              </button>
              <button
                type="button"
                onClick={() => salin(daftar.map((m) => m.url_lengkap).join('\n'), '__semua__')}
                disabled={!daftar.length}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paper-300 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-paper-100 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300"
              >
                {tersalin === '__semua__' ? (
                  <FaCheck className="h-3 w-3 text-emerald-500" />
                ) : (
                  <FaCopy className="h-3 w-3" />
                )}
                Salin semua ({daftar.length})
              </button>
              <button
                type="button"
                onClick={unduhJson}
                disabled={!data}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paper-300 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-paper-100 disabled:opacity-50 dark:border-white/[0.08] dark:text-slate-300"
              >
                <FaDownload className="h-3 w-3" />
                JSON
              </button>
              {data && (
                <span className="ml-auto truncate font-mono text-[10px] text-slate-400">
                  {data.base_url}
                </span>
              )}
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              {galat && (
                <p className="rounded-lg bg-rose-50 p-3 text-[12px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  {galat}
                </p>
              )}
              {memuat && !data && <p className="text-[12px] text-slate-400">Memuat link\u2026</p>}
              {!memuat && data && !daftar.length && (
                <p className="text-[12px] text-slate-400">
                  Modul ini belum punya endpoint katalog API.
                </p>
              )}

              {daftar.map((m) => (
                <div
                  key={m.kode}
                  className="rounded-xl border border-paper-200 p-3 dark:border-white/[0.08]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-400">{m.kode}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        BADGE[m.auth_mode] || BADGE.public
                      }`}
                    >
                      {m.auth_mode === 'bearer' ? (
                        <FaLock className="h-2.5 w-2.5" />
                      ) : (
                        <FaGlobe className="h-2.5 w-2.5" />
                      )}
                      {m.auth_mode}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      token {m.masa_berlaku_hari} hari
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                    {m.nama}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {m.keterangan}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-paper-100 px-2 py-1.5 font-mono text-[11px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      {m.url_lengkap}
                    </code>
                    <button
                      type="button"
                      onClick={() => salin(m.url_lengkap, m.kode)}
                      className="shrink-0 rounded-lg border border-paper-300 p-2 text-slate-500 transition hover:bg-paper-100 hover:text-accent-700 dark:border-white/[0.08]"
                      aria-label={`Salin link ${m.kode}`}
                    >
                      {tersalin === m.kode ? (
                        <FaCheck className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <FaCopy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
