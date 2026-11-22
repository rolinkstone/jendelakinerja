// components/produksi/irt/Modal.js
/**
 * MODAL — Modul Produksi: Pangan IRT (CPPB - IRT)
 * ----------------------------------------------
 * Dialog milik modul ditaruh terpisah di `components/<kelompok>/<modul>/Modal.js`,
 * sedangkan state & request API tetap di `Container.js` (file ini murni tampilan).
 *
 * Isi:
 *   Modal               -> kerangka dialog (overlay, tutup via Esc / klik luar, kunci scroll)
 *   DetailLaporanModal  -> rincian satu laporan produksi pangan IRT: identitas sarana,
 *                          hasil pemeriksaan (hasil balai + grading + level IRTP),
 *                          temuan M/m/S/C, daftar penyimpangan, tindak lanjut,
 *                          dan verifikasi pusat sampai direktur.
 */
import { useEffect, useRef } from 'react';
import { FaTimes, FaMapMarkerAlt, FaClipboardCheck, FaUserCheck, FaExclamationTriangle } from 'react-icons/fa';
import { kelasKesimpulan, kelasGrading, kelasTemuan, formatAngka } from './helper';

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
      <div
        className="absolute inset-0 bg-ink-950/60"
        onClick={onClose}
        aria-hidden="true"
      />
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

/** Satu baris "label : nilai" pada grid identitas. */
function Baris({ label, nilai, lebar = 'sm:col-span-1' }) {
  return (
    <div className={lebar}>
      <p className="stat-label">{label}</p>
      <p className="mt-0.5 whitespace-pre-line text-[13px] font-medium text-ink-800 dark:text-ink-100">
        {nilai || '-'}
      </p>
    </div>
  );
}

