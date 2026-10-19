// Smoke test — jalanin server dulu: PORT=8097 ADMIN_PASSWORD=test1234 node server.js
// terus: node test.js
const BASE = process.env.TEST_BASE || "http://localhost:8097";
const crypto = require("crypto");

function solve(challenge, difficulty) {
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  while (true) {
    if (crypto.createHash("sha256").update(challenge + nonce).digest("hex").startsWith(prefix)) return String(nonce);
    nonce++;
  }
}
const sess = (res) => { const m = (res.headers.get("set-cookie") || "").match(/xb33_session=([^;]*)/); return m ? "xb33_session=" + m[1] : ""; };
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "✅" : "❌"} ${name} ${extra}`); };

(async () => {
  // health
  let r = await fetch(BASE + "/health");
  ok("health", r.status === 200);

  // admin tanpa auth
  r = await fetch(BASE + "/api/admin/overview");
  ok("admin no-auth 401", r.status === 401);

  // login page tampil
  r = await fetch(BASE + "/admin");
  ok("login page", (await r.text()).includes("LOGIN"));

  // login salah
  r = await fetch(BASE + "/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "salah" }) });
  ok("login salah 401", r.status === 401);

  // login bener (butuh 4x biar gak kena lock)
  r = await fetch(BASE + "/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.TEST_PASSWORD || "test1234" }) });
  const cookie = sess(r);
  ok("login benar 200 + cookie", r.status === 200 && cookie !== "", "HttpOnly=" + (r.headers.get("set-cookie") || "").includes("HttpOnly"));

  // dashboard via cookie
  r = await fetch(BASE + "/admin", { headers: { cookie } });
  ok("dashboard via cookie", (await r.text()).includes("DASHBOARD"));

  // admin API via cookie
  r = await fetch(BASE + "/api/admin/overview?minutes=60", { headers: { cookie } });
  ok("admin API via cookie", r.status === 200);

  // create link (publik)
  const c = await (await fetch(BASE + "/api/challenge")).json();
  const nonce = solve(c.challenge, c.difficulty);
  r = await fetch(BASE + "/api/shorten", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://example.com", challenge: c.challenge, ts: c.ts, nonce }) });
  const cj = await r.json();
  ok("create link 201", r.status === 201 && cj.ok);

  // redirect
  r = await fetch(BASE + "/" + cj.code, { redirect: "manual" });
  ok("redirect 302", r.status === 302);

  // logout
  r = await fetch(BASE + "/api/admin/logout", { method: "POST", headers: { cookie } });
  ok("logout 200", r.status === 200);

  // session mati
  r = await fetch(BASE + "/api/admin/overview", { headers: { cookie } });
  ok("session vokum 401", r.status === 401);

  console.log(`\n${pass} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
