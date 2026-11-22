// components/jendela-kinerja/KepatuhanKomoditas.js
/**
 * TABEL "SEBARAN KEPATUHAN MUTU PER KELOMPOK KOMODITAS"
 * -----------------------------------------------------
 * Berdiri sendiri (bukan menyatu dengan kartu angka sampel) karena di halaman
 * induk ia ditaruh tepat di bawah "Peringkat Sarana Diperiksa".
 *
 * Datanya dioper dari Container lewat prop `data` (respons
 * /api/publik/kinerja/sampel), jadi satu kali fetch dipakai bersama SampelLab.
 *
 * Tabelnya memakai komponen bersama TabelKepatuhan.js supaya lebar kolom,
 * perataan angka, dan baris jumlahnya sama dengan tabel sampel per tahun.
 */
import { FaCheckCircle, FaFlask } from 'react-icons/fa';
import { angka, formatAngka } from './helper';
import TabelKepatuhan from './TabelKepatuhan';

export default function KepatuhanKomoditas({ data, memuat }) {
  // Modul sampel belum diimpor -> jangan tampilkan panel kosong.
  if (!memuat && !angka(data?.total?.sampel)) return null;

  const perKomoditas = data?.per_komoditas || [];
  const tahun = data?.lintas_tahun ? null : data?.per_tahun?.[0]?.tahun;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="flex items-center gap-2">
          <FaCheckCircle className="h-3.5 w-3.5 text-hijau-500" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            Sebaran Kepatuhan Mutu per Kelompok Komoditas
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-accent hidden sm:inline-flex">
            <FaFlask className="h-3 w-3" />
            {tahun ? `Tahun ${tahun}` : 'Seluruh tahun tersedia'}
          </span>
          <span className="badge-primary">{perKomoditas.length} kelompok</span>
        </div>
      </div>

      <TabelKepatuhan
        label="Kelompok Komoditas"
        kolomNama="komoditi"
        baris={perKomoditas}
        memuat={memuat}
        pesanKosong="Belum ada data komoditas."
        sub={(b) => `${formatAngka(angka(b.produk))} produk`}
      />

      {/* Kelompok komoditas mengikuti kolom `komoditi` di berkas, jadi modul
          sampel baru (pangan, kosmetik) otomatis menambah baris di sini. */}
      <p className="border-t border-paper-200 px-4 py-2.5 text-[11px] leading-snug text-slate-400 dark:border-white/[0.08] dark:text-slate-500">
        Kelompok komoditas mengikuti kolom <em>Komoditi</em> pada berkas sampel — modul sampel lain
        (pangan, kosmetik) akan muncul otomatis di sini begitu diimpor.
      </p>
    </div>
  );
}
