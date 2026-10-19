"use strict";
// Halaman depan. Client-side PoW solver biar manusia asli gak ngerasain beban.
function htmlPage() {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>XB33 SHORTLINK</title>
<style>
  :root { --bg:#0a0a0f; --fg:#e6e6ef; --acc:#39ff14; --mut:#7a7a8c; }
  * { box-sizing:border-box; }
  body { margin:0; font:16px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
         background:var(--bg); color:var(--fg); display:flex; min-height:100vh;
         align-items:center; justify-content:center; }
  .box { width:min(560px,92vw); padding:28px; border:1px solid #1e1e2a;
         border-radius:12px; background:#0e0e16; }
  h1 { font-size:20px; margin:0 0 4px; color:var(--acc); letter-spacing:1px; }
  .sub { color:var(--mut); font-size:12px; margin-bottom:20px; }
  input { width:100%; padding:12px; margin-bottom:10px; background:#08080d;
          border:1px solid #22222e; border-radius:8px; color:var(--fg);
          font:inherit; }
  input:focus { outline:none; border-color:var(--acc); }
  button { width:100%; padding:12px; background:var(--acc); color:#000;
           border:0; border-radius:8px; font:inherit; font-weight:700;
           cursor:pointer; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  .hp { position:absolute; left:-9999px; } /* honeypot */
  #out { margin-top:16px; font-size:13px; word-break:break-all; min-height:20px; }
  .ok { color:var(--acc); } .err { color:#ff5555; }
  a { color:var(--acc); }
</style>
</head>
<body>
<div class="box">
  <h1>XB33 SHORTLINK</h1>
  <div class="sub">anti-ddos &middot; zero-dep &middot; self-hosted</div>
  <form id="f">
    <input id="url" type="url" placeholder="https://target-url.lu/panjang-banget" required>
    <input id="custom" type="text" placeholder="custom slug (opsional)">
    <div class="hp"><input id="website" type="text" tabindex="-1" autocomplete="off"></div>
    <button id="btn" type="submit">SINGKATKAN</button>
  </form>
  <div id="out"></div>
</div>
<script>
const out = document.getElementById('out');
const btn = document.getElementById('btn');

// ---- client-side PoW solver ----
function solve(challenge, difficulty){
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;
  return new Promise((resolve)=>{
    function work(){
      const start = Date.now();
      while(Date.now()-start < 30){ // kerja 30ms, lalu yield biar UI gak freeze
        const h = hexSha256(challenge + nonce);
        if(h.startsWith(prefix)) return resolve(String(nonce));
        nonce++;
      }
      setTimeout(work, 0);
    }
    work();
  });
}
// sha256 via WebCrypto (async) -> bungkus sync-ish pake cache. Karena WebCrypto
// async, kita preload jadi loop async.
async function hexSha256(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function solveAsync(challenge, difficulty){
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;
  while(true){
    const h = await hexSha256(challenge + nonce);
    if(h.startsWith(prefix)) return String(nonce);
    nonce++;
  }
}

document.getElementById('f').addEventListener('submit', async (e)=>{
  e.preventDefault();
  btn.disabled = true; btn.textContent = 'MENGHITUNG...';
  out.className=''; out.textContent='Menyiapkan challenge...';
  try {
    const c = await (await fetch('/api/challenge')).json();
    out.textContent = 'Proof-of-Work... (difficulty '+c.difficulty+')';
    const nonce = await solveAsync(c.challenge, c.difficulty);
    const payload = {
      url: document.getElementById('url').value,
      custom: document.getElementById('custom').value || undefined,
      website: document.getElementById('website').value, // honeypot
      challenge: c.challenge, ts: c.ts, nonce
    };
    const r = await fetch('/api/shorten', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if(!r.ok) throw new Error(j.error || 'gagal');
    const short = location.origin + '/' + j.code;
    out.className='ok';
    out.innerHTML = 'Beres: <a href="'+short+'">'+short+'</a>';
  } catch(err){
    out.className='err'; out.textContent = 'ERR: ' + err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'SINGKATKAN';
  }
});
</script>
</body>
</html>`;
}

module.exports = { htmlPage };
