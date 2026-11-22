/** @type {import('tailwindcss').Config} */
/**
 * DESIGN TOKENS — JENDELA KINERJA
 * -------------------------------
 * Bahasa visual: "executive cockpit" — kertas hangat (paper) + tinta navy (ink)
 * + aksen BIRU–HIJAU (accent + hijau), mengikuti warna Badan POM.
 * Semua warna brand dipusatkan di sini supaya perubahan palet cukup dilakukan sekali.
 */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tinta navy — sidebar, teks utama mode gelap, permukaan gelap
        ink: {
          950: '#060a12',
          900: '#0a1220',
          850: '#0e1a2b',
          800: '#132238',
          700: '#1b2f4a',
          600: '#28425f',
          500: '#3c5a7d',
        },
        // Aksen BIRU (Badan POM) — aksi, penanda aktif, angka penting
        accent: {
          50: '#f0f7fe',
          100: '#dcecfd',
          200: '#bcdcfb',
          300: '#8ec6f7',
          400: '#58a8ee',
          500: '#2a89dd',
          600: '#0f6cb8',
          700: '#0c5591',
        },
        // Aksen HIJAU (Badan POM) — pelengkap biru: gradien, status baik, penanda
        hijau: {
          50: '#eefaf2',
          100: '#d5f3e0',
          200: '#ade7c4',
          300: '#79d6a0',
          400: '#45bf7c',
          500: '#1fa65f',
          600: '#148c4d',
          700: '#0f6f3f',
        },
        // Kertas hangat — latar terang dan garis rambut
        paper: {
          50: '#fbfaf7',
          100: '#f6f5f1',
          200: '#efece5',
          300: '#e2ded4',
          400: '#cbc5b6',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15,23,42,0.05), 0 10px 26px -18px rgba(15,23,42,0.35)',
        'panel-dark': '0 1px 2px rgba(0,0,0,0.45), 0 14px 34px -20px rgba(0,0,0,0.75)',
        accent: '0 12px 26px -16px rgba(12,85,145,0.65)',
      },
    },
  },
  plugins: [],
};
