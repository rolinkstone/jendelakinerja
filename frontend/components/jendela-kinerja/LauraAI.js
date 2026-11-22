// components/jendela-kinerja/LauraAI.js
/**
 * TOMBOL LAURA AI — maskot BBPOM yang menempel di pojok kanan bawah halaman
 * publik (Jendela Kinerja dan halaman menu lain).
 *
 * Perilaku:
 *  - Diam sebagai gambar maskot (bukan tombol besar) supaya tidak menutupi
 *    konten tabel/peta. Balon sapaan muncul sekali saat halaman dimuat, lalu
 *    bisa dibuka-tutup dengan mengklik maskot.
 *  - Klik "Tanya Laura" membuka https://laura-ai.bbpompky.id di tab BARU
 *    (target=_blank + rel="noopener noreferrer") supaya dashboard tidak hilang.
 *  - Balon bisa ditutup permanen per sesi (sessionStorage), jadi tidak terus
 *    muncul setiap pindah halaman di tab yang sama.
 *
 * Aset: public/images/maskot-bpom.png (RGBA 263x948, proporsi tinggi-sempit).
 * Sengaja memakai <img> biasa, bukan next/image, karena asetnya PNG transparan
 * berukuran tetap dan tidak perlu optimasi tambahan.
 */
import { useEffect, useState } from 'react';
import { FaTimes, FaExternalLinkAlt } from 'react-icons/fa';

const LAURA_URL = 'https://laura-ai.bbpompky.id';
const KUNCI_TUTUP = 'laura-balon-tutup';

export default function LauraAI() {
  const [balon, setBalon] = useState(false);

  // Balon hanya muncul kalau pengguna belum pernah menutupnya di sesi ini.
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

  const tutupBalon = () => {
    setBalon(false);
    try {
      window.sessionStorage.setItem(KUNCI_TUTUP, '1');
    } catch (e) {
      // abaikan
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {/* Balon sapaan */}
      {balon && (
        <div className="relative max-w-[248px] rounded-2xl rounded-br-sm border border-paper-200 bg-white p-3 pr-8 shadow-lg shadow-slate-900/10 dark:border-white/[0.12] dark:bg-ink-800">
          <button
            type="button"
            onClick={tutupBalon}
            aria-label="Tutup sapaan"
            className="absolute right-1.5 top-1.5 rounded-md p-1 text-slate-400 transition hover:bg-paper-100 hover:text-slate-700 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <FaTimes className="h-2.5 w-2.5" />
          </button>
          <p className="text-[12px] font-bold leading-snug text-slate-900 dark:text-white">
            Halo, saya Laura
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            Ada pertanyaan soal data pengawasan? Tanya saya, ya.
          </p>
          <a
            href={LAURA_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setBalon(false)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-accent-700"
          >
            Tanya Laura
            <FaExternalLinkAlt className="h-2 w-2" />
          </a>
        </div>
      )}

      {/* Maskot — klik untuk buka/tutup balon. Ukuran dijaga kecil di layar
          sempit supaya tidak menutupi tabel. */}
      <button
        type="button"
        onClick={() => (balon ? tutupBalon() : setBalon(true))}
        aria-label={balon ? 'Tutup sapaan Laura AI' : 'Tanya Laura AI'}
        title="Tanya Laura AI"
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
        {!balon && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-hijau-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-ink-900">
            ?
          </span>
        )}
      </button>
    </div>
  );
}
