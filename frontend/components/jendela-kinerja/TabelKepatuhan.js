// components/jendela-kinerja/TabelKepatuhan.js
/**
 * TABEL KEPATUHAN MUTU — komponen bersama
 * --------------------------------------
 * Dipakai dua tempat di Jendela Kinerja:
 *   1. "Jumlah Sampel Diuji per Tahun"  (SampelLab.js)
 *   2. "Sebaran Kepatuhan per Kelompok Komoditas" (KepatuhanKomoditas.js)
 *
 * Sebelumnya tiap tabel ditulis ulang sendiri-sendiri, sehingga lebar kolom,
 * perataan angka, dan gayanya gampang melenceng satu sama lain. Sekarang satu
 * sumber: kepala tabel, baris data, dan baris jumlah semuanya di sini.
 *
 * Catatan gaya:
 * - Kolom angka selalu rata kanan + `tnum` supaya digit sejajar vertikal.
 * - Kolom "Kepatuhan" memakai lebar persen tetap (52px) + batang, jadi angkanya
 *   tidak melompat saat nilainya berubah dari 9,9% ke 100%.
 * - Baris jumlah hanya muncul kalau baris data lebih dari satu — kalau cuma
 *   satu baris, baris jumlah hanya mengulang angka yang sama.
 */
import { angka, formatAngka } from './helper';

/** Persentase kepatuhan: satu desimal bila tidak bulat (302/303 = 99,7%). */
export function persenKepatuhan(memenuhi, sampel) {
  if (!sampel) return 0;
  const p = (memenuhi / sampel) * 100;
  return Number.isInteger(p) ? p : Math.round(p * 10) / 10;
}

/** Warna batang kepatuhan. */
function warnaBatang(tidakMemenuhi) {
  return angka(tidakMemenuhi) > 0
    ? 'bg-gradient-to-r from-hijau-500 to-hijau-400'
    : 'bg-gradient-to-r from-hijau-500 to-accent-500';
}

/** Kolom persentase + batang. `tebal` untuk baris jumlah. */
function KolomKepatuhan({ memenuhi, sampel, tidakMemenuhi }) {
  const persen = persenKepatuhan(memenuhi, sampel);
  return (
    <td className="px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="tnum w-[52px] shrink-0 whitespace-nowrap text-right text-[12px] font-bold text-slate-700 dark:text-slate-200">
          {persen}%
        </span>
        <span
          className="h-1.5 w-full max-w-[150px] overflow-hidden rounded-full bg-paper-200 dark:bg-white/10"
          title={`${formatAngka(memenuhi)} dari ${formatAngka(sampel)} sampel memenuhi syarat`}
        >
          <span
            className={`block h-full rounded-full ${warnaBatang(tidakMemenuhi)}`}
            style={{ width: `${persen}%` }}
          />
        </span>
      </div>
    </td>
  );
}

/**
 * @param {string}   label        judul kolom pertama
 * @param {string}   kolomNama    properti baris yang dipakai sebagai label
 * @param {Array}    baris        data: { sampel, memenuhi, tidak_memenuhi, ... }
 * @param {Function} sub          opsional, teks kecil di bawah label
 * @param {string}   pesanKosong  teks saat data kosong
 * @param {boolean}  memuat       true saat fetch berjalan
 */
export default function TabelKepatuhan({
  label = 'Tahun',
  kolomNama = 'tahun',
  baris = [],
  sub = null,
  pesanKosong = 'Belum ada data.',
  memuat = false,
}) {
  if (baris.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
        {memuat ? 'Memuat data…' : pesanKosong}
      </p>
    );
  }

  // Baris jumlah: hanya kalau memang ada beberapa baris untuk dijumlahkan.
  const pakaiJumlah = baris.length > 1;
  const jumlah = baris.reduce(
    (a, b) => ({
      sampel: a.sampel + angka(b.sampel),
      memenuhi: a.memenuhi + angka(b.memenuhi),
      tidak: a.tidak + angka(b.tidak_memenuhi),
    }),
    { sampel: 0, memenuhi: 0, tidak: 0 },
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-paper-200 bg-paper-50/70 dark:border-white/[0.08] dark:bg-white/[0.03]">
            {/* Kolom angka lebarnya dikunci: kalau dibiarkan melar, digit
                satu baris berjauhan sampai sulit dibaca di layar lebar. */}
            <th className="th w-auto text-left">{label}</th>
            <th className="th w-[110px] text-right">Sampel</th>
            <th className="th w-[120px] text-right">Memenuhi</th>
            <th className="th w-[150px] text-right">Tidak Memenuhi</th>
            <th className="th w-[210px] text-left">Kepatuhan</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => {
            const memenuhi = angka(b.memenuhi);
            const tidakMemenuhi = angka(b.tidak_memenuhi);
            return (
              <tr
                key={String(b[kolomNama])}
                className="border-b border-paper-200 last:border-0 even:bg-paper-50/40 hover:bg-accent-500/[0.05] dark:border-white/[0.06] dark:even:bg-white/[0.02] dark:hover:bg-accent-500/[0.08]"
              >
                <td className="px-4 py-2.5">
                  <p className="break-words text-[12.5px] font-semibold leading-snug text-slate-700 dark:text-slate-200">
                    {b[kolomNama] || '—'}
                  </p>
                  {sub && sub(b) ? (
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{sub(b)}</p>
                  ) : null}
                </td>
                <td className="tnum px-4 py-2.5 text-right text-[12.5px] font-semibold text-slate-800 dark:text-white">
                  {formatAngka(angka(b.sampel))}
                </td>
                <td className="tnum px-4 py-2.5 text-right text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatAngka(memenuhi)}
                </td>
                <td className="tnum px-4 py-2.5 text-right text-[12.5px] font-semibold text-rose-600 dark:text-rose-400">
                  {tidakMemenuhi > 0 ? formatAngka(tidakMemenuhi) : '—'}
                </td>
                <KolomKepatuhan
                  memenuhi={memenuhi}
                  sampel={angka(b.sampel)}
                  tidakMemenuhi={tidakMemenuhi}
                />
              </tr>
            );
          })}
        </tbody>
        {pakaiJumlah && (
          <tfoot>
            <tr className="border-t border-paper-200 bg-paper-50/70 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <td className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Jumlah
              </td>
              <td className="tnum px-4 py-2.5 text-right text-[12.5px] font-bold text-slate-800 dark:text-white">
                {formatAngka(jumlah.sampel)}
              </td>
              <td className="tnum px-4 py-2.5 text-right text-[12.5px] font-bold text-emerald-600 dark:text-emerald-400">
                {formatAngka(jumlah.memenuhi)}
              </td>
              <td className="tnum px-4 py-2.5 text-right text-[12.5px] font-bold text-rose-600 dark:text-rose-400">
                {jumlah.tidak > 0 ? formatAngka(jumlah.tidak) : '—'}
              </td>
              <KolomKepatuhan memenuhi={jumlah.memenuhi} sampel={jumlah.sampel} tidakMemenuhi={jumlah.tidak} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
