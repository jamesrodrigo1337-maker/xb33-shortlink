# DEPLOY — XB33 SHORTLINK ke domain lu

## ⚠️ Baca dulu: kenapa BUKAN surge buat backend

`surge.sh` = **static hosting doang** (cuma HTML/CSS/JS). Shortlink lu butuh
**Node.js runtime** (redirect 302, rate-limit, PoW, analytics). Surge **gak bisa**
jalanin itu.

Jadi arsitektur yang bener:

```
                       ┌─────────────────────────────┐
  user ──► domain ───► │ BACKEND (Node) di PaaS      │  ← server.js jalan di sini
                       │ Railway / Render / Fly      │     (pilih salah satu)
                       └─────────────────────────────┘
```

Surge **opsional** — cuma kalau lu mau landing page terpisah. Backend-nya sendiri
harus di host Node. Panduan di bawah fokus ke backend.

---

## Kenapa gak semua host cocok

Storage shortlink lu **file JSON** (`data/links.json`). Ini butuh **disk persisten**:

| Host | Disk persisten? | Cocok? |
|------|----------------|--------|
| **Railway** | ✅ ada volume (berbayar tp dpt kredit gratis) | ⭐ paling cocok |
| **Fly.io** | ✅ ada volume, gratis tier terbatas | ⭐ cocok |
| **Render (free)** | ❌ ephemeral, reset tiap redeploy | ⚠️ data bisa hilang |
| **Vercel** | ❌ serverless, FS read-only | ❌ gak cocok |
| **VPS + Docker** | ✅ paling bebas | ⭐ kalau lu punya VPS |

**Kalau gak mau pusing soal data hilang → Railway atau VPS + Docker.**

---

## PATH A — Railway (recommended, config udah ada)

```bash
cd shortlink

# 1. install CLI Railway (sekali doang)
npm i -g @railway/cli

# 2. login (buka browser)
railway login

# 3. bikin project + link
railway init

# 4. PASANG VARIABLE PENTING (sekali doang)
railway variables set ADMIN_TOKEN="$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')"
railway variables set NODE_ENV=production

# 5. deploy (railway.json + Dockerfile udah kebaca otomatis)
railway up
```

Railway kasih URL kayak `xxx.up.railway.app`. Status sehat:
`https://xxx.up.railway.app/health`

**Attach volume (biar data persisten):**
```bash
railway volume add -n data -s 512
# volume mount ke /app/data (udah di-set DATA_FILE di Dockerfile)
```

**Custom domain di Railway:**
```bash
railway domain add tabolabale.online
```
Railway bakal kasih record DNS yang harus lu tambah (lihat bagian DNS bawah).

---

## PATH B — Render (config render.yaml udah ada)

Render deploy dari **repo Git (GitHub/GitLab)** — jadi lu harus push kode dulu.
(`render.yaml` bakal dibaca otomatis lewat fitur "Blueprint".)

### Step 1 — Push ke GitHub

```bash
cd shortlink
git init
git add .
git commit -m "xb33 shortlink"

# bikin repo di github.com dulu (jangan centang README/gitignore),
# terus connect + push:
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```
`.gitignore` udah nge-exclude `data/` — password & link **gak ke-push**. Aman.

### Step 2 — Bikin service di Render

1. Buka https://dashboard.render.com → **Sign in with GitHub**.
2. Klik **New +** → **Blueprint**.
3. Pilih repo lu → Render baca `render.yaml` → klik **Apply**.
4. Render bakal minta **`ADMIN_PASSWORD`** (karena `sync: false`). Isi password kuat.
   - Ini password buat login dashboard `/admin`. Jangan sampe lupa.
5. Tunggu build (~1 menit, zero-dep jadi cepet). Status jadi **Live**.
6. Lu dapet URL: `https://xb33-shortlink-xxxx.onrender.com`

### Step 3 — Verifikasi

