# Panduan Deploy & Push ke GitHub

Dokumen ini menjelaskan cara (1) push repo ini ke GitHub tanpa membocorkan
kredensial, dan (2) menjalankan produksi dengan Docker di server
**192.168.15.4**.

---

## 1. Ringkasan arsitektur

```
                    Internet / LAN
                          │
              ┌───────────┴────────────┐
              │  reverse proxy (nginx) │   di server 192.168.15.4
              └───────────┬────────────┘
                          │
   ┌──────────────────────┴──────────────────────┐
   │                                             │
   ▼                                             ▼
lets-digital.bbpompky.id              data-lets.bbpompky.id
   │ :3007                                       │ :5006
┌──┴──────────────────┐              ┌──────────┴───────────────┐
│  jendela-frontend   │              │  jendela-backend         │
│  (bridge, ports)    │              │  network_mode: "host"    │
└─────────────────────┘              └──────────┬───────────────┘
                                                │
                                     MySQL 127.0.0.1 (di server ini,
                                     di luar Docker, tidak perlu
                                     dibuka ke jaringan)
```

| Layanan  | Alamat publik                          | Port internal         | Mode network        |
| -------- | -------------------------------------- | --------------------- | ------------------- |
| frontend | `https://lets-digital.bbpompky.id`     | `3007` (mapping)      | bridge + `ports:`   |
| backend  | `https://data-lets.bbpompky.id/api`    | `5006` (langsung)     | `host`              |
| MySQL    | tidak dipublikasikan                   | `3306` (loopback)     | di luar Docker      |

> ⚠️ `network_mode: "host"` **hanya bekerja bila host Docker-nya Linux**.
> Itulah pilihan untuk server 192.168.15.4.

---

## 2. Aturan kredensial

Kredensial **TIDAK PERNAH** ditulis di dalam kode atau `docker-compose.yml`.
Semuanya berasal dari file `.env` yang tidak ikut ter-commit.

| File lokal (tidak di-commit)  | Berisi                        | Template yang di-commit    |
| ----------------------------- | ----------------------------- | -------------------------- |
| `.env`                        | dipakai `docker compose`      | `.env.example`             |
| `backend/.env`                | DB, Keycloak, JWT, CORS (dev) | `backend/.env.example`     |
| `frontend/.env`               | NextAuth, Keycloak, API (dev) | `frontend/.env.example`    |

Kalau file `.env` hilang, buat ulang dari template:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

**Di `.env` produksi**, bagian yang nilainya kosong dan harus Anda isi sendiri:

| Variabel                    | Cara mendapatkan                                            |
| --------------------------- | ----------------------------------------------------------- |
| `DB_PASSWORD`               | password user MySQL                                         |
| `KEYCLOAK_CLIENT_SECRET`    | Keycloak → Clients → `<client>` → Credentials               |
| `KEYCLOAK_ADMIN_PASSWORD`   | password user admin Keycloak                                |
| `NEXTAUTH_SECRET`           | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

Compose memakai nama variabel yang **sama persis** dengan `.env.example`
(`PORT_BACKEND`, `PORT_FRONTEND`, `CORS_ORIGIN`, `DB_*`, `KEYCLOAK_*`,
`NEXT_PUBLIC_API_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `laura_API_URL`,
`CHROME_PATH`). Tidak ada lagi `${VAR:-nilai}` maupun `${VAR:?pesan}` — nilai
yang tidak ada di `.env` menjadi **string kosong** tanpa peringatan, jadi
pastikan semua kunci dari `.env.example` ada.

> **`SESSION_SECRET` tidak perlu diisi.** `docker-compose.yml` meneruskan
> `NEXTAUTH_SECRET` sebagai `SESSION_SECRET` ke backend (dipakai menyegel token
> di tabel `api_link`). Kalau `NEXTAUTH_SECRET` diganti, link lama tidak bisa
> dibuka lagi — link baru tetap bisa dibuat.

> **`BACKEND_API_URL` diatur otomatis oleh compose** menjadi
> `http://host.docker.internal:${PORT_BACKEND}/api` (proxy `pages/api/**`
> memanggil backend lewat jalur internal). Jadi halaman tidak lagi bergantung
> pada domain API publik; hostname API hanya dipakai browser (`NEXT_PUBLIC_API_URL`).
> Supaya bisa dijangkau container frontend, backend dijalankan dengan
> `HOST=0.0.0.0` (bukan `127.0.0.1`). Kalau ingin backend tetap loopback,
> jalankan frontend dengan `network_mode: "host"` dan ganti `BACKEND_API_URL`
> ke `http://127.0.0.1:${PORT_BACKEND}/api`.

---

## 3. Push ke GitHub (aman)

Repo sudah di-`git init` dan semua kredensial sudah dikeluarkan dari staging.
Sebelum push, **selalu** jalankan pemeriksaan berikut:

