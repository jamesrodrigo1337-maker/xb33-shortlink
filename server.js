"use strict";
const http = require("http");
const crypto = require("crypto");

const CONFIG = require("./config");
const { Store } = require("./store");
const { RateLimiter } = require("./ratelimit");
const { PowChallenge } = require("./pow");
const { Analytics } = require("./analytics");
const { htmlPage } = require("./ui");
const { dashboardPage } = require("./dashboard");
const { loginPage } = require("./login");
const { Auth } = require("./auth");

const store = new Store(CONFIG.dataFile);
const analytics = new Analytics(CONFIG.analyticsFile);
const auth = new Auth({
  file: CONFIG.auth.passwordFile,
  defaultPassword: CONFIG.auth.password,
  sessionTtlMs: CONFIG.auth.sessionTtlMs,
  maxFails: CONFIG.auth.maxFails,
  lockoutMs: CONFIG.auth.lockoutMs,
});
const limiter = new RateLimiter({ ratePerSec: CONFIG.limits.ratePerSec, burst: CONFIG.limits.burst, createPerMin: CONFIG.limits.createPerMin });
const pow = new PowChallenge({ difficulty: CONFIG.pow.difficulty, ttlMs: CONFIG.pow.ttlMs });

const SECURITY_HEADERS = { "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer" };

function clientIp(req) {
  if (CONFIG.trustProxy) {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.length) {
      const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
  }
  return req.socket.remoteAddress || "unknown";
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store", ...SECURITY_HEADERS });
  res.end(body);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > maxBytes) { reject(new Error("payload too large")); req.destroy(); return; } chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) { crypto.timingSafeEqual(ab, ab); return false; }
  return crypto.timingSafeEqual(ab, bb);
}

/** Ambil token session dari cookie. */
function sessionToken(req) {
  const c = Auth.parseCookies(req.headers.cookie);
  return c.xb33_session || "";
}

/** HTTPS? (buat Secure cookie). */
function isSecure(req) {
  if (CONFIG.auth.secureCookie) return true;
  return req.socket.encrypted === true;
}

/**
 * Cek request admin sah. Sumber auth:
 *  1. session cookie (hasil login) -> prioritas
 *  2. bearer/query token (compat lama, buat script/curl)
 */
function isAdmin(req) {
  if (auth.checkSession(sessionToken(req))) return true;
  const h = req.headers["authorization"] || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const url = new URL(req.url, "http://x");
  const q = url.searchParams.get("token") || "";
  return timingSafeEqual(token, CONFIG.adminToken) || timingSafeEqual(q, CONFIG.adminToken);
}

const SCHEME_ALLOW = new Set(["http:", "https:"]);
function validateTarget(raw) {
  if (typeof raw !== "string") return { ok: false, reason: "missing url" };
  const s = raw.trim();
  if (!s) return { ok: false, reason: "empty url" };
  if (s.length > 2048) return { ok: false, reason: "url too long" };
  let u; try { u = new URL(s); } catch { return { ok: false, reason: "malformed url" }; }
  if (!SCHEME_ALLOW.has(u.protocol)) return { ok: false, reason: "scheme not allowed" };
  if (!u.hostname) return { ok: false, reason: "no hostname" };
  return { ok: true, url: u.toString() };
}

const SLUG_RE = /^[a-zA-Z0-9_-]{1,64}$/;
function genSlug() { return crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8); }

function handleRedirect(req, res, slug) {
  const ip = clientIp(req);
  if (!limiter.allow(ip)) return sendJson(res, 429, { error: "too many requests" });
  const entry = store.getWithCache(slug);
  if (!entry) { res.writeHead(404, { "content-type": "text/plain", ...SECURITY_HEADERS }); return res.end("404 - link not found"); }
  store.hit(slug);
  analytics.record(slug, { ref: req.headers["referer"] || req.headers["referrer"] || "", ua: req.headers["user-agent"] || "", cc: req.headers["cfipcountry"] || req.headers["x-country-code"] || "" });
  res.writeHead(302, { location: entry.url, "cache-control": "no-store", ...SECURITY_HEADERS });
  res.end();
}

