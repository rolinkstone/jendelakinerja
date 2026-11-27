// components/jendela-kinerja/SampelLab.js
/**
 * BAGIAN "HASIL PENGUJIAN LABORATORIUM" DI JENDELA KINERJA
 * --------------------------------------------------------
 * Berisi ringkasan hasil uji laboratorium modul Sampel (Obat Tradisional):
 *   1. Empat angka pokok (sampel diuji, memenuhi, tidak memenuhi, wilayah)
 *   2. Tabel "Jumlah Sampel Diuji per Tahun"
 *
 * Tabel per kelompok komoditas TIDAK di sini \u2014 ia komponen sendiri
 * (KepatuhanKomoditas.js) dan ditaruh setelah bagian ini di halaman induk.
 * Bentuk sediaan tidak ditampilkan (permintaan pemilik aplikasi).
 *
 * Data dari GET /api/publik/kinerja/sampel (backend/routes/publik.js), yang
 * membaca tabel `sampel_ot_laporan` \u2014 bukan view `v_kinerja_sarana`, karena di
 * view itu satu sampel hanya jadi satu baris sarana tanpa nama produk, kode
 * sampel, atau sediaan.
 *
 * Komponen ini mengikuti filter TAHUN dan WILAYAH (kab/kota) halaman induk.
 * Filter wilayah WAJIB diikuti: berkas sampel mencantumkan `kab_kota`, jadi
 * setelah pengguna mengklik satu kabupaten di panel Peringkat, bagian ini
 * harus menampilkan angka wilayah itu. Sebelumnya filter wilayah tidak
 * diteruskan sehingga panel menampilkan angka SELURUH wilayah (2026: 1.311)
 * sementara tabel per kab/kota menampilkan 1.096 untuk Kota Palangka Raya \u2014
 * dua angka berbeda untuk wilayah yang sama, dan pembaca mengira salah satu
 * di antaranya keliru.
 * Filter JENIS SARANA memang tidak dipakai: berkas sampel tidak menggreding sarana.
 */
import { FaVial, FaFlask, FaCheckCircle, FaExclamationTriangle, FaMapMarkedAlt } from 'react-icons/fa';
import { angka, formatAngka } from './helper';
import TabelKepatuhan, { persenKepatuhan } from './TabelKepatuhan';

export default function SampelLab({ data, memuat, tahun, kab }) {
  // Modul sampel belum diimpor -> bagian ini tidak perlu tampil sama sekali.
  if (!memuat && !angka(data?.total?.sampel)) return null;

  const total = data?.total || {};
  const perTahun = data?.per_tahun || [];

  const jumlahSampel = angka(total.sampel);
  const memenuhi = angka(total.memenuhi);
  const tidakMemenuhi = angka(total.tidak_memenuhi);
  const persenMemenuhi = persenKepatuhan(memenuhi, jumlahSampel);

  // Empat angka pokok. Disusun sebagai data, bukan JSX berulang, supaya
  // pemisah antar kolom (garis tipis) konsisten di semua lebar layar.
  const angkaPokok = [
    {
      label: 'Sampel Diuji',
      nilai: formatAngka(jumlahSampel),
      catatan: `${formatAngka(total.produk)} produk \xb7 ${formatAngka(total.produsen)} produsen`,
      ikon: FaVial,
      warna: 'text-accent-600 dark:text-accent-400',
    },
    {
      label: 'Memenuhi Syarat',
      nilai: formatAngka(memenuhi),
      catatan: `${persenMemenuhi}% dari sampel`,
      ikon: FaCheckCircle,
      warna: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Tidak Memenuhi Syarat',
      nilai: formatAngka(tidakMemenuhi),
      catatan: tidakMemenuhi > 0 ? 'perlu tindak lanjut pengawasan' : 'tidak ada temuan',
      ikon: FaExclamationTriangle,
      warna: 'text-rose-600 dark:text-rose-400',
    },
    {
      label: 'Wilayah Sampling',
      nilai: formatAngka(total.wilayah),
      catatan: kab ? 'sesuai filter wilayah' : 'kabupaten/kota',
      ikon: FaMapMarkedAlt,
      warna: 'text-slate-500 dark:text-slate-400',
    },
  ];

  return (
    <section className="space-y-4">
      {/* ============ Ringkasan angka ============ */}
      <div className="panel">
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <FaVial className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Hasil Pengujian Laboratorium
            </h3>
          </div>
          {/* Label tahun harus jujur: kalau tahun filter sarana tidak punya
              data sampel, angka di bawah ini mencakup semua tahun. */}
          <span className="chip chip-accent">
            <FaFlask className="h-3 w-3" />
            {/* Wilayah + tahun ditulis eksplisit supaya angka pada kartu tidak
                ambigu: 1.311 (seluruh wilayah) vs 1.096 (satu kabupaten). */}
            {kab || 'Semua wilayah'}
            {' \xb7 '}
            {data?.lintas_tahun || !tahun ? 'seluruh tahun tersedia' : `tahun ${tahun}`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4">
          {angkaPokok.map((k, i) => {
            const Ikon = k.ikon;
            return (
              <div
                key={k.label}
                className={[
                  'px-3 py-3.5 sm:px-4 sm:py-4',
                  // Pemisah: 2 kolom di ponsel, 4 kolom di layar lebar.
                  i === 1 ? 'border-l border-paper-200 dark:border-white/[0.08]' : '',
                  i === 2 ? 'border-t border-paper-200 dark:border-white/[0.08] sm:border-l sm:border-t-0' : '',
                  i === 3 ? 'border-l border-t border-paper-200 dark:border-white/[0.08] sm:border-t-0' : '',
                ].join(' ')}
              >
                {/* Label dibiarkan MELIPAT, bukan `truncate`: di kisi 2 kolom
                    ponsel "Tidak Memenuhi Syarat" terpotong jadi "TIDAK MEME..."
                    dan pembaca kehilangan arti angkanya. `items-start` membuat
                    ikon tetap di baris pertama saat label melipat dua baris. */}
                <p className="flex items-start gap-1.5 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-400 dark:text-slate-500">
                  <Ikon className={`mt-[1px] h-3 w-3 shrink-0 ${k.warna}`} />
                  <span className="min-w-0">{k.label}</span>
                </p>
                <p className={`stat-value mt-1.5 text-xl sm:text-2xl ${k.warna}`}>{memuat ? '\u2026' : k.nilai}</p>
                <p className="mt-1 text-[10.5px] leading-snug text-slate-400 dark:text-slate-500 sm:text-[11px]">{k.catatan}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============ Tabel sampel per tahun ============ */}
      <div className="panel">
        <div className="panel-head">
          <div className="flex items-center gap-2">
            <FaFlask className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Jumlah Sampel Diuji per Tahun
            </h3>
          </div>
          <span className="badge-primary">
            {perTahun.length} tahun \xb7 {formatAngka(jumlahSampel)} sampel
          </span>
        </div>

        <TabelKepatuhan
          label="Tahun"
          kolomNama="tahun"
          baris={perTahun}
          memuat={memuat}
          pesanKosong="Belum ada data sampel laboratorium."
          sub={(b) =>
            `${formatAngka(angka(b.produk))} produk \xb7 ${formatAngka(angka(b.produsen))} produsen`
          }
        />
      </div>
    </section>
  );
}
