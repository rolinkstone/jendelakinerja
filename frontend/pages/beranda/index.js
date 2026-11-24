// pages/beranda/index.js
/**
 * BERANDA DASHBOARD — Jendela Kinerja
 * -----------------------------------
 * Halaman ini dulu berada di `/` (pages/index.js). Sejak navbar publik
 * diperkenalkan, `/` diarahkan ke Jendela Kinerja dan beranda dashboard
 * berpindah ke `/beranda` (tetap di balik SSO).
 * Halaman ringkasan (executive summary). Identitas brand diambil dari
 * components/Brand.js supaya seragam dengan login, sidebar, dan 404.
 *
 * Tampilan: "executive cockpit" — kartu ringkasan KPI, daftar modul aktif,
 * status sistem. Nilai KPI sengaja masih placeholder ("—") karena modul
 * kinerja belum terpasang; begitu modul jadi, ganti `KPI_SLOTS` dengan data
 * dari backend melalui helper modul terkait.
 *
 * ==== KONVENSI STRUKTUR APLIKASI ====
 *   pages/<modul>/index.js            -> halaman tipis (<Head> + layout + container)
 *   components/<modul>/Container.js   -> logika + tampilan modul
 *   components/<modul>/helper.js      -> konstanta & formatter (tanpa state/API)
 *   components/<modul>/Modal.js       -> dialog modul, bila ada
 *   backend/routes/<modul>.js         -> router Express modul (didahului /api/)
 * ====================================
 */
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import DashboardLayout from '../../components/DashboardLayout';
import { BRAND, BrandMark } from '../../components/Brand';
import {
  FaBullseye,
  FaWallet,
  FaUsers,
  FaFileSignature,
  FaFileExcel,
  FaArrowRight,
  FaPlus,
  FaChartLine,
  FaCircle,
  FaBoxOpen,
  FaWarehouse,
  FaBuilding,
  FaBoxes,
  FaClipboardCheck,
  FaFilm,
  FaBandAid,
  FaLeaf,
  FaCookieBite,
  FaFlask,
  FaPills,
  FaCapsules,
  FaSprayCan,
  FaUtensils,
} from 'react-icons/fa';

const greetings = [
  { text: 'Selamat pagi', range: [0, 10] },
  { text: 'Selamat siang', range: [10, 15] },
  { text: 'Selamat sore', range: [15, 18] },
  { text: 'Selamat malam', range: [18, 24] },
];

const getGreeting = () => {
  const h = new Date().getHours();
  return greetings.find((g) => h >= g.range[0] && h < g.range[1]) || greetings[0];
};

// Kartu KPI — placeholder sampai modul kinerja terpasang
const KPI_SLOTS = [
  {
    label: 'Capaian IKU',
    value: '—',
    unit: '%',
    note: 'Menunggu modul kinerja',
    icon: FaBullseye,
  },
  {
    label: 'Realisasi Anggaran',
    value: '—',
    unit: '%',
    note: 'Menunggu modul anggaran',
    icon: FaWallet,
  },
  {
    label: 'Pegawai Aktif',
    value: '—',
    unit: 'org',
    note: 'Menunggu data kepegawaian',
    icon: FaUsers,
  },
  {
    label: 'Perjanjian Kinerja',
    value: '—',
    unit: 'dok',
    note: 'Menunggu data dokumen',
    icon: FaFileSignature,
  },
];

