# XB33 SHORTLINK

URL shortener self-hosted, **zero-dependency** (Node.js murni), dengan
lapisan pertahanan anti-DDoS + **dashboard login**. Gratis, gak perlu `npm install`.

## Jalan
```bash
# set password login dashboard
ADMIN_PASSWORD="password-kuat-disini" node server.js
```
Buka `http://localhost:8080/admin` → masuk pake password.

Password pertama di-seed dari `ADMIN_PASSWORD` (atau random kalau gak diset),
disimpan **hashed (scrypt)** di `data/auth.json`. Ubah lewat menu
"Ganti Password" setelah login.

## Keamanan
- **Login page + session cookie** (HttpOnly, SameSite=Lax, expire 8 jam)
- **Anti brute-force**: 5x salah → kunci IP 15 menit (429)
- **Password scrypt + timing-safe compare**
- Ganti password → semua session keluar

## Fitur pertahanan DDoS (in-process, gratis)
1. **Token-bucket rate limit per-IP** — nahan serangan volumetrik.
2. **Connection backpressure** — `maxConnections` + idle timeout (anti slowloris).
3. **Proof-of-Work (Hashcash-style)** — create wajib solve SHA-256 → bot ngeluarin CPU.
4. **Honeypot field** — bot auto-fill `website` → dibalas sukses palsu, link gak dibuat.
5. **Sliding-window limiter khusus create.**
6. **LRU cache redirect** — hot path gak nyentuh disk.
7. **Scheme allowlist** — blok `javascript:`, `data:`, dll.

> Ini nahan DDoS level script-kiddie & botnet kecil.
> Serapan raksasa (ratusan Gbps) tetep butuh edge di depan (Cloudflare dsb).
> Tapi combo ini bikin server lu BERTAHAN, bukan crash.

## Dashboard (`/admin`)
- **Login** pake password → session cookie
- 4 kartu live: total link, total klik, klik/jam, live 5m
- Timeseries chart (canvas, 1j/6j/24j/7h) — auto-refresh 5 detik
- Top links + tabel kelola (cari, urut, tambah, hapus)
- Breakdown referrer / browser / negara
- Live feed klik terakhir + modal statistik per-link
- Tombol **ganti password** + **keluar**

## Test
```bash
ADMIN_PASSWORD=test1234 PORT=8097 node server.js &   # terminal 1
npm test                                              # terminal 2
```

## API
```bash
# login -> cookie
curl -i -X POST localhost:8080/api/admin/login \
  -H 'content-type: application/json' -d '{"password":"..."}'

# create (butuh PoW)
curl -s localhost:8080/api/challenge

# stats publik
curl -s localhost:8080/api/stats/<code>
```

## Env
| Var | Default | Fungsi |
|-----|---------|--------|
| `PORT` | 8080 | port |
| `ADMIN_PASSWORD` | random-seed | password login dashboard |
| `ADMIN_TOKEN` | `ganti-in-bangke-8char` | token API (compat) |
| `SESSION_TTL_MS` | 8 jam | masa hidup session |
| `LOGIN_MAX_FAILS` | 5 | percobaan sebelum kunci |
| `LOGIN_LOCKOUT_MS` | 15 menit | durasi kunci |
| `SECURE_COOKIE` | 0 | set `1` kalau udah HTTPS |
| `POW_DIFF` | 4 | difficulty leading-zero |
| `RATE_PER_SEC` | 20 | rate limit redirect/detik per IP |
| `CREATE_PER_MIN` | 10 | limit create/menit per IP |
| `MAX_CONN` | 512 | backpressure koneksi |
| `TRUST_PROXY` | 0 | set `1` hanya di belakang reverse-proxy tepercaya |

## Deploy
Lihat **DEPLOY.md** (Railway / Render / Docker + DNS).
