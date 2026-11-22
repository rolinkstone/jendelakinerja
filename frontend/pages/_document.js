// pages/_document.js
// Menyuntikkan script tema lebih awal (di <head>) agar dark mode diterapkan
// SEBELUM halaman dicat, sehingga tidak ada kedipan (flash) warna terang/gelap.
// Sekaligus menandai identitas brand "Let's Digital": favicon, nama aplikasi,
// dan warna tema browser (lihat components/Brand.js).
import Document, { Html, Head, Main, NextScript } from 'next/document';
import { BRAND } from '../components/Brand';

export default function MyDocument() {
  return (
    <Html lang="id">
      <Head>
        {/* ===== Brand / identitas browser ===== */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.svg" />
        <link rel="mask-icon" href="/favicon.svg" color="#0f6cb8" />
        <meta name="application-name" content={BRAND.name} />
        <meta name="apple-mobile-web-app-title" content={BRAND.name} />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f5f1" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#060a12" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