// Modul yang sudah terpasang, dikelompokkan mengikuti menu sidebar:
// Distribusi → PBF, Produksi → Obat Tradisional + Pangan IRT.
const MODULES = [
  {
    kelompok: 'Distribusi',
    href: '/distribusi/pbf',
    label: 'PBF',
    desc: 'Impor & pantau laporan hasil pemeriksaan sarana distribusi PBF.',
    icon: FaBoxOpen,
    status: 'Aktif',
  },
  {
    kelompok: 'Distribusi',
    href: '/distribusi/ifp',
    label: 'IFP',
    desc: 'Impor & pantau laporan hasil pemeriksaan sarana distribusi Instalasi Farmasi Pemerintah (IFP).',
    icon: FaWarehouse,
    status: 'Aktif',
  },
  {
    kelompok: 'Distribusi',
    href: '/distribusi/ifk',
    label: 'IFK',
    desc: 'Impor & pantau laporan hasil pemeriksaan sarana distribusi Instalasi Farmasi Pemerintah Kota/Kabupaten (IFK).',
    icon: FaBuilding,
    status: 'Aktif',
  },
  {
    kelompok: 'Distribusi',
    href: '/distribusi/kos',
    label: 'Kosmetika',
    desc: 'Impor & pantau laporan hasil pemeriksaan sarana distribusi kosmetika.',
    icon: FaSprayCan,
    status: 'Aktif',
  },
  {
    kelompok: 'Distribusi',
    href: '/distribusi/ot',
    label: 'Obat Tradisional',
    desc: 'Impor & pantau laporan hasil pemeriksaan sarana distribusi obat tradisional.',
    icon: FaLeaf,
    status: 'Aktif',
  },
  {
    kelompok: 'Distribusi',
    href: '/distribusi/ipk',
    label: 'IPK',
    desc: 'Impor & pantau laporan Intensifikasi Pengawasan Khusus (IPK) sarana distribusi.',
    icon: FaClipboardCheck,
    status: 'Aktif',
  },
  {
    kelompok: 'Distribusi',
    href: '/distribusi/sk',
    label: 'Suplemen Kesehatan',
    desc: 'Impor & pantau laporan hasil pemeriksaan sarana distribusi suplemen kesehatan.',
    icon: FaPills,
    status: 'Aktif',
  },
  {
    kelompok: 'Produksi',
    href: '/produksi/ot',
    label: 'Obat Tradisional',
    desc: 'Impor & pantau laporan hasil pemeriksaan sarana produksi obat tradisional.',
    icon: FaLeaf,
    status: 'Aktif',
  },
  {
    kelompok: 'Produksi',
    href: '/produksi/irt',
    label: 'Pangan IRT',
    desc: 'Impor & pantau laporan hasil pemeriksaan sarana produksi pangan IRT (CPPB-IRT).',
    icon: FaCookieBite,
    status: 'Aktif',
  },
  {
    kelompok: 'Produksi',
    href: '/produksi/pangan-md',
    label: 'Pangan MD',
    desc: 'Impor & pantau laporan hasil pemeriksaan sarana produksi Pangan MD (Pangan Olahan Makanan Dalam).',
    icon: FaBoxes,
    status: 'Aktif',
  },
  {
    kelompok: 'Sampel',
    href: '/sampel/ot',
    label: 'Obat Tradisional',
    desc: 'Impor & pantau rekap data sampel obat tradisional yang diuji laboratorium (satu baris = satu sampel).',
    icon: FaFlask,
    status: 'Aktif',
  },
  {
    kelompok: 'Sampel',
    href: '/sampel/sk',
    label: 'Suplemen Kesehatan',
    desc: 'Impor & pantau rekap data sampel suplemen kesehatan yang diuji laboratorium (satu baris = satu sampel).',
    icon: FaPills,
    status: 'Aktif',
  },
  {
    kelompok: 'Sampel',
    href: '/sampel/ob',
    label: 'Obat',
    desc: 'Impor & pantau rekap data sampel obat yang diuji laboratorium (satu baris = satu sampel).',
    icon: FaCapsules,
    status: 'Aktif',
  },
  {
    kelompok: 'Sampel',
    href: '/sampel/kos',
    label: 'Kosmetika',
    desc: 'Impor & pantau rekap data sampel kosmetika yang diuji laboratorium (satu baris = satu sampel).',
    icon: FaSprayCan,
    status: 'Aktif',
  },
  {
    kelompok: 'Sampel',
    href: '/sampel/pp',
    label: 'Produk Pangan',
    desc: 'Impor & pantau rekap data sampel produk pangan yang diuji laboratorium (satu baris = satu sampel).',
    icon: FaUtensils,
    status: 'Aktif',
  },
  {
    kelompok: 'Sampel',
    href: '/sampel/kp',
    label: 'Kemasan Pangan',
    desc: 'Impor & pantau rekap data sampel kemasan pangan yang diuji laboratorium (satu baris = satu sampel).',
    icon: FaFilm,
    status: 'Aktif',
  },
  {
    kelompok: 'Sampel',
    href: '/sampel/ok',
    label: 'Obat Kuasi',
    desc: 'Impor & pantau rekap data sampel obat kuasi yang diuji laboratorium (satu baris = satu sampel).',
    icon: FaBandAid,
    status: 'Aktif',
  },
];

