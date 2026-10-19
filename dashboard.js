"use strict";
// Dashboard admin — chart canvas murni (gak ada library eksternal).
// Data di-poll dari /api/admin/* setiap 5 detik.
function dashboardPage() {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>XB33 DASHBOARD</title>
<style>
  :root{--bg:#08080d;--panel:#0e0e16;--fg:#e6e6ef;--acc:#39ff14;--mut:#6d6d80;
        --line:#1c1c28;--red:#ff5555;--blue:#4da6ff;--yel:#ffd24d;}
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.5 ui-monospace,Menlo,monospace;background:var(--bg);color:var(--fg)}
  header{display:flex;align-items:center;justify-content:space-between;gap:12px;
         padding:14px 20px;border-bottom:1px solid var(--line);background:var(--panel);
         position:sticky;top:0;z-index:5;flex-wrap:wrap}
  header h1{font-size:16px;margin:0;color:var(--acc);letter-spacing:1px}
  .pill{font-size:11px;color:var(--mut);border:1px solid var(--line);padding:4px 8px;border-radius:20px}
  main{padding:20px;max-width:1200px;margin:0 auto}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
  .card .k{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:1px}
  .card .v{font-size:30px;font-weight:700;margin-top:6px;color:var(--acc)}
  .card.blue .v{color:var(--blue)} .card.yel .v{color:var(--yel)} .card.red .v{color:var(--red)}
  .row{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:18px}
  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px}
  h2{font-size:13px;margin:0 0 12px;color:var(--fg);letter-spacing:.5px;
     display:flex;justify-content:space-between;align-items:center}
  canvas{width:100%;display:block}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;color:var(--mut);font-weight:400;padding:6px 8px;border-bottom:1px solid var(--line);
     text-transform:uppercase;font-size:10px;letter-spacing:1px}
  td{padding:7px 8px;border-bottom:1px solid #141420;vertical-align:middle}
  td a{color:var(--acc);text-decoration:none} td a:hover{text-decoration:underline}
  .host{color:var(--mut);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:bottom}
  .bar{height:6px;background:var(--acc);border-radius:3px;display:block;margin-top:4px}
  .btn{background:transparent;border:1px solid var(--red);color:var(--red);padding:3px 8px;
       border-radius:6px;cursor:pointer;font:inherit;font-size:11px}
  .btn:hover{background:var(--red);color:#000}
  .btn.gr{border-color:var(--line);color:var(--mut)}
  .btn.gr:hover{background:var(--acc);color:#000;border-color:var(--acc)}
  .rd{background:transparent;border:1px solid var(--red);color:var(--red);padding:4px 10px;
      border-radius:6px;cursor:pointer;font:inherit;font-size:11px}
  .rd:hover{background:var(--red);color:#000}
  .seg{display:flex;gap:6px}
  .seg button{background:var(--panel);border:1px solid var(--line);color:var(--mut);
              padding:4px 10px;border-radius:6px;cursor:pointer;font:inherit;font-size:11px}
  .seg button.on{border-color:var(--acc);color:var(--acc)}
  #live{max-height:280px;overflow:auto}
  .empty{color:var(--mut);padding:16px;text-align:center;font-size:12px}
  .filters{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
  input,select{background:var(--panel);border:1px solid var(--line);color:var(--fg);
               padding:8px 10px;border-radius:8px;font:inherit;font-size:12px}
  input:focus,select:focus{outline:none;border-color:var(--acc)}
  .create{display:flex;gap:8px;flex-wrap:wrap}
  .create input{flex:1;min-width:160px}
  .modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:none;
         align-items:flex-start;justify-content:center;padding:40px 20px;z-index:20;overflow:auto}
  .modal.on{display:flex}
  .modal .box{background:var(--panel);border:1px solid var(--line);border-radius:14px;
              padding:22px;width:min(720px,94vw)}
  .split{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .tag{font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
  .mini{margin-bottom:12px}
  .x{float:right;cursor:pointer;color:var(--mut);font-size:20px;line-height:1}
  @media(max-width:820px){.grid{grid-template-columns:repeat(2,1fr)}.row,.row3,.split{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <h1>XB33 // DASHBOARD</h1>
  <div class="pill" id="clock">-</div>
  <div class="seg">
    <button data-range="60" class="on">1j</button>
    <button data-range="360">6j</button>
    <button data-range="1440">24j</button>
    <button data-range="10080">7h</button>
    <button id="refresh" class="gr">⟳ refresh</button>
    <button id="pwbtn" class="gr">ganti password</button>
    <button id="logout" class="rd">keluar</button>
  </div>
</header>

<main>
  <div class="grid">
    <div class="card"><div class="k">Total Link</div><div class="v" id="s-links">0</div></div>
    <div class="card blue"><div class="k">Total Klik</div><div class="v" id="s-hits">0</div></div>
    <div class="card yel"><div class="k">Klik / jam</div><div class="v" id="s-rate">0</div></div>
    <div class="card red"><div class="k">Live (5m)</div><div class="v" id="s-live">0</div></div>
  </div>

  <div class="row">
    <div class="card">
      <h2>TRAFFIC TIMESERIES <span class="tag" id="ts-label">-</span></h2>
      <canvas id="chart" height="180"></canvas>
    </div>
    <div class="card">
      <h2>TOP LINKS</h2>
      <div id="top"></div>
    </div>
  </div>

  <div class="card" style="margin-bottom:18px">
    <h2>SEMAKIN LINK
      <div class="create">
        <input id="n-url" placeholder="https://target-url">
        <input id="n-slug" placeholder="slug (opsional)" style="flex:0 0 160px">
        <button class="btn gr" id="n-add">+ TAMBAH</button>
      </div>
    </h2>
    <div class="filters">
      <input id="q" placeholder="cari code / url...">
      <select id="sort"><option value="hits">urut: klik</option><option value="created">urut: terbaru</option><option value="code">urut: code</option></select>
      <span class="tag" id="count"></span>
    </div>
    <div style="overflow:auto">
      <table>
        <thead><tr><th>CODE</th><th>TARGET</th><th>KLIK</th><th>DIBUAT</th><th></th></tr></thead>
        <tbody id="links"></tbody>
      </table>
    </div>
  </div>

  <div class="row3">
    <div class="card"><h2>REFERRER</h2><div id="refs"></div></div>
    <div class="card"><h2>BROWSER</h2><div id="uas"></div></div>
    <div class="card"><h2>NEGARA</h2><div id="ccs"></div></div>
  </div>

  <div class="card">
    <h2>LIVE FEED <span class="tag">klik terakhir</span></h2>
    <div id="live"><div class="empty">belum ada traffic...</div></div>
  </div>
</main>

<div class="modal" id="modal">
  <div class="box">
    <span class="x" id="mx">&times;</span>
    <h2 id="m-title">STATS</h2>
    <div class="row" style="margin-bottom:14px">
      <div class="card"><h2>TIMESERIES</h2><canvas id="m-chart" height="160"></canvas></div>
      <div class="card"><div class="split">
        <div class="mini"><div class="tag">REFERRER</div><div id="m-refs"></div></div>
        <div class="mini"><div class="tag">BROWSER</div><div id="m-uas"></div></div>
        <div class="mini"><div class="tag">NEGARA</div><div id="m-ccs"></div></div>
      </div></div>
    </div>
    <div class="card"><h2>LOG KLIK</h2><div id="m-live" style="max-height:220px;overflow:auto"></div></div>
  </div>
</div>

<div class="modal" id="pwmodal">
  <div class="box" style="width:min(420px,94vw)">
    <span class="x" id="pw-x">&times;</span>
    <h2>GANTI PASSWORD</h2>
    <div id="pw-err" class="err" style="display:none;color:var(--red);font-size:12px;margin-bottom:10px"></div>
    <div class="mini"><div class="tag">Password lama</div><input id="pw-old" type="password" style="width:100%"></div>
    <div class="mini"><div class="tag">Password baru (min 6)</div><input id="pw-new" type="password" style="width:100%"></div>
    <div class="mini"><div class="tag">Ulangi password baru</div><input id="pw-new2" type="password" style="width:100%"></div>
    <button class="btn gr" id="pw-save" style="width:100%;margin-top:8px;padding:10px">SIMPAN</button>
  </div>
</div>

<script>
const TOKEN = new URLSearchParams(location.search).get('token') || '';
const api = (p)=>fetch('/api/admin/'+p+(TOKEN?('&token='+TOKEN):'')).then(r=>{
  if(r.status===401){ location.replace('/admin'); throw new Error('unauthorized'); }
  return r.json();
});
const $ = (id)=>document.getElementById(id);
let RANGE = 60, LINKS = [], CURRENT = null;

function fmt(n){ if(n>=1e6)return (n/1e6).toFixed(1)+'M'; if(n>=1e3)return (n/1e3).toFixed(1)+'K'; return ''+n; }
function ago(t){ const s=(Date.now()-t)/1000; if(s<60)return Math.floor(s)+'d'; if(s<3600)return Math.floor(s/60)+'m'; if(s<86400)return Math.floor(s/3600)+'j'; return Math.floor(s/86400)+'h'; }
function host(u){ try{return new URL(u).host}catch{return u} }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) }

// ---- canvas bar/line chart ----
function drawChart(canvas, data, color){
  const dpr = window.devicePixelRatio||1;
  const w = canvas.clientWidth||canvas.parentNode.clientWidth, h = canvas.height;
  canvas.width = w*dpr; canvas.height = h*dpr; canvas.style.height=h+'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,w,h);
  if(!data.length){ ctx.fillStyle='#6d6d80'; ctx.font='12px monospace'; ctx.fillText('no data',10,h/2); return; }
  const pad=28, max=Math.max(1,...data.map(d=>d.v));
  const bw=(w-pad)/data.length;
  // grid
  ctx.strokeStyle='#1c1c28'; ctx.fillStyle='#6d6d80'; ctx.font='9px monospace';
  for(let i=0;i<=3;i++){ const y=pad/2+(h-pad)*i/3; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    ctx.fillText(Math.round(max*(1-i/3)),2,y-2); }
  // bars
  data.forEach((d,i)=>{ const bh=(h-pad)*(d.v/max); const x=i*bw; const y=h-pad/2-bh;
    ctx.fillStyle=color; ctx.globalAlpha=.85; ctx.fillRect(x+1,y,Math.max(1,bw-2),bh); ctx.globalAlpha=1; });
  // x labels
  ctx.fillStyle='#6d6d80'; const step=Math.ceil(data.length/8);
  data.forEach((d,i)=>{ if(i%step===0){ ctx.fillText(d.label,i*bw,h-2);} });
}

function bars(list, total){
  if(!list.length) return '<div class="empty">no data</div>';
  const max=Math.max(1,...list.map(x=>x.v));
  return list.map(x=>{
    const pct=total?Math.round(x.v/total*100):0;
    return '<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:12px">'
      +'<span style="max-width:75%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.k)+'</span>'
      +'<span style="color:var(--mut)">'+x.v+' ('+pct+'%)</span></div>'
      +'<span class="bar" style="width:'+(x.v/max*100)+'%"></span></div>';
  }).join('');
}

function drawTop(list, max){
  if(!list.length) return '<div class="empty">belum ada link</div>';
  const m=Math.max(1,...list.map(x=>x.hits));
  return '<table>'+list.map(x=>
    '<tr><td><a href="#" data-code="'+x.code+'">/'+esc(x.code)+'</a><br><span class="host">'+esc(host(x.url))+'</span></td>'
    +'<td style="text-align:right;width:70px">'+x.hits+'<span class="bar" style="width:'+(x.hits/m*100)+'%"></span></td></tr>'
  ).join('')+'</table>';
}

function drawLinks(){
  const q=$('q').value.toLowerCase(), sort=$('sort').value;
  let l=LINKS.filter(x=>!q||x.code.toLowerCase().includes(q)||x.url.toLowerCase().includes(q));
  l.sort((a,b)=> sort==='hits'? b.hits-a.hits : sort==='created'? b.created-a.created : a.code.localeCompare(b.code));
  $('count').textContent=l.length+' link';
  if(!l.length){ $('links').innerHTML='<tr><td colspan="5" class="empty">tidak ada</td></tr>'; return; }
  const m=Math.max(1,...l.map(x=>x.hits));
  $('links').innerHTML=l.map(x=>
    '<tr><td><a href="#" data-code="'+esc(x.code)+'">/'+esc(x.code)+'</a>'
    +'<span class="bar" style="width:'+(x.hits/m*100)+'%"></span></td>'
    +'<td><span class="host">'+esc(host(x.url))+'</span></td>'
    +'<td>'+x.hits+'</td>'
    +'<td style="color:var(--mut)">'+new Date(x.created).toLocaleDateString()+'</td>'
    +'<td style="text-align:right"><button class="btn" data-del="'+esc(x.code)+'">hapus</button></td></tr>'
  ).join('');
}

async function loadLinks(){
  const d=await api('links');
  LINKS=d.links||[]; drawLinks();
}

async function loadOverview(){
  const d=await api('overview?minutes='+RANGE);
  $('s-links').textContent=fmt(d.totalLinks);
  $('s-hits').textContent=fmt(d.totalHits);
  const s=d.series||[]; const win=s.slice(-60);
  $('s-rate').textContent=fmt(win.reduce((a,b)=>a+b.v,0));
  $('ts-label').textContent=RANGE+' menit terakhir';
  const now=Date.now(); $('s-live').textContent=fmt((d.recent||[]).filter(r=>now-r.t<300000).length);
  drawChart($('chart'), s, '#39ff14');
  $('top').innerHTML=drawTop((d.top||[]).slice(0,8));
  $('live').innerHTML = (d.recent||[]).length
    ? '<table><thead><tr><th>LINK</th><th>WAKTU</th><th>REFERRER</th><th>BROWSER</th></tr></thead><tbody>'
      + d.recent.map(r=>'<tr><td><a href="#" data-code="'+esc(r.slug)+'">/'+esc(r.slug)+'</a></td>'
      +'<td style="color:var(--mut)">'+ago(r.t)+'</td><td class="host">'+esc(r.ref)+'</td><td>'+esc(r.ua)+'</td></tr>').join('')
      +'</tbody></table>'
    : '<div class="empty">belum ada traffic...</div>';
}

async function loadLink(code){
  const d=await api('link/'+code+'?minutes='+RANGE);
  CURRENT=code;
  $('m-title').innerHTML='/'+esc(d.code)+' &nbsp; <span class="tag">'+d.hits+' klik</span>';
  drawChart($('m-chart'), d.series||[], '#4da6ff');
  $('m-refs').innerHTML=bars(d.referrers||[]);
  $('m-uas').innerHTML=bars(d.browsers||[]);
  $('m-ccs').innerHTML=bars(d.countries||[]);
  $('m-live').innerHTML=(d.recent||[]).length
    ? '<table>'+d.recent.map(r=>'<tr><td style="color:var(--mut)">'+ago(r.t)+'</td><td class="host">'+esc(r.ref)+'</td><td>'+esc(r.ua)+'</td></tr>').join('')+'</table>'
    : '<div class="empty">no data</div>';
  $('modal').classList.add('on');
}

// ---- events ----
document.querySelectorAll('.seg button[data-range]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.seg button[data-range]').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); RANGE=+b.dataset.range; refresh();
});
$('refresh').onclick=refresh;
$('q').oninput=drawLinks; $('sort').onchange=drawLinks;
$('modal').onclick=(e)=>{ if(e.target.id==='modal') $('modal').classList.remove('on'); };
$('mx').onclick=()=>$('modal').classList.remove('on');

document.body.addEventListener('click',(e)=>{
  const a=e.target.closest('a[data-code]'); if(a){ e.preventDefault(); loadLink(a.dataset.code); return; }
  const del=e.target.closest('button[data-del]');
  if(del && confirm('Hapus /'+del.dataset.del+'?')){
    fetch('/api/admin/link/'+del.dataset.del+(TOKEN?('?token='+TOKEN):''),{method:'DELETE'}).then(()=>loadLinks());
  }
});

$('n-add').onclick=async()=>{
  const url=$('n-url').value.trim(); if(!url) return;
  const slug=$('n-slug').value.trim();
  const body={url}; if(slug) body.custom=slug;
  const r=await fetch('/api/admin/link'+(TOKEN?('?token='+TOKEN):''),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();
  if(r.ok){ $('n-url').value=''; $('n-slug').value=''; loadLinks(); } else alert(j.error||'gagal');
};

// ---- logout ----
$('logout').onclick=async()=>{
  if(!confirm('Keluar dari dashboard?')) return;
  await fetch('/api/admin/logout',{method:'POST'});
  location.replace('/admin');
};

// ---- ganti password ----
$('pwbtn').onclick=()=>{ $('pw-err').style.display='none'; $('pw-old').value=$('pw-new').value=$('pw-new2').value=''; $('pwmodal').classList.add('on'); };
$('pw-x').onclick=()=>$('pwmodal').classList.remove('on');
$('pwmodal').onclick=(e)=>{ if(e.target.id==='pwmodal') $('pwmodal').classList.remove('on'); };
$('pw-save').onclick=async()=>{
  const err=$('pw-err');
  const oldP=$('pw-old').value, n1=$('pw-new').value, n2=$('pw-new2').value;
  if(n1!==n2){ err.textContent='password baru gak sama'; err.style.display='block'; return; }
  if(n1.length<6){ err.textContent='password baru min 6 karakter'; err.style.display='block'; return; }
  const r=await fetch('/api/admin/password'+(TOKEN?('?token='+TOKEN):''),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({oldPassword:oldP,newPassword:n1})});
  const j=await r.json();
  if(r.ok){ alert('password diganti. login ulang ya.'); location.replace('/admin'); }
  else { err.textContent=j.error||'gagal'; err.style.display='block'; }
};

function refresh(){ loadOverview(); loadLinks(); }
setInterval(loadOverview, 5000);
setInterval(()=>{ $('clock').textContent=new Date().toLocaleTimeString(); }, 1000);
refresh();
</script>
</body>
</html>`;
}

module.exports = { dashboardPage };
