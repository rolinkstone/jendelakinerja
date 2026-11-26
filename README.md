# Jendela Kinerja — BBPOM Palangka Raya

Dashboard kinerja. Modul dikelompokkan dalam tiga menu, masing-masing bersub menu:

- **Distribusi → PBF** — impor laporan hasil pemeriksaan sarana distribusi PBF
  dari berkas Excel.
- **Distribusi → PBF** — impor laporan hasil pemeriksaan sarana distribusi
  PBF (44 kolom: ada blok temuan Kategori/Observasi/Temuan, M/m/C, Analisa,
  Kriteria Resiko, ATC).
- **Distribusi → IFP** — sarana distribusi **Instalasi Farmasi Pemerintah**.
  Tata letak berkasnya IDENTIK dengan PBF, jadi memakai router kembar.
- **Distribusi → IFK** — Instalasi Farmasi Pemerintah **Kota/Kabupaten**.
  Berkasnya IDENTIK dengan PBF/IFP (44 kolom, rincian fokus pemeriksaan,
  M/m/C), jadi memakai router kembar. Jangan tertukar dengan **IFP**
  (provinsi) — kolomnya sama, tabel & kewenangannya beda.
  Berkas contoh `distribusi IFK 2024.xlsx` (149 baris) → **10 laporan +
  130 rincian**, karena satu laporan menampung banyak baris fokus.
- **Distribusi → Kosmetika** — 35 kolom, TIDAK punya blok temuan maupun M/m/C.
  Judul "Tindak Lanjut" muncul **dua kali** (kolom 11 = UPT, kolom 15 = pusat)
  dan disimpan ke kolom berbeda (`tindak_lanjut` / `tindak_lanjut_pusat`).
  Kesimpulan ada di "Hasil Balai" (kolom 14).
- **Distribusi → Obat Tradisional** — 38 kolom, ada "Metode Inspeksi" dan tiga
  kolom detil (Detil Tindak Lanjut, Detil Hasil Pemeriksaan, Detil Kesimpulan
  TMK). Kesimpulan ada di "Hasil Balai" (kolom 17).
  **Jangan tertukar dengan Produksi → Obat Tradisional** (CPOTB): yang ini
  sarana peredaran, bukan sarana produksi.
- **Distribusi → IPK (Intensifikasi Pengawasan Khusus)** — 32 kolom, paling
  ringkas: tanpa blok temuan, M/m/C, maupun "Klasifikasi". Yang khas hanya
  "Tindakan Terhadap Produk". Kesimpulan di "Hasil Balai".
- **Distribusi → Suplemen Kesehatan** — 38 kolom. Jangan tertukar dengan
  **Sampel → Suplemen Kesehatan** (`sampel-sk`): yang ini sarana peredaran yang
  diperiksa, bukan produk yang diuji lab. Judul "Tindak Lanjut" juga muncul
  **dua kali** (kolom 12 = UPT, kolom 18 = pusat).
- **Produksi → Pangan IRT** — impor laporan hasil pemeriksaan sarana produksi
  pangan IRT (CPPB-IRT).
- **Produksi → Obat Tradisional** — impor laporan hasil pemeriksaan sarana
  produksi obat tradisional (CPOTB) dari berkas Excel.
- **Produksi → Pangan MD** — sarana produksi Pangan Olahan Makanan Dalam.
  Berkasnya **48 kolom** (beda dari IRT/OT): identitas produk ada di baris
  sarana (Nama Pangan, Jenis Pangan, Merk Produk), ada blok **Sertifikat**
  (jenis, nomor, masa berlaku, lembaga), Status Sarana, temuan ketidaksesuaian
  administrasi, M/m/C, dan Tingkat Rating. Kesimpulan akhir memakai
  `hasil_balai` (kolom `kesimpulan` hanya ringkasan UPT).
  Berkas contoh `produksi - pangan md.xlsx` (31 baris) → **22 laporan**.
- **Sampel → Obat Tradisional** — impor rekap data sampel obat tradisional yang
  diuji laboratorium (satu baris tabel = satu sampel).
- **Sampel → Suplemen Kesehatan** — sama, untuk komoditi suplemen kesehatan.
- **Sampel → Obat** — sama, untuk komoditi obat (berkasnya paling lebar: 59
  kolom, ada `Kriteria Resiko`, `ATC`, dan kolom tanpa judul).
- **Sampel → Kosmetika** — sama, untuk komoditi kosmetika (54 kolom: tanpa
  `Jenis Sarana`, tanpa `Kriteria Resiko`/`ATC`; kolom tanpa judul di bawah
  kelompok "Tujuan Sampling" memang berisi tujuan sampling, jadi engine
  memetakannya sendiri).
- **Sampel → Produk Pangan** — sama, untuk komoditi produk pangan (54 kolom:
  `Kategori Sarana` berisi "Pangan IRT (CPPB - IRT)" sehingga tidak dipakai
  sebagai `jenis_sarana`; `Kategori` 514 karakter dan `Komposisi` 1.277
  karakter disimpan sebagai TEXT; ada `Brand Produk`, `URL Produk`, `Cara
  Perolehan`, `Kondisi Sampling`). Berkas contoh `Produk Pangan 2024.xlsx`
  (2.871 baris mentah) → **631 sampel tahun 2024**. Kolom `no_reg` (di **semua** tabel sampel: 80 → 255) dan
  `importir` dilebarkan ke 255 karena satu sel bisa memuat beberapa nomor
  registrasi sekaligus (93 karakter).
