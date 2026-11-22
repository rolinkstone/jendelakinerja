// components/sampel/lab/Modal.js
/**
 * MODAL — Modul Sampel (dipakai bersama semua komoditi)
 * -----------------------------------------------------
 * Dua komponen:
 *   - `Modal`            : kerangka dialog (overlay + kepala + tombol tutup)
 *   - `DetailSampelModal`: isi rincian satu sampel
 *
 * Berkas sampel punya 55 kolom, jadi rincian dikelompokkan (identitas, tempat,
 * laboratorium, kesimpulan UPT vs Pusat, tindak lanjut) alih-alih satu daftar
 * panjang — supaya bisa dibaca sekilas.
 *
 * Nilai kosong selalu ditampilkan sebagai "—" supaya pengguna tahu kolomnya ada
 * tetapi tidak diisi, bukan kolomnya hilang.
 */
import { useEffect } from 'react';
import { FaTimes, FaFlask, FaCheckCircle, FaTimesCircle, FaBuilding, FaClipboardList } from 'react-icons/fa';
import { kelasKesimpulan, kesimpulanPenuh, formatAngka } from './helper';

/** Satu baris "label : nilai" di dalam blok rincian. */
function Baris({ label, nilai, lebar = true }) {
  const tampil = nilai === null || nilai === undefined || String(nilai).trim() === '' ? '—' : nilai;
  return (
    <div className={lebar ? 'sm:col-span-2' : ''}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-line text-[13px] font-medium text-slate-800 dark:text-slate-100">
        {tampil}
      </dd>
    </div>
  );
}