```powershell
# 1. Pastikan file rahasia TIDAK ikut ter-stage
git status --short
git ls-files | Select-String -Pattern '\.env$|\.env\.|secrets\.h$'

# 2. Pastikan nilai rahasia tidak muncul di isi file yang di-commit
git grep -n -I -E 'CLIENT_SECRET|ADMIN_PASSWORD|NEXTAUTH_SECRET|DB_PASSWORD'
```

Cara push:

```powershell
# Ganti <akun> dan <repo> sesuai milik Anda
git remote add origin https://github.com/<akun>/<repo>.git
git push -u origin main
```

Kalau repo GitHub sudah ada dan sudah punya commit awal:

```powershell
git remote add origin https://github.com/<akun>/<repo>.git
git fetch origin
git reset --soft origin/main      # jadikan commit GitHub sebagai dasar
git commit -m "Deploy Docker: backend 5006, frontend 3007"
git push -u origin main
```

> **Kalau repo di GitHub ternyata publik** — jangan pernah mengandalkan
> `.gitignore` saja untuk data sensitif; audit dulu dengan perintah di atas.

---

## 4. Menjalankan di server produksi

Di server 192.168.15.4:

```bash
# 1. Clone
git clone https://github.com/<akun>/<repo>.git
cd <repo>

# 2. Siapkan konfigurasi (TIDAK dari git)
cp .env.example .env
nano .env            # isi DB_PASSWORD, KEYCLOAK_CLIENT_SECRET, KEYCLOAK_ADMIN_PASSWORD, NEXTAUTH_SECRET

# 3. Jalankan
docker compose up -d --build
docker compose ps          # tunggu kedua layanan "healthy"
docker compose logs -f backend
```

> **Image berisi kode.** Tidak ada lagi mount folder `./backend` atau `./frontend`
> ke dalam container. Setelah mengubah kode, wajib `docker compose up -d --build`
> (atau `docker compose build backend` lalu `up -d`).

Kalau `.env` berubah (khususnya `NEXT_PUBLIC_API_URL`) frontend harus di-build
ulang karena nilai `NEXT_PUBLIC_*` ditanam saat build:

```bash
docker compose build --no-cache frontend
docker compose up -d
```

### Cek kesehatan

Dari server (lewat loopback / port internal):

```bash
curl -s http://127.0.0.1:5006/api/health
curl -sI http://127.0.0.1:3007
```

Dari browser / luar:

```
https://data-lets.bbpompky.id/api/health
https://lets-digital.bbpompky.id
```

### Cek koneksi database dari dalam container

Paling cepat untuk memastikan `DB_HOST` / `DB_PASSWORD` benar — jalankan dari folder
repo di server:

```bash
docker compose exec backend node -e "require('./db').pool.query('SELECT 1 AS ok').then(([r]) => { console.log('DB OK', r); process.exit(0); }).catch(e => { console.error('DB GAGAL:', e.message); process.exit(1); })"
```

### Kenapa `DB_HOST=127.0.0.1` tetap benar?

Backend memakai `network_mode: "host"`, artinya container **tidak punya network
sendiri** — dia menumpang network stack server. Jadi `127.0.0.1` di dalam container
= `127.0.0.1` di server.

Untungnya ini justru menguntungkan: MySQL **tidak perlu dibuka ke jaringan sama
sekali**. `bind-address` boleh tetap `127.0.0.1`, dan user MySQL `@'localhost'` tetap
bisa dipakai — tidak perlu `GRANT` ke `@'%'` dan tidak perlu mengubah `my.cnf`.

Kalau MySQL Anda ada di **komputer lain**, cukup ganti `DB_HOST` di `.env` dengan IP
komputer itu, lalu sesuaikan `GRANT`-nya.

> ⚠️ **Kalau suatu saat dipindah ke Docker Desktop Windows**, `network_mode: "host"`
> tidak berfungsi. Ubah backend menjadi:
> ```yaml
> # hapus: network_mode: "host"
> ports:
>   - "5006:5006"
> ```
> lalu set `DB_HOST=host.docker.internal`. Backend harus mendengar di semua
> antarmuka (`HOST: 0.0.0.0` sudah diset di compose) supaya port mapping bisa
> dijangkau. Buka juga `bind-address` MySQL ke `0.0.0.0` (serta `GRANT` untuk
> user `@'%'`).

### Masalah umum