- **Sampel → Kemasan Pangan** — tata letak berkasnya SAMA dengan Produk Pangan
  (54 kolom, header dua tingkat di baris 9–10), jadi engine memetakannya tanpa
  `kolomPaku`. Yang khas: `Kategori Sarana` hanya berisi "Pangan" (bukan jenis
  sarana), sedangkan rincian kemasan ("» Polikarbonat (pc)") ada di kolom
  `Kategori`. Berkas contoh `Kemasan Pangan 2024.xlsx` (18 baris mentah) →
  **9 sampel tahun 2024**.
- **Sampel → Obat Kuasi** — tata letak berkasnya SAMA dengan Produk Pangan (54 kolom, header dua tingkat di baris 9–10). Berkas contoh `obat kuasi 2024.xlsx` (54 baris mentah) → **27 sampel tahun 2024**.

Semua modul menyimpan data **terpisah per tahun**: mengunggah berkas tahun 2025
hanya menggantikan data tahun 2025, tahun lain tidak tersentuh (tidak ada
riwayat versi untuk tahun yang sama).

**Tahun data dibaca dari isi berkas, bukan dari judul berkas.** Yang dihitung
dulu adalah tanggal sampling terbanyak (bobot 3), lalu tanggal LHU/SPK (bobot
1), dan baru meta `PERIODE SAMPLING` sebagai cadangan terakhir. Alasannya:
berkas `Produk Pangan 2024.xlsx` mencantumkan periode `01-01-2024 - 01-01-2025`
padahal seluruh sampelnya bertanggal 2024 — kalau meta diutamakan, 631 sampel
2024 tersimpan sebagai tahun 2025 tanpa error apa pun.

- **Backend** — Express + MySQL (`backend/`) — port **5006**
- **Frontend** — Next.js (pages router) + NextAuth/Keycloak (`frontend/`) — port **3007**

## Identitas warna

Palet brand mengikuti warna **Badan POM: biru + hijau**. Nilai token dipusatkan di
`frontend/tailwind.config.js` (`accent` = biru, `hijau` = hijau, `ink` = navy);
komponen memakai kelas token, bukan hex langsung.

Jangan memakai **violet/ungu** (dipakai aplikasi lain) atau **orange/amber/gold**
(dipakai eCipar) sebagai warna identitas. Bila palet berganti, ikut ubah:
`frontend/styles/globals.css` (gradien & semburat latar), `frontend/components/ThemeRegistry.js`
(primary/secondary MUI), `frontend/pages/_document.js`, dan `frontend/public/favicon.svg`
— lalu **restart** dev frontend agar Tailwind memuat ulang config.

## Menjalankan (development lokal)

```powershell
# Backend
cd backend
Copy-Item .env.example .env     # pertama kali saja
npm install
npm start                       # http://localhost:5006

# Frontend (terminal terpisah)
cd frontend
Copy-Item .env.example .env     # pertama kali saja
npm install
npm run dev                     # http://localhost:3007
```

Skema database (idempoten, aman diulang) — menerapkan **semua** `backend/db/*.sql`:

```powershell
cd backend
node scripts/apply-schema.js
```

## Menjalankan (produksi / Docker)

```powershell
Copy-Item .env.example .env     # lalu isi kredensialnya (lihat DEPLOY.md)
docker compose up -d --build
```

Port internal di server: frontend `3007`, backend `5006`.

## Kredensial

File `.env` **tidak ikut ter-commit**. Selalu pakai file `.example` sebagai
template. Detail lengkap ada di [`DEPLOY.md`](DEPLOY.md).

