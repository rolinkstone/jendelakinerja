// components/DashboardLayout.js
/**
 * LAYOUT DASHBOARD — Jendela Kinerja
 * ----------------------------------
 * Kerangka halaman aplikasi: sidebar + top bar. Identitas brand (nama, logo,
 * tagline) diambil dari components/Brand.js supaya konsisten di semua halaman.
 *
 * Gaya: "executive cockpit" — sidebar TINTA NAVY (selalu gelap) dengan penanda
 * aktif biru, top bar kertas hangat bergaris rambut, konten berlatar blueprint.
 * Mendukung DARK MODE (class "dark" di <html>, tersimpan di localStorage "theme").
 *
 * Struktur:
 *  - Latar aplikasi (fixed): kertas hangat + garis blueprint + semburat biru/hijau
 *  - Sidebar kiri tinta navy + aksen biru/hijau, bisa di-minimize jadi ikon
 *  - Top bar: judul halaman, tanggal, toggle tema, menu pengguna
 */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  FaBars,
  FaTimes,
  FaThLarge,
  FaFileExcel,
  FaSignOutAlt,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaSun,
  FaMoon,
  FaTruck,
  FaIndustry,
  FaBoxOpen,
  FaBandAid,
  FaFilm,
  FaLeaf,
  FaCookieBite,
  FaVial,
  FaFlask,
  FaPills,
  FaCapsules,
  FaSprayCan,
  FaUtensils,
} from 'react-icons/fa';
import Brand, { BRAND, BrandMark } from './Brand';

const NAV_GROUPS = [
  // PENTING: href-nya '/beranda', BUKAN '/'. Akar '/' sudah dipakai halaman
  // publik dan dialihkan (307) ke /jendela-kinerja lewat getServerSideProps,
  // jadi memakai '/' di sini membuat tombol Beranda melempar pengguna KELUAR
  // dari dashboard ke halaman publik.
  { label: 'Beranda', href: '/beranda', icon: FaThLarge },
  {
    label: 'Distribusi',
    icon: FaTruck,
    // Sub menu: satu kelompok bisa punya beberapa modul. Modul berikutnya
    // tinggal ditambah di sini + folder halaman pages/<kelompok>/<modul>/.
    items: [{ label: 'PBF', href: '/distribusi/pbf', icon: FaBoxOpen }],
  },
  {
    label: 'Produksi',
    icon: FaIndustry,
    items: [
      { label: 'Obat Tradisional', href: '/produksi/ot', icon: FaLeaf },
      { label: 'Pangan IRT', href: '/produksi/irt', icon: FaCookieBite },
    ],
  },
  {
    label: 'Sampel',
    icon: FaVial,
    // Satu entri per komoditi. Komponen & engine-nya dipakai bersama
    // (components/sampel/lab/, backend/lib/sampel.js) — sub menu baru cukup
    // menambah baris di sini + halaman pages/sampel/<segmen>/.
    items: [
      { label: 'Obat Tradisional', href: '/sampel/ot', icon: FaFlask },
      { label: 'Suplemen Kesehatan', href: '/sampel/sk', icon: FaPills },
      { label: 'Obat', href: '/sampel/ob', icon: FaCapsules },
      { label: 'Kosmetika', href: '/sampel/kos', icon: FaSprayCan },
      { label: 'Produk Pangan', href: '/sampel/pp', icon: FaUtensils },
      { label: 'Kemasan Pangan', href: '/sampel/kp', icon: FaFilm },
      { label: 'Obat Kuasi', href: '/sampel/ok', icon: FaBandAid },
    ],
  },
];