| Gejala                                        | Penyebab & solusi                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Halaman: **"Gagal memuat ringkasan"** / JSON `BALASAN_KOSONG` | Proxy Next tidak mendapat balasan JSON dari backend internal. Cek `docker compose ps` (backend **healthy**?) dan `docker compose logs --tail=80 backend`. Alamat yang dipakai proxy tercantum di pesan galat (`BACKEND_API_URL`). |
| Browser: `Failed to execute 'json' on 'Response': Unexpected end of JSON input` | Dulu: proxy meneruskan body **kosong** dari backend. Sekarang proxy membalas JSON `BALASAN_KOSONG` berisi URL tujuan, jadi pesan ini hanya muncul bila ada respons kosong dari jalur lain (mis. reverse proxy). |
| Backend `ECONNREFUSED` ke MySQL               | `DB_HOST` salah. MySQL di server yang sama → `127.0.0.1`; di komputer lain → IP komputer itu. |
| `Access denied for user ...`                  | `DB_USER` / `DB_PASSWORD` di `.env` tidak cocok dengan yang ada di MySQL.              |
| Docker menolak `network_mode` + `ports`       | Keduanya tidak boleh digabung. Backend = host (tanpa `ports`), frontend = bridge + `ports`. |
| Domain web error 502 / blank                  | Reverse proxy belum meneruskan ke `127.0.0.1:3007` (lihat bagian Reverse proxy). Frontend sekarang dijalankan `next start -H 0.0.0.0` di dalam container; jangan diganti `npm start` (script itu mengikat `127.0.0.1` dan membuat port mapping tidak bisa diakses). |
| `/api/publik/*` 502 padahal halaman lain normal | Pastikan container backend hidup dan `HOST: 0.0.0.0` (compose). Proxy memanggil `http://host.docker.internal:PORT_BACKEND/api`; bila `extra_hosts` tidak ada (container lama), `docker compose up -d` ulang. |
| Domain API error 502                          | Reverse proxy belum meneruskan ke `localhost:5006`. Bila API publik memang tidak dipakai, biarkan — proxy frontend memakai jalur internal. |
| Browser gagal memanggil API                   | `NEXT_PUBLIC_API_URL` salah. Perbaiki di `.env`, lalu **build ulang** frontend (nilainya ditanam saat build). |
| Login muter-muter / `redirect_uri` mismatch   | Tambahkan `https://jendela-kinerja.bbpompky.id/api/auth/callback/keycloak` ke *Valid redirect URIs* di Keycloak. |
| NextAuth `UntrustedHost` / cookie gagal       | Pastikan `NEXTAUTH_URL` sama persis dengan alamat yang dibuka di browser (termasuk `https://`). |

---

## 5. Konfigurasi Keycloak (sekali saja)

Client ID yang dipakai: **`jendela`** (dari `KEYCLOAK_CLIENT_ID` di `.env`).

Di Keycloak → Clients → `jendela`:

- **Valid redirect URIs**
  - `https://jendela-kinerja.bbpompky.id/api/auth/callback/keycloak`
  - `http://localhost:3007/api/auth/callback/keycloak` (untuk dev lokal)
- **Web origins**
  - `https://jendela-kinerja.bbpompky.id`
  - `http://localhost:3007`
- **Capability config**
  - Standard flow: **ON** (dipakai NextAuth)
  - Direct access grants: **ON** (dipakai `POST /api/login` di backend)

Kalau `KEYCLOAK_CLIENT_ID` diubah, nilai untuk browser ikut berubah saat build
frontend, jadi frontend harus di-build ulang (`--no-cache`).

---

## 6. Reverse proxy (domain)

Docker hanya menyediakan port di server (`3007` dan `5006`). Supaya domain
`lets-digital.bbpompky.id` dan `data-lets.bbpompky.id` mengarah ke sana, reverse
proxy di server harus meneruskan seperti ini:

| Domain                            | Path   | Diteruskan ke              |
| --------------------------------- | ------ | -------------------------- |
| `lets-digital.bbpompky.id`        | `/`    | `http://127.0.0.1:3007`    |
| `data-lets.bbpompky.id`           | `/api` | `http://127.0.0.1:5006/api`|

Contoh blok nginx:

