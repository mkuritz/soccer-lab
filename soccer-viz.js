/* Soccer Hub · integrated visuals (Shot Map / Goal & xG Flow / Attack Zones).
   Display-only. Uses recorded hub data: per-match team shot/SOT/goal counts (hub_profiles this_szn),
   recorded goal minutes (data/recaps), recorded book prices and the existing hub projection (calcMatchPoisson).
   Located shot coordinates, per-shot xG, field tilt and zone event data are NOT licensed here and are shown as unavailable. */
(function(){'use strict';
const VIEWS={'viz-shotmap':'Shot Map','viz-xgflow':'xG Flow','viz-zones':'Attack Zones'};
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const F=(v,d=2)=>v==null||!isFinite(v)?'–':(+v).toFixed(d);const P=v=>v==null||!isFinite(v)?'–':(v*100).toFixed(1)+'%';
const SAFE=/^(?:events\/\d{1,12}|hub_profiles|recaps\/index|recaps\/\d{4}-\d{2}-\d{2}|[a-z]{2,4}\.[a-z0-9_.]{1,24})$/;
const J=k=>SAFE.test(k)?fetch(`./data/${k}.json`).then(r=>r.ok?r.json():null).catch(()=>null):Promise.resolve(null);
let PR=null,GAMES=null,RECAPS=null,root=null,PRN='',EV=null;
/* Event-feed integration point (see EVENT_CONTRACT.md). EV stays null until a verified adapter writes data/events/<game_id>.json. */
const evOk=e=>e&&e.schema==='sl-soccer-events/1'&&Array.isArray(e.shots)&&e.source&&e.source.license_ok===true;
function evDots(ab){if(!EV)return'';const sh=EV.shots.filter(x=>x.team===ab&&x.x>=0&&x.x<=105&&x.y>=0&&x.y<=68);return `<svg class="vz-ev" viewBox="-2 -2 109 72" style="position:absolute;inset:0" aria-label="${sh.length} located shots">${sh.map(x=>`<circle cx="${x.x}" cy="${x.y}" r="${(0.8+Math.sqrt(x.xg||0)*3).toFixed(2)}" fill="${x.outcome==='goal'?'#3ee6a8':'none'}" stroke="#3ee6a8" stroke-width=".3"><title>${E(x.minute+"' "+(x.player||'')+' xG '+(x.xg??'–'))}</title></circle>`).join('')}</svg>`}const st={team:'',game:'',win:'L10',side:'home',rgame:'',src:'hub'};
const CSS=`<style id="svcss">body.viz-on .w>*:not(header):not(#viz-root):not(footer):not(#sl-modal-root){display:none!important}
#viz-root{--vb:#121614;--vp:#1a1f1c;--vl:#2a332e;--vm:#3ee6a8;--vt:#e8efe9;--vs:#9aa8a0;color:var(--vt)}
#viz-root .vz-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}#viz-root .vz-tabs a{padding:9px 14px;border-radius:99px;border:1px solid var(--vl);background:var(--vp);color:var(--vs);font-weight:700;text-decoration:none;min-height:40px;box-sizing:border-box}
#viz-root .vz-tabs a[aria-current]{background:var(--vm);color:#06140e;border-color:var(--vm)}#viz-root a:focus-visible,#viz-root select:focus-visible,#viz-root button:focus-visible{outline:2px solid var(--vm);outline-offset:2px}
.vz-ctl{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:12px}.vz-ctl label{display:flex;flex-direction:column;font-size:12px;color:var(--vs);gap:4px}
.vz-ctl select,.vz-seg button{background:var(--vp);color:var(--vt);border:1px solid var(--vl);border-radius:10px;padding:9px 10px;min-height:42px;font:inherit}
.vz-seg{display:inline-flex;gap:0}.vz-seg button{border-radius:0;cursor:pointer}.vz-seg button:first-child{border-radius:10px 0 0 10px}.vz-seg button:last-child{border-radius:0 10px 10px 0}.vz-seg button[aria-pressed=true]{background:var(--vm);color:#06140e}
.vz-lay{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);gap:14px}.vz-card{background:var(--vb);border:1px solid var(--vl);border-radius:14px;padding:14px;margin-bottom:14px;min-width:0}
.vz-card h3{margin:0 0 8px;font-size:15px}.vz-mut{color:var(--vs);font-size:12px}.vz-kpi{display:grid;grid-template-columns:1fr 1fr;gap:8px}.vz-kpi div{background:var(--vp);border-radius:10px;padding:10px}.vz-kpi b{display:block;font-size:24px;color:var(--vm)}
.vz-pitch{position:relative}.vz-pitch svg{width:100%;height:auto;display:block}.vz-na{display:inline-block;margin:0 0 8px;border:1px dashed var(--vl);border-radius:99px;padding:4px 10px;font-size:12px;color:var(--vs)}
.vz-bars{display:flex;align-items:flex-end;gap:4px;height:120px;border-bottom:1px solid var(--vl)}.vz-bars i{flex:1;background:var(--vm);border-radius:4px 4px 0 0;min-height:2px;position:relative}.vz-bars i.l{background:#5b6b62}
.vz-meter{height:14px;border-radius:7px;background:var(--vp);position:relative;margin:6px 0 2px}.vz-meter span{position:absolute;top:0;bottom:0;border-radius:7px}
.vz-t{width:100%;border-collapse:collapse;font-size:13px}.vz-t th,.vz-t td{padding:7px 6px;border-bottom:1px solid var(--vl);text-align:right}.vz-t th:first-child,.vz-t td:first-child{text-align:left}
.vz-sb{display:flex;justify-content:space-between;align-items:center;font-size:20px;font-weight:800}.vz-sb small{display:block;font-size:12px;color:var(--vs);font-weight:500}
.vz-empty{height:120px;border:1px dashed var(--vl);border-radius:10px;background:repeating-linear-gradient(90deg,transparent 0 59px,#1f2823 59px 60px)}
.vz-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:900px){.vz-lay,.vz-two{grid-template-columns:minmax(0,1fr)}.vz-kpi b{font-size:20px}}</style>`;
function pitch(id,label){/* full pitch 105x68, outline only; no event dots */
 const l='#3a4a41';return `<svg viewBox="-2 -2 109 72" role="img" aria-label="${E(label)}"><rect x="-2" y="-2" width="109" height="72" fill="#16201b"/>
 <g fill="none" stroke="${l}" stroke-width=".4"><rect x="0" y="0" width="105" height="68"/><line x1="52.5" y1="0" x2="52.5" y2="68"/><circle cx="52.5" cy="34" r="9.15"/>
 <rect x="0" y="13.84" width="16.5" height="40.32"/><rect x="88.5" y="13.84" width="16.5" height="40.32"/><rect x="0" y="24.84" width="5.5" height="18.32"/><rect x="99.5" y="24.84" width="5.5" height="18.32"/>
 <path d="M16.5 26.7A9.15 9.15 0 0 1 16.5 41.3M88.5 26.7A9.15 9.15 0 0 0 88.5 41.3"/></g><circle cx="11" cy="34" r=".5" fill="${l}"/><circle cx="94" cy="34" r=".5" fill="${l}"/></svg>`}
const NA=t=>`<div class="vz-na" role="status">${E(t)}</div>`;
function logs(ab){const t=PR&&PR.teams[ab];if(!t)return[];const L=(t.this_szn||[]).filter(x=>typeof x.sh==='number'&&typeof x.gf==='number').slice().sort((a,b)=>a.d<b.d?-1:1);
 return st.win==='L5'?L.slice(-5):st.win==='L10'?L.slice(-10):L}
function agg(L){const n=L.length,s=k=>L.reduce((a,x)=>a+(typeof x[k]==='number'?x[k]:0),0);if(!n)return null;
 const sh=s('sh'),g=s('gf');return{n,gf:g/n,ga:s('ga')/n,sh:sh/n,sot:s('sot')/n,conv:sh?g/sh:null,acc:sh?s('sot')/sh:null}}
const imp=o=>typeof o!=='number'||!isFinite(o)||Math.abs(o)<100?null:o>0?100/(o+100):-o/(-o+100);
async function load(){if(PR)return;const lg=(window.HUB&&HUB.leagues||[]).map(l=>l[0]).filter(k=>k!=='all');
 const [pr,idx,...ls]=await Promise.all([J('hub_profiles'),J('recaps/index'),...lg.map(k=>J(k))]);PR=pr||{teams:{}};
 const vp=new URLSearchParams(location.search).get('vzplayer');if(vp&&/^\d{1,10}$/.test(vp)&&PR.players&&Object.hasOwn(PR.players,vp)){const pl=PR.players[vp];PRN=pl.player;st._club=pl.team}
 const now=Date.now()-3*36e5;GAMES=ls.flatMap((d,i)=>((d&&d.games)||[]).map(g=>Object.assign({_lg:lg[i]},g))).filter(g=>g.state==='pre'&&Date.parse(g.date)>=now).sort((a,b)=>a.date<b.date?-1:1);
 const days=((idx&&idx.days)||[]).slice(-5).reverse();const R=await Promise.all(days.map(d=>J('recaps/'+d)));
 RECAPS=R.flatMap(r=>((r&&r.games)||[]).map(g=>Object.assign({_day:r.day},g))).filter(g=>g.status==='FT'||/FT|AET|Pen/i.test(g.status||''))}
const ctlGame=()=>`<label>Match<select data-k="game">${GAMES.map(g=>`<option value="${E(g.id)}"${g.id===st.game?' selected':''}>${E(g.away.abbr+' @ '+g.home.abbr+' · '+(g._lg||''))}</option>`).join('')}</select></label>`;
const seg=(k,opts)=>`<div class="vz-seg" role="group" aria-label="${E(k)}">${opts.map(([v,l])=>`<button type="button" data-k="${k}" data-v="${E(v)}" aria-pressed="${st[k]===v}">${E(l)}</button>`).join('')}</div>`;
function curGame(){if(st._club&&!st.game){const c=GAMES.find(x=>x.home.abbr===st._club||x.away.abbr===st._club);if(c){st.game=c.id;st.side=c.home.abbr===st._club?'home':'away'}}let g=GAMES.find(x=>x.id===st.game);if(!g){g=GAMES.find(x=>PR.teams[x.home.abbr]&&PR.teams[x.away.abbr])||GAMES[0];st.game=g?g.id:''}return g}
function shotmap(){const g=curGame();if(!g)return '<div class="vz-card">No upcoming recorded fixtures in the current hub snapshot.</div>';
 const ab=st.side==='home'?g.home.abbr:g.away.abbr,opp=st.side==='home'?g.away.abbr:g.home.abbr,L=logs(ab),A=agg(L);
  const bk=[imp(g.mla),imp(g.mld),imp(g.mlh)],vs=bk.every(x=>x!=null)?bk.reduce((a,b)=>a+b,0):null,book=vs?(st.side==='home'?bk[2]:bk[0])/vs:null;
 const mx=Math.max(1,...L.map(x=>x.sh));
 return `<div class="vz-ctl">${ctlGame()}${seg('side',[['away',g.away.abbr],['home',g.home.abbr]])}${seg('win',[['L5','Last 5'],['L10','Last 10'],['S','Season']])}</div>
 <div class="vz-lay"><div><div class="vz-card"><h3>${E(PRN?PRN+' → ':'')}${E(ab)} team shot map · next: vs ${E(opp)}</h3>${EV?'':NA('Shot locations: no event feed connected. Pitch left empty.')}<div class="vz-pitch">${pitch('sm','Pitch for '+ab+' team shot locations')}${evDots(ab)}</div><div class="vz-mut">Team-level view. ${PRN?'Opened from a player link; the stats shown are for the club, not the player.':''}</div></div>
 <div class="vz-card"><h3>Team shots per match · ${E(ab)} (${A?A.n:0} recorded)</h3>${L.length?`<div class="vz-bars" role="img" aria-label="Shots per match">${L.map(x=>`<i class="${x.gf>0?'':'l'}" style="height:${(x.sh/mx*100).toFixed(0)}%" title="${E(x.d+' '+x.at+' '+x.opp+': '+x.sh+' shots, '+x.sot+' on target, '+x.gf+' goals')}"></i>`).join('')}</div><div class="vz-mut">Mint = scored, grey = blank. Hover/tap a bar for date, opponent, shots, SOT, goals. Shot distance: unavailable (needs located events).</div>`:'<div class="vz-mut">No recorded matches with shot counts.</div>'}</div></div>
 <div><div class="vz-card"><h3>Team attacking output · ${E(st.win==='S'?'Season':st.win)}</h3>${A?`<div class="vz-kpi"><div>Goals / match<b>${F(A.gf)}</b></div><div>Shots / match<b>${F(A.sh,1)}</b></div><div>On target / match<b>${F(A.sot,1)}</b></div><div>Goals per shot<b>${P(A.conv)}</b></div></div><div class="vz-mut" style="margin-top:6px">Recorded match totals. Not xG: the hub's shot-weight heuristic is not presented as expected goals.</div>`:'<div class="vz-mut">No team profile for '+E(ab)+'.</div>'}</div>
 <div class="vz-card"><h3>Market baseline · ${E(ab)} to win (90 min)</h3>${book!=null?`<div class="vz-meter" role="img" aria-label="Market no-vig win probability ${P(book)}"><span style="left:0;width:${(book*100).toFixed(1)}%;background:#8aa397"></span></div><b>${P(book)}</b><div class="vz-mut">No-vig from recorded ${E(g.odds_src||'')} prices ${E(g.mlh+' / '+g.mld+' / '+g.mla)} (home/draw/away).</div>`:'<div class="vz-mut">No recorded price for this match.</div>'}
 <div class="vz-mut" style="margin-top:8px">Independent model: unavailable. The hub's match projection is derived from these same prices, so it isn't shown as a separate model or edge.</div></div></div></div></div>`}
const minOf=m=>{const a=String(m||'').match(/(\d+)(?:'?\s*\+\s*(\d+))?/);return a?Math.min(+a[1]+(a[2]?+a[2]/10:0),125):null};
function flow(){if(!RECAPS.length)return '<div class="vz-card">No completed recorded matches in the last recap days.</div>';
 let g=RECAPS.find(x=>x.id===st.rgame)||RECAPS.find(x=>(x.goals||[]).length)||RECAPS[0];st.rgame=g.id;
 const gl=(g.goals||[]).map(x=>({m:minOf(x.min),h:x.team===g.home.name,p:x.player,og:x.og,raw:x.min})).filter(x=>x.m!=null).sort((a,b)=>a.m-b.m);
 const W=600,H=200,X=m=>20+m/95*(W-40),top=Math.max(1,g.home.score,g.away.score),Y=v=>H-20-v/top*(H-40);
 const step=h=>{let c=0,d=`M${X(0)} ${Y(0)}`;gl.filter(x=>x.h===h).forEach(x=>{d+=`H${X(x.m)}V${Y(++c)}`});return d+`H${X(95)}`};
 return `<div class="vz-ctl"><label>Completed match<select data-k="rgame">${RECAPS.map(x=>`<option value="${E(x.id)}"${x.id===g.id?' selected':''}>${E(x._day+' · '+x.away.abbr+' '+x.away.score+'–'+x.home.score+' '+x.home.abbr)}</option>`).join('')}</select></label></div>
 <div class="vz-lay"><div><div class="vz-card"><div class="vz-sb"><span>${E(g.away.name)}<small>Away</small></span><span>${E(g.away.score)} – ${E(g.home.score)}<small>${E(g.status)} · ${E(g.lg)}</small></span><span style="text-align:right">${E(g.home.name)}<small>Home</small></span></div></div>
 <div class="vz-card"><h3>xG flow</h3>${EV?'':NA('xG flow: unavailable. Needs per-shot xG from an event feed.')}<div class="vz-empty" aria-hidden="true"></div></div><div class="vz-card"><h3>Observed goals — not xG</h3><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative goals by minute"><g stroke="#2a332e">${[0,15,30,45,60,75,90].map(m=>`<line x1="${X(m)}" x2="${X(m)}" y1="10" y2="${H-20}"/><text x="${X(m)}" y="${H-5}" fill="#9aa8a0" font-size="10" text-anchor="middle">${m}'</text>`).join('')}</g>
 <path d="${step(false)}" fill="none" stroke="#8aa397" stroke-width="2.5"/><path d="${step(true)}" fill="none" stroke="#3ee6a8" stroke-width="2.5"/>
 ${gl.map(x=>`<circle cx="${X(x.m)}" cy="${Y(gl.filter(y=>y.h===x.h&&y.m<=x.m).length)}" r="5" fill="${x.h?'#3ee6a8':'#8aa397'}"><title>${E(x.raw+' '+x.p+(x.og?' (own goal)':''))}</title></circle>`).join('')}</svg>
 <div class="vz-mut">Mint = ${E(g.home.abbr)}, grey = ${E(g.away.abbr)}. Steps are recorded goals by minute from the match recap. This is a separate chart, not a stand-in for xG.</div></div></div>
 <div><div class="vz-card"><h3>Goals</h3>${gl.length?`<table class="vz-t"><tr><th>Scorer</th><th>Team</th><th>Min</th></tr>${gl.map(x=>`<tr><td>${E(x.p)}${x.og?' (OG)':''}</td><td>${E(x.h?g.home.abbr:g.away.abbr)}</td><td>${E(x.raw)}</td></tr>`).join('')}</table>`:'<div class="vz-mut">No goals recorded.</div>'}</div>
 <div class="vz-card"><h3>Field tilt</h3><div class="vz-mut">Unavailable. It needs final-third pass/touch events that are not in the hub's licensed data.</div></div>
 <div class="vz-card"><h3>Largest chances</h3><div class="vz-mut">Unavailable. Ranking chances needs per-shot xG, which the hub does not have.</div></div></div></div>`}
function zones(){const g=curGame();if(!g)return '<div class="vz-card">No upcoming recorded fixtures.</div>';const h=g.home.abbr,a=g.away.abbr;
 const T=(ab,side)=>{const t=PR.teams[ab];return agg(((t&&t.this_szn)||[]).filter(x=>typeof x.sh==='number'&&(side==null||x.at===side)))};
 const rows=[['Goals for / match','gf',2],['Goals against / match','ga',2],['Shots / match','sh',1],['On target / match','sot',1],['Goals per shot','conv',-1],['On-target rate','acc',-1]];
 const ah=T(h),aa=T(a),hh=T(h,'vs'),aw=T(a,'@');const c=(o,k,d)=>!o?'–':d<0?P(o[k]):F(o[k],d);
 return `<div class="vz-ctl">${ctlGame()}</div><div class="vz-two"><div class="vz-card"><h3>${E(a)} chance creation</h3>${NA('Zones: unavailable without located events.')}<div class="vz-pitch">${pitch('zc','Creation zones')}</div></div>
 <div class="vz-card"><h3>${E(h)} chances conceded</h3>${NA('Zones: unavailable without located events.')}<div class="vz-pitch">${pitch('zd','Concession zones')}</div></div></div>
 <div class="vz-card"><h3>Recorded attack vs defence (season)</h3><div style="overflow-x:auto"><table class="vz-t"><tr><th>Metric</th><th>${E(a)} all</th><th>${E(a)} away</th><th>${E(h)} all</th><th>${E(h)} home</th></tr>
 ${rows.map(([l,k,d])=>`<tr><td>${l}</td><td>${c(aa,k,d)}</td><td>${c(aw,k,d)}</td><td>${c(ah,k,d)}</td><td>${c(hh,k,d)}</td></tr>`).join('')}</table></div>
 <div class="vz-mut">Matches: ${aa?aa.n:0} (${E(a)}), ${ah?ah.n:0} (${E(h)}). Shots against are not recorded per match, so concession uses goals against only. Higher attack and higher goals against are both worse for the defending side.</div></div>`}
/* All dynamic values are escaped with E(); markup is parsed inertly (scripts never run) and swapped in. */
function paint(html){const doc=new DOMParser().parseFromString('<body>'+html+'</body>','text/html');doc.querySelectorAll('script,iframe,object,embed').forEach(n=>n.remove());root.replaceChildren(...doc.body.childNodes)}
async function show(){const v=location.hash.slice(1);const on=Object.hasOwn(VIEWS,v);document.body.classList.toggle('viz-on',on);if(!root)return;root.hidden=!on;if(!on)return;
 root.innerHTML='<div class="vz-card">Loading recorded data…</div>';try{await load()}catch(e){}
 const g0=v==='viz-xgflow'?null:curGame();EV=null;if(g0&&/^\d{1,12}$/.test(String(g0.id))){const e=await J('events/'+g0.id);EV=evOk(e)?e:null}
 const RS=window.SL_RESEARCH_EVENTS&&window.SoccerVizResearch?window.SoccerVizResearch:null;if(!RS)st.src='hub';
 const srcSeg=RS?`<div class="vz-ctl">${seg('src',[['hub','Current hub data'],['res','Historical research sample (local only)']])}</div>`:'';
 const body=srcSeg+(RS&&st.src==='res'?RS.render(v,st,{pitch,E,NA,seg,F,P}):v==='viz-shotmap'?shotmap():v==='viz-xgflow'?flow():zones());
 paint(`<nav class="vz-tabs" aria-label="Soccer visuals">${Object.entries(VIEWS).map(([k,l])=>`<a href="#${k}"${k===v?' aria-current="page"':''}>${l}</a>`).join('')}</nav>${body}<div class="vz-mut">Recorded snapshots (hub data ${E(PR&&PR.updated||'')} UTC), not live prices. Informational only.</div>`)}
function init(){if(!document.getElementById('svcss'))document.head.insertAdjacentHTML('beforeend',CSS);const hd=document.querySelector('.w>header');root=document.createElement('section');root.id='viz-root';root.hidden=true;root.setAttribute('aria-live','polite');(hd?hd.after(root):document.body.prepend(root));
 root.addEventListener('change',e=>{const k=e.target.dataset.k;if(k){st[k]=e.target.value;show().then(()=>{const n=root.querySelector(`select[data-k="${k}"]`);n&&n.focus()})}});
 root.addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(b){st[b.dataset.k]=b.dataset.v;show().then(()=>{const n=root.querySelector(`button[data-k="${b.dataset.k}"][data-v="${b.dataset.v}"]`);n&&n.focus()})}});
 addEventListener('hashchange',show);show()}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
window.SoccerViz={show,_st:st};
})();
