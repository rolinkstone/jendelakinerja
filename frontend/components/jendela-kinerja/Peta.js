// components/jendela-kinerja/Peta.js
/**
 * PETA KALIMANTAN TENGAH \u2014 choropleth per kab/kota (SVG, tanpa library peta)
 * ------------------------------------------------------------------------
 * Geometri sudah diproyeksikan ke bidang datar saat build data
 * (frontend/data/kalteng-kabupaten.json), jadi komponen ini hanya:
 *   - menggambar path kab/kota
 *   - mewarnai sesuai jumlah sarana (lihat warnaSarana); wilayah kerja Loka
 *     POM Kotawaringin Barat memakai SATU warna tetap dari helper
 *     (WILAYAH_UPT) supaya batas wilayah kerja terbaca, bukan skalanya
 *   - menaruh gelembung angka di titik tengah wilayah
 *   - menampilkan tooltip saat kursor di atas wilayah
 *
 * Props:
 *   perKab   : { [namaKab]: { total, produksi, distribusi, mayor, minor } }
 *   terpilih : nama kab/kota yang sedang difilter (atau '')
 *   onPilih  : (namaKab) => void   \u2014 klik wilayah = pasang filter kab/kota
 *   maks     : nilai maksimum untuk skala warna
 */
import { useState } from 'react';
import {
  PETA,
  warnaSarana,
  namaPendek,
  formatAngka,
  angka,
  WILAYAH_UPT,
  wilayahKab,
} from './helper';