async function handleCreate(req, res) {
  const ip = clientIp(req);
  if (!limiter.allowCreate(ip)) return sendJson(res, 429, { error: "creation rate limit exceeded" });
  let body; try { body = await readBody(req, CONFIG.limits.maxBodyBytes); } catch (e) { return sendJson(res, 413, { error: e.message }); }
  let payload; try { payload = JSON.parse(body); } catch { return sendJson(res, 400, { error: "invalid json" }); }
  if (payload.website) return sendJson(res, 200, { ok: true, code: genSlug(), url: payload.url || "" });
  const powOk = pow.verify(payload.nonce, payload.challenge, payload.ts);
  if (!powOk) return sendJson(res, 401, { error: "invalid or expired pow challenge" });
  const v = validateTarget(payload.url);
  if (!v.ok) return sendJson(res, 400, { error: v.reason });
  let slug;
  if (payload.custom) {
    if (!SLUG_RE.test(payload.custom)) return sendJson(res, 400, { error: "invalid custom slug" });
    slug = payload.custom;
    if (store.get(slug)) return sendJson(res, 409, { error: "custom slug already taken" });
  } else { do { slug = genSlug(); } while (store.get(slug)); }
  store.put(slug, v.url);
  return sendJson(res, 201, { ok: true, code: slug, url: v.url });
}

function handleChallenge(req, res) { return sendJson(res, 200, pow.issue()); }

function handleAdminList(req, res) {
  const links = [];
  for (const [code, e] of store.map) links.push({ code, url: e.url, hits: e.hits, created: e.created });
  links.sort((a, b) => b.hits - a.hits);
  return sendJson(res, 200, { count: links.length, links });
}

function handleAdminOverview(req, res, minutes) {
  const totalLinks = store.map.size;
  let totalHits = 0; for (const e of store.map.values()) totalHits += e.hits;
  const top = [...store.map.entries()].map(([code, e]) => ({ code, url: e.url, hits: e.hits })).sort((a, b) => b.hits - a.hits).slice(0, 10);
  const recent = analytics.totalRecent(25);
  return sendJson(res, 200, { totalLinks, totalHits, top, recent, series: analytics.totalSeries(minutes) });
}

function handleAdminLinkStats(req, res, slug, minutes) {
  const e = store.get(slug);
  if (!e) return sendJson(res, 404, { error: "not found" });
  return sendJson(res, 200, { code: slug, url: e.url, hits: e.hits, created: e.created, series: analytics.seriesFor(slug, minutes), referrers: analytics.top("refs", slug, 10), browsers: analytics.top("uas", slug, 10), countries: analytics.top("countries", slug, 10), recent: analytics.recent.filter((r) => r.slug === slug).slice(-50).reverse() });
}

function handleAdminDelete(req, res, slug) {
  if (!store.map.has(slug)) return sendJson(res, 404, { error: "not found" });
  store.map.delete(slug); store.lru.delete(slug); store.dirty = true;
  return sendJson(res, 200, { ok: true, deleted: slug });
}

async function handleAdminCreate(req, res) {
  let body; try { body = await readBody(req, CONFIG.limits.maxBodyBytes); } catch (e) { return sendJson(res, 413, { error: e.message }); }
  let payload; try { payload = JSON.parse(body); } catch { return sendJson(res, 400, { error: "invalid json" }); }
  const v = validateTarget(payload.url);
  if (!v.ok) return sendJson(res, 400, { error: v.reason });
  let slug;
  if (payload.custom) { if (!SLUG_RE.test(payload.custom)) return sendJson(res, 400, { error: "invalid custom slug" }); slug = payload.custom; if (store.get(slug)) return sendJson(res, 409, { error: "slug taken" }); }
  else { do { slug = genSlug(); } while (store.get(slug)); }
  store.put(slug, v.url);
  return sendJson(res, 201, { ok: true, code: slug, url: v.url });
}

// ------------------------------ Auth handlers ------------------------------

/** POST /api/admin/login {password} -> set session cookie. */
async function handleLogin(req, res) {
  const ip = clientIp(req);
  let body;
  try { body = await readBody(req, CONFIG.limits.maxBodyBytes); } catch (e) { return sendJson(res, 413, { error: e.message }); }
  let payload; try { payload = JSON.parse(body); } catch { return sendJson(res, 400, { error: "invalid json" }); }

  const r = await auth.verify(ip, payload.password);
  if (!r.ok) {
    if (r.lockedFor) return sendJson(res, 429, { error: `terlalu banyak percobaan. kunci ${r.lockedFor}s` });
    return sendJson(res, 401, { error: `password salah${r.remaining != null ? " (" + r.remaining + " percobaan lagi)" : ""}` });
  }
  const s = auth.createSession();
  res.setHeader("Set-Cookie", auth.buildSessionCookie(s.token, s.maxAge, isSecure(req)));
  return sendJson(res, 200, { ok: true, maxAge: s.maxAge });
}

