// DOM checks for integrated Soccer visuals (jsdom only). Run: NODE_PATH=/workspace/visual-preview-tests/node_modules node tests/hub_viz.cjs
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');const R=path.join(__dirname,'..');let ok=0,bad=0;
const t=(c,m)=>{c?ok++:(bad++,console.log('FAIL',m))},wait=ms=>new Promise(r=>setTimeout(r,ms));
const fetchStub=u=>{const f=path.join(R,String(u).split('?')[0].replace(/^\.\//,''));return Promise.resolve(fs.existsSync(f)?{ok:true,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))}:{ok:false,json:async()=>null})};
function hub(url){const dom=new JSDOM('<!doctype html><body><div class="w"><header>h</header><div class="lay">main</div><footer>f</footer></div></body>',{url,runScripts:'outside-only'});const w=dom.window;w.fetch=fetchStub;
 w.HUB={leagues:[['all','All'],['eng.1','PL'],['esp.1','L'],['tur.1','T'],['uefa.champions','UCL'],['uefa.europa','UEL']]};w.localStorage.setItem('sl-acct-probe','kept');
 for(const f of['navcfg.js','side.js','soccer-viz.js'])w.eval(fs.readFileSync(path.join(R,f),'utf8'));return w}
(async()=>{const w=hub('https://x.test/index.html#viz-shotmap'),d=w.document,root=()=>d.getElementById('viz-root');await wait(500);
 const nav=[...d.querySelectorAll('.sl-side a')].map(a=>a.getAttribute('href'));t(['./index.html#viz-shotmap','./index.html#viz-xgflow','./index.html#viz-zones'].every(h=>nav.includes(h)),'3 views in hub sidebar');t(!nav.some(h=>/visual-lab/.test(h)),'no standalone sidebar link');
 for(const v of['viz-shotmap','viz-xgflow','viz-zones']){w.location.hash=v;await wait(300);const r=root();
  t(d.body.classList.contains('viz-on')&&!r.hidden,v+' visible in hub');t(d.querySelector('.sl-side a.cur')?.getAttribute('href')==='./index.html#'+v,v+' sidebar active state');t(r.querySelector('.vz-tabs a[aria-current]')?.getAttribute('href')==='#'+v,v+' tab active state');
  t(!d.querySelector('iframe'),v+' no iframe');t(!r.querySelector('.vz-ev circle'),v+' no event dots without feed');t(![...r.querySelectorAll('.vz-na')].some(n=>n.closest('.vz-pitch')),v+' status outside pitch (does not cover chart)');t(!/StatsBomb/.test(r.textContent),v+' no unlicensed data');
  if(v==='viz-shotmap'){t(/team shot map/i.test(r.querySelector('h3').textContent),'team-level header');t(r.querySelectorAll('.vz-kpi>div').length===4,'kpi 2x2');t(r.querySelectorAll('.vz-meter').length<=1&&/Independent model: unavailable/.test(r.textContent),'market baseline only, no model edge');t(!/Hub projection/.test(r.textContent),'no projection-vs-book');
   const b=r.querySelector('button[data-k="side"][aria-pressed="false"]');b.click();await wait(80);t(root().querySelector(`button[data-k="side"][data-v="${b.dataset.v}"]`).getAttribute('aria-pressed')==='true','side toggle');
   root().querySelector('button[data-k="win"][data-v="L5"]').click();await wait(80);t(root().querySelector('.vz-bars').children.length<=5,'window filter L5');
   const s=root().querySelector('select[data-k="game"]');s.value=s.options[1].value;s.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(80);t(root().querySelector('select[data-k="game"]').value===s.options[1].value,'match selector');}
  if(v==='viz-xgflow'){t(r.querySelector('.vz-sb'),'scoreboard');t([...r.querySelectorAll('h3')].some(h=>h.textContent==='Observed goals — not xG'),'goal steps labelled not xG');t(/xG flow: unavailable/.test(r.textContent),'xG flow unavailable state');}
  if(v==='viz-zones'){t(r.querySelectorAll('.vz-two svg').length===2,'side-by-side pitches');t(r.querySelectorAll('.vz-t tr').length===7,'zones table');}}
 w.history.back();await wait(300);t(w.location.hash==='#viz-xgflow'&&root().querySelector('.vz-sb'),'browser back returns to previous view');w.history.forward();await wait(300);t(w.location.hash==='#viz-zones','forward');
 w.location.hash='';await wait(150);t(!d.body.classList.contains('viz-on'),'hub restored on exit');t(w.localStorage.getItem('sl-acct-probe')==='kept','no storage/account reset');
 // old route keeps the supported player ID
 const P=JSON.parse(fs.readFileSync(path.join(R,'data/hub_profiles.json'),'utf8'));const pid=Object.keys(P.players).find(id=>P.players[id].team);
 const old=new JSDOM(fs.readFileSync(path.join(R,'visual-lab.html'),'utf8'),{url:'https://x.test/visual-lab.html?player='+pid+'&evil=<x>',runScripts:'outside-only',virtualConsole:new (require('jsdom').VirtualConsole)()});old.window.eval(fs.readFileSync(path.join(R,'visual-redirect.js'),'utf8'));
 t(old.window.__vizRedirect==='index.html?vzplayer='+pid+'#viz-shotmap','old route -> hub view with player ID only');
 const w2=hub('https://x.test/index.html?vzplayer='+pid+'#viz-shotmap');await wait(500);t(w2.document.getElementById('viz-root').textContent.includes(P.players[pid].player),'player route resolves to club team view');
 const old2=new JSDOM('',{url:'https://x.test/visual-lab.html?player=abc',runScripts:'outside-only',virtualConsole:new (require('jsdom').VirtualConsole)()});old2.window.eval(fs.readFileSync(path.join(R,'visual-redirect.js'),'utf8'));t(old2.window.__vizRedirect==='index.html#viz-shotmap','unsupported ID dropped');
 console.log(`hub_viz: ${ok} passed, ${bad} failed`);process.exit(bad?1:0)})();
