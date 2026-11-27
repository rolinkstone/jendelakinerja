// components/jendela-kinerja/Modal.js
/**
 * MODAL \u2014 Dashboard publik "Jendela Kinerja"
 * ------------------------------------------
 * Konvensi modul: dialog ditaruh terpisah di `components/<modul>/Modal.js`,
 * state & permintaan API tetap di `Container.js` (file ini murni tampilan).
 *
 * Isi:
 *   Modal                  -> kerangka dialog (overlay, tutup via Esc / klik luar, kunci scroll)
 *   RincianKabupatenModal  -> daftar sarana satu kab/kota: nama sarana, kegiatan,
 *                             jenis sarana, periode periksa, status MK/TMK.
 *                             Kolom "Produk" menampilkan NAMA PRODUK (tanpa kode
 *                             sampel \u2014 kode membuat kolom melebar) untuk baris
 *                             sampel, supaya beberapa sampel dari sarana &
 *                             tanggal yang sama (satu kunjungan bisa mengambil
 *                             banyak produk) tidak terbaca sebagai data ganda.
 */
import { useEffect, useRef } from 'react';
import { FaTimes, FaMapMarkerAlt, FaClipboardList } from 'react-icons/fa';
import { formatAngka, gayaKesimpulan } from './helper';

/** Kerangka dialog: overlay + panel. `children` dirender apa adanya. */
export function Modal({ onClose, labelledBy, maxWidth = 'max-w-4xl', children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div className="absolute inset-0 bg-ink-950/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`panel relative z-10 flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden outline-none`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Rincian sarana satu kab/kota.
 *
 * `detail` = { kab, memuat, galat, total, baris: [...] }
 * Data disiapkan Container lewat /api/publik/kinerja/sarana (saringan aktif ikut).
 */
export default function RincianKabupatenModal({ detail, onClose }) {
  const judulId = 'judul-rincian-kabupaten';
  const baris = detail?.baris || [];

  return (
    <Modal onClose={onClose} labelledBy={judulId}>
      <div className="panel-head shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <FaMapMarkerAlt className="h-3.5 w-3.5 shrink-0 text-accent-600 dark:text-accent-400" />
          <div className="min-w-0">
            <h3 id={judulId} className="truncate text-sm font-bold text-slate-800 dark:text-white">
              {detail?.kab || 'Rincian'}
            </h3>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Daftar sarana yang diperiksa pada filter aktif
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="btn-ghost shrink-0" aria-label="Tutup">
          <FaTimes className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-[180px] flex-1 overflow-auto">
        {detail?.memuat && (
          <p className="px-4 py-10 text-center text-[13px] text-slate-400 dark:text-slate-500">
            Memuat rincian sarana\u2026
          </p>
        )}

        {!detail?.memuat && detail?.galat && (
          <p className="px-4 py-10 text-center text-[13px] text-rose-600 dark:text-rose-400">
            {detail.galat}
          </p>
        )}

        {!detail?.memuat && !detail?.galat && baris.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-slate-400 dark:text-slate-500">
            Tidak ada sarana pada kombinasi filter ini.
          </p>
        )}

        {!detail?.memuat && !detail?.galat && baris.length > 0 && (
          <table className="w-full min-w-[780px] border-collapse text-left">
            <thead>
              <tr className="border-b border-paper-200 bg-paper-50/70 dark:border-white/[0.08] dark:bg-white/[0.03]">
                {['Sarana', 'Produk', 'Kegiatan', 'Komoditi', 'Periode Periksa', 'Kesimpulan'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => (
                <tr
                  key={`${b.nama_sarana}-${b.tgl_periksa_mulai}-${b.produk_sampel || ''}-${i}`}
                  className="border-b border-paper-200 last:border-0 hover:bg-paper-50 dark:border-white/5 dark:hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-2.5 text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                    {b.nama_sarana || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-[12.5px] text-slate-600 dark:text-slate-300">
                    {b.produk_sampel || (
                      <span className="text-slate-400 dark:text-slate-500">\u2014</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={b.kegiatan === 'Produksi' ? 'badge-warning' : 'badge-primary'}>
                      {b.kegiatan || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[12.5px] text-slate-600 dark:text-slate-300">
                    {b.jenis_sarana || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-slate-500 dark:text-slate-400">
                    {b.tgl_periksa_mulai || '-'}
                    {b.tgl_periksa_selesai && b.tgl_periksa_selesai !== b.tgl_periksa_mulai
                      ? ` \u2013 ${b.tgl_periksa_selesai}`
                      : ''}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={gayaKesimpulan(b.kesimpulan_akhir)}>{b.kesimpulan_akhir || '-'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-200 px-4 py-3 dark:border-white/[0.08]">
        <p className="flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
          <FaClipboardList className="h-3 w-3" />
          {formatAngka(detail?.total || baris.length)} sarana
          {detail?.total > baris.length ? ` (ditampilkan ${formatAngka(baris.length)})` : ''}
        </p>
        <button type="button" onClick={onClose} className="btn-ghost">
          Tutup
        </button>
      </div>
    </Modal>
  );
}
