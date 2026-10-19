"use strict";
// Halaman login dashboard. POST /api/admin/login -> session cookie HttpOnly.
function loginPage(err) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login — XB33</title>
<style>
  :root{--bg:#08080d;--panel:#0e0e16;--fg:#e6e6ef;--acc:#39ff14;--mut:#6d6d80;
        --line:#1c1c28;--red:#ff5555;}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       font:14px/1.5 ui-monospace,Menlo,monospace;background:
       radial-gradient(600px 300px at 50% -10%, #10240f 0%, transparent 60%),var(--bg);color:var(--fg)}
  .box{width:min(380px,92vw);background:var(--panel);border:1px solid var(--line);
       border-radius:16px;padding:32px 28px;position:relative;overflow:hidden}
  .box:before{content:"";position:absolute;top:0;left:0;right:0;height:2px;
       background:linear-gradient(90deg,transparent,var(--acc),transparent)}
  .lock{font-size:34px;text-align:center;color:var(--acc);margin-bottom:8px}
  h1{font-size:18px;text-align:center;margin:0 0 4px;letter-spacing:2px;color:var(--acc)}
  .sub{text-align:center;color:var(--mut);font-size:11px;margin-bottom:24px;letter-spacing:1px}
  label{display:block;font-size:11px;color:var(--mut);text-transform:uppercase;
        letter-spacing:1px;margin-bottom:6px}
  input{width:100%;padding:13px 14px;background:#08080d;border:1px solid var(--line);
        border-radius:10px;color:var(--fg);font:inherit;letter-spacing:3px}
  input:focus{outline:none;border-color:var(--acc);box-shadow:0 0 0 3px rgba(57,255,20,.12)}
  button{width:100%;margin-top:18px;padding:13px;background:var(--acc);color:#000;border:0;
        border-radius:10px;font:inherit;font-weight:700;letter-spacing:1px;cursor:pointer;
        transition:.15s}
  button:hover{filter:brightness(1.1)}
  button:disabled{opacity:.55;cursor:not-allowed}
  .err{display:none;background:rgba(255,85,85,.1);border:1px solid rgba(255,85,85,.35);
       color:var(--red);font-size:12px;padding:10px 12px;border-radius:8px;margin-bottom:14px}
  .err.on{display:block;animation:shake .3s}
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  .foot{text-align:center;color:var(--mut);font-size:10px;margin-top:20px;letter-spacing:.5px}
</style>
</head>
<body>
<div class="box">
  <div class="lock">&#128274;</div>
  <h1>XB33 // LOGIN</h1>
  <div class="sub">restricted &mdash; admin only</div>
  <div class="err" id="err"></div>
  <form id="f" autocomplete="off">
    <label>Password</label>
    <input id="pw" type="password" placeholder="••••••••" autofocus required>
    <button id="btn" type="submit">MASUK</button>
  </form>
  <div class="foot">session expire otomatis &middot; 5x salah = kunci 15 menit</div>
</div>
<script>
const f=document.getElementById('f'),err=document.getElementById('err'),
      btn=document.getElementById('btn'),pw=document.getElementById('pw');
${err ? `show(${JSON.stringify(String(err))});` : ""}
function show(m){ err.textContent=m; err.classList.add('on'); }
f.addEventListener('submit', async (e)=>{
  e.preventDefault();
  btn.disabled=true; btn.textContent='...'; err.classList.remove('on');
  try{
    const r=await fetch('/api/admin/login',{
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({password: pw.value})
    });
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||('gagal ('+r.status+')'));
    // sukses -> reload, server udah set cookie & bakal kirim dashboard
    location.replace('/admin');
  }catch(ex){ show(ex.message); btn.disabled=false; btn.textContent='MASUK'; pw.value=''; pw.focus(); }
});
</script>
</body>
</html>`;
}

module.exports = { loginPage };
