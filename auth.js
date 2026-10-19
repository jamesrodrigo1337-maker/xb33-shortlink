"use strict";
/**
 * Auth engine — login + session cookie + anti-brute-force.
 *
 * - Password di-hash pake scrypt (salt random) + timing-safe compare.
 * - Disimpan di data/auth.json (sekali seed, terus jadi kebenaran).
 * - Session token random 64 hex, disimpan server-side, expire otomatis.
 * - Lockout: 5x salah -> kunci IP 15 menit (anti brute-force).
 * - Gak ada session yang persist lintas restart (user login ulang) — by design.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 }; // moderate, cepat tapi aman

function scryptHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, SCRYPT_OPTS, (err, dk) =>
      err ? reject(err) : resolve(dk)
    );
  });
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) { crypto.timingSafeEqual(ab, ab); return false; }
  return crypto.timingSafeEqual(ab, bb);
}

class Auth {
  constructor({ file, defaultPassword, sessionTtlMs = 8 * 3600 * 1000, maxFails = 5, lockoutMs = 15 * 60 * 1000 }) {
    this.file = file;
    this.sessionTtlMs = sessionTtlMs;
    this.maxFails = maxFails;
    this.lockoutMs = lockoutMs;

    this.sessions = new Map(); // token -> { created, expires }
    this.fails = new Map();    // ip -> { count, lockedUntil }
    this._loadOrCreate(defaultPassword);
  }

  _loadOrCreate(defaultPassword) {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      if (fs.existsSync(this.file)) {
        const d = JSON.parse(fs.readFileSync(this.file, "utf8"));
        if (d && d.salt && d.hash) { this.salt = d.salt; this.hash = d.hash; return; }
      }
      // Seed password pertama kali.
      this._setPasswordSync(defaultPassword || crypto.randomBytes(9).toString("base64url"));
      console.log("[auth] password admin di-seed. Ubah setelah login (menu 'Ganti Password').");
    } catch (e) {
      console.error("[auth] init failed:", e.message);
      this.salt = crypto.randomBytes(16).toString("hex");
      this.hash = "";
    }
  }

  _setPasswordSync(pw) {
    this.salt = crypto.randomBytes(16).toString("hex");
    const dk = crypto.scryptSync(String(pw), Buffer.from(this.salt, "hex"), 64, SCRYPT_OPTS);
    this.hash = dk.toString("hex");
    this._save();
  }

  _save() {
    try {
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify({ salt: this.salt, hash: this.hash, algo: "scrypt" }));
      fs.renameSync(tmp, this.file);
    } catch (e) { console.error("[auth] save failed:", e.message); }
  }

  /** Cek IP kena lock gak. */
  isLocked(ip) {
    const f = this.fails.get(ip);
    if (!f) return 0;
    if (f.lockedUntil && Date.now() < f.lockedUntil)
      return Math.ceil((f.lockedUntil - Date.now()) / 1000);
    if (f.lockedUntil && Date.now() >= f.lockedUntil) this.fails.delete(ip); // unlock
    return 0;
  }

  /** Verifikasi password. Return {ok, lockedFor}. */
  async verify(ip, password) {
    const lock = this.isLocked(ip);
    if (lock) return { ok: false, lockedFor: lock };

    const saltBuf = Buffer.from(this.salt, "hex");
    let ok = false;
    if (this.hash) {
      const dk = await scryptHash(String(password || ""), saltBuf);
      ok = timingSafeEqual(dk.toString("hex"), this.hash);
    }

    if (ok) { this.fails.delete(ip); return { ok: true }; }

    // catat kegagalan
    const f = this.fails.get(ip) || { count: 0, lockedUntil: 0 };
    f.count++;
    if (f.count >= this.maxFails) f.lockedUntil = Date.now() + this.lockoutMs;
    this.fails.set(ip, f);
    return { ok: false, lockedFor: this.isLocked(ip), remaining: Math.max(0, this.maxFails - f.count) };
  }

  /** Ganti password. Verifikasi lama dulu. */
  async changePassword(oldPw, newPw) {
    const saltBuf = Buffer.from(this.salt, "hex");
    const dk = await scryptHash(String(oldPw || ""), saltBuf);
    if (!timingSafeEqual(dk.toString("hex"), this.hash)) return { ok: false, error: "password lama salah" };
    if (!newPw || String(newPw).length < 6) return { ok: false, error: "password baru min 6 karakter" };
    this._setPasswordSync(String(newPw));
    this.revokeAll(); // semua session keluar setelah ganti password
    return { ok: true };
  }

  // ---------------- session ----------------
  createSession() {
    const token = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    this.sessions.set(token, { created: now, expires: now + this.sessionTtlMs });
    this._gcSessions();
    return { token, maxAge: Math.floor(this.sessionTtlMs / 1000) };
  }

  checkSession(token) {
    if (!token || typeof token !== "string" || token.length !== 64) return false;
    const s = this.sessions.get(token);
    if (!s) return false;
    if (Date.now() > s.expires) { this.sessions.delete(token); return false; }
    return true;
  }

  revoke(token) { if (token) this.sessions.delete(token); }
  revokeAll() { this.sessions.clear(); }

  _gcSessions() {
    if (this.sessions.size < 1000) return;
    const now = Date.now();
    for (const [t, s] of this.sessions) if (now > s.expires) this.sessions.delete(t);
  }

  // ---------------- cookie helpers ----------------
  static parseCookies(header) {
    const out = {};
    if (!header) return out;
    for (const part of String(header).split(";")) {
      const i = part.indexOf("=");
      if (i < 0) continue;
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  buildSessionCookie(token, maxAge, secure) {
    return `xb33_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (secure ? "; Secure" : "");
  }

  clearCookie(secure) {
    return `xb33_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
  }
}

module.exports = { Auth, timingSafeEqual };
