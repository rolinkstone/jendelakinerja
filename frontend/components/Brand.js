// components/Brand.js
/**
 * BRAND — Jendela Kinerja
 * -----------------------
 * Satu-satunya sumber identitas aplikasi (single source of truth).
 * Ubah nama/tagline di `BRAND` -> seluruh aplikasi (login, sidebar, beranda,
 * 404, judul tab) ikut berubah.
 *
 * Bahasa visual: tinta navy (ink) + aksen BIRU + HIJAU (Badan POM) + kertas hangat.
 * Glyph logo = BINGKAI JENDELA 4 panel, satu panel terisi hijau -> "jendela"
 * tempat capaian kinerja terlihat.
 *
 * Ekspor:
 *   BRAND              -> konstanta teks brand (nama, tagline, deskripsi, versi)
 *   BrandGlyph         -> glyph bingkai jendela (SVG, memakai `currentColor`)
 *   BrandMark          -> glyph hijau di dalam petak tinta (logo ikon)
 *   BrandWordmark      -> teks "Jendela Kinerja" (+ subjudul opsional)
 *   default Brand      -> lockup lengkap mark + wordmark, bisa diberi `href`
 */
import Link from 'next/link';

export const BRAND = {
  name: 'Jendela Kinerja',
  lead: 'Jendela',
  main: 'Kinerja',
  monogram: 'JK',
  // Baris kecil di bawah nama (sidebar/login)
  subtitle: 'Pemantauan Kinerja',
  // Kalimat penjelas resmi
  tagline: 'Satu jendela untuk melihat capaian kinerja',
  taglineShort: 'Kinerja dalam satu jendela',
  description:
    'Jendela Kinerja adalah platform internal untuk memantau capaian kinerja unit dan pegawai dalam satu tampilan.',
  version: '1.0',
  // Dipakai untuk <title> halaman: "Beranda | Jendela Kinerja"
  titleSuffix: 'Jendela Kinerja',
  footerNote: 'Aplikasi internal',
};

/** Gradien aksen brand (biru → hijau, warna Badan POM) — dipakai petak logo & aksen. */
export const BRAND_GRADIENT = 'from-accent-600 via-accent-500 to-hijau-500';

const MARK_SIZES = {
  xs: 'h-6 w-6 rounded-[5px]',
  sm: 'h-8 w-8 rounded-md',
  md: 'h-9 w-9 rounded-md',
  lg: 'h-11 w-11 rounded-lg',
  xl: 'h-14 w-14 rounded-xl',
  '2xl': 'h-16 w-16 rounded-[1.1rem]',
};

const GLYPH_SIZES = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-[1.35rem] w-[1.35rem]',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-9 w-9',
};

const TEXT_SIZES = {
  xs: { name: 'text-[13px]', sub: 'text-[8px]' },
  sm: { name: 'text-sm', sub: 'text-[9px]' },
  md: { name: 'text-[15px]', sub: 'text-[9px]' },
  lg: { name: 'text-lg', sub: 'text-[10px]' },
  xl: { name: 'text-2xl', sub: 'text-[11px]' },
  '2xl': { name: 'text-3xl', sub: 'text-xs' },
};

/**
 * Glyph bingkai jendela pada grid 48x48: bingkai + palang tengah, dan satu
 * panel kanan-bawah terisi (capaian kinerja). Memakai `currentColor`.
 */
export function BrandGlyph({ className = '' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Bingkai jendela */}
      <rect
        x="7"
        y="7"
        width="34"
        height="34"
        rx="5"
        stroke="currentColor"
        strokeWidth="3.2"
      />
      {/* Palang tengah */}
      <path
        d="M24 8.6v30.8M8.6 24h30.8"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* Panel terisi = capaian */}
      <rect x="26.5" y="26.5" width="11.5" height="11.5" rx="1.6" fill="currentColor" />
    </svg>
  );
}

/** Logo ikon: glyph hijau di atas petak tinta navy, bingkai biru. */
export function BrandMark({ size = 'md', glow = true, className = '', title }) {
  const labelled = Boolean(title);
  return (
    <span
      role={labelled ? 'img' : undefined}
      aria-label={title}
      aria-hidden={labelled ? undefined : 'true'}
      className={`relative inline-flex shrink-0 items-center justify-center bg-ink-900 text-hijau-400 ring-1 ring-inset ring-accent-500/40 ${
        MARK_SIZES[size] || MARK_SIZES.md
      } ${glow ? 'shadow-accent' : ''} ${className}`}
    >
      <BrandGlyph className={GLYPH_SIZES[size] || GLYPH_SIZES.md} />
      {glow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-tr from-white/0 via-white/[0.05] to-white/15"
        />
      )}
    </span>
  );
}

/**
 * Teks brand. `tone`:
 *   'onDark' -> untuk latar gelap (sidebar, panel tinta): kata "Jendela" redup,
 *               kata "Kinerja" putih
 *   'onLight' / 'auto' -> untuk latar terang: slate, otomatis terang di dark mode
 * `gradient` -> kata "Kinerja" memakai gradien biru → hijau.
 */
export function BrandWordmark({
  size = 'md',
  tone = 'auto',
  subtitle,
  gradient = false,
  className = '',
}) {
  const t = TEXT_SIZES[size] || TEXT_SIZES.md;
  const onDark = tone === 'onDark';
  const leadClass = onDark ? 'text-white/55' : 'text-slate-400 dark:text-slate-500';
  const mainClass = gradient
    ? 'text-gradient-accent'
    : onDark
      ? 'text-white'
      : 'text-slate-900 dark:text-white';
  const subClass = onDark ? 'text-accent-300/70' : 'text-slate-400 dark:text-slate-500';

  return (
    <span className={`flex min-w-0 flex-col justify-center ${className}`}>
      <span className={`truncate font-semibold leading-none tracking-tight ${t.name}`}>
        <span className={`font-light ${leadClass}`}>{BRAND.lead}</span>{' '}
        <span className={`font-extrabold ${mainClass}`}>{BRAND.main}</span>
      </span>
      {subtitle && (
        <span
          className={`mt-1.5 truncate font-medium uppercase leading-none tracking-[0.16em] ${t.sub} ${subClass}`}
        >
          {subtitle}
        </span>
      )}
    </span>
  );
}

/** Lockup lengkap (mark + wordmark). Beri `href` untuk menjadikannya tautan. */
export default function Brand({
  size = 'md',
  tone = 'auto',
  subtitle,
  gradient = false,
  glow = true,
  href,
  className = '',
  markClassName = '',
}) {
  const lockup = (
    <>
      <BrandMark size={size} glow={glow} className={markClassName} />
      <BrandWordmark
        size={size}
        tone={tone}
        subtitle={subtitle}
        gradient={gradient}
        className="min-w-0"
      />
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={BRAND.name}
        className={`inline-flex min-w-0 items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent-400/70 ${className}`}
      >
        {lockup}
      </Link>
    );
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>{lockup}</span>
  );
}