export default function Peta({ perKab = {}, terpilih = '', onPilih, maks = 0 }) {
  const [hover, setHover] = useState(null); // { nama, x, y }

  const wil = PETA.kabupaten;
  const lebar = PETA.lebar;
  const tinggi = PETA.tinggi;

  /** Satu kab/kota dipilih, atau SELURUH wilayah kerjanya sedang disorot. */
  function sedangTerpilih(nama) {
    if (terpilih === nama) return true;
    // Wilayah kerja: satu anggota dipilih = seluruh kelompok tersorot, supaya
    // batas wilayah kerjanya ikut terlihat saat difilter.
    const kel = wilayahKab(nama);
    return Boolean(kel && terpilih && kel.kabupaten.includes(terpilih));
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${lebar} ${tinggi}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label="Peta Kalimantan Tengah per kabupaten/kota"
      >
        {/* Bayangan halus di bawah peta */}
        <defs>
          <filter id="peta-bayang" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0a1220" floodOpacity="0.18" />
          </filter>
          <linearGradient id="peta-laut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(15,108,184,0.12)" />
            <stop offset="100%" stopColor="rgba(31,166,95,0.05)" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={lebar} height={tinggi} rx="18" fill="url(#peta-laut)" />

        <g filter="url(#peta-bayang)">
          {wil.map((k) => {
            const data = perKab[k.nama] || { total: 0, produksi: 0, distribusi: 0 };
            const aktif = sedangTerpilih(k.nama);
            const kel = wilayahKab(k.nama);
            return (
              <path
                key={k.nama}
                d={k.d}
                // Wilayah kerja: satu warna tetap untuk semua anggotanya.
                fill={kel ? kel.warna : warnaSarana(data.total, maks)}
                stroke={aktif ? '#facc15' : kel ? kel.warnaGaris : 'rgba(15,23,42,0.35)'}
                strokeWidth={aktif ? 2.4 : kel ? 1.1 : 0.9}
                className="cursor-pointer transition-[fill,stroke] duration-200 hover:brightness-110"
                onClick={() => onPilih && onPilih(terpilih === k.nama ? '' : k.nama)}
                onMouseEnter={(e) => {
                  const kotak = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                  const skala = kotak.width / lebar;
                  setHover({
                    nama: k.nama,
                    wilayah: kel ? kel.label : '',
                    x: k.cx * skala,
                    y: k.cy * skala,
                    total: data.total,
                    produksi: data.produksi,
                    distribusi: data.distribusi,
                  });
                }}
                onMouseLeave={() => setHover(null)}
              >
                <title>
                  {kel
                    ? `${k.nama} (${kel.label}): ${formatAngka(data.total)} sarana`
                    : `${k.nama}: ${formatAngka(data.total)} sarana`}
                </title>
              </path>
            );
          })}
        </g>

        {/* Gelembung angka \u2014 hanya untuk wilayah yang punya data */}
        <g>
          {wil.map((k) => {
            const data = perKab[k.nama] || { total: 0 };
            const total = angka(data.total);
            if (!total) return null;
            // Radius tumbuh akar dari jumlah supaya wilayah besar tak menutupi peta.
            const r = 9 + Math.min(13, Math.sqrt(total) * 2.1);
            return (
              <g key={`b-${k.nama}`} className="pointer-events-none">
                <circle cx={k.cx} cy={k.cy} r={r} fill="#0a1220" opacity="0.88" />
                <circle cx={k.cx} cy={k.cy} r={r} fill="none" stroke="rgba(167,139,250,0.85)" strokeWidth="1.6" />
                <text
                  x={k.cx}
                  y={k.cy + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={r > 15 ? 13 : 11}
                  fontWeight="800"
                  fill="#ffffff"
                >
                  {total}
                </text>
              </g>
            );
          })}
        </g>

        {/* Label nama wilayah \u2014 hanya untuk wilayah tanpa gelembung agar tidak bertumpuk */}
        <g>
          {wil.map((k) => {
            const data = perKab[k.nama] || { total: 0 };
            if (angka(data.total)) return null;
            return (
              <text
                key={`t-${k.nama}`}
                x={k.cx}
                y={k.cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="700"
                className="fill-slate-400 dark:fill-slate-500"
              >
                {namaPendek(k.nama)}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Tooltip mengikuti wilayah yang disorot */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[125%] rounded-lg border border-paper-200 bg-white/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur dark:border-white/10 dark:bg-ink-900/95"
          style={{ left: `${hover.x}px`, top: `${hover.y}px` }}
        >
          <p className="mb-1 whitespace-nowrap font-bold text-slate-800 dark:text-white">{hover.nama}</p>
          {hover.wilayah && (
            <p className="mb-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {hover.wilayah}
            </p>
          )}
          <p className="whitespace-nowrap text-slate-500 dark:text-slate-400">
            Produksi <strong className="text-accent-600 dark:text-accent-300">{formatAngka(hover.produksi)}</strong>
            {'  \xb7  '}
            Distribusi <strong className="text-accent-600 dark:text-accent-300">{formatAngka(hover.distribusi)}</strong>
          </p>
          <p className="mt-0.5 whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">
            Total {formatAngka(hover.total)} sarana
          </p>
        </div>
      )}

      {/* Legenda: skala jumlah sarana + warna wilayah kerja */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5">
        {WILAYAH_UPT.map((w) => (
          <div key={w.kode} className="flex items-center gap-2">
            <span
              className="h-3 w-7 rounded-sm ring-1 ring-inset ring-slate-900/10 dark:ring-white/10"
              style={{ backgroundColor: w.warna }}
            />
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {w.label} ({w.kabupaten.length} kabupaten)
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Jumlah sarana
          </span>
          <div className="flex items-center gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((rasio) => {
              // Legenda memakai skala yang sama dengan warnaSarana (hijau \u2192 biru).
              const h = [31, 166, 95];
              const b = [15, 108, 184];
              const rgb = h.map((v, i) => Math.round(v + (b[i] - v) * rasio));
              const alfa = Math.round((0.18 + rasio * 0.67) * 100) / 100;
              return (
                <span
                  key={rasio}
                  className="h-3 w-7 rounded-sm ring-1 ring-inset ring-slate-900/10 dark:ring-white/10"
                  style={{ backgroundColor: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alfa})` }}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {formatAngka(maks)} tertinggi
          </span>
        </div>
      </div>
    </div>
  );
}
