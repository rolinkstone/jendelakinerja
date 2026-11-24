// components/distribusi/sk/Modal.js
/**
 * MODAL — Modul Distribusi Suplemen Kesehatan
 * ----------------------------
 * Dialog milik modul ditaruh terpisah di `components/<modul>/Modal.js`,
 * sedangkan state & request API tetap di `Container.js` (file ini murni tampilan).
 *
 * Isi:
 *   Modal               -> kerangka dialog (overlay, tutup via Esc / klik luar, kunci scroll)
 *   DetailLaporanModal  -> rincian satu laporan KOS: identitas sarana, hasil
 *                          pemeriksaan, verifikasi pusat, dan daftar fokus
 *                          pemeriksaan (kategori + observasi + temuan).
 */
import { useEffect, useRef } from 'react';
import { FaTimes, FaBuilding, FaMapMarkerAlt, FaClipboardCheck, FaUserCheck } from 'react-icons/fa';
import { kelasKesimpulan, kelasKekritisan, formatAngka, ringkas } from './helper';

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
      <p className="mt-0.5 text-[13px] font-medium text-ink-800 dark:text-ink-100">{nilai || '-'}</p>
    </div>
  );
}

/** Satu blok rincian fokus pemeriksaan. */
function BlokRincian({ item }) {
  return (
    <details className="group rounded-lg border border-paper-200 bg-paper-50 px-3 py-2 dark:border-ink-800 dark:bg-ink-850/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink-800 dark:text-ink-100">
          {item.kategori || `Rincian ${item.no_urut}`}
        </span>
        <span className="text-[11px] font-medium text-ink-400 group-open:hidden">buka</span>
        <span className="hidden text-[11px] font-medium text-ink-400 group-open:inline">tutup</span>
      </summary>
      <div className="mt-2 space-y-2 border-t border-paper-200 pt-2 dark:border-ink-800">
        <div>
          <p className="stat-label">Observasi</p>
          <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
            {item.observasi || '-'}
          </p>
        </div>
        <div>
          <p className="stat-label">Temuan</p>
          <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
            {item.temuan || '-'}
          </p>
        </div>
      </div>
    </details>
  );
}

/** Dialog rincian satu laporan. */
export function DetailLaporanModal({ data, loading, onClose }) {
  const l = data;

  return (
    <Modal onClose={onClose} labelledBy="judul-detail-kos" maxWidth="max-w-4xl">
      <div className="panel-head flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="section-label">Rincian Laporan Pemeriksaan</p>
          <h2 id="judul-detail-kos" className="truncate text-[15px] font-bold text-ink-900 dark:text-ink-50">
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
              <Baris label="Jenis Komoditi" nilai={l.jenis_komoditi} lebar="sm:col-span-2" />
              <Baris label="Fokus Pemeriksaan" nilai={l.fokus_pemeriksaan} />
            </section>

            {/* Kesimpulan */}
            <section className="rounded-lg border border-paper-200 bg-paper-50 p-3 dark:border-ink-800 dark:bg-ink-850/60">
              <p className="section-label flex items-center gap-2">
                <FaClipboardCheck /> Kesimpulan & Tindak Lanjut
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="stat-label">Kesimpulan Akhir</span>
                  <span className={`inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${kelasKesimpulan(l.hasil_balai)}`}>
                    {l.hasil_balai || '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="stat-label">Kekritisan</span>
                  <span className={`inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${kelasKekritisan(l.kesimpulan_kekritisan)}`}>
                    {l.kesimpulan_kekritisan || '-'}
                  </span>
                </div>
                <Baris label="Penetapan Sanksi" nilai={l.penetapan_sanksi} />
                <Baris label="Hasil Balai" nilai={l.hasil_balai} />
                <Baris label="Tindak Lanjut" nilai={l.tindak_lanjut} />
                <Baris label="Grading/Kriteria" nilai={l.grading} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Baris label="Rekomendasi Pemeriksaan" nilai={l.rekomendasi} lebar="sm:col-span-2" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { label: 'Mayor', nilai: l.jumlah_mayor, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' },
                  { label: 'Minor', nilai: l.jumlah_minor, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
                  { label: 'Kritis', nilai: l.jumlah_kritis, tone: 'bg-accent-500/10 text-accent-700 dark:text-accent-300' },
                ].map((t) => (
                  <span key={t.label} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${t.tone}`}>
                    {t.label}: {formatAngka(t.nilai)}
                  </span>
                ))}
              </div>
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
                nilai={[l.verif_direktur, l.verif_tgl_direktur].filter(Boolean).join(' · ')}
              />
            </section>

            {/* Justifikasi pusat */}
            <section className="rounded-lg border border-paper-200 bg-paper-50 p-3 dark:border-ink-800 dark:bg-ink-850/60">
              <p className="section-label flex items-center gap-2">
                <FaUserCheck /> Justifikasi Pusat
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Baris label="Hasil Kesimpulan" nilai={l.just_kesimpulan} />
                <Baris label="Saran Tindak Lanjut" nilai={l.just_saran} />
                <Baris label="Hasil Temuan" nilai={ringkas(l.just_temuan, 220)} lebar="sm:col-span-2" />
                <Baris label="Catatan Hasil Pemeriksaan" nilai={ringkas(l.just_catatan, 220)} lebar="sm:col-span-2" />
                <Baris label="Detil Tindak Lanjut" nilai={ringkas(l.just_detil, 220)} lebar="sm:col-span-2" />
              </div>
            </section>

            {/* Fokus pemeriksaan */}
            <section>
              <p className="section-label flex items-center gap-2">
                <FaBuilding /> Fokus Pemeriksaan ({l.rincian?.length || 0})
              </p>
              <div className="mt-2 space-y-2">
                {(l.rincian || []).map((item) => (
                  <BlokRincian key={item.id} item={item} />
                ))}
                {!l.rincian?.length && (
                  <p className="text-[12px] text-ink-500 dark:text-ink-300">Tidak ada rincian fokus pemeriksaan.</p>
                )}
              </div>
            </section>
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