```nginx
server {
    listen 443 ssl;
    server_name lets-digital.bbpompky.id;
    # ssl_certificate ...;

    location / {
        proxy_pass http://127.0.0.1:3007;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name data-lets.bbpompky.id;
    # ssl_certificate ...;

    location /api/ {
        proxy_pass http://127.0.0.1:5006/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> `proxy_set_header Host $host` penting untuk NextAuth — tanpa itu Next.js bisa
> menolak host dan login gagal.

---

## 7. Firewall server

```bash
# Linux (ufw)
sudo ufw allow 5006/tcp     # backend (dipakai reverse proxy / akses LAN)
sudo ufw allow 443/tcp      # HTTPS reverse proxy
sudo ufw allow 80/tcp       # redirect HTTP -> HTTPS
```

Port `3007` **tidak perlu** dibuka ke LAN — hanya reverse proxy di server yang
mengaksesnya lewat loopback. Port MySQL `3306` juga tidak perlu dibuka.

---

## 8. Modul pemantauan suhu — dihapus

Sketch NodeMCU/SHT31, route `/api/sensor/*`, dan tabel `dht_log` sudah tidak dipakai
aplikasi ini (modulnya dihapus). Kalau alatnya masih terpasang di lapangan, perangkat
cukup dimatikan atau diarahkan ke aplikasi lain — server tidak lagi menerima data suhu,
sehingga kiriman dari perangkat akan dibalas `404`.

> Sisa tabel `dht_log` di database lama (`pengujian`) dibiarkan apa adanya sebagai arsip.
> Tidak ada skrip aplikasi yang membacanya.

---

## 9. KEAMANAN — kredensial yang bocor (WAJIB dibaca sebelum deploy)

Audit `git` menemukan **satu kredensial asli yang ter-commit**:

| Nilai                        | Lokasi                          | Status |
| ---------------------------- | ------------------------------- | ------ |
| Password MySQL user `jendela_app` | `backend/.env.example` baris 32 | **BOCOK** — sudah ter-push ke GitHub |

Temuan detail:

- Masuk lewat commit `ddced5f` ("perbaikan bug version") dan masih ada di semua
  commit sesudahnya, termasuk `main`.
- Repo `rolinkstone/jendelakinerja` **publik**, sehingga berkas itu bisa dibaca
  siapa pun lewat `https://raw.githubusercontent.com/.../backend/.env.example`.
- Sejak commit ini, file `backend/.env.example` sudah dikembalikan ke placeholder
  (`DB_PASSWORD=ISI_PASSWORD_MYSQL`), tetapi **commit lama tetap menyimpan nilai
  aslinya**.

### 9.1 Tindakan wajib (lakukan berurutan)

1. **Ganti password MySQL sekarang** (anggap password lama sudah diketahui publik):

   ```sql
   -- di server MySQL
   ALTER USER 'jendela_app'@'localhost' IDENTIFIED BY 'PASSWORD-BARU-YANG-KUAT';
   FLUSH PRIVILEGES;
   ```

2. Perbarui `DB_PASSWORD` di `.env` server dengan password baru itu.

3. Ganti juga bila password lama pernah dipakai di tempat lain (Keycloak admin,
   SSH, dsb.) — orang bisa mencoba memakainya ulang.

4. Kalau server MySQL sempat terbuka ke jaringan saat password itu masih berlaku,
   periksa log akses:

   ```bash
   sudo grep -i 'jendela_app' /var/log/mysql/error.log | tail -50
   ```

### 9.2 Membersihkan jejak di git (opsional, tapi disarankan)

Rotation di atas sudah menutup risikonya. Kalau ingin nilainya hilang dari
riwayat GitHub juga, tulis ulang history dengan `git filter-repo`:

```bash
pip install git-filter-repo

# 1. Backup dulu
git clone --mirror https://github.com/rolinkstone/jendelakinerja.git jk-backup.git

# 2. Ganti nilai rahasia di SELURUH riwayat
#    (ambil nilai aslinya dari commit lama, JANGAN ditulis di file ini)
cd jendela-kinerja
printf '%s==>ISI_PASSWORD_MYSQL\n' 'PASSWORD-LAMA' > /tmp/ganti.txt
git filter-repo --replace-text /tmp/ganti.txt

# 3. Push paksa
git remote add origin https://github.com/rolinkstone/jendelakinerja.git
git push --force --all
git push --force --tags
```

> Force-push menulis ulang `main`. Setelah itu, commit lama masih bisa muncul di
> cache GitHub (mis. lewat URL commit langsung) sampai GitHub membersihkan cache-
> nya. Ini alasan rotation password tetap langkah nomor satu.
>
> Kontributor lain harus `git clone` ulang; `git pull` biasa akan bentrok.

### 9.3 Kredensial yang belum pernah bocor

Nilai berikut **tidak pernah** masuk ke git (hanya ada di `.env` lokal yang
di-ignore). Tetap sebaiknya diganti bila folder proyek pernah disalin ke tempat
lain:

| Kredensial                       | Cara ganti                                   |
| -------------------------------- | -------------------------------------------- |
| Keycloak client secret           | Keycloak → Clients → `jendela` → Credentials → Regenerate |
| Password admin Keycloak          | Keycloak → Users → admin → Credentials        |
| `NEXTAUTH_SECRET`                | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (juga dipakai backend sebagai `SESSION_SECRET`) |

### 9.4 Audit ulang sebelum push berikutnya

```bash
# File rahasia tidak boleh ter-track
git ls-files | grep -E '(^|/)\.env($|\.)'          # hanya *.env.example yang boleh muncul

# Tidak ada nilai asli di template / kode
git grep -n -I -E '(PASSWORD|SECRET|TOKEN)=[^I ]'
```

Semua hasil harus berupa placeholder (`ISI_...`) atau referensi `${VAR}`.
