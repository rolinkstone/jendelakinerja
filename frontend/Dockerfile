FROM node:24.22.1-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat wget

# Copy package files
COPY package.json package-lock.json ./

# Clean npm cache dan install dependencies
RUN npm cache clean --force && \
    npm ci --no-audit --legacy-peer-deps

# Copy source code
COPY . .

# Env variabel untuk build — Next.js me-bake NEXT_PUBLIC_* saat build,
# jadi harus diisi dari build args (bukan runtime). Nilai dari compose build.args.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_LAURA_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_LAURA_URL=$NEXT_PUBLIC_LAURA_URL

# Build aplikasi Next.js
RUN npm run build

# Port aplikasi
ENV PORT=3007
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

EXPOSE 3007

# Start aplikasi.
# JANGAN pakai "npm start": script di package.json mengikat -H 127.0.0.1,
# sehingga server hanya mendengar di loopback container dan port mapping
# "3007:3007" tidak bisa dijangkau (domain jadi 502).
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3007"]