export default function DashboardLayout({ children, pageTitle = 'Beranda' }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  const [sidebarOpen, setSidebarOpen] = useState(false); // khusus mobile
  const [isCollapsed, setIsCollapsed] = useState(false); // minimize sidebar (desktop)
  const [isDark, setIsDark] = useState(false); // dark mode
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bukaGrup, setBukaGrup] = useState({}); // sub menu sidebar: { [label kelompok]: boolean }
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const themeAppliedRef = useRef(false);
  const userMenuRef = useRef(null);

  // ===== Dark mode: inisialisasi dari localStorage / preferensi sistem =====
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    themeAppliedRef.current = true;
  }, []);

  // ===== Dark mode: terapkan saat berubah (lewati run pertama) =====
  useEffect(() => {
    if (!themeAppliedRef.current) return;
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleDark = () => setIsDark((v) => !v);

  // Redirect ke /login bila belum login
  useEffect(() => {
    if (!loading && !session) {
      router.push('/login');
    }
  }, [loading, session, router]);

  // Tutup dropdown user saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==== Logout NextAuth + Keycloak SSO (seluruhnya di sisi server) ====
  // Browser hanya diarahkan ke route ini. Route tersebut membaca id_token dari
  // cookie sesi httpOnly, membersihkan cookie NextAuth, lalu meneruskan ke
  // logout Keycloak. Token tidak pernah dibaca/dibuat oleh JavaScript halaman.
  const handleLogout = () => {
    setIsLoggingOut(true);
    window.location.href = '/api/auth/keycloak-logout';
  };

  // ==== Data user ====
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

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ================================================
  //  STATE LOADING
  // ================================================
  if (loading) {
    return (
      <div className="app-surface flex min-h-screen flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400">
        <BrandMark size="xl" className="animate-pulse" />
        <p className="animate-pulse text-sm font-medium tracking-wide">Memuat {BRAND.name}…</p>
      </div>
    );
  }

  // Redirect akan terjadi via useEffect di atas
  if (!session) return null;

  const isActive = (href) => router.pathname === href;

  // Tutup/buka sub menu kelompok. Saat sidebar diciutkan, klik kelompok justru
  // membuka sidebar penuh lebih dulu — sub menu tidak muat di lebar 4.75rem.
  const toggleGrup = (label, sedangAktif) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      return;
    }
    setBukaGrup((prev) => ({ ...prev, [label]: !(prev[label] ?? sedangAktif) }));
  };

  return (
    <div className="relative min-h-screen bg-paper-100 text-slate-800 dark:bg-ink-950 dark:text-slate-100">
      {/* ===== Latar aplikasi (fixed) ===== */}
      <div aria-hidden="true" className="app-surface fixed inset-0 -z-10" />

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/[0.07] bg-ink-900 transition-all duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'md:w-[4.75rem]' : 'md:w-64'}`}
        style={{
          backgroundImage:
            'radial-gradient(22rem 14rem at 0% 0%, rgba(245,158,11,0.10), transparent 62%)',
        }}
      >
        {/* Brand — Jendela Kinerja */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-white/[0.07] ${
            isCollapsed ? 'justify-center px-2' : 'px-4'
          }`}
        >
          {isCollapsed ? (
            <BrandMark size="md" title={BRAND.name} />
          ) : (
            <Brand href="/beranda" size="sm" tone="onDark" subtitle={BRAND.subtitle} className="min-w-0" />
          )}
        </div>

        {/* Navigasi */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-4">
          {isCollapsed ? (
            <div className="mb-3 h-px bg-white/[0.07]" />
          ) : (
            <p className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Menu utama
            </p>
          )}

          <div className="space-y-1">
            {NAV_GROUPS.map((grup) => {
              const Icon = grup.icon;

              // --- Item tunggal (Beranda) ---
              if (!grup.items) {
                const active = isActive(grup.href);
                return (
                  <Link
                    key={grup.href}
                    href={grup.href}
                    onClick={() => setSidebarOpen(false)}
                    title={isCollapsed ? grup.label : undefined}
                    aria-label={grup.label}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center rounded-lg text-sm transition-colors ${
                      isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                    } ${
                      active
                        ? 'bg-white/[0.07] font-semibold text-white'
                        : 'font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent-400"
                      />
                    )}
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-accent-400' : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{grup.label}</span>}
                  </Link>
                );
              }

              // --- Grup dengan sub menu (Distribusi, Produksi) ---
              const adaAktif = grup.items.some((it) => isActive(it.href));
              const dibuka = bukaGrup[grup.label] ?? adaAktif;

              const tombolGrup = (
                <button
                  type="button"
                  onClick={() => toggleGrup(grup.label, adaAktif)}
                  aria-expanded={dibuka}
                  title={isCollapsed ? grup.label : undefined}
                  className={`group relative flex w-full items-center rounded-lg text-sm transition-colors ${
                    isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                  } ${
                    adaAktif
                      ? 'font-semibold text-white'
                      : 'font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      adaAktif ? 'text-accent-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{grup.label}</span>}
                  {!isCollapsed && (
                    <FaChevronDown
                      className={`ml-auto h-2.5 w-2.5 shrink-0 text-slate-500 transition-transform ${
                        dibuka ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>
              );

              // Saat sidebar diciutkan tidak ada ruang untuk sub menu bertingkat:
              // kelompok berubah jadi tombol yang membuka sidebar penuh.
              if (isCollapsed) return <div key={grup.label}>{tombolGrup}</div>;

              return (
                <div key={grup.label}>
                  {tombolGrup}
                  {dibuka && (
                    <div className="mt-0.5 space-y-0.5 border-l border-white/[0.09] pl-3 ml-4">
                      {grup.items.map((it) => {
                        const SubIcon = it.icon || FaBoxOpen;
                        const active = isActive(it.href);
                        return (
                          <Link
                            key={it.href}
                            href={it.href}
                            onClick={() => setSidebarOpen(false)}
                            aria-current={active ? 'page' : undefined}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                              active
                                ? 'bg-white/[0.07] font-semibold text-white'
                                : 'font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                            }`}
                          >
                            <SubIcon
                              className={`h-3 w-3 shrink-0 ${
                                active ? 'text-hijau-400' : 'text-slate-600'
                              }`}
                            />
                            <span className="truncate">{it.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tempat modul baru (draf) */}
          {isCollapsed ? (
            <div className="pt-4">
              <FaPlus
                className="mx-auto h-3 w-3 text-accent-500/60"
                title="Modul menyusul"
                aria-label="Modul menyusul"
              />
            </div>
          ) : (
            <>
              <p className="px-2.5 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Modul lain
              </p>
              <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-white/[0.12] px-3 py-2.5 text-slate-500">
                <FaPlus className="h-3 w-3 shrink-0 text-accent-500/70" />
                <span className="text-[11px] leading-snug">Menu modul menyusul di sini</span>
              </div>
            </>
          )}
        </nav>

        {/* User (footer sidebar) */}
        <div className="shrink-0 border-t border-white/[0.07] px-2.5 py-3">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-500 text-xs font-bold text-white"
                title={displayName}
              >
                {initials}
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Keluar"
                aria-label="Keluar"
                className="text-slate-500 transition-colors hover:text-accent-300 disabled:opacity-50"
              >
                <FaSignOutAlt className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-500 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight text-white">
                  {displayName}
                </p>
                <p className="truncate text-[11px] leading-tight text-slate-500">{roleLabel}</p>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Keluar"
                aria-label="Keluar"
                className="text-slate-500 transition-colors hover:text-accent-300 disabled:opacity-50"
              >
                <FaSignOutAlt className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ================= KONTEN ================= */}
      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-300 ${
          isCollapsed ? 'md:pl-[4.75rem]' : 'md:pl-64'
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-paper-300 bg-paper-50/85 px-4 backdrop-blur-md dark:border-white/[0.08] dark:bg-ink-950/85 sm:gap-3 sm:px-6">
          {/* Mobile: buka drawer */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white md:hidden"
            aria-label="Buka menu"
          >
            <FaBars className="h-4 w-4" />
          </button>

          {/* Desktop: minimize / perluas sidebar */}
          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="hidden items-center justify-center rounded-lg border border-transparent p-2 text-slate-400 transition-colors hover:border-paper-300 hover:bg-white hover:text-slate-900 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-white md:inline-flex"
            aria-label={isCollapsed ? 'Perluas menu samping' : 'Minimalkan menu samping'}
            title={isCollapsed ? 'Perluas menu' : 'Minimalkan menu'}
          >
            {isCollapsed ? (
              <FaChevronRight className="h-3.5 w-3.5" />
            ) : (
              <FaChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Judul halaman */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="hidden h-7 w-[3px] shrink-0 rounded-full bg-accent-400 sm:block"
            />
            <div className="min-w-0">
              <p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 sm:block">
                {BRAND.name}
              </p>
              <h1 className="truncate text-[15px] font-bold leading-tight text-slate-900 dark:text-white">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Tanggal */}
            <span className="chip tnum hidden text-slate-500 dark:text-slate-400 lg:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              {today}
            </span>

            {/* Toggle tema */}
            <button
              onClick={toggleDark}
              className="rounded-lg border border-paper-300 bg-white p-2 text-slate-500 transition-colors hover:border-accent-400/70 hover:text-accent-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-accent-500/40 dark:hover:text-accent-300"
              aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
              title={isDark ? 'Mode terang' : 'Mode gelap'}
            >
              {isDark ? <FaSun className="h-3.5 w-3.5" /> : <FaMoon className="h-3.5 w-3.5" />}
            </button>

            <span aria-hidden="true" className="mx-0.5 hidden h-6 w-px bg-paper-300 dark:bg-white/10 sm:block" />

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1.5 transition-colors hover:border-paper-300 hover:bg-white dark:hover:border-white/10 dark:hover:bg-white/10"
                aria-label="Menu pengguna"
                aria-expanded={userMenuOpen}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-900 text-[11px] font-bold text-accent-400 ring-1 ring-inset ring-accent-500/30">
                  {initials}
                </div>
                <div className="hidden text-left md:block">
                  <p className="max-w-[160px] truncate text-[13px] font-semibold leading-tight text-slate-800 dark:text-white">
                    {displayName}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                    {roleLabel}
                  </p>
                </div>
                <FaChevronDown className="h-2.5 w-2.5 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-paper-300 bg-white py-1.5 shadow-panel dark:border-white/10 dark:bg-ink-850 dark:shadow-panel-dark">
                  <div className="border-b border-paper-200 px-4 py-2.5 dark:border-white/10">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                      {user.email || roleLabel}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <FaSignOutAlt className="h-3.5 w-3.5" />
                    <span>{isLoggingOut ? 'Keluar…' : 'Keluar'}</span>
                  </button>
                  <div className="mt-1 flex items-center gap-2 border-t border-paper-200 px-4 pb-1 pt-2.5 text-[11px] text-slate-400 dark:border-white/10 dark:text-slate-500">
                    <BrandMark size="xs" glow={false} />
                    <span className="truncate">
                      {BRAND.name} v{BRAND.version}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Konten halaman */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* Tombol tutup sidebar (mobile, di luar aside) */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed left-[16.5rem] top-5 z-40 text-slate-400 transition-colors hover:text-white md:hidden"
          aria-label="Tutup menu"
        >
          <FaTimes className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
