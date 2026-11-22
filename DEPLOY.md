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

Selama masih kosong, `docker compose` **menolak jalan** dan memberi pesan
`DB_PASSWORD wajib diisi - salin .env.example ke .env`.

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
nano .env            # isi DB_PASSWORD, KEYCLOAK_*_SECRET, NEXTAUTH_SECRET

# 3. Jalankan
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

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
> lalu set `DB_HOST=host.docker.internal` di `.env` dan buka `bind-address` MySQL
> ke `0.0.0.0` (serta `GRANT` untuk user `@'%'`).

### Masalah umum

| Gejala                                        | Penyebab & solusi                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `docker compose up` gagal: `... wajib diisi - salin .env.example ke .env` | Ada nilai kosong di `.env`. Isi dulu.                    |
| Backend `ECONNREFUSED` ke MySQL               | `DB_HOST` salah. MySQL di server yang sama → `127.0.0.1`; di komputer lain → IP komputer itu. |
| `Access denied for user ...`                  | `DB_USER` / `DB_PASSWORD` di `.env` tidak cocok dengan yang ada di MySQL.              |
| Docker menolak `network_mode` + `ports`       | Keduanya tidak boleh digabung. Backend = host (tanpa `ports`), frontend = bridge + `ports`. |
| Domain web error 502 / blank                  | Reverse proxy belum meneruskan ke `localhost:3007` (lihat bagian Reverse proxy).        |
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

Kalau `KEYCLOAK_CLIENT_ID` diubah, variabel itu **ditanam saat build** ke browser
(`NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`) → frontend harus di-build ulang.

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

## 9. Rotasi kredensial (disarankan)

Kredensial berikut sebelumnya tersimpan sebagai teks biasa di file lokal
(`docker-compose.yml` lama, `.env`, dan sketch Arduino). Repo ini **belum pernah
di-push**, jadi belum ada kebocoran ke GitHub — tetapi kalau folder ini pernah
disalin ke tempat lain, sebaiknya diganti:

| Kredensial                       | Cara ganti                                   |
| -------------------------------- | -------------------------------------------- |
| Keycloak client secret           | Keycloak → Clients → `pengujian` → Credentials → Regenerate |
| Password admin Keycloak          | Keycloak → Users → admin → Credentials        |
| `NEXTAUTH_SECRET`                | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| Password MySQL                   | `ALTER USER ... IDENTIFIED BY 'baru';`        |