```bash
DOMAIN=https://xb33-shortlink-xxxx.onrender.com
curl -s $DOMAIN/health        # {"ok":true,...}
```
Buka `$DOMAIN/admin` di browser → login pake `ADMIN_PASSWORD` → dashboard.

### Step 4 — Custom domain (opsional)

Render → service lu → **Settings** → **Custom Domains** → **Add** →
masukin `tabolabale.online`. Render kasih target CNAME. Terus add di Namecheap
(lihat bagian DNS di bawah).

> ⚠️ **Catatan free tier Render** (jujur ya):
> - **Disk ephemeral**: `data/links.json` + `data/auth.json` **reset tiap redeploy/restart**. Link & password yang lu ubah bakal ilang.
> - **Spin down** setelah ~15 menit nganggur → request pertama lambat (~30-60 detik).
> - Kalau mau serius: upgrade ke **Starter ($7/bln)** terus attach **Disk** (1GB), mount ke `/opt/render/project/src/data`. Uncomment bagian `disk:` di `render.yaml`.

---

## PATH C — VPS + Docker (paling stabil, kalau lu punya VPS)

```bash
cd shortlink
docker build -t xb33-shortlink .

docker run -d --name shortlink \
  -p 80:8080 \
  -e ADMIN_TOKEN="$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')" \
  -v /var/lib/shortlink:/app/data \
  --restart unless-stopped \
  xb33-shortlink
```
Volume `-v /var/lib/shortlink:/app/data` bikin data **gak ilang** walau container restart.

---

## 🌐 DNS — cara add di Namecheap

Yang lu tanya tadi. Masuk **Domain List → Manage → tab "Advanced DNS"**.

**1. HAPUS record lama** (parking namecheap, klik trash):
- `@  URL Redirect  http://www.tabolabale.online/` → **DELETE**

**2. Tambah record baru** (tombol **"Add New Record"**):

Kalau backend di **Railway/Render** (PATH A/B):

| Type | Host | Value | TTL |
|------|------|-------|-----|
| **CNAME** | `@` | `xxx.up.railway.app` | 30 min |
| **CNAME** | `www` | `xxx.up.railway.app` | 30 min |

> Catatan: kalau Namecheap gak nerima CNAME di `@` (beberapa domain shell gak bisa),
> pakai **A record** → IP yang dikasih Railway. Railway print IP-nya di step `railway domain add`.

Kalau backend di **VPS** (PATH C):

| Type | Host | Value | TTL |
|------|------|-------|-----|
| **A** | `@` | `IP_VPS_LU` | 30 min |
| **A** | `www` | `IP_VPS_LU` | 30 min |

**3. (Opsional) surge buat landing page terpisah** di subdomain:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| **CNAME** | `landing` | `geo.surge.world` | 30 min |

Terus `surge ./landing landing.tabolabale.online`

---

## ✅ Checklist setelah deploy

```bash
# ganti DOMAIN sama URL backend lu
DOMAIN=https://xxx.up.railway.app

curl -s $DOMAIN/health                          # harus {"ok":true,...}
curl -s $DOMAIN/api/challenge                   # harus kasih challenge

# bikin link (solve PoW) — buka aja browser:
#   $DOMAIN  → isi URL → SINGKATKAN

# dashboard:
#   $DOMAIN/admin?token=<ADMIN_TOKEN lu>
```

Cek status DNS:
```bash
dig tabolabale.online +short
# harus keluar IP/arah ke backend lu, BUKAN parkingpage.namecheap.com
```

---

## Env variables (penting)

| Var | Wajib? | Fungsi |
|-----|--------|--------|
| `ADMIN_TOKEN` | ✅ **WAJIB** | token buka dashboard. Generate: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |
| `PORT` | biasanya auto | PaaS (Render/Railway) nyetel ini otomatis |
| `TRUST_PROXY` | `1` kalau di belakang proxy | biar IP asli kebaca buat rate-limit |
| `POW_DIFF` | opsional | difficulty PoW (default 4) |

**GANTI token default `ganti-in-bangke-8char`** — itu udah public di kode, jangan dipake produksi.
