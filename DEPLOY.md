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
│  pengujian-frontend │              │  pengujian-backend       │
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
| `KEYCLOAK_CLIENT_SECRET`    | Keycloak → Clients → `pengujian` → Credentials              |
| `KEYCLOAK_ADMIN_PASSWORD`   | password user admin Keycloak                                |
| `NEXTAUTH_SECRET`           | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SESSION_SECRET`            | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

Selama masih kosong, `docker compose` **menolak jalan** dan memberi pesan
`DB_PASSWORD wajib diisi - salin .env.example ke .env`.

> `SESSION_SECRET` dipakai backend untuk menyegel token di tabel `api_link`.
> Kalau nilainya berubah setelah ada link dibuat, link lama tidak bisa dibuka
> lagi — tetapi link baru tetap bisa dibuat.

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
nano .env            # isi DB_PASSWORD, KEYCLOAK_*_SECRET, NEXTAUTH_SECRET, SESSION_SECRET

# 3. Jalankan
docker compose up -d --build
docker compose ps          # tunggu kedua layanan "healthy"
docker compose logs -f backend
```

> **Image berisi kode.** Tidak ada lagi mount folder `./backend` atau `./frontend`
> ke dalam container. Setelah mengubah kode, wajib `docker compose up -d --build`
> (atau `docker compose build backend` lalu `up -d`).

Kalau `.env` berubah (khususnya `API_URL`) frontend harus di-build ulang karena
nilai `NEXT_PUBLIC_*` ditanam saat build:

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
> lalu set `DB_HOST=host.docker.internal` **dan** `BACKEND_HOST=0.0.0.0` di `.env`
> (tanpa `BACKEND_HOST=0.0.0.0`, backend hanya mendengar di loopback container dan
> port mapping tidak bisa dijangkau). Buka juga `bind-address` MySQL ke `0.0.0.0`
> (serta `GRANT` untuk user `@'%'`).

### Masalah umum

| Gejala                                        | Penyebab & solusi                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `docker compose up` gagal: `... wajib diisi - salin .env.example ke .env` | Ada nilai kosong di `.env`. Isi dulu.                    |
| `docker compose config` error `SESSION_SECRET wajib diisi` | Tambahkan `SESSION_SECRET` di `.env` (belum ada di `.env` lama). |
| Backend `ECONNREFUSED` ke MySQL               | `DB_HOST` salah. MySQL di server yang sama → `127.0.0.1`; di komputer lain → IP komputer itu. |
| `Access denied for user ...`                  | `DB_USER` / `DB_PASSWORD` di `.env` tidak cocok dengan yang ada di MySQL.              |
| Docker menolak `network_mode` + `ports`       | Keduanya tidak boleh digabung. Backend = host (tanpa `ports`), frontend = bridge + `ports`. |
| Domain web error 502 / blank                  | Reverse proxy belum meneruskan ke `127.0.0.1:3007` (lihat bagian Reverse proxy). Frontend sekarang dijalankan `next start -H 0.0.0.0` di dalam container; jangan diganti `npm start` (script itu mengikat `127.0.0.1` dan membuat port mapping tidak bisa diakses). |
| Domain API error 502                          | Reverse proxy belum meneruskan ke `localhost:5006`.                                     |
| Browser gagal memanggil API                   | `API_URL` salah. Set `https://data-lets.bbpompky.id/api`, lalu **build ulang** frontend (nilainya ditanam saat build). |
| Login muter-muter / `redirect_uri` mismatch   | Tambahkan `https://lets-digital.bbpompky.id/api/auth/callback/keycloak` ke *Valid redirect URIs* di Keycloak. |
| NextAuth `UntrustedHost` / cookie gagal       | Pastikan `WEB_URL` sama persis dengan alamat yang dibuka di browser (termasuk `https://`). |

---

## 5. Konfigurasi Keycloak (sekali saja)

Client ID yang dipakai: **`pengujian`**.

Di Keycloak → Clients → `pengujian`:

- **Valid redirect URIs**
  - `https://lets-digital.bbpompky.id/api/auth/callback/keycloak`
  - `http://localhost:3007/api/auth/callback/keycloak` (untuk dev lokal)
- **Web origins**
  - `https://lets-digital.bbpompky.id`
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
| Keycloak client secret           | Keycloak → Clients → `pengujian` → Credentials → Regenerate |
| Password admin Keycloak          | Keycloak → Users → admin → Credentials        |
| `NEXTAUTH_SECRET`                | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SESSION_SECRET`                 | sama seperti di atas                          |

### 9.4 Audit ulang sebelum push berikutnya

```bash
# File rahasia tidak boleh ter-track
git ls-files | grep -E '(^|/)\.env($|\.)'          # hanya *.env.example yang boleh muncul

# Tidak ada nilai asli di template / kode
git grep -n -I -E '(PASSWORD|SECRET|TOKEN)=[^I ]'
```

Semua hasil harus berupa placeholder (`ISI_...`) atau referensi `${VAR}`.
