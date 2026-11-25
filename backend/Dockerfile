# ============================================================
#  BACKEND — image produksi
#  Kredensial TIDAK dimasukkan ke image.
#  Semuanya di-inject saat runtime lewat docker-compose (.env).
# ============================================================
FROM node:24.22.1-alpine

WORKDIR /usr/src/app

# Dependency dulu (layer cache).
# vendor/ wajib disalin SEBELUM npm install karena package.json memakai
# "xlsx": "file:vendor/xlsx-0.20.3.tgz" — tanpa tarball itu install gagal.
COPY package*.json ./
COPY vendor ./vendor
RUN npm install --omit=dev && npm cache clean --force

# Baru salin source (file .env* sudah dikecualikan oleh .dockerignore)
COPY . .

# Folder data yang di-mount oleh compose
RUN mkdir -p /data/uploads /data/logs

ENV NODE_ENV=production
ENV PORT=5006

EXPOSE 5006

CMD ["node", "server.js"]