/** Dialog rincian satu laporan produksi. */
export function DetailLaporanModal({ data, loading, onClose }) {
  const l = data;

  // Berkas menuliskan penyimpangan sebagai satu sel berisi beberapa butir yang
  // dipisah "; ". Dipecah supaya terbaca sebagai daftar, bukan satu paragraf.
  const penyimpangan = String(l?.penyimpangan || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <Modal onClose={onClose} labelledBy="judul-detail-irt" maxWidth="max-w-4xl">
      <div className="panel-head flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="section-label">Rincian Laporan Pemeriksaan Produksi</p>
          <h2 id="judul-detail-irt" className="truncate text-[15px] font-bold text-ink-900 dark:text-ink-50">
            {loading ? 'Memuat…' : l?.nama_sarana || 'Laporan'}
          </h2>
          {!loading && l && (
            <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-300">
              <FaMapMarkerAlt className="shrink-0" />
              <span className="truncate">{l.alamat || '-'}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="rounded-lg p-2 text-ink-400 transition hover:bg-paper-200 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-100"
        >
          <FaTimes />
        </button>
      </div>

      <div className="overflow-y-auto p-4 sm:p-5">
        {loading && <p className="text-[13px] text-ink-500 dark:text-ink-300">Memuat rincian laporan…</p>}

        {!loading && !l && (
          <p className="text-[13px] text-ink-500 dark:text-ink-300">Data laporan tidak tersedia.</p>
        )}

        {!loading && l && (
          <div className="space-y-5">
            {/* Identitas & hasil pemeriksaan */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Baris label="Tahun Data" nilai={l.tahun ? String(l.tahun) : '-'} />
              <Baris label="Nama Sarana" nilai={l.nama_sarana} />
              <Baris label="Kabupaten/Kota" nilai={l.kab_kota} />
              <Baris label="Jenis Industri" nilai={l.jenis_industri} />
              <Baris label="Tanggal Periksa" nilai={`${l.tgl_periksa_mulai || '-'} s.d. ${l.tgl_periksa_selesai || '-'}`} />
              <Baris label="Tanggal Input" nilai={l.tgl_input} />
              <Baris label="Tujuan Pemeriksaan" nilai={l.tujuan_pemeriksaan} />
              <Baris label="Level IRTP" nilai={l.level_irtp} />
              <Baris label="Status Sarana" nilai={l.status_sarana} />
            </section>

            {/* Hasil pemeriksaan */}
            <section className="rounded-lg border border-paper-200 bg-paper-50 p-3 dark:border-ink-800 dark:bg-ink-850/60">
              <p className="section-label flex items-center gap-2">
                <FaClipboardCheck /> Hasil Pemeriksaan & Tindak Lanjut
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="stat-label">Hasil Balai</span>
                  <span className={`inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${kelasKesimpulan(l.hasil_balai)}`}>
                    {l.hasil_balai || '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="stat-label">Grading/Kriteria</span>
                  <span className={`inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${kelasGrading(l.grading)}`}>
                    {l.grading || '-'}
                  </span>
                </div>
                <Baris label="Tindak Lanjut" nilai={l.tindak_lanjut} />
              </div>

              {/* Temuan M / m / S / C */}
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { label: 'Serius', nilai: l.jumlah_serius, tingkat: 'serius' },
                  { label: 'Mayor', nilai: l.jumlah_mayor, tingkat: 'mayor' },
                  { label: 'Minor', nilai: l.jumlah_minor, tingkat: 'minor' },
                  { label: 'Kritis', nilai: l.jumlah_kritis, tingkat: 'kritis' },
                ].map((t) => (
                  <span
                    key={t.label}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${kelasTemuan(t.nilai, t.tingkat)}`}
                  >
                    {t.label}: {formatAngka(t.nilai)}
                  </span>
                ))}
              </div>
            </section>

            {/* Daftar penyimpangan — kolom khas berkas Pangan IRT */}
            <section className="rounded-lg border border-paper-200 bg-paper-50 p-3 dark:border-ink-800 dark:bg-ink-850/60">
              <p className="section-label flex items-center gap-2">
                <FaExclamationTriangle /> Ketidaksesuaian / Penyimpangan
              </p>
              {penyimpangan.length ? (
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
                  {penyimpangan.map((p, i) => (
                    <li key={`${i}-${p.slice(0, 12)}`}>{p}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-[12px] text-ink-500 dark:text-ink-300">
                  Tidak ada penyimpangan yang dicatat pada laporan ini.
                </p>
              )}
              {(l.kriteria || l.timeline) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Baris label="Kriteria" nilai={l.kriteria} />
                  <Baris label="Timeline" nilai={l.timeline} />
                </div>
              )}
            </section>

            {/* Verifikasi pusat */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Baris label="Operator" nilai={l.operator} />
              <Baris label="Petugas" nilai={l.petugas} />
              <Baris label="Status / Posisi Tarikan" nilai={l.status_tarikan} />
              <Baris label="Kepala Balai" nilai={l.kepala_balai} />
              <Baris label="Tgl Kirim Ka. Balai" nilai={l.tgl_kirim_ka_balai} />
              <Baris
                label="Verifikasi Operator Pusat"
                nilai={[l.verif_operator_pusat, l.verif_tgl_operator].filter(Boolean).join(' · ')}
              />
              <Baris
                label="Supervisor Satu Pusat"
                nilai={[l.verif_supervisor_1, l.verif_tgl_supervisor_1].filter(Boolean).join(' · ')}
              />
              <Baris
                label="Supervisor Dua Pusat"
                nilai={[l.verif_supervisor_2, l.verif_tgl_supervisor_2].filter(Boolean).join(' · ')}
              />
              <Baris
                label="Direktur"
                nilai={[l.direktur, l.verif_tgl_direktur].filter(Boolean).join(' · ')}
              />
              <Baris
                label="Kesimpulan Verifikasi Pusat"
                nilai={l.verif_hasil_kesimpulan}
              />
              <Baris
                label="Catatan Verifikasi Pusat"
                nilai={l.verif_catatan}
                lebar="sm:col-span-2"
              />
            </section>

            <p className="flex items-start gap-2 rounded-lg bg-paper-100 px-3 py-2 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-850 dark:text-ink-300">
              <FaUserCheck className="mt-0.5 shrink-0" />
              Berkas laporan Produksi Pangan IRT tidak memuat baris rincian fokus pemeriksaan —
              temuan sudah diringkas pada kolom M/m/S/C dan daftar penyimpangan di atas.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-paper-200 px-4 py-3 dark:border-ink-800">
        <button type="button" onClick={onClose} className="btn-primary">
          Tutup
        </button>
      </div>
    </Modal>
  );
}
