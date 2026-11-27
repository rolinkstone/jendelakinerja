// components/laura/PengaturanSuara.js
/**
 * PANEL PENGATURAN SUARA LAURA
 * ----------------------------
 * Tiga hal yang bisa diubah: pilihan suara (dari daftar suara sistem), laju
 * bicara, dan nada. Pilihan disimpan di localStorage perangkat lewat
 * `useSuaraLaura()` (lib/tts.js), jadi berlaku untuk widget publik maupun
 * halaman koreksi naskah di dashboard.
 *
 * Catatan penting yang ditampilkan ke pengguna: suara berasal dari perangkat
 * pengunjung, bukan dari server. Kalau perangkat belum punya paket suara
 * Indonesia, Laura membaca dengan suara terdekat \u2014 di Windows perlu memasang
 * paket "Bahasa Indonesia" pada Settings \u2192 Time & Language \u2192 Speech.
 */
import {
  FaVolumeUp, FaPlay, FaUndo, FaExclamationTriangle, FaCheck,
} from 'react-icons/fa';
import { BATAS, labelVoice } from '../../lib/tts';

const persen = (v) => `${Math.round((Number(v) || 1) * 100)}%`;

export default function PengaturanSuara({ suara, ringkas = false }) {
  const { tersedia, daftar, pref, set, reset, coba } = suara;

  if (!tersedia) {
    return (
      <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[10.5px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
        Browser ini tidak mendukung pembacaan suara (Web Speech API), jadi nada bicara
        tidak bisa diubah. Narasi tetap bisa dibaca sebagai teks.
      </p>
    );
  }

  const adaIndonesia = daftar.some((v) => /^id/i.test(v.lang));

  return (
    <div className="space-y-2.5">
      {/* Pilihan suara */}
      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold text-slate-600 dark:text-slate-300">
          <FaVolumeUp className="h-2.5 w-2.5" />
          Suara ({daftar.length} terpasang)
        </span>
        <select
          value={pref.nama}
          onChange={(e) => set({ nama: e.target.value })}
          className="w-full rounded-lg border border-paper-200 bg-white px-2 py-1.5 text-[11px] text-slate-800 outline-none transition focus:border-accent-500 dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-white"
        >
          <option value="">Otomatis (utamakan bahasa Indonesia)</option>
          {daftar.map((v) => (
            <option key={v.name} value={v.name}>{labelVoice(v)}</option>
          ))}
        </select>
      </label>

      {!adaIndonesia && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <FaExclamationTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
          <span>
            Belum ada paket suara Indonesia di perangkat ini, jadi Laura membaca dengan
            suara lain. Di Windows: <strong>Settings \u2192 Time &amp; Language \u2192 Language &amp;
            region \u2192 Tambah bahasa Indonesia \u2192 centang Speech</strong>, lalu muat ulang halaman.
          </span>
        </p>
      )}

      {/* Laju & nada */}
      {!ringkas && (
        <>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[10.5px] font-bold text-slate-600 dark:text-slate-300">
              <span>Kecepatan bicara</span>
              <span className="font-mono text-[10px] text-slate-400">{persen(pref.laju)}</span>
            </span>
            <input
              type="range"
              min={BATAS.laju.min}
              max={BATAS.laju.max}
              step={BATAS.laju.step}
              value={pref.laju}
              onChange={(e) => set({ laju: Number(e.target.value) })}
              className="h-1 w-full cursor-pointer accent-accent-600"
            />
            <span className="flex justify-between text-[9px] text-slate-400">
              <span>lambat</span><span>normal</span><span>cepat</span>
            </span>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[10.5px] font-bold text-slate-600 dark:text-slate-300">
              <span>Nada suara</span>
              <span className="font-mono text-[10px] text-slate-400">{persen(pref.nada)}</span>
            </span>
            <input
              type="range"
              min={BATAS.nada.min}
              max={BATAS.nada.max}
              step={BATAS.nada.step}
              value={pref.nada}
              onChange={(e) => set({ nada: Number(e.target.value) })}
              className="h-1 w-full cursor-pointer accent-accent-600"
            />
            <span className="flex justify-between text-[9px] text-slate-400">
              <span>berat</span><span>normal</span><span>tinggi</span>
            </span>
          </label>
        </>
      )}

      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => coba(pref.nama)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-2 py-1 text-[10.5px] font-bold text-white transition hover:bg-accent-700"
        >
          <FaPlay className="h-2 w-2" />
          Dengarkan contoh
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-paper-100 px-2 py-1 text-[10.5px] font-bold text-slate-600 transition hover:bg-paper-200 dark:bg-white/[0.07] dark:text-slate-300"
        >
          <FaUndo className="h-2 w-2" />
          Kembalikan
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-slate-400">
          <FaCheck className="h-1.5 w-1.5 text-emerald-500" />
          tersimpan di perangkat ini
        </span>
      </div>
    </div>
  );
}