/** POST /api/admin/logout -> revoke session + clear cookie. */
function handleLogout(req, res) {
  auth.revoke(sessionToken(req));
  res.setHeader("Set-Cookie", auth.clearCookie(isSecure(req)));
  return sendJson(res, 200, { ok: true });
}

/** POST /api/admin/password {oldPassword,newPassword} -> ganti password. */
async function handlePassword(req, res) {
  if (!isAdmin(req)) return sendJson(res, 401, { error: "unauthorized" });
  let body;
  try { body = await readBody(req, CONFIG.limits.maxBodyBytes); } catch (e) { return sendJson(res, 413, { error: e.message }); }
  let payload; try { payload = JSON.parse(body); } catch { return sendJson(res, 400, { error: "invalid json" }); }
  const r = await auth.changePassword(payload.oldPassword, payload.newPassword);
  if (!r.ok) return sendJson(res, 400, { error: r.error });
  return sendJson(res, 200, { ok: true });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x");
    const parts = u.pathname.split("/").filter(Boolean);
    const m = req.method;
    if (m === "GET" && parts.length === 0) { res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...SECURITY_HEADERS }); return res.end(htmlPage()); }
    if (m === "GET" && parts[0] === "health")
      return sendJson(res, 200, { ok: true, uptime: process.uptime(), links: store.map.size });
    if (m === "GET" && parts[0] === "api" && parts[1] === "challenge") return handleChallenge(req, res);
    if (m === "POST" && parts[0] === "api" && parts[1] === "shorten") return await handleCreate(req, res);
    if (m === "GET" && parts[0] === "admin") {
      if (parts.length === 1) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...SECURITY_HEADERS });
        // Belum login -> halaman login. Udah login -> dashboard.
        return res.end(isAdmin(req) ? dashboardPage() : loginPage());
      }
    }
    if (parts[0] === "api" && parts[1] === "admin") {
      // Login gak butuh auth (ya iyalah).
      if (m === "POST" && parts[2] === "login") return await handleLogin(req, res);
      if (m === "POST" && parts[2] === "logout") return handleLogout(req, res);
      // Sisanya wajib auth.
      if (!isAdmin(req)) return sendJson(res, 401, { error: "unauthorized" });
      if (m === "POST" && parts[2] === "password") return await handlePassword(req, res);
      if (m === "GET" && parts[2] === "session") return sendJson(res, 200, { ok: true });
      if (m === "GET" && parts[2] === "links") return handleAdminList(req, res);
      if (m === "GET" && parts[2] === "overview") { const mins = parseInt(u.searchParams.get("minutes") || "60", 10); return handleAdminOverview(req, res, mins); }
      if (m === "GET" && parts[2] === "link" && parts[3]) { const mins = parseInt(u.searchParams.get("minutes") || "60", 10); return handleAdminLinkStats(req, res, parts[3], mins); }
      if (m === "POST" && parts[2] === "link") return await handleAdminCreate(req, res);
      if (m === "DELETE" && parts[2] === "link" && parts[3]) return handleAdminDelete(req, res, parts[3]);
    }
    if (m === "GET" && parts[0] === "api" && parts[1] === "stats" && parts[2]) { const e = store.get(parts[2]); if (!e) return sendJson(res, 404, { error: "not found" }); return sendJson(res, 200, { code: parts[2], url: e.url, hits: e.hits }); }
    if (m === "GET" && parts.length === 1) return handleRedirect(req, res, parts[0]);
    sendJson(res, 404, { error: "not found" });
  } catch (err) {
    console.error("[err]", err.message);
    if (!res.headersSent) sendJson(res, 500, { error: "internal error" }); else res.end();
  }
});

server.maxConnections = CONFIG.limits.maxConnections;
server.on("connection", (socket) => { socket.setTimeout(CONFIG.limits.idleTimeoutMs, () => socket.destroy()); });
server.on("listening", () => { const a = server.address(); console.log("\n  XBumbbleB33 SHORTLINK\n  > http://localhost:" + a.port + "\n  > dashboard: http://localhost:" + a.port + "/admin  (login pake password)\n  > api token (compat): " + CONFIG.adminToken + "\n"); });
server.listen(CONFIG.port, CONFIG.host, () => {});
process.on("SIGINT", () => { store.flushSync(); analytics.flush(); process.exit(0); });
