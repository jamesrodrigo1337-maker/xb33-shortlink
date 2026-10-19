"use strict";
// Konfigurasi utama. Ubah-ubah di sini, jangan di server.js.
module.exports = {
  host: process.env.HOST || "0.0.0.0",
  port: parseInt(process.env.PORT || "8080", 10),
  dataFile: process.env.DATA_FILE || require("path").join(__dirname, "data", "links.json"),
  analyticsFile: process.env.ANALYTICS_FILE || require("path").join(__dirname, "data", "analytics.json"),

  // Token admin buat akses dashboard + API manage. GENERATE ULANG, jangan pakai default.
  // node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  adminToken: process.env.ADMIN_TOKEN || "ganti-in-bangke-8char",

  auth: {
    // Password login dashboard. Kalau gak diset, di-seed random sekali ke
    // data/auth.json (cek log pas start). Setelah itu ubah lewat menu dashboard.
    password: process.env.ADMIN_PASSWORD || "",
    passwordFile: process.env.ADMIN_PASSWORD_FILE || require("path").join(__dirname, "data", "auth.json"),
    sessionTtlMs: parseInt(process.env.SESSION_TTL_MS || String(8 * 3600 * 1000), 10), // 8 jam
    maxFails: parseInt(process.env.LOGIN_MAX_FAILS || "5", 10),
    lockoutMs: parseInt(process.env.LOGIN_LOCKOUT_MS || String(15 * 60 * 1000), 10),
    // Secure cookie (HTTPS only). Set 1 kalau udah di belakang TLS.
    secureCookie: process.env.SECURE_COOKIE === "1",
  },

  // Percaya X-Forwarded-For (AKTIFKAN hanya kalau lo di belakang reverse-proxy
  // tepercaya kayak nginx. Kalau expose langsung, BIARKAN false — otherwise
  // rate-limit lu bisa di-bypass spoofing header.)
  trustProxy: process.env.TRUST_PROXY === "1",

  pow: {
    difficulty: parseInt(process.env.POW_DIFF || "4", 10), // jumlah leading-zero hex
    ttlMs: parseInt(process.env.POW_TTL || "120000", 10),
  },

  limits: {
    ratePerSec: parseInt(process.env.RATE_PER_SEC || "20", 10), // redirect/detik per IP
    burst: parseInt(process.env.BURST || "40", 10),
    createPerMin: parseInt(process.env.CREATE_PER_MIN || "10", 10),
    maxBodyBytes: 8 * 1024, // 8KB
    maxConnections: parseInt(process.env.MAX_CONN || "512", 10),
    idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT || "10000", 10),
  },
};