> ⚠️ **Sebelum deploy:** password MySQL user `jendela_app` pernah ter-commit di
> `backend/.env.example` dan repo ini publik. Password itu **wajib diganti** —
> lihat [DEPLOY.md §9](DEPLOY.md#9-keamanan--kredensial-yang-bocor-wajib-dibaca-sebelum-deploy).

## Laura AI (maskot bantuan di halaman publik)

Halaman publik menampilkan **maskot BBPOM** di pojok kanan bawah sebagai pintu
masuk ke **Laura AI** (`https://laura-ai.bbpompky.id`) — asisten AI Balai POM
Palangka Raya. Pertanyaan pengunjung diarahkan ke sana, bukan dijawab di
dashboard.

| Bagian | Berkas |
|---|---|
| Komponen | `frontend/components/jendela-kinerja/LauraAI.js` |
| Aset maskot | `frontend/public/images/maskot-bpom.png` (PNG RGBA **263×948**) |
| Dipasang di | `components/jendela-kinerja/Container.js` (Jendela Kinerja) + `components/navbar/Segera.js` (halaman "segera hadir") |

Aturan yang perlu dijaga saat mengubahnya:

- **Asetnya sangat tinggi (rasio 1:3,6).** Membatasi tinggi saja (`h-*`) membuat
  lebarnya menyusut jadi ±20px di dalam tombol 80px sehingga maskot tampak kurus.
  Yang dipakai sekarang: lebar tetap `w-[74%]` + `absolute bottom-0 left-1/2
  -translate-x-1/2`, dengan `overflow-hidden` pada tombol bundar.
- **Tautan wajib `target="_blank"` + `rel="noopener noreferrer"`** — dashboard
  tidak boleh hilang saat pengunjung pindah ke Laura.
- **Balon sapaan ditutup per sesi** (`sessionStorage` kunci `laura-balon-tutup`),
  dibungkus `try/catch` karena `sessionStorage` bisa diblokir di mode privat.
- Klik maskot = buka/tutup balon; klik "Tanya Laura" = buka situs.
- Tombol `fixed bottom-4 right-4 z-40` dan sengaja **kecil** agar tidak menutupi
  tabel/peta; balon maksimal 248px.

## Navbar Publik & Gerbang Aplikasi

Membuka `localhost:3007` (`/`) **langsung menampilkan Jendela Kinerja** — bukan form login.

| Path | Sifat | Isi |
|---|---|---|
| `/` | publik | gerbang: `getServerSideProps` → redirect 307 ke `/jendela-kinerja` |
| `/jendela-kinerja` | publik | dashboard pengawasan (satu-satunya menu yang modulnya sudah jalan) |
| `/prestasi-unit-kerja` | publik | halaman "segera hadir" (`components/navbar/Segera.js`) |
| `/anggaran-realisasi` | publik | halaman "segera hadir" |
| `/dokumen-pk-rapk` | publik | halaman "segera hadir" |
| `/sumber-daya` | publik | halaman "segera hadir" |
| `/beranda` | **butuh SSO** | beranda dashboard lama (kartu KPI + daftar modul); dulu di `/` |
| `/login` | publik | masuk lewat Keycloak |

Komponen navbar: `components/navbar/Navbar.js` + `components/navbar/helper.js`.
Daftar menu hidup di `MENU_PUBLIK`; entri yang modulnya belum selesai ditandai
`siap: false` dan otomatis diarahkan ke halaman "segera hadir". Menu aktif
ditentukan dari `useRouter().pathname`, jadi tiap halaman publik tidak perlu
mengirim statusnya sendiri.

Dua hal yang mudah salah:

1. **Akar `/` harus dinyatakan publik lebih dulu di `middleware.js`** dengan
   perbandingan **persis** (`path === '/'`). `path.startsWith('/')` cocok dengan
   semua path, dan tanpa pengecualian ini `/` ditahan middleware di form login.
2. **Tombol "Masuk dashboard" mengarah ke `/beranda`**, bukan `/` — kalau
   diarahkan ke `/`, tombol itu hanya memantul kembali ke Jendela Kinerja.

## Struktur Folder

Satu modul = satu paket file, halaman tetap tipis:

```
frontend/pages/<modul>/index.js          # halaman tipis (Head + DashboardLayout + Container)
frontend/components/<modul>/Container.js # logika & tampilan
frontend/components/<modul>/helper.js    # konstanta & formatter
frontend/components/<modul>/Modal.js     # dialog, bila perlu
frontend/pages/api/<modul>/[...path].js  # proxy server (menyuntik Bearer token dari sesi)
backend/routes/<modul>.js                # router Express, di-mount sebagai /api/<modul>
backend/db/<modul>.sql                   # DDL idempoten
```

Halaman mengikuti struktur menu, jadi satu kelompok menu = satu folder:
`frontend/pages/distribusi/pbf/`, `frontend/pages/produksi/ot/`,
`frontend/pages/sampel/ot/`, dan seterusnya.

Menu sidebar didaftarkan di `frontend/components/DashboardLayout.js` (`NAV_GROUPS`).
Satu entri boleh punya `items` (sub menu); saat sidebar diciutkan kelompok berubah
jadi tombol yang membuka sidebar penuh karena sub menu tidak muat di 4.75rem.

## Token & autentikasi

Token Keycloak **tidak pernah** dikirim ke browser. `frontend/utils/axiosInstance.js`
sengaja tidak memasang header Authorization; setiap modul memanggil route proxy di
`pages/api/**` (cookie sesi NextAuth bersifat httpOnly), lalu proxy meneruskan
`Authorization: Bearer <accessToken>` ke backend.

## Endpoint backend

| Endpoint | Keterangan |
| --- | --- |
| `GET /api/health` | status server (publik) |
| `GET /api/keycloak/*` | utilitas Keycloak |
| `POST /api/pbf/import` | unggah Excel PBF (multipart: `berkas`, `tahun`) — **mengganti data tahun itu saja** |
| `GET /api/pbf/summary?tahun=` | ringkasan + `daftar_tahun` (jumlah laporan/rincian per tahun) |
| `GET /api/pbf/laporan?tahun=&q=&page=` | daftar laporan (pagination + pencarian) |
| `GET /api/pbf/laporan/:id` | rincian satu laporan (fokus pemeriksaan, grading) |
| `DELETE /api/pbf/data?tahun=` | hapus satu tahun; tanpa `tahun` = hapus semua tahun |
| `POST /api/produksi-ot/import` | unggah Excel Produksi OT (multipart: `berkas`, `tahun` atau `otomatis`) — **mengganti data tahun itu saja** |
| `GET /api/produksi-ot/summary?tahun=` | ringkasan + `daftar_tahun` |
| `GET /api/produksi-ot/laporan?tahun=&q=&page=` | daftar laporan produksi (pagination + pencarian) |
| `GET /api/produksi-ot/laporan/:id` | rincian satu laporan produksi |
| `DELETE /api/produksi-ot/data?tahun=` | hapus satu tahun; tanpa `tahun` = hapus semua tahun |
| `POST /api/produksi-irt/import` | unggah Excel Produksi Pangan IRT (multipart: `berkas`, `tahun` atau `otomatis`) — **mengganti data tahun itu saja** |
| `GET /api/produksi-irt/summary?tahun=` | ringkasan + `daftar_tahun` |
| `GET /api/produksi-irt/laporan?tahun=&q=&page=` | daftar laporan produksi pangan IRT (pagination + pencarian) |
| `GET /api/produksi-irt/laporan/:id` | rincian satu laporan (penyimpangan, level IRTP, verifikasi pusat) |
| `DELETE /api/produksi-irt/data?tahun=` | hapus satu tahun; tanpa `tahun` = hapus semua tahun |
| `POST /api/sampel-<komoditi>/import` | unggah Excel sampel (multipart: `berkas`, `tahun` atau `otomatis`) — **mengganti data tahun itu saja**; baris multi-baris digabung jadi satu sampel. `<komoditi>` = `ot`, `sk`, `ob`, atau `kos` |
| `GET /api/sampel-<komoditi>/summary?tahun=` | ringkasan (sampel, memenuhi/tidak memenuhi, sebaran sediaan, per kab/kota) + `daftar_tahun` |
| `GET /api/sampel-<komoditi>/sampel?tahun=&q=&kesimpulan=&page=` | daftar sampel (pagination + pencarian + filter kesimpulan) |
| `GET /api/sampel-<komoditi>/sampel/:id` | rincian satu sampel (identitas produk, tempat sampling, hasil UPT & Pusat, tindak lanjut) |
| `DELETE /api/sampel-<komoditi>/data?tahun=` | hapus satu tahun; tanpa `tahun` = hapus semua tahun |

Semua endpoint sampel memakai **engine yang sama** (`backend/lib/sampel.js`);
router per komoditi (`routes/sampel-ot.js`, `routes/sampel-sk.js`,
`routes/sampel-ob.js`, `routes/sampel-kos.js`) hanya berisi konfigurasi nama
tabel & label — kecuali berkas Obat yang kolomnya bergeser dan kolomnya dipaku
(`kolomPaku`) (lihat bagian "Modul Sampel"). Proxy frontend satu pintu:
`frontend/pages/api/sampel/[...path].js` (segmen pertama = komoditi, divalidasi
terhadap daftar `SEGMEN`).
| `GET /api/publik/kinerja/sampel?tahun=` | rekap hasil uji laboratorium: sampel per tahun + kepatuhan per kelompok komoditas & bentuk sediaan (tanpa Bearer) |

Semua endpoint PBF, Produksi OT, Produksi Pangan IRT, dan seluruh Sampel butuh Bearer token; hanya
`/api/health`, `/api/login`, dan `/api/publik/*` yang publik.

### Impor Produksi OT

Berkas Excel export SIPT (`sarana produksi OT <tahun>.xlsx`): baris 0–6 berisi
identitas laporan (periode pemeriksaan, periode entri, balai, jenis sarana),
baris 7–8 header dua tingkat, data mulai baris 9. Berbeda dengan PBF, satu baris
bernomor = satu sarana produksi — **tidak ada tabel rincian fokus pemeriksaan**.

Tahun data ditentukan berurutan: field multipart `tahun` → deteksi dari berkas
(periode pemeriksaan → tanggal entri → tanggal periksa) → bila gagal, impor
ditolak `400` dan UI meminta tahun dipilih manual.

### Impor Produksi Pangan IRT

Berkas Excel export SIPT (`produksi pangan irt <tahun>.xlsx`) memakai tata letak
yang sama dengan OT: baris 0–6 identitas laporan, baris 7–8 header dua tingkat,
data mulai baris 9, satu baris bernomor = satu sarana produksi.

Bedanya, berkas ini memuat kolom tambahan yang ikut disimpan:
`Penyimpangan` / `Kriteria` / `Timeline` per baris, `Level IRTP`, serta blok
verifikasi pusat sampai direktur (`Hasil Kesimpulan`, `Catatan`, `Saran` dan
`Detil Tindak Lanjut`). Temuan memakai **M/m/S/C** — `S` (serius) menempati slot
yang pada berkas OT diisi `O` (lainnya); di view gabungan slot itu bernama
`jumlah_lain` sehingga dashboard publik bisa menampilkan label "Serius" atau
"Lainnya" sesuai jenis sarana yang sedang difilter.

Tahun data ditentukan dengan aturan yang sama seperti PBF dan OT (replace per
tahun, satu transaksi, tahun lain tidak tersentuh).

### Modul Sampel — satu engine, banyak komoditi

Modul Sampel punya beberapa sub menu (Obat Tradisional, Suplemen Kesehatan,
Obat, dan berikutnya). Komponen & parser dibagi bersama — tetapi **berkas Excel
tiap komoditi TIDAK selalu bertata letak sama** (lihat catatan di bawah tabel):

| Lapisan | Berkas | Isi |
|---|---|---|
| Engine | `backend/lib/sampel.js` | pemetaan kolom **dari judul header**, penggabungan baris, deteksi tahun, impor per tahun, CRUD — `buatRouterSampel()` |
| Router | `backend/routes/sampel-ot.js`, `sampel-sk.js`, `sampel-ob.js` | ~20–30 baris: label + nama tabel (+ `kolomPaku` bila berkasnya tidak berjudul lengkap) |
| Skema | `backend/db/sampel_ot.sql`, `sampel_sk.sql`, `sampel_ob.sql` | sepasang tabel (`*_import`, `*_laporan`) per komoditi; kolom tambahan lama ditambahkan `db/zz_migrasi_kolom.sql` |
| Komponen | `frontend/components/sampel/lab/` | `Container`, `helper`, `Modal` dipakai semua komoditi |
| Konfigurasi | `frontend/components/sampel/lab/config.js` | perbedaan antar komoditi: prefix API, judul, label komoditi |
| Halaman | `frontend/pages/sampel/ot/index.js`, `sk/index.js`, `ob/index.js` | tipis, hanya `<Container jenis="…" />` |

**Menambah komoditi baru** (mis. Kosmetik): satu entri di `config.js`, satu
router tipis di backend, satu berkas `db/sampel_<kode>.sql`, satu halaman
`pages/sampel/<segmen>/index.js`, lalu tambahkan di `SEGMEN` proxy dan di
daftar `TABEL_SAMPEL` (`backend/routes/publik.js`) + cabang `v_kinerja.sql`.
Jangan menyalin folder komponen atau parser — itu jalan tercepat menuju
perbaikan yang hanya mendarat di satu tempat.

### Impor Sampel (berkas REKAP DATA SAMPEL)

Berkas Excel export SIPT (`sampel <tahun>.xlsx`, `suplemen kesehatan <tahun>.xlsx`,
`Obat <tahun>.xlsx`) memakai tata letak **REKAP DATA SAMPEL**: baris 1–8 identitas
berkas (unit, komoditi, periode sampling, anggaran, tujuan, asal), baris 9–10
header dua tingkat, data mulai baris 11.

**Kolom dipetakan dari JUDUL header, bukan indeks tetap.** Awalnya indeks kolom
dikunci (55 kolom, A..BC) — sampai berkas `Obat 2025.xlsx` datang dengan **59
kolom**: ada `Kriteria Resiko` dan `ATC`, dan kolom `Jenis Sarana` tidak ada,
sehingga seluruh kolom setelah `Kabupaten/Kota` bergeser satu. Dengan peta
indeks tetap, data masuk ke kolom yang salah **tanpa error apa pun** — kesalahan
yang paling sulit dilacak. Sekarang:

1. judul kolom (baris 10) dipetakan lewat kamus sinonim (`SINONIM_KOLOM`);
2. kolom tanpa judul ditentukan oleh **ISI kolomnya** (`PETUNJUK_NILAI`:
   nilai berawalan "Sarana Berizin …" = jenis sarana, "Targeted/Acak …" =
   tujuan sampling), baru kemudian oleh judul kelompoknya (baris 9);
3. medan yang tidak ditemukan dibiarkan **kosong**, tidak diisi dari indeks
   cadangan;
4. berkas yang judulnya tidak dikenali sama sekali (< 25 medan) jatuh ke peta
   indeks lama, dan impor menulis peringatan di log.

**Jangan memaku kolom tanpa judul di router kalau isinya berubah antar tahun.**
Berkas Obat membuktikannya: kolom ke-15 tanpa judul di bawah kelompok "Tujuan
Sampling" berisi `Sarana Berizin » Obat JKN` di **2025**, tetapi `Acak » NON JKN`
di **2024**. Saat kolom itu dipaku `jenis_sarana: 15`, impor 2024 gagal dengan
`Data too long for column 'jenis_sarana'` karena tujuan sampling 211 karakter
masuk ke kolom jenis sarana. `kolomPaku` masih ada untuk keperluan lain, tapi
bukan untuk kasus ini.

Sebelum mengimpor berkas tahun baru, jalankan pemeriksaan lebar kolom: nilai
terpanjang hasil parser dibandingkan dengan `information_schema.columns`
(`jenis_sarana` 255, `tujuan_sampling` 255, `pabrik` 400). Tanpa itu, kegagalan
baru muncul sebagai `Data too long for column` di tengah impor.

Berbeda dari modul sarana, **satu sampel bisa memakan beberapa baris**: kolom
`Kategori` (35) dan `Komposisi` (24) kadang berlanjut ke baris berikutnya yang
tidak mengulang nomor sampel. Penanda sampel baru adalah kolom `Sampel` (3) yang
terisi; baris lanjutan digabung ke sampel terakhir. Pada berkas contoh
**901 baris → 303 sampel** — jumlah yang disimpan adalah jumlah SAMPEL.

Kesimpulan akhir dibaca dari blok Pusat bila terisi, jika tidak dari blok UPT,
lalu disimpan sebagai `kesimpulan_akhir` + `sumber_kesimpulan`. Nilainya bisa
berupa singkatan `MS` / `TMS` — frontend menampilkan bentuk panjang
(`kesimpulanPenuh()` di `helper.js`).

Di view gabungan (`v_kinerja_sarana`) tiap komoditi punya cabangnya sendiri
(`sumber='SAMPEL_OT'` / `'SAMPEL_SK'` / `'SAMPEL_OB'`), `kegiatan='Sampling'`,
`jenis_sarana` = komoditi, dan kolom temuan selalu `NULL` karena berkas sampel tidak memuat
grading sarana. `jumlah_sampel_lab` diisi `1` per sampel supaya kolom "Total
Sampel Lab" di dashboard publik terhitung benar.

## Panel "Sebaran Jenis Sarana" = 2 kelompok, bukan daftar jenis

`sumber`/`jenis_sarana` di `v_kinerja_sarana` dipakai dua hal sekaligus:
jenis sarana sungguhan (PBF / Pangan IRT / Obat Tradisional) **dan** komoditi
sampel (Obat / Kosmetika / Suplemen). Panel ini karena itu dikelompokkan menurut
`kegiatan`: **Sarana Distribusi** (kegiatan `Distribusi`) dan **Sarana Produksi**
(`Produksi`); baris `Sampling` sengaja dibuang — satu sampel = satu produk, bukan
sarana, dan jumlahnya sudah tampil di panel "Hasil Pengujian Laboratorium" serta
"Kepatuhan per Kelompok Komoditas". Rincian jenis tiap kelompok ditaruh sebagai
keterangan kecil di bawah bar.

`/api/publik/kinerja/ringkasan` mengirim `per_jenis_sarana` beserta kolom
`kegiatan` (GROUP BY jenis_sarana, kegiatan) — tanpa kolom itu frontend tidak
bisa memisahkan keduanya.

Kolom tambahan **`produk_sampel`** hanya terisi untuk cabang sampel: **nama
produk saja** (mis. `AMITRIPTYLINE HYDROCHLORIDE`) — kode sampel sengaja tidak
diikutkan supaya kolom di modal rincian tidak melebar. PBF/OT/IRTP `NULL` karena
satu baris di sana memang satu sarana.
Modal rincian kab/kota memakai kolom ini untuk membedakan sampel yang berasal
dari **sarana & tanggal yang sama** — satu kunjungan bisa mengambil banyak produk
(mis. 6 obat di RS Bhayangkara, 02 November 2026), dan tanpa nama produk keenam
baris itu terbaca sebagai data ganda padahal bukan.

**Label unit dibaca dengan awalan, bukan pencocokan persis**: berkas OT menulis
`UNIT / BALAI BESAR / BALAI / LOKA POM`, berkas SK hanya sampai `.../LOKA`.
Mencocokkan persis membuat kolom "balai" kosong tanpa error.

**Kesimpulan dibakukan DUA arah** (`lib/sampel.js`):

- saat impor → `normalkanKesimpulan()` menyimpan bentuk panjang (`MS`/`MK` →
  `Memenuhi Syarat`); nilai `-` (hasil belum ada) disimpan `NULL`;
- saat dibaca → `MEMENUHI` / `TIDAK_MEMENUHI` di SQL tetap menerima singkatan
  lama (`MS`, `TMS`, `MK`, `TMK`) supaya baris yang sudah tersimpan tetap
  terhitung.

Singkatan berbeda antar komoditi: OT & SK memakai `MS`/`TMS`, **Obat memakai
`MK`/`TMK`** (Memenuhi / Tidak Memenuhi Kriteria). Tanpa penyamaan, hasilnya
salah: OT 2024 terbaca 281 dari 302, SK 2025 terbaca 55 dari 62.

Kolom hasil yang tidak masuk kategori memenuhi/tidak (mis. `Hasil Pengujian
Seperti Tersebut (HPST)`) ditampilkan apa adanya dan **tidak** dihitung sebagai
tidak memenuhi — di dashboard publik `tidak_memenuhi` dihitung eksplisit
(`KESIMPULAN_TIDAK_MEMENUHI`), bukan `COUNT(*) - memenuhi`.

## Dashboard publik `/jendela-kinerja`

Bagian **Hasil Pengujian Laboratorium** (`components/jendela-kinerja/SampelLab.js`)
menampilkan rekap modul Sampel: jumlah sampel diuji per tahun, sebaran
kepatuhan mutu per kelompok komoditas, dan per bentuk sediaan (12 terbanyak).

Dua hal yang perlu diketahui saat mengubah bagian ini:

1. Datanya dari tabel laporan modul sampel — dijahit dengan `UNION ALL` pada
   konstanta `TABEL_SAMPEL` (`backend/routes/publik.js`) — **bukan** view
   `v_kinerja_sarana`: di view itu satu sampel hanya jadi satu baris sarana tanpa
   nama produk, kode sampel, atau sediaan. **Tabel komoditi baru wajib
   ditambahkan di `TABEL_SAMPEL`**, kalau tidak sampelnya hilang dari rekap
   walaupun sudah masuk view.
2. **Tahun filter halaman ini milik modul sarana** (default = tahun sarana
   terbaru, mis. 2026), sedangkan modul sampel bisa berisi tahun lain (2024).
   Karena itu `muatSampel()` memakai tahun filter hanya kalau tahun itu punya
   sampel; kalau tidak — atau kalau filternya memang "Semua tahun" — ia
   mengambil seluruh tahun dan menandai `lintas_tahun` supaya label di kepala
   bagian berbunyi "Seluruh tahun tersedia", bukan mencomot tahun pertama
   sebagai judul.

**Hanya medan tanggal yang boleh menerjemahkan serial angka Excel.** `teks()`
di `lib/sampel.js` menerima bendera `sebagaiTanggal`; daftar medannya ada di
`MEDAN_TANGGAL`. Jangan kembali menebak dari rentang angka: harga Rp 40.000
(serial 40000) pernah tersimpan sebagai "06 Juli 2009" dan Rp 115.000 sebagai
"02 Mei 2018" — salah, tanpa error. Kalau daftar medan tanggal bertambah,
tambahkan juga di sana.

Kesimpulan di berkas sampel ditulis campuran (`MS`, `MK`, `Memenuhi Syarat`).
Normalisasinya dilakukan di SQL lewat `KESIMPULAN_MEMENUHI` /
`KESIMPULAN_TIDAK_MEMENUHI` (`routes/publik.js`) — **jangan** menghitung
`kesimpulan_akhir = 'Memenuhi Syarat'` langsung, hasilnya akan terpecah dan
persentase kepatuhan jadi salah. `tidak_memenuhi` juga dihitung eksplisit:
`COUNT(*) - memenuhi` ikut menghitung hasil yang belum berkategori (HPST,
belum ada kesimpulan) sebagai tidak memenuhi.

### Tabel kepatuhan

Dua tabel di dashboard (`Jumlah Sampel Diuji per Tahun` dan `Sebaran Kepatuhan
Mutu per Kelompok Komoditas`) memakai satu komponen bersama:
`components/jendela-kinerja/TabelKepatuhan.js`. Aturannya:

- Kolom angka rata kanan + `tnum`; lebarnya **dikunci** (`w-[110px]` dst) dengan
  `table-fixed`, karena kalau dibiarkan melar digit satu baris berjauhan di
  layar lebar.
- Baris **Jumlah** muncul hanya bila baris data lebih dari satu — kalau cuma
  satu baris, baris jumlah hanya mengulang angka yang sama.
- Persentase memakai satu desimal bila tidak bulat (302/303 → 99,7%), dan
  dibulatkan dari angka total di baris jumlah.

Gaya sel kepala tabel ada di kelas `.th` (`styles/globals.css`). Kelas ini
sebelumnya **tidak pernah didefinisikan** padahal sudah dipakai sebagai
`className="th"`, sehingga header tampil polos tanpa padding — sekarang
didefinisikan dan setara dengan header tabel kab/kota di `Container.js`.

## Struktur Folder

Halaman **tanpa login** (di luar `DashboardLayout`) untuk menampilkan pengawasan
sarana produksi & distribusi: peta choropleth Kalimantan Tengah per kabupaten/kota
+ filter tahun, bulan, produksi/distribusi, jenis sarana, dan kabupaten/kota,
ditambah bagian hasil pengujian laboratorium (lihat penjelasan di atas).

| Endpoint publik | Keterangan |
| --- | --- |
| `GET /api/publik/kinerja/pilihan` | daftar pilihan filter + jumlah (`tahun`, `bulan`, `kegiatan`, `jenis_sarana`, `kab_kota`) |
| `GET /api/publik/kinerja/ringkasan?tahun=&bulan=&kegiatan=&jenis=&kab=` | KPI + `per_kab_kota` (peta + tabel per kab/kota) + `per_bulan` + `per_jenis_sarana` |
| `GET /api/publik/kinerja/sarana?...` | daftar sarana (pagination) — dipakai modal "Rincian" per kab/kota. **Wajib login**: proxy meneruskan Bearer token, backend menolak (401) tanpa pengguna sah |

Sumber data publik adalah view `backend/db/v_kinerja.sql` (`v_kinerja_sarana`)
yang menjahit `pbf_laporan` + `ot_laporan` dengan kolom seragam (`sumber`
`PBF`/`OT`, `sumber_label`, `kegiatan` `Distribusi`/`Produksi`,
`kesimpulan_akhir`). Endpoint menerima filter tambahan `?sumber=PBF|OT`.
Nama berkas diawali `v_` supaya `apply-schema.js` (urut alfabetis) menjalankannya
paling akhir — view ini bergantung pada kolom hasil migrasi lain.

- **Tabel "Data Kinerja Pengawasan Per Kabupaten/Kota"** di bawah peta memakai
  `per_kab_kota` dari endpoint `ringkasan`:
  | Kolom | Sumber |
  | --- | --- |
  | Sarana Produksi (MK / TMK) | `produksi_mk` / `produksi_tmk` (view `v_kinerja_sarana` sumber `OT`) |
  | Sarana Distribusi (MK/TMK) | `distribusi_mk` / `distribusi_tmk` (sumber `PBF`) |
  | Total Sampel Lab | `sampel_lab` = `SUM(pbf_laporan.jumlah_sampel_lab)` |
  | Indeks Kepatuhan | `MK ÷ (MK + TMK) × 100` (dihitung di frontend `helper.js`) |
  | Aksi | tombol **Rincian** → modal daftar sarana kab/kota itu (`/kinerja/sarana?kab=`); untuk tamu tombolnya mengarah ke `/login` (rincian hanya untuk pengguna yang login) |

  MK = *Memenuhi Ketentuan*, TMK = *Tidak Memenuhi Ketentuan*. Karena
  `'Tidak Memenuhi Ketentuan'` **juga** mengandung kata "Memenuhi", MK dihitung
  dengan `LIKE '%Memenuhi%' AND NOT LIKE '%Tidak%'`.
- Kolom `pbf_laporan.jumlah_sampel_lab` (migrasi `backend/db/pbf_sampel_lab.sql`)
  diisi impor **hanya bila** baris header berkas punya kolom memuat kata "sampel";
  kalau tidak ada, nilainya NULL dan tampil 0. Berkas yang dipakai sekarang belum
  punya kolom itu.

- **Read-only dan agregat saja** — tidak ada temuan/observasi/nama petugas yang keluar.
  Peta/tabel rekap terbuka untuk tamu; **rincian sarana per baris hanya untuk
  pengguna yang login** (`/kinerja/sarana` menolak tanpa sesi). Temuan tetap di
  dashboard internal.
- Frontend memakai proxy `frontend/pages/api/publik/[...path].js` (hanya GET), jadi
  browser tidak perlu tahu alamat backend.
- Path `/jendela-kinerja` dan `/api/publik` didaftarkan di `publicPaths`
  (`frontend/middleware.js`).
- Peta: `frontend/data/kalteng-kabupaten.json` — 14 kabupaten/kota, path SVG hasil
  penyederhanaan Douglas-Peucker + proyeksi Web Mercator (tanpa library peta).
- **Wilayah kerja UPT**: `WILAYAH_UPT` di `components/jendela-kinerja/helper.js`.
  Anggota satu wilayah kerja diwarnai **satu warna tetap abu-abu**
  (`rgba(148,163,184,0.55)` + garis `rgba(100,116,139,0.95)`), bukan skala
  jumlah sarana — sekarang Loka POM Kotawaringin Barat (Kotawaringin Barat,
  Seruyan, Lamandau, Sukamara). Abu-abu dipilih supaya tidak tertukar dengan
  skala choropleth hijau→biru yang menyatakan jumlah sarana. Nama kabupaten di situ harus sama persis dengan
  `data/kalteng-kabupaten.json`; kalau tidak, wilayahnya tidak ikut terwarnai.
  Mengklik satu anggota menyorot seluruh kelompoknya.
- Kolom turunan `kegiatan`, `jenis_sarana`, `bulan` di `pbf_laporan` mengisi filter
  (migrasi `backend/db/pbf_kinerja.sql`, backfill `backend/scripts/backfill-kinerja.js`).

## Catatan penting: middleware & hidrasi dev

`frontend/middleware.js` **wajib mengecualikan `_next/webpack-hmr`** (lihat `config.matcher`).
Jika middleware ikut menangani kanal HMR, runtime dev Next tidak pernah menyelesaikan
pendaftaran entrypoint halaman: HTML hasil SSR tetap tampil, tetapi React **tidak pernah
terhidrasi** — semua dropdown, tombol, dan `fetch` sisi klien mati **tanpa pesan galat**.
Gejala ini hanya muncul di mode dev; mode produksi (`next build && next start`) normal.

## Data per tahun (Distribusi PBF)

Modul Distribusi PBF menyimpan data **terpisah per tahun**, jadi impor 2024, 2025,
dan 2026 bisa berdampingan:

- Setiap unggahan mengganti **hanya tahun yang dipilih/di deteksi** — tahun lain
  tidak tersentuh. Di dalam tahun yang sama tetap "ganti total" (tanpa riwayat versi).
- Tahun ditentukan dari field `tahun` pada form unggah; bila dibiarkan
  "Otomatis", backend membacanya dari periode pemeriksaan di berkas
  (fallback: tanggal entri → tanggal periksa baris data).
- Penggantian berjalan dalam satu transaksi: berkas gagal baca tidak pernah
  menghapus data lama.
- Kolom `tahun` ada di `pbf_import` dan `pbf_laporan`
  (migrasi idempoten: `backend/db/pbf_tahun.sql`).
- UI: filter tahun (chip) menyaring statistik, daftar laporan, dan tombol hapus;
  tombol hapus memakai konfirmasi dua langkah di dalam UI (tanpa `window.confirm`).