export default function Home() {
  const { data: session, status } = useSession();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    setGreeting(getGreeting().text);
    const interval = setInterval(() => setGreeting(getGreeting().text), 60000);
    return () => clearInterval(interval);
  }, []);

  const loading = status === 'loading';
  const user = session?.user || {};
  const displayName =
    user.name ||
    user.username ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Pengguna';
  const initials =
    displayName
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  const roleLabel = typeof user.role === 'string' && user.role ? user.role : 'User';

  const now = new Date();
  const periode = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const tanggalLengkap = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="app-surface flex min-h-screen flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400">
        <BrandMark size="xl" className="animate-pulse" />
        <p className="animate-pulse text-sm font-medium tracking-wide">Memuat {BRAND.name}…</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`Beranda | ${BRAND.name}`}</title>
      </Head>

      <DashboardLayout pageTitle="Beranda">
        <div className="mx-auto max-w-7xl space-y-5">

          {/* ===== Identitas pengguna + periode berjalan ===== */}
          <section className="panel animate-rise overflow-hidden">
            <div className="grid lg:grid-cols-[1.55fr_1fr]">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-base font-extrabold text-accent-400 ring-1 ring-inset ring-accent-500/30">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="chip chip-accent">
                      <BrandMark size="xs" glow={false} />
                      {BRAND.name}
                    </span>
                    <span className="chip">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">SSO aktif</span>
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                    {greeting}, <span className="text-gradient-accent">{displayName}</span>
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {BRAND.tagline}. Peran Anda:{' '}
                    <strong className="font-semibold text-slate-700 dark:text-slate-200">
                      {roleLabel}
                    </strong>
                    . Pilih modul pada menu samping untuk mulai bekerja.
                  </p>
                </div>
              </div>

              {/* Kartu periode — panel tinta bermotif jendela */}
              <div className="window-pattern flex flex-col justify-center gap-1 border-t border-paper-200 bg-ink-900 p-5 text-white dark:border-white/[0.08] sm:p-6 lg:border-l lg:border-t-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-400/90">
                  Periode aktif
                </p>
                <p className="text-2xl font-extrabold capitalize tracking-tight">{periode}</p>
                <p className="text-[11px] text-slate-400">{tanggalLengkap}</p>
                <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                  <FaCircle className="h-1.5 w-1.5 animate-pulse" />
                  Berjalan
                </span>
              </div>
            </div>
          </section>

          {/* ===== Ringkasan KPI ===== */}
          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h3 className="section-label">Ringkasan Kinerja</h3>
              <span className="chip text-slate-400 dark:text-slate-500">Menunggu data modul</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {KPI_SLOTS.map((slot) => {
                const Icon = slot.icon;
                return (
                  <div key={slot.label} className="panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="stat-label">{slot.label}</p>
                        <p className="stat-value mt-2">
                          {slot.value}
                          <span className="ml-1 text-sm font-semibold text-slate-400 dark:text-slate-500">
                            {slot.unit}
                          </span>
                        </p>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600 ring-1 ring-inset ring-accent-500/25 dark:text-accent-400">
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="empty-track mt-3 h-6" aria-hidden="true" />
                    <p className="mt-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                      {slot.note}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ===== Capaian + modul ===== */}
          <section className="grid gap-4 lg:grid-cols-3">
            {/* Capaian per unit (masih kosong) */}
            <div className="panel lg:col-span-2">
              <div className="panel-head">
                <div className="flex items-center gap-2">
                  <FaChartLine className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Capaian per Unit</h3>
                </div>
                <span className="chip">Triwulan berjalan</span>
              </div>

              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 text-accent-400 ring-1 ring-inset ring-accent-500/25">
                  <FaChartLine className="h-5 w-5" />
                </div>
                <h4 className="mt-4 text-sm font-bold text-slate-800 dark:text-white">
                  Belum ada data capaian
                </h4>
                <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Grafik capaian per unit akan tampil di sini setelah modul kinerja terpasang.
                  Modul baru mengikuti konvensi struktur aplikasi:
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                  <code className="rounded border border-paper-300 bg-paper-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    pages/&lt;modul&gt;/index.js
                  </code>
                  <code className="rounded border border-paper-300 bg-paper-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    components/&lt;modul&gt;/Container.js
                  </code>
                  <code className="rounded border border-paper-300 bg-paper-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    backend/routes/&lt;modul&gt;.js
                  </code>
                </div>
              </div>
            </div>

            {/* Kolom kanan */}
            <div className="space-y-4">
              {/* Modul terpasang */}
              <div className="panel overflow-hidden">
                <div className="panel-head">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Modul Terpasang</h3>
                  <span className="badge-primary">{MODULES.length}</span>
                </div>
                <div className="divide-y divide-paper-200 dark:divide-white/5">
                  {MODULES.map((m) => {
                    const Icon = m.icon;
                    return (
                      <Link
                        key={m.href}
                        href={m.href}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper-50 dark:hover:bg-white/[0.04]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600 ring-1 ring-inset ring-accent-500/20 dark:text-accent-400">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-slate-800 dark:text-white">
                            {m.kelompok && (
                              <span className="shrink-0 rounded border border-paper-300 bg-paper-50 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                                {m.kelompok}
                              </span>
                            )}
                            {m.label}
                          </p>
                          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                            {m.desc}
                          </p>
                        </div>
                        <FaArrowRight className="h-3 w-3 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-600 dark:text-slate-600" />
                      </Link>
                    );
                  })}
                  <div className="flex items-center gap-2.5 px-4 py-3 text-slate-400 dark:text-slate-500">
                    <FaPlus className="h-3 w-3" />
                    <span className="text-[11px]">Modul berikutnya menyusul</span>
                  </div>
                </div>
              </div>

              {/* Status sistem */}
              <div className="panel overflow-hidden">
                <div className="panel-head">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Status Sistem</h3>
                </div>
                <div className="px-4 py-1">
                  <div className="data-row">
                    <span className="text-slate-500 dark:text-slate-400">Autentikasi</span>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      SSO Keycloak
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="text-slate-500 dark:text-slate-400">Lingkungan</span>
                    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                      Internal
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="text-slate-500 dark:text-slate-400">Versi</span>
                    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                      {BRAND.name} v{BRAND.version}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== Kaki halaman ===== */}
          <footer className="flex flex-col items-center gap-2 pb-2 pt-1 text-center">
            <BrandMark size="sm" glow={false} />
            <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
              {BRAND.name} v{BRAND.version} — {BRAND.subtitle}
              <br />
              {BRAND.footerNote}
            </p>
          </footer>
        </div>
      </DashboardLayout>
    </>
  );
}