/** Blok berjudul dengan ikon. */
function Blok({ judul, ikon: Ikon, children }) {
  return (
    <section className="rounded-xl border border-paper-200 bg-paper-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-accent-700 dark:text-accent-300">
        {Ikon ? <Ikon className="h-3 w-3" /> : null}
        {judul}
      </h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/** Kerangka dialog. `lebar` = kelas max-width (mis. "max-w-4xl"). */
export function Modal({ judul, onTutup, children, lebar = 'max-w-3xl' }) {
  // Esc menutup dialog; listener dilepas lagi saat komponen hilang.
  useEffect(() => {
    const tekan = (e) => {
      if (e.key === 'Escape') onTutup();
    };
    document.addEventListener('keydown', tekan);
    return () => document.removeEventListener('keydown', tekan);
  }, [onTutup]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onTutup}
    >
      <div
        className={`my-6 w-full ${lebar} rounded-2xl border border-paper-200 bg-white shadow-xl dark:border-white/[0.08] dark:bg-ink-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-paper-200 px-5 py-4 dark:border-white/[0.08]">
          <h2 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">{judul}</h2>
          <button type="button" onClick={onTutup} className="btn-ghost" aria-label="Tutup">
            <FaTimes className="h-3.5 w-3.5" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Rincian satu sampel. `sampel` = objek penuh dari GET /sampel/:id. */
export function DetailSampelModal({ sampel, onTutup }) {
  if (!sampel) return null;

  const kelas = kelasKesimpulan(sampel.kesimpulan_akhir);
  const lulus = /memenuhi/i.test(String(sampel.kesimpulan_akhir || '')) &&
    !/tidak/i.test(String(sampel.kesimpulan_akhir || ''));

  return (
    <Modal judul="Rincian Sampel" onTutup={onTutup} lebar="max-w-4xl">
      {/* --- kepala: nama sampel + kesimpulan --- */}
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600 dark:text-accent-300">
          <FaFlask className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-snug text-slate-900 dark:text-white">
            {sampel.nama_sampel || '—'}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            {sampel.nomor_sampel || '—'} · {sampel.tahun || '—'}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${kelas}`}>
          {lulus ? <FaCheckCircle className="h-3 w-3" /> : <FaTimesCircle className="h-3 w-3" />}
          {kesimpulanPenuh(sampel.kesimpulan_akhir)}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <Blok judul="Identitas Produk" ikon={FaClipboardList}>
          <Baris label="Nama Sampel" nilai={sampel.nama_sampel} />
          <Baris label="Brand Produk" nilai={sampel.brand_produk} />
          <Baris label="Bentuk Sediaan" nilai={sampel.bentuk_sediaan} />
          <Baris label="Komoditi" nilai={sampel.komoditi} />
          <Baris label="Netto" nilai={sampel.netto} lebar={false} />
          <Baris label="Harga" nilai={sampel.harga} lebar={false} />
          <Baris label="No. Registrasi" nilai={sampel.no_reg} lebar={false} />
          {/* Kolom khas berkas Obat; kosong ("—") untuk komoditi lain. */}
          <Baris label="Kode ATC" nilai={sampel.atc} lebar={false} />
          <Baris label="No. Bets" nilai={sampel.no_bets} lebar={false} />
          <Baris label="Keterangan ED" nilai={sampel.keterangan_ed} lebar={false} />
          <Baris label="Pabrik" nilai={sampel.pabrik} />
          <Baris label="Importir" nilai={sampel.importir} />
          <Baris label="Komposisi" nilai={sampel.komposisi} />
          <Baris label="Kategori" nilai={sampel.kategori} />
        </Blok>

        <Blok judul="Tempat & Kode Sampling" ikon={FaBuilding}>
          <Baris label="Nama Sarana" nilai={sampel.nama_sarana} />
          <Baris label="Kategori Sarana" nilai={sampel.kategori_sarana} />
          <Baris label="Kabupaten/Kota" nilai={sampel.kab_kota} lebar={false} />
          <Baris label="Asal Sampel" nilai={sampel.asal_sampel} lebar={false} />
          <Baris label="Tanggal Sampling" nilai={sampel.tgl_sampling} lebar={false} />
          <Baris label="Bulan Anggaran" nilai={sampel.bulan_anggaran} lebar={false} />
          <Baris label="Tujuan Sampling" nilai={sampel.tujuan_sampling} lebar={false} />
          <Baris label="Cara Perolehan" nilai={sampel.cara_perolehan} lebar={false} />
          <Baris label="Nomor SPK" nilai={sampel.nomor_spk} />
          <Baris label="Nomor Surat Tugas" nilai={sampel.nomor_surat_tugas} />
        </Blok>

        <Blok judul="Pengujian & Hasil" ikon={FaFlask}>
          <Baris label="Jenis Pengujian" nilai={sampel.jenis_pengujian} lebar={false} />
          <Baris label="Kondisi Sampling" nilai={sampel.kondisi_sampling} lebar={false} />
          <Baris label="Kriteria Resiko" nilai={sampel.kriteria_resiko} lebar={false} />
          <Baris label="Jumlah Sampel" nilai={sampel.jumlah_sampel} lebar={false} />
          <Baris label="Metode Pengambilan" nilai={sampel.metode_pengambilan} lebar={false} />
          <Baris label="UPT Penyampling" nilai={sampel.upt_penyampling} />
          <Baris label="UPT Penguji" nilai={sampel.upt_penguji} />
          <Baris label="Hasil Uji (UPT)" nilai={sampel.upt_kesimpulan_uji} />
          <Baris label="Penandaan (UPT)" nilai={sampel.upt_kesimpulan_penandaan} />
          <Baris label="Kesimpulan Akhir (UPT)" nilai={sampel.upt_kesimpulan_akhir} lebar={false} />
          <Baris label="Parameter TMS" nilai={sampel.pusat_parameter_tms} />
          <Baris label="Hasil Uji (Pusat)" nilai={sampel.pusat_kesimpulan_uji} />
          <Baris label="Penandaan (Pusat)" nilai={sampel.pusat_kesimpulan_penandaan} />
          <Baris label="Kesimpulan Akhir (Pusat)" nilai={sampel.pusat_kesimpulan_akhir} lebar={false} />
          <Baris label="Sumber Kesimpulan" nilai={sampel.sumber_kesimpulan} lebar={false} />
        </Blok>

        <Blok judul="Status & Tindak Lanjut" ikon={FaClipboardList}>
          <Baris label="Status Sampel" nilai={sampel.status_sampel} lebar={false} />
          <Baris label="Jenis Tindak Lanjut" nilai={sampel.jenis_tindak_lanjut} lebar={false} />
          <Baris label="Nomor Surat" nilai={sampel.nomor_surat} />
          <Baris label="Tanggal Surat" nilai={sampel.tanggal_surat} />
          <Baris label="Nomor SPU" nilai={sampel.nomor_spu} lebar={false} />
          <Baris label="Operator" nilai={sampel.operator} />
          <Baris label="Diverifikasi oleh" nilai={sampel.verifikasi_oleh} />
          <Baris label="Tanggal LHU" nilai={sampel.tgl_lhu} lebar={false} />
        </Blok>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onTutup} className="btn-primary-sm">
          Tutup
        </button>
      </div>
    </Modal>
  );
}
