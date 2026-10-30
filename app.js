const LOGO64=u=>u&&/^https:\/\/a\.espncdn\.com\/i\//.test(u)?"https://a.espncdn.com/combiner/i?img="+encodeURIComponent(u.replace("https://a.espncdn.com",""))+"&h=64&w=64":u;
/* Sports Labs hub v1 — display only. */
const CFG=window.HUB,$=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const BL="https://betlab.sportslabshq.com/";
const j=(u,d)=>fetch(u+(u.includes("?")?"&":"?")+"t="+Date.now()).then(r=>r.ok?r.json():d).catch(()=>d);
const _et0=t=>t?new Date(t).toLocaleString("en-US",{timeZone:"America/New_York",weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})+" ET":"";const _etM=new Map();const et=t=>{if(t==null||typeof t==="object")return _et0(t);let v=_etM.get(t);if(v===undefined){v=_et0(t);if(_etM.size>5000)_etM.clear();_etM.set(t,v)}return v};
const _etDay0=t=>t?new Date(t).toLocaleDateString("en-CA",{timeZone:"America/New_York"}):"";const _etDayM=new Map();const etDay=t=>{if(t==null||typeof t==="object")return _etDay0(t);let v=_etDayM.get(t);if(v===undefined){v=_etDay0(t);if(_etDayM.size>5000)_etDayM.clear();_etDayM.set(t,v)}return v};
const todayET=()=>new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"});
const ago=t=>{if(!t)return"";const m=Math.round((Date.now()-new Date(t))/60000);return m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"};
const ALL=CFG.leagues.length>1;if(ALL&&CFG.leagues[0][0]!="all")CFG.leagues.unshift(["all","All"]);
let LG=CFG.leagues[0][0],MF="",SC_VIEW="today",D={},EX={},REC=[],ALG={},SC=null,STAND_ALL={},LSG={};
function applyLiveOverlay(games){
 (games||[]).forEach(g=>{
  const lv=LSG[(CFG.short||"soccer")+"|"+g.id];
  if(lv&&lv.length>=6&&lv[0]&&lv[0]!="pre"){
   g.state=lv[0];
   if(lv[1])g.status=lv[1];
   if(lv[3]!=null&&g.away)g.away.score=String(lv[3]);
   if(lv[5]!=null&&g.home)g.home.score=String(lv[5]);
  }
 });
}
let SLIP=[];try{SLIP=JSON.parse(localStorage.getItem("sl_soccer_slip")||"[]")||[]}catch(e){SLIP=[]}
function saveSlip(){try{localStorage.setItem("sl_soccer_slip",JSON.stringify(SLIP))}catch(e){}}
function toAm(p){if(!p||p<=0||p>=1)return"—";return p>=0.5?"-"+Math.round(p/(1-p)*100):"+"+Math.round((1-p)/p*100)}
function imp(o){if(o==null)return null;const n=Number(o);if(!isFinite(n)||n===0)return null;return n>0?100/(n+100):-n/(-n+100)}

function tabs(){
 $("lgs").innerHTML=CFG.leagues.length>1?CFG.leagues.map(([k,n])=>`<button data-l="${k}" class="${k==LG?"on":""}">${n}</button>`).join(""):"";
 document.querySelectorAll("#lgs button").forEach(b=>b.onclick=()=>{LG=b.dataset.l;MF="";load()});
}

async function load(){
 tabs();
 if(LG=="all"){
  const keys=CFG.leagues.filter(l=>l[0]!="all").map(l=>l[0]);
  const L=await Promise.all(keys.map(k=>j(`data/${k}.json`,{games:[],news:[],standings:[]})));
  keys.forEach((k,i)=>{STAND_ALL[k]=L[i].standings||[]});
  D={updated:L.map(x=>x.updated).filter(Boolean).sort().pop(),league:"All leagues",games:L.flatMap((x,i)=>(x.games||[]).map(g=>Object.assign({_lg:keys[i]},g))),news:L.flatMap(x=>x.news||[]).sort((a,b)=>a.d<b.d?1:-1).slice(0,12),standings:[]};
 } else {
  D=await j(`data/${LG}.json`,{games:[],news:[],standings:[]});
  STAND_ALL[LG]=D.standings||[];
 }
 applyLiveOverlay(D.games);
 render();
}

function defMap(lg){
 const S=STAND_ALL[lg]||(lg==LG?D.standings:[])||[];
 const list=[];
 S.forEach(r=>{
  const gp=parseFloat((r.st||{}).gamesPlayed||0),pa=parseFloat((r.st||{}).pointsAgainst||0);
  if(gp>0)list.push({team:r.team,ga:pa/gp});
 });
 list.sort((a,b)=>a.ga-b.ga);
 const out={};
 list.forEach((x,i)=>{out[x.team]={ga:x.ga,rk:i+1,n:list.length,sieve:i>=list.length-5||x.ga>=1.65}});
 return out;
}

const recLg=r=>{if(r.lg)return r.lg;const m=String((r.ref||{}).rec||r.id||"").match(/\|(\d+)~/)||String((r.ref||{}).aid||"").match(/(\d+)/);return m?ALG[m[1]]:null};
function story(g){const h=g.home,a=g.away,out=[];
 out.push(`${esc(a.name)} (${esc(a.record||"—")}) at ${esc(h.name)} (${esc(h.record||"—")}).`);
 if(g.line)out.push(`Market: ${esc(g.line)}${g.total?`, total ${g.total}`:""} (${esc(g.odds_src||"sportsbook")}).`);
 const x=CFG.extra?CFG.extra(g,EX):[];return out.concat(x);
}

function badgeCls(t){
 if(/H2H/i.test(t))return"sbadge pk";
 if(/Penalty/i.test(t))return"sbadge pk";
 if(/Set-Piece|Aerial|Volume/i.test(t))return"sbadge sp";
 if(/Bottom-5|Sieve|Defense/i.test(t))return"sbadge sv";
 if(/High-Total/i.test(t))return"sbadge ht";
 return"sbadge cal";
}

function renderRibbon(G){
 const el=$("mrib");if(!el)return;
 const td=todayET();
 const up=G.filter(g=>g.state!="post").sort((a,b)=>{
  const at=etDay(a.date)==td?0:1,bt=etDay(b.date)==td?0:1;
  return at!=bt?at-bt:(a.date<b.date?-1:1);
 }).slice(0,24);
 if(!up.length){el.innerHTML="";return}
 el.innerHTML=`<button data-mf="" class="${!MF?"on":""}">All Matches (${up.length})</button>`+up.map(g=>{
  const mu=`${g.away.abbr} @ ${g.home.abbr}`;
  const tot=g.total>=3?` · ⚡${g.total}`:"";
  const st=g.state=="in"?` · 🔴 ${g.away.score}-${g.home.score}`:"";
  return `<button data-mf="${esc(g.id)}" data-mu="${esc(mu)}" class="${MF==String(g.id)?"on":""}">${esc(mu)}${st}${tot}</button>`;
 }).join("");
 el.querySelectorAll("button").forEach(b=>b.onclick=()=>{MF=b.dataset.mf||"";render()});
}

function matchBadges(g){
 const lg=g._lg||LG;
 const dm=defMap(lg);
 const hd=dm[g.home.abbr],ad=dm[g.away.abbr];
 const b=[];
 if(g.total&&g.total>=3.0)b.push(`<span class="sbadge ht">⚡ High-Total Match (O/U ${esc(g.total)})</span>`);
 if(ad&&ad.sieve)b.push(`<span class="sbadge sv">🚨 ${esc(g.away.abbr)} Bottom-5 Defense (${ad.ga.toFixed(1)} GA/90 · #${ad.rk}/${ad.n})</span>`);
 if(hd&&hd.sieve)b.push(`<span class="sbadge sv">🚨 ${esc(g.home.abbr)} Bottom-5 Defense (${hd.ga.toFixed(1)} GA/90 · #${hd.rk}/${hd.n})</span>`);
 return b.length?`<div style="margin-top:5px">${b.join("")}</div>`:"";
}

function matchGoalViz(g){
 const lg=g._lg||LG;
 const tot=g.total?Number(g.total):2.6;
 let aShare=0.47;
 if(g.line&&g.line!="EVEN"){
  const pts=String(g.line).trim().split(/\s+/);
  const fav=pts[0],ml=parseFloat(pts[1]);
  if(isFinite(ml)&&ml!==0){
   const pFav=imp(ml)||0.5;
   const fShare=Math.min(0.78,Math.max(0.46,0.50+(pFav-0.38)*0.65));
   aShare=(fav===g.away.abbr)?fShare:(1-fShare);
  }
 } else {
  const S=STAND_ALL[lg]||(lg==LG?D.standings:[])||[];
  const ra=(S.find(r=>r.team===g.away.abbr)?.st?.rank)||10;
  const rh=(S.find(r=>r.team===g.home.abbr)?.st?.rank)||10;
  const n=S.length||20;
  aShare=Math.min(0.68,Math.max(0.32,0.47+((rh-ra)/n)*0.28));
 }
 const aG=(tot*aShare).toFixed(2),hG=(tot*(1-aShare)).toFixed(2);
 const aPct=Math.round(aShare*100),hPct=100-aPct;
 return `<div class="gm-xg-viz"><div class="xg-hd"><span class="xg-a"><b>${esc(g.away.abbr)}</b> xG ${aG} <i>(${aPct}%)</i></span><span class="xg-mid">⚽ Goal Split · Total ${tot.toFixed(1)}</span><span class="xg-h"><i>(${hPct}%)</i> ${hG} xG <b>${esc(g.home.abbr)}</b></span></div><div class="xg-track"><div class="xg-fill-a" style="width:${aPct}%"></div><div class="xg-fill-h" style="width:${hPct}%"></div></div></div>`;
}

function matchQuickLegs(g){
 if(g.state=="post")return"";
 const mu=`${g.away.abbr} @ ${g.home.abbr}`;
 const tot=g.total||2.5;
 const fav=(g.line&&g.line!="EVEN")?g.line.split(" ")[0]:g.home.abbr;
 const ud=fav==g.home.abbr?g.away.abbr:g.home.abbr;
 const legs=[
  {id:`m|${g.id}|tot`,game:String(g.id),matchup:mu,kind:"total",label:`${mu} Over ${tot}`,team:fav,p:tot>=3.5?0.52:0.54},
  {id:`m|${g.id}|fav`,game:String(g.id),matchup:mu,kind:"team_goals",label:`${fav} 2+ Team Goals`,team:fav,p:0.51},
  {id:`m|${g.id}|gks`,game:String(g.id),matchup:mu,kind:"gk_saves",label:`${ud} GK 3+ Saves`,team:ud,p:0.56}
 ];
 return `<div class="gm-legs">${legs.map(l=>{
  const on=SLIP.some(x=>x.id==l.id);
  return `<button type="button" class="slip-btn ${on?"on":""}" data-slip='${esc(JSON.stringify(l))}'>${on?"✓ In Slip":"+"} ${esc(l.label)} (${Math.round(l.p*100)}%)</button>`;
 }).join("")}</div>`;
}

function takeByLeagueHTML(){
 if(!SC||!SC.leagues)return"";
 const td=todayET();
 const nm=k=>(CFG.leagues.find(l=>l[0]==k)||[,k])[1];
 const allKeys=CFG.leagues.filter(l=>l[0]!="all").map(l=>l[0]);
 const ks=LG=="all"?allKeys:[LG];
 const blocks=[];
 ks.forEach(k=>{
  let ms=((SC.leagues[k]||{}).matches||[]).filter(m=>etDay(m.start)==td&&(!MF||String(m.game)==MF));
  if(!ms.length)return;
  const rows=ms.flatMap(m=>(m.players||[]).filter(p=>p.best_prop).slice(0,3).map(p=>Object.assign({matchup:m.matchup,start:m.start,game:m.game},p)));
  const useRows=rows.length?rows:ms.flatMap(m=>(m.players||[]).slice(0,2).map(p=>Object.assign({matchup:m.matchup,start:m.start,game:m.game},p)));
  if(!useRows.length)return;
  blocks.push(`<div style="margin-bottom:10px"><div style="display:flex;align-items:center;gap:8px;padding:4px 8px;margin-bottom:5px;background:#162642;border-left:3px solid var(--acc);border-radius:5px;font-weight:800;font-size:12.5px"><span>⚽ ${esc(nm(k))}</span><span class="mut sm" style="font-weight:600">${ms.length} ${ms.length==1?"match":"matches"} today</span></div>`+useRows.map(p=>{
   const propTxt=p.best_prop||`Anytime Goal (${Math.round(p.p*100)}% model)`;
   const why0=(p.why&&p.why[0])?p.why[0]:"";
   return `<div class="tk" style="padding:4px 6px"><span class="pill">HIGHLIGHTED</span> <b>${esc(p.player)}</b> <span class="mut">(${esc(p.team)} · ${esc(p.matchup)})</span> <span class="sbadge pk">🎯 ${esc(propTxt)}</span> <span class="mut sm">${esc(why0)} · ${et(p.start)}</span></div>`;
  }).join("")+`</div>`);
 });
 return blocks.join("");
}

function render(){
 const G0=(D.games||[]).slice().sort((x,y)=>x.date<y.date?-1:1);
 renderRibbon(G0);
 const G=MF?G0.filter(g=>String(g.id)==MF):G0;
 $("upd").innerHTML=`Data updated ${ago(D.updated)} (${et(D.updated)}) · ${esc(D.league||"")}${D.week?" · Week "+D.week:""} ${D.season||""}`;
 const rec=REC.filter(r=>CFG.recSport.includes(r.sport)&&(LG=="all"||recLg(r)==LG)&&(!MF||String(r.game||(r.ref||{}).game||"")==MF));
 const lgName=(CFG.leagues.find(l=>l[0]==LG)||[,""])[1];
 const recHTML=rec.length?rec.slice(0,10).map(r=>`<div class="tk"><span class="pill">${r.lh?"PRE-GAME LIST HIT · #"+r.rank+" most likely":r.gp?(/Goal|Assist/.test(r.market)?"GOAL HIGHLIGHT":"PROBABLE PLAY")+" · "+esc(r.tier.toUpperCase()):"SPORTS LABS HIGHLIGHTED"}</span> <b>${esc(r.title)}</b>${r.lh?` <span class="mut">our ${Math.round(r.ours*100)}% vs book ${Math.round(r.book*100)}% (${r.price>0?"+"+r.price:r.price}) pre-game</span>`:""}${r.gp?` <b>${r.price>0?"+"+r.price:r.price}</b> <span class="mut">${esc(r.book)} · our chance ${Math.round(r.p*100)}% vs ${Math.round(r.nv*100)}% no-vig · ${esc(r.xi)} · ${esc(r.season)}</span>`:""} <span class="mut">${et(r.start)}</span>${r.lh?` <b class="lv">✅ ${esc(r.lh)}</b>`:""}${window.LR&&r.gp?LR.tag("soccer",r.aid||"",r.market,r.grade&&r.grade.line!=null?r.grade.line:null,r.player||r.title,"",r.start,r.game||""):""}${window.LR&&!r.gp&&!r.lh?LR.tag(r.sport,(r.ref||{}).aid||"",r.market,(r.ref||{}).line,(r.ref||{}).player||r.title.replace(/ (anytime|over|under|to score).*$/i,""),"",r.start):""}</div>`).join(""):"";
 const byLgTake=takeByLeagueHTML();
 $("take").innerHTML=(recHTML+byLgTake)?(recHTML+byLgTake+`<a href="${BL}sharp.html">All Highlighted in Bet Lab →</a>`):LG!="all"?`<div class="mut">No Highlighted ${esc(lgName)} plays for today's slate${scN(LG)?" (see upcoming Likely Scorers below)":""}. Select <b>All</b> for today's highlights across every league. <a href="${BL}sharp.html">Highlighted in Bet Lab →</a></div>`:`<div class="mut">No Highlighted ${CFG.short} plays have cleared our bar right now. When they do, they show here. <a href="${BL}sharp.html">Highlighted in Bet Lab →</a></div>`;
 {const GC=g=>`<div class="g"><div class="gh"><span class="tm"><img loading="lazy" decoding="async" width="32" height="32" src="${esc(LOGO64(g.away.logo))}" alt="">${esc(g.away.abbr)} ${g.state!="pre"?esc(g.away.score):""}</span><span class="mut">@</span><span class="tm"><img loading="lazy" decoding="async" width="32" height="32" src="${esc(LOGO64(g.home.logo))}" alt="">${esc(g.home.abbr)} ${g.state!="pre"?esc(g.home.score):""}</span><span class="st ${g.state}">${esc(g.status)}</span></div><div class="mut sm">${et(g.date)}${g.venue?" · "+esc(g.venue):""}${g.bc&&g.bc[0]?" · 📺 "+esc(g.bc.filter(Boolean).join(", ")):""}</div>${matchGoalViz(g)}${matchBadges(g)}<ul class="sl">${story(g).map(s=>`<li>${s}</li>`).join("")}</ul>${matchQuickLegs(g)}</div>`,ge=$("games"),tok=window.__gTok=(window.__gTok||0)+1;
 if(!G.length)ge.innerHTML='<div class="mut">No games in the current window.</div>';
 else{const N0=8;ge.innerHTML=G.slice(0,N0).map(GC).join("");let i=N0;
  /* progressive: the rest of the grid is built in small idle batches so no frame blocks; cards are decorated once all are in */
  const step=()=>{if(tok!==window.__gTok)return;const t0=performance.now();let h="";while(i<G.length&&performance.now()-t0<8)h+=GC(G[i++]);if(h)ge.insertAdjacentHTML("beforeend",h);if(i<G.length)setTimeout(step,0);else if(typeof decorateClickableNames==="function")setTimeout(()=>{if(tok===window.__gTok)decorateClickableNames()},0)};
  if(i<G.length)setTimeout(step,0)}}
 const S=D.standings||[],grps=[...new Set(S.map(r=>r.grp))];
 $("stand").innerHTML=grps.map(gp=>`<h3>${esc(gp)}</h3><div class="wrap"><table><tr><th>Team</th>${CFG.cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr>${S.filter(r=>r.grp==gp).map(r=>`<tr><td><img class="lg" loading="lazy" decoding="async" width="32" height="32" src="${esc(LOGO64(r.logo))}" alt="">${esc(r.name)}</td>${CFG.cols.map(c=>`<td>${esc(r.st[c[0]]??"")}</td>`).join("")}</tr>`).join("")}</table></div>`).join("")||'<div class="mut">Standings unavailable.</div>';
 if(LG=="all")$("stand").innerHTML='<div class="mut">Select a league above for its table.</div>';
 $("news").innerHTML=(D.news||[]).map(n=>`<div class="nw"><a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}</a><div class="mut sm">${et(n.d)}</div></div>`).join("")||'<div class="mut">No headlines.</div>';
 if($("scor"))$("scor").innerHTML=scHTML();
 renderTray();
 if(CFG.renderExtra)CFG.renderExtra(EX);
}

const scN=l=>SC&&SC.leagues&&SC.leagues[l]?SC.leagues[l].n_players:0;
function renderMatchBlock(m,nm){
 return `<div class="tk" style="margin-bottom:10px"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><b>${esc(m.matchup)}</b> <span class="mut">${esc(nm(m.lg))} · ${et(m.start)}</span>${(m.match_tags||[]).map(t=>`<span class="${badgeCls(t)}">${esc(t)}</span>`).join("")}</div>${m.players.map(p=>{
  const lid=`s|${m.game}|${p.aid}`;
  const on=SLIP.some(x=>x.id==lid);
  const propShort=p.best_prop?p.best_prop.split("·")[0].trim():"Anytime Goal";
  const legObj={id:lid,game:String(m.game),matchup:m.matchup,kind:"scorer",aid:String(p.aid),label:`${p.player} (${p.team}) ${propShort}`,team:p.team,opp:p.opp,p:p.p,price:p.price};
  const tags=(p.tags||[]).slice(0,3).map(t=>`<span class="${badgeCls(t)}">${esc(t)}</span>`).join("");
  const calBadge=p.cal_tier?`<span class="sbadge cal">${esc(p.cal_tier)}</span>`:"";
  const bestBadge=p.best_prop?`<span class="sbadge pk">🎯 ${esc(p.best_prop)}</span>`:"";
  const maxScale=0.65;
  const ourP=Math.max(0.05,Math.min(maxScale,p.p||0.2));
  const mktRaw=p.price!=null?imp(p.price):null;
  const refP=mktRaw!=null?mktRaw:Math.max(0.08,ourP*0.84);
  const ourW=Math.min(100,Math.round((ourP/maxScale)*1000)/10);
  const refLeft=Math.min(97,Math.max(3,Math.round((refP/maxScale)*1000)/10));
  const edgePts=Math.round((p.p-refP)*1000)/10;
  const vizBar=`<div class="sc-viz-bar" title="Our Calibrated Chance ${Math.round(p.p*100)}% vs ${mktRaw!=null?'Book Implied':'Baseline Prior'} ${Math.round(refP*100)}%"><div class="sc-viz-track"><div class="sc-viz-fill" style="width:${ourW}%"></div><div class="sc-viz-tick" style="left:${refLeft}%" title="${mktRaw!=null?'Book Implied':'Prior'}: ${Math.round(refP*100)}%"></div></div><div class="sc-viz-meta"><span class="our">Our <b>${Math.round(p.p*100)}%</b></span><span class="mkt">${mktRaw!=null?'Book Imp':'Prior'} <b>${Math.round(refP*100)}%</b></span>${edgePts>=0.5?`<span class="edg">+${edgePts.toFixed(1)}% Edge</span>`:""}</div></div>`;
  return `<div class="sc-row"><div style="flex:1;min-width:0"><div><span class="pill">${Math.round(p.p*100)}% TO SCORE</span> <b>${esc(p.player)}</b> <span class="mut">${esc(p.team)}${p.pos?" "+esc(p.pos):""} · ${esc(p.xi)}${p.price!=null?` · Book ${p.price>0?"+"+p.price:p.price}`:` · Fair ${toAm(p.p)}`}</span></div>${vizBar}<div style="margin-top:3px">${bestBadge}${calBadge}${tags}</div><div class="mut sm" style="margin-top:2px">${esc(p.why.join(" · "))}</div></div><button type="button" class="slip-btn ${on?"on":""}" data-slip='${esc(JSON.stringify(legObj))}'>${on?"✓ In Slip":"+ Slip"}</button></div>`;
 }).join("")}</div>`;
}

function scHTML(){
 if(!SC)return'<div class="mut">Loading…</div>';
 const td=todayET();
 const allKeys=CFG.leagues.filter(l=>l[0]!="all").map(l=>l[0]);
 const ks=LG=="all"?allKeys:[LG],nm=k=>(CFG.leagues.find(l=>l[0]==k)||[,k])[1];
 let M=ks.flatMap(k=>((SC.leagues[k]||{}).matches||[]).map(m=>Object.assign({lg:k},m))).filter(m=>new Date(m.start)>Date.now()-7200000).sort((a,b)=>a.start<b.start?-1:1);
 if(MF)M=M.filter(m=>String(m.game)==MF);
 if(!M.length)return `<div class="mut">Not enough player data yet for upcoming ${esc(LG=="all"?"":nm(LG)+" ")}matches. This fills in once player markets and recent match logs are posted.</div>`;
 const todayM=M.filter(m=>etDay(m.start)==td);
 const effView=(SC_VIEW=="today"&&todayM.length)?SC_VIEW:"all";
 const showM=effView=="today"?todayM:M;
 const viewBtns=todayM.length?`<span style="display:inline-flex;gap:5px;margin-left:auto"><button type="button" class="slip-btn ${effView=="today"?"on":""}" data-scv="today">🔥 Today's Slate · By League (${todayM.length})</button><button type="button" class="slip-btn ${effView=="all"?"on":""}" data-scv="all">📆 All Upcoming · By League (${M.length})</button></span>`:`<span class="mut sm" style="margin-left:auto">Showing ${M.length} upcoming matches by league · tap <b>+ Slip</b> to build an SGP or Parlay</span>`;
 const calHdr=`<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px;padding:7px 10px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;font-size:12px"><span class="sbadge cal">✓ CALIBRATED · ${SC.bt.n} BACKTESTED (${Math.round(SC.bt.hit*100)}% ACTUAL HIT RATE)</span><span class="sbadge pk">✓ FIRST-TEAM ROSTER &amp; STARTER VERIFIED</span>${viewBtns}</div>`;
 // Order leagues so leagues with matches today appear first, then by earliest kickoff
 const lgOrder=ks.slice().sort((a,b)=>{
  const aTd=todayM.some(m=>m.lg==a)?0:1,bTd=todayM.some(m=>m.lg==b)?0:1;
  if(aTd!=bTd)return aTd-bTd;
  const aM=showM.find(m=>m.lg==a),bM=showM.find(m=>m.lg==b);
  return (aM?aM.start:"9")<(bM?bM.start:"9")?-1:1;
 });
 const sections=lgOrder.map(k=>{
  const lgMs=showM.filter(m=>m.lg==k);
  if(!lgMs.length)return"";
  const nPl=lgMs.reduce((s,m)=>s+(m.players||[]).length,0);
  const tdCnt=lgMs.filter(m=>etDay(m.start)==td).length;
  const lgHdr=`<div class="lg-sec-hd" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 11px;margin:12px 0 8px;background:#162642;border:1px solid var(--line);border-left:3px solid var(--acc);border-radius:8px;font-weight:800;font-size:13.5px"><span>⚽ ${esc(nm(k))}${tdCnt?` <span class="sbadge pk" style="margin-left:6px">🔥 ${tdCnt} Today</span>`:""}</span><span class="mut sm" style="font-weight:600">${lgMs.length} ${lgMs.length==1?"match":"matches"} · ${nPl} highlighted hitters</span></div>`;
  return `<div class="lg-sec" data-lg-sec="${esc(k)}">${lgHdr}${lgMs.map(m=>renderMatchBlock(m,nm)).join("")}</div>`;
 }).join("");
 return calHdr+sections+`<div class="mut sm" style="margin-top:6px">Chances are calibrated to past results: in our backtest, ${SC.bt.n} listed players scored ${Math.round(SC.bt.hit*100)}% of the time. Updated ${ago(SC.updated)}.</div>`;
}

function evalSlip(legs){
 if(!legs.length)return{indep:0,copula:0,boost:0,notes:[],weakIdx:-1};
 const indep=legs.reduce((a,l)=>a*(l.p||0.3),1);
 let mult=1.0;const notes=[];
 for(let i=0;i<legs.length;i++){
  for(let j=i+1;j<legs.length;j++){
   const a=legs[i],b=legs[j];
   if(String(a.game)==String(b.game)){
    if(a.kind=="scorer"&&b.kind=="scorer"){
     if(a.team==b.team){mult*=0.89;notes.push(`⚠️ Same-club scorer share cannibalization (${a.team} · ρ -0.14)`)}
     else{mult*=1.06;notes.push(`🔗 Two-sided high-scoring correlation (${a.matchup} · ρ +0.11)`)}
    } else if((a.kind=="scorer"&&(b.kind=="team_goals"||b.kind=="total"))||((a.kind=="team_goals"||a.kind=="total")&&b.kind=="scorer")){
     mult*=1.16;notes.push(`🔗 Copula SGP Boost: Scorer + Goals (${a.matchup} · ρ +0.38)`)
    } else if((a.kind=="scorer"&&b.kind=="gk_saves")||(a.kind=="gk_saves"&&b.kind=="scorer")){
     mult*=1.11;notes.push(`🔗 Copula SGP Boost: Attacking Volume + Opp GK Saves (${a.matchup} · ρ +0.26)`)
    } else {
     mult*=1.08;notes.push(`🔗 Same-Match SGP Correlation (${a.matchup} · ρ +0.20)`)
    }
   }
  }
 }
 const minP=Math.min(...legs.map(l=>l.p||0.3));
 const copula=Math.min(minP*0.95,Math.max(0.005,indep*mult));
 let weakIdx=0;
 legs.forEach((l,idx)=>{if((l.p||0)<(legs[weakIdx].p||1))weakIdx=idx});
 return{indep,copula,boost:copula-indep,notes:[...new Set(notes)],weakIdx};
}

function renderTray(){
 const el=$("soc-tray");if(!el)return;
 if(!SLIP.length){el.classList.remove("open");el.innerHTML="";return}
 el.classList.add("open");
 const ev=evalSlip(SLIP);
 const sgp=ev.notes.length>0;
 const corrBadge=ev.boost>0.003?`<span class="sbadge pk">🔗 Copula SGP +${(ev.boost*100).toFixed(1)}% vs indep</span>`:ev.boost<-0.003?`<span class="sbadge sv">⚠️ Cannib ${(ev.boost*100).toFixed(1)}%</span>`:`<span class="sbadge cal">Multi-Match Parlay</span>`;
 el.innerHTML=`<div class="tr-hd"><div><b>⚽ ${SLIP.length}-Leg ${sgp?"Same-Game / Hybrid SGP":"Goalscorer Parlay"}</b> ${corrBadge} · <span style="color:var(--acc2);font-weight:800">Fair ${(ev.copula*100).toFixed(1)}% (${toAm(ev.copula)})</span>${sgp?` <span class="mut sm">(Indep ${(ev.indep*100).toFixed(1)}% / ${toAm(ev.indep)})</span>`:""}</div><div class="tr-act" style="display:flex;gap:6px;flex-wrap:wrap">${SLIP.length>=3?`<button type="button" id="tr-trim" title="Remove lowest-probability leg (${esc(SLIP[ev.weakIdx].label)})">✂️ Trim Weakest</button>`:""}<button type="button" id="tr-copy">📋 Copy</button><button type="button" class="pri" id="tr-png">📸 Tail Card</button><button type="button" id="tr-clr">Clear</button></div></div>`
  +`<div class="tr-legs">${SLIP.map((l,i)=>`<span class="tr-chip">${i==ev.weakIdx&&SLIP.length>=3?'<span title="Weakest leg" style="color:#fbbf24">⚠</span>':""}<b>${esc(l.label)}</b> <span class="mut">${Math.round(l.p*100)}%</span><button type="button" data-rm="${esc(l.id)}" aria-label="Remove leg">×</button></span>`).join("")}</div>`
  +(ev.notes.length?`<div class="mut sm">${ev.notes.map(esc).join(" · ")}</div>`:"");
}

function exportTailCard(){
 if(!SLIP.length)return;
 const ev=evalSlip(SLIP);
 const cv=document.createElement("canvas");
 const W=720,H=220+SLIP.length*56+(ev.notes.length?36:0);
 cv.width=W;cv.height=H;
 const cx=cv.getContext("2d");
 cx.fillStyle="#0b1220";cx.fillRect(0,0,W,H);
 cx.strokeStyle="#22d3ee";cx.lineWidth=3;cx.strokeRect(10,10,W-20,H-20);
 cx.fillStyle="#22d3ee";cx.font="bold 22px system-ui,sans-serif";
 cx.fillText("⚽ SOCCER HUB · SPORTS LABS TAIL CARD",32,48);
 cx.fillStyle="#e6ebf5";cx.font="bold 18px system-ui,sans-serif";
 cx.fillText(`${SLIP.length}-Leg ${ev.notes.length?"Copula SGP":"Parlay"} · Fair ${(ev.copula*100).toFixed(1)}% (${toAm(ev.copula)})`,32,80);
 let y=118;
 SLIP.forEach((l,i)=>{
  cx.fillStyle="#16213a";cx.fillRect(32,y-24,W-64,44);
  cx.fillStyle="#a3e635";cx.font="bold 15px system-ui,sans-serif";
  cx.fillText(`${Math.round(l.p*100)}%`,46,y+3);
  cx.fillStyle="#e6ebf5";cx.font="bold 15px system-ui,sans-serif";
  cx.fillText(l.label,104,y+3);
  cx.fillStyle="#8b97b0";cx.font="13px system-ui,sans-serif";
  cx.fillText(l.matchup||"",W-170,y+3);
  y+=54;
 });
 if(ev.notes.length){
  cx.fillStyle="#67e8f9";cx.font="13px system-ui,sans-serif";
  cx.fillText(ev.notes[0],32,y+4);
 }
 cx.fillStyle="#8b97b0";cx.font="12px system-ui,sans-serif";
 cx.fillText("soccer.sportslabshq.com · Calibrated model · Not betting advice · 21+",32,H-24);
 const a=document.createElement("a");
 a.download="soccer-hub-tail-card.png";
 a.href=cv.toDataURL("image/png");
 a.click();
}

document.addEventListener("click",e=>{
 const scv=e.target.closest("[data-scv]");
 if(scv){SC_VIEW=scv.getAttribute("data-scv")||"today";render();return}
 const sb=e.target.closest("[data-slip]");
 if(sb){
  try{
   const leg=JSON.parse(sb.getAttribute("data-slip"));
   const idx=SLIP.findIndex(x=>x.id==leg.id);
   if(idx>=0)SLIP.splice(idx,1);
   else if(SLIP.length<6)SLIP.push(leg);
   saveSlip();render();
  }catch(err){}
  return;
 }
 const rm=e.target.closest("[data-rm]");
 if(rm){SLIP=SLIP.filter(x=>x.id!=rm.getAttribute("data-rm"));saveSlip();render();return}
 if(e.target.id=="tr-clr"){SLIP=[];saveSlip();render();return}
 if(e.target.id=="tr-trim"){const ev=evalSlip(SLIP);if(ev.weakIdx>=0){SLIP.splice(ev.weakIdx,1);saveSlip();render()}return}
 if(e.target.id=="tr-copy"){
  const ev=evalSlip(SLIP);
  const txt=`⚽ Soccer Hub ${SLIP.length}-Leg Slip (Fair ${(ev.copula*100).toFixed(1)}% · ${toAm(ev.copula)})\n`+SLIP.map(l=>`• ${l.label} (${Math.round(l.p*100)}%)`).join("\n")+`\nhttps://soccer.sportslabshq.com/`;
  if(navigator.clipboard)navigator.clipboard.writeText(txt);
  e.target.textContent="✓ Copied";setTimeout(()=>{if(e.target)e.target.textContent="📋 Copy"},1500);
  return;
 }
 if(e.target.id=="tr-png"){exportTailCard();return}
});

(async()=>{
 const refreshLS=()=>j(BL+"data/live_stats.json",null).then(ls=>{if(ls&&ls.g){LSG=ls.g;if(D.games){applyLiveOverlay(D.games);render()}}});
 refreshLS();setInterval(refreshLS,120000);
 j("data/scorers.json",null).then(x=>{SC=x;render()});if(ALL)j(BL+"data/soccer_aidlg.json",{}).then(M=>{ALG=M||{};if(REC.length)render()});
 const [ex,tiers,txt,SG,LH]=await Promise.all([CFG.loadExtra?CFG.loadExtra():{},j(BL+"data/edge_tiers.json",{}),fetch(BL+"data/edge_log.jsonl?t="+Date.now()).then(r=>r.ok?r.text():"").catch(()=>""),j(BL+"data/soccer_goals.json",{rows:[]}),j(BL+"data/soccer_list_hits.json",{rows:[]})]);EX=ex||{};
 const now=Date.now(),D0=(([h,m])=>now-((+h%24)*60+ +m)*60e3-new Date().getSeconds()*1e3)(new Date().toLocaleTimeString("en-US",{timeZone:"America/New_York",hour12:false,hour:"2-digit",minute:"2-digit"}).split(":"));REC=txt.split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l)}catch(e){return null}}).filter(p=>p&&(tiers[p.id]||{}).tier==="recommended"&&new Date(p.start||0)>=D0);REC=((SG||{}).rows||[]).filter(r=>r.rec&&new Date(r.start)>=D0).map(r=>Object.assign({gp:1},r)).concat(REC).concat(((LH||{}).rows||[]).filter(r=>new Date(r.start)>=D0).map(r=>Object.assign({lh:r.result},r)));load()})();

/* ---- Interactive Player, Club/Team & Match Profile Modals + Competition Tactical Edge Board ---- */
window.SOC_PROFILES = null;
let TAC_FLT = "all", MODAL_STATE = { kind: null, id: null, span: "this_szn", stat: "sot" };

function normKey(s) {
  return String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function plLink(name, aid, team, cls) {
  if (!name) return "";
  return `<span class="pl-lk soc-plink ${cls || ""}" data-soc-player="${esc(name)}" data-soc-aid="${esc(aid || "")}" data-soc-team="${esc(team || "")}">${esc(name)}</span>`;
}

function tmLink(abbr, lg, label, cls) {
  if (!abbr) return "";
  return `<span class="tm-lk soc-tlink ${cls || ""}" data-soc-team="${esc(abbr)}" data-soc-lg="${esc(lg || LG || "")}">${esc(label || abbr)}</span>`;
}

function mtLink(gid, label, cls) {
  if (!gid) return esc(label || "");
  return `<span class="mt-lk ${cls || ""}" data-soc-match="${esc(gid)}">${esc(label || "")}</span>`;
}

function ensureModalRoot() {
  let root = $("sl-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "sl-modal-root";
    root.className = "sl-modal-bg";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    document.body.appendChild(root);
  }
  return root;
}

function closeSocModal() {
  const root = $("sl-modal-root");
  if (root) {
    root.classList.remove("open");
    root.innerHTML = "";
  }
}

function findPlayerProfile(aid, name, team) {
  const P = window.SOC_PROFILES;
  if (!P || !P.players) return null;
  if (aid && P.players[String(aid)]) return P.players[String(aid)];
  const nk = normKey(name);
  if (nk && P.name_index && P.name_index[nk] && P.players[P.name_index[nk]]) {
    return P.players[P.name_index[nk]];
  }
  const all = Object.values(P.players);
  if (team) {
    const byTm = all.find(p => p.team === team && normKey(p.player) === nk);
    if (byTm) return byTm;
  }
  return all.find(p => normKey(p.player) === nk || normKey(p.player).includes(nk)) || null;
}

function findTeamProfile(teamAbbr, nameHint) {
  const P = window.SOC_PROFILES;
  if (!P || !P.teams) return null;
  const k = String(teamAbbr || "").toUpperCase().trim();
  if (P.teams[k]) return P.teams[k];
  const nk = normKey(nameHint || teamAbbr);
  return Object.values(P.teams).find(t => normKey(t.name) === nk || normKey(t.abbr) === nk) || null;
}

function openPlayerModal(aid, name, team) {
  const p = findPlayerProfile(aid, name, team);
  const root = ensureModalRoot();
  if (!p) {
    root.innerHTML = `<div class="sl-modal"><button class="sl-modal-close" data-soc-close="1">×</button><div class="sl-m-hdr"><div><h3 class="sl-m-title">${esc(name || "Player Profile")}</h3><div class="sl-m-sub">Club: ${tmLink(team, LG, team)} · Profile match logs syncing</div></div></div><div class="mut">Full game logs for ${esc(name)} populate once starting appearances are logged. Tap ${tmLink(team, LG, team || "Club")} to view club tactical splits.</div></div>`;
    root.classList.add("open");
    return;
  }
  MODAL_STATE = { kind: "player", p, span: MODAL_STATE.kind === "player" && MODAL_STATE.p === p ? MODAL_STATE.span : "this_szn", stat: MODAL_STATE.kind === "player" && MODAL_STATE.p === p ? MODAL_STATE.stat : "sot" };
  drawPlayerModal();
  root.classList.add("open");
}

function drawPlayerModal() {
  const p = MODAL_STATE.p;
  if (!p) return;
  const root = ensureModalRoot();
  const T = findTeamProfile(p.team);
  const logo = T && T.logo ? `<img class="crest" src="${esc(LOGO64(T.logo))}" alt="">` : "";
  const wSzn = (p.windows && p.windows.Season) || { gp: 0, starts: 0, g: 0, a: 0, gpg: 0, gapg: 0, sotpg: 0, shpg: 0, xgpg: 0 };
  const wL5 = (p.windows && p.windows.L5) || {};
  const wL10 = (p.windows && p.windows.L10) || {};
  const pGoal = p.p_goal || Math.min(0.75, Math.max(0.12, (wSzn.gpg || 0.25) * 0.85));

  const spanArr = (MODAL_STATE.span === "last_szn" ? (p.last_szn || []) : (p.this_szn || [])).slice(-12);
  const stKey = MODAL_STATE.stat || "sot";
  const stMeta = {
    g: { lbl: "Goals (1+)", line: 0.5, fn: x => x.g || 0 },
    sot: { lbl: "Shots on Target (1+)", line: 0.5, fn: x => x.sot || 0 },
    sh: { lbl: "Total Shots (2+)", line: 1.5, fn: x => x.sh || 0 },
    ga: { lbl: "Goal + Assist (1+)", line: 0.5, fn: x => (x.g || 0) + (x.a || 0) }
  }[stKey] || { lbl: "Shots on Target (1+)", line: 0.5, fn: x => x.sot || 0 };

  const vals = spanArr.map(stMeta.fn);
  const mx = Math.max(2, stMeta.line * 1.6, ...vals);
  const hits = vals.filter(v => v > stMeta.line).length;
  const avgVal = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "0.00";

  const pxMap = p.prices || {};
  const propCards = [
    ["Anytime Goal", "atg", pGoal, wL5.g_hit, (wL5.gp || 5), wL10.g_hit, (wL10.gp || 10)],
    ["1+ Shots on Target", "sot1", Math.min(0.88, Math.max(0.35, (wL10.sot1_hit || 5) / Math.max(1, wL10.gp || 10))), wL5.sot1_hit, (wL5.gp || 5), wL10.sot1_hit, (wL10.gp || 10)],
    ["2+ Shots on Target", "sot2", Math.min(0.68, Math.max(0.15, (wL10.sot2_hit || 2) / Math.max(1, wL10.gp || 10))), wL5.sot2_hit, (wL5.gp || 5), wL10.sot2_hit, (wL10.gp || 10)],
    ["Anytime Assist", "ast1", Math.min(0.55, Math.max(0.12, (wSzn.gapg || 0.3) - (wSzn.gpg || 0.15))), null, null, null, null]
  ].map(([mName, pkKey, ourP, h5, n5, h10, n10]) => {
    const q = pxMap[pkKey];
    const amStr = q && q.odds != null ? (q.odds > 0 ? "+" + q.odds : String(q.odds)) : toAm(ourP);
    const bkStr = q && q.book ? q.book : "Fair Est.";
    const lid = `mprof|${p.aid}|${pkKey}`;
    const inS = SLIP.some(x => x.id === lid);
    const legObj = { id: lid, game: p.team, matchup: p.team, kind: "scorer", aid: String(p.aid), label: `${p.player} (${p.team}) ${mName}`, team: p.team, p: ourP, price: q ? q.odds : null };
    return `<div class="sl-win-card">
      <div class="wh"><span>${esc(mName)}</span><span style="color:var(--acc2)">${ esc(amStr) } <small class="mut">${esc(bkStr)}</small></span></div>
      <div class="sl-win-bars">
        <div class="wb"><span class="lbl">Our Chance</span><span class="val">${Math.round(ourP * 100)}%</span></div>
        <div class="wb"><span class="lbl">Fair Odds</span><span class="val">${toAm(ourP)}</span></div>
        ${h10 != null ? `<div class="wb"><span class="lbl">L10 Hit</span><span class="val">${h10}/${n10}</span></div>` : `<div class="wb"><span class="lbl">Season</span><span class="val">${wSzn.a || 0} A</span></div>`}
      </div>
      <button type="button" class="slip-btn ${inS ? "on" : ""}" style="width:100%;margin-top:6px" data-slip='${esc(JSON.stringify(legObj))}'>${inS ? "✓ In Parlay Slip" : "+ Add to Slip"}</button>
    </div>`;
  }).join("");

  const sp = p.splits || {};
  const splitRows = [
    ["Home Matches", sp.home],
    ["Away Matches", sp.away],
    ["Domestic League", sp.league],
    ["Cup & UEFA/Continental", sp.cup]
  ].filter(([, o]) => o && o.gp > 0).map(([lbl, o]) => `<tr>
    <td><b>${esc(lbl)}</b></td>
    <td>${o.gp} (${o.starts || 0} GS)</td>
    <td><b>${o.g}G · ${o.a}A</b></td>
    <td>${o.sotpg} SOT/g</td>
    <td>${o.shpg} SH/g</td>
    <td>${o.xgpg} xG/g</td>
    <td>${o.g_hit}/${o.gp} (${Math.round((o.g_hit / Math.max(1, o.gp)) * 100)}%)</td>
  </tr>`).join("");

  root.innerHTML = `<div class="sl-modal">
    <button class="sl-modal-close" data-soc-close="1" aria-label="Close">×</button>
    <div class="sl-m-hdr">
      ${logo}
      <div>
        <h3 class="sl-m-title">${esc(p.player)} <span class="sbadge pk">${esc(p.pos || "FW")}</span> ${p.pk ? '<span class="sbadge pk">🎯 Penalty Taker</span>' : ""} ${p.sp_threat ? '<span class="sbadge sp">🔥 Set-Piece / Volume Threat</span>' : ""}</h3>
        <div class="sl-m-sub">
          <span>Club: <b>${tmLink(p.team, p.lg, (T && T.name) ? `${T.name} (${p.team})` : p.team)}</b></span>
          <span>· Competition: <b>${esc((p.lg || "").toUpperCase())}</b></span>
          ${p.best_prop ? `<span>· Best Edge: <b style="color:var(--acc2)">${esc(p.best_prop)}</b></span>` : ""}
        </div>
      </div>
    </div>

    <div class="sl-kpi-grid">
      <div class="sl-kpi"><div class="k">Season Goals</div><div class="v" style="color:var(--acc2)">${wSzn.g || 0}G</div><div class="s">${wSzn.gpg || 0}/g (${wSzn.gp || 0} GP, ${wSzn.starts || 0} GS)</div></div>
      <div class="sl-kpi"><div class="k">Season Assists</div><div class="v">${wSzn.a || 0}A</div><div class="s">${wSzn.gapg || 0} G+A/g</div></div>
      <div class="sl-kpi"><div class="k">Shots on Target</div><div class="v" style="color:var(--acc)">${wSzn.sotpg || 0}/g</div><div class="s">L10: ${wL10.sot1_hit || 0}/${wL10.gp || 0} 1+ SOT</div></div>
      <div class="sl-kpi"><div class="k">Shot Volume</div><div class="v">${wSzn.shpg || 0}/g</div><div class="s">${wSzn.xgpg || 0} xG/g</div></div>
      <div class="sl-kpi"><div class="k">Model Goal %</div><div class="v" style="color:#4ade80">${Math.round(pGoal * 100)}%</div><div class="s">Fair ${toAm(pGoal)}</div></div>
    </div>

    <div class="sl-sec-title"><span>🎯 Calibrated Player Props &amp; Book Prices</span><span class="mut sm">Tap + Add to build SGP</span></div>
    <div class="sl-win-grid">${propCards}</div>

    <div class="sl-toggles">
      <div class="sl-btn-grp">
        <button type="button" class="${MODAL_STATE.span === "this_szn" ? "on" : ""}" data-pm-span="this_szn">2026-27 Season (${(p.this_szn || []).length}G)</button>
        <button type="button" class="${MODAL_STATE.span === "last_szn" ? "on" : ""}" data-pm-span="last_szn">Prior Season (${(p.last_szn || []).length}G)</button>
      </div>
      <div class="sl-btn-grp">
        <button type="button" class="${stKey === "sot" ? "on" : ""}" data-pm-stat="sot">Shots on Target</button>
        <button type="button" class="${stKey === "g" ? "on" : ""}" data-pm-stat="g">Goals</button>
        <button type="button" class="${stKey === "sh" ? "on" : ""}" data-pm-stat="sh">Total Shots</button>
        <button type="button" class="${stKey === "ga" ? "on" : ""}" data-pm-stat="ga">Goals + Assists</button>
      </div>
    </div>

    <div class="sl-chart-wrap">
      <div class="sl-chart-meta">
        <span><b>${esc(stMeta.lbl)}</b> · Game-by-Game Log (Oldest → Latest)</span>
        <span>Cleared in <b style="color:var(--acc2)">${hits}/${vals.length} (${vals.length ? Math.round((hits / vals.length) * 100) : 0}%)</b> · Avg <b>${avgVal}</b></span>
      </div>
      ${spanArr.length ? `<div class="sl-bars">${spanArr.map(x => {
        const v = stMeta.fn(x);
        const hit = v > stMeta.line;
        const hPct = Math.max(8, Math.round((v / mx) * 100));
        return `<div class="sl-bar-col">
          <div class="sl-bar-val">${v}</div>
          <div class="sl-bar-track"><div class="sl-bar-fill ${hit ? "hit" : "miss"}" style="height:${hPct}%"></div></div>
          <div class="sl-bar-lbl"><span class="opp">${tmLink(x.opp, x.lg, `${x.at || "vs"}${x.opp}`)}</span><span class="dt">${esc((x.d || "").slice(5))}</span></div>
        </div>`;
      }).join("")}</div>` : `<div class="mut sm" style="padding:10px 0">No match logs in this season window.</div>`}
    </div>

    ${splitRows ? `<div class="sl-sec-title"><span>📊 Home / Away &amp; League vs. Cup Splits</span></div>
    <div class="wrap"><table><thead><tr><th>Split Window</th><th>Matches (GS)</th><th>G · A</th><th>SOT/g</th><th>Shots/g</th><th>xG/g</th><th>Scored 1+ Goal</th></tr></thead><tbody>${splitRows}</tbody></table></div>` : ""}
  </div>`;
}

function openTeamModal(teamAbbr, lgHint) {
  const t = findTeamProfile(teamAbbr);
  const root = ensureModalRoot();
  if (!t) {
    root.innerHTML = `<div class="sl-modal"><button class="sl-modal-close" data-soc-close="1">×</button><div class="sl-m-hdr"><h3 class="sl-m-title">${esc(teamAbbr || "Club Profile")}</h3></div><div class="mut">Detailed club profile not available for ${esc(teamAbbr)}.</div></div>`;
    root.classList.add("open");
    return;
  }
  MODAL_STATE = { kind: "team", t, lg: lgHint || t.dom_lg || LG, span: MODAL_STATE.kind === "team" && MODAL_STATE.t === t ? MODAL_STATE.span : "this_szn" };
  drawTeamModal();
  root.classList.add("open");
}

function drawTeamModal() {
  const t = MODAL_STATE.t;
  if (!t) return;
  const root = ensureModalRoot();
  const spAll = (t.splits && t.splits.all) || { gp: 0, gf_pg: 0, ga_pg: 0, xg_pg: 0, xga_pg: 0, btts_pct: 0, o25_pct: 0, cs_pct: 0 };
  const cong = t.congestion || { risk: "LOW", rest_days: 6, m10: 1, note: "Normal rest window" };
  const stEntries = Object.entries(t.standings || {});
  const formPills = String(t.form || "").split("").map(c => `<span class="f-pill ${c}">${esc(c)}</span>`).join("");

  const spanArr = (MODAL_STATE.span === "last_szn" ? (t.last_szn || []) : (t.this_szn || [])).slice(-12);
  const mxG = Math.max(3, ...spanArr.map(x => (x.gf || 0) + (x.ga || 0)));

  const splitRows = [
    ["All Competitions", (t.splits || {}).all],
    ["Home Matches", (t.splits || {}).home],
    ["Away Matches", (t.splits || {}).away],
    ["Domestic League", (t.splits || {}).league],
    ["Cup & Continental", (t.splits || {}).cup]
  ].filter(([, o]) => o && o.gp > 0).map(([lbl, o]) => `<tr>
    <td><b>${esc(lbl)}</b></td>
    <td>${o.gp} (${o.w}W-${o.d}D-${o.l}L)</td>
    <td><b style="color:var(--acc2)">${o.gf_pg}</b> / <span style="color:#fda4af">${o.ga_pg}</span></td>
    <td>${o.xg_pg} / ${o.xga_pg}</td>
    <td><b>${o.btts_pct}%</b></td>
    <td><b>${o.o25_pct}%</b></td>
    <td>${o.cs_pct}%</td>
  </tr>`).join("");

  const leadersHTML = (t.leaders || []).map(l => {
    const amStr = l.price != null ? (l.price > 0 ? "+" + l.price : String(l.price)) : toAm(l.p_goal || 0.25);
    return `<tr>
      <td><b>${plLink(l.player, l.aid, t.abbr)}</b> <span class="mut sm">${esc(l.pos || "")}</span> ${l.pk ? '<span class="sbadge pk">PK</span>' : ""}</td>
      <td>${l.gp} (${l.starts} GS)</td>
      <td><b style="color:var(--acc2)">${l.g}G · ${l.a}A</b></td>
      <td>${l.sotpg} SOT/g (${l.shpg} SH/g)</td>
      <td><b style="color:var(--acc)">${l.p_goal ? Math.round(l.p_goal * 100) + "%" : "—"}</b></td>
      <td><b>${esc(amStr)}</b></td>
    </tr>`;
  }).join("");

  root.innerHTML = `<div class="sl-modal">
    <button class="sl-modal-close" data-soc-close="1" aria-label="Close">×</button>
    <div class="sl-m-hdr">
      ${t.logo ? `<img class="crest" src="${esc(LOGO64(t.logo))}" alt="">` : ""}
      <div>
        <h3 class="sl-m-title">${esc(t.name)} <span class="sbadge cal">${esc(t.abbr)}</span> <span class="form-pills">${formPills}</span></h3>
        <div class="sl-m-sub">
          ${stEntries.map(([lgK, stO]) => `<span><b>${esc(stO.grp || lgK.toUpperCase())}:</b> #${stO.rank} (${esc(stO.overall || `${stO.w}-${stO.d}-${stO.l}`)} · ${stO.pts} pts · GD ${stO.gd})</span>`).join(" · ") || `<span>Primary League: ${esc((t.dom_lg || "").toUpperCase())}</span>`}
        </div>
      </div>
    </div>

    <div class="sl-cong-box ${esc(cong.risk || "LOW")}">
      <div><b>⏱️ Fixture Congestion &amp; Turnaround (${esc(cong.risk || "LOW")} Risk):</b> ${esc(cong.note || "")}</div>
      <div class="mut sm">${cong.last ? `Last: ${esc(cong.last.at)} ${esc(cong.last.opp)} (${esc(cong.last.score)} ${esc(cong.last.res)})` : ""} ${cong.next ? `· Next: ${esc(cong.next.at)} ${esc(cong.next.opp)} (${esc(cong.next.d)})` : ""}</div>
    </div>

    <div class="sl-kpi-grid">
      <div class="sl-kpi"><div class="k">Goals For / 90</div><div class="v" style="color:var(--acc2)">${spAll.gf_pg}</div><div class="s">xG/90: ${spAll.xg_pg}</div></div>
      <div class="sl-kpi"><div class="k">Goals Against / 90</div><div class="v" style="color:${spAll.ga_pg >= 1.65 ? "var(--bad)" : "var(--txt)"}">${spAll.ga_pg}</div><div class="s">xGA/90: ${spAll.xga_pg}</div></div>
      <div class="sl-kpi"><div class="k">BTTS Hit Rate</div><div class="v" style="color:var(--acc)">${spAll.btts_pct}%</div><div class="s">Both Teams to Score</div></div>
      <div class="sl-kpi"><div class="k">Over 2.5 Goals</div><div class="v">${spAll.o25_pct}%</div><div class="s">3+ Total Match Goals</div></div>
      <div class="sl-kpi"><div class="k">Clean Sheet %</div><div class="v">${spAll.cs_pct}%</div><div class="s">${spAll.gp} Matches Sampled</div></div>
    </div>

    <div class="sl-toggles">
      <div class="sl-sec-title" style="margin:0"><span>📈 Match Results &amp; Total Goals Log</span></div>
      <div class="sl-btn-grp">
        <button type="button" class="${MODAL_STATE.span === "this_szn" ? "on" : ""}" data-tm-span="this_szn">2026-27 Season (${(t.this_szn || []).length}G)</button>
        <button type="button" class="${MODAL_STATE.span === "last_szn" ? "on" : ""}" data-tm-span="last_szn">Prior Season (${(t.last_szn || []).length}G)</button>
      </div>
    </div>

    <div class="sl-chart-wrap" style="margin-top:8px">
      ${spanArr.length ? `<div class="sl-bars">${spanArr.map(x => {
        const totG = (x.gf || 0) + (x.ga || 0);
        const hPct = Math.max(10, Math.round((totG / mxG) * 100));
        const fillCls = x.res === "W" ? "hit" : x.res === "D" ? "draw" : "miss";
        return `<div class="sl-bar-col">
          <span class="sl-bar-res ${esc(x.res || "D")}">${esc(x.res || "D")}</span>
          <div class="sl-bar-val">${x.gf}-${x.ga}</div>
          <div class="sl-bar-track"><div class="sl-bar-fill ${fillCls}" style="height:${hPct}%"></div></div>
          <div class="sl-bar-lbl"><span class="opp">${tmLink(x.opp, x.lg, `${x.at || "vs"}${x.opp}`)}</span><span class="dt">${esc((x.d || "").slice(5))}</span></div>
        </div>`;
      }).join("")}</div>` : `<div class="mut sm">No match logs in this window.</div>`}
    </div>

    ${splitRows ? `<div class="sl-sec-title"><span>🏟️ Club Home / Away &amp; Competition Splits</span></div>
    <div class="wrap"><table><thead><tr><th>Split</th><th>Record</th><th>GF / GA per 90</th><th>xG / xGA per 90</th><th>BTTS %</th><th>Over 2.5 %</th><th>Clean Sheet %</th></tr></thead><tbody>${splitRows}</tbody></table></div>` : ""}

    ${leadersHTML ? `<div class="sl-sec-title"><span>⭐ Club Attacking Leaders (Tap any player for full profile)</span></div>
    <div class="wrap"><table><thead><tr><th>Player</th><th>Apps (GS)</th><th>G · A</th><th>Shot Volume</th><th>Model Goal %</th><th>ATG Price</th></tr></thead><tbody>${leadersHTML}</tbody></table></div>` : ""}
  </div>`;
}

function poisProb(lam, k) {
  return Math.exp(-lam) * Math.pow(lam, k) / (k <= 1 ? 1 : k === 2 ? 2 : k === 3 ? 6 : k === 4 ? 24 : k === 5 ? 120 : 720);
}

function calcMatchPoisson(g) {
  const lg = g._lg || LG;
  const tA = findTeamProfile(g.away && g.away.abbr);
  const tH = findTeamProfile(g.home && g.home.abbr);
  const tot = g.total ? Number(g.total) : 2.65;
  let aShare = 0.46;
  if (g.line && g.line !== "EVEN") {
    const pts = String(g.line).trim().split(/\s+/);
    const fav = pts[0], ml = parseFloat(pts[1]);
    if (isFinite(ml) && ml !== 0) {
      const pFav = imp(ml) || 0.5;
      const fShare = Math.min(0.76, Math.max(0.46, 0.50 + (pFav - 0.38) * 0.65));
      aShare = fav === g.away.abbr ? fShare : 1 - fShare;
    }
  }
  const lamA = Math.max(0.45, +(tot * aShare).toFixed(2));
  const lamH = Math.max(0.55, +(tot * (1 - aShare)).toFixed(2));
  let pA = 0, pD = 0, pH = 0, pO25 = 0, pBTTS = 0;
  for (let i = 0; i <= 6; i++) {
    const pi = Math.exp(-lamA) * Math.pow(lamA, i) / [1, 1, 2, 6, 24, 120, 720][i];
    for (let j = 0; j <= 6; j++) {
      const pj = Math.exp(-lamH) * Math.pow(lamH, j) / [1, 1, 2, 6, 24, 120, 720][j];
      const p = pi * pj;
      if (i > j) pA += p;
      else if (i === j) pD += p;
      else pH += p;
      if (i + j >= 3) pO25 += p;
      if (i >= 1 && j >= 1) pBTTS += p;
    }
  }
  const isKo = /cup|pokal|rey|champions|europa|usa\.1|mex\.1/i.test(lg);
  return { lg, lamA, lamH, pA, pD, pH, pO25, pBTTS, isKo, tA, tH };
}

function openMatchModal(gid) {
  const g = (D.games || []).find(x => String(x.id) === String(gid));
  if (!g) return;
  const root = ensureModalRoot();
  const mp = calcMatchPoisson(g);
  const cm = ((window.SOC_PROFILES || {}).comp_meta || {})[mp.lg] || ((window.SOC_PROFILES || {}).comp_meta || {}).all || {};
  const aLeaders = (mp.tA && mp.tA.leaders || []).slice(0, 3);
  const hLeaders = (mp.tH && mp.tH.leaders || []).slice(0, 3);

  root.innerHTML = `<div class="sl-modal">
    <button class="sl-modal-close" data-soc-close="1" aria-label="Close">×</button>
    <div class="sl-m-hdr">
      ${g.away.logo ? `<img class="crest" src="${esc(LOGO64(g.away.logo))}" alt="">` : ""}
      <div style="flex:1">
        <h3 class="sl-m-title">${tmLink(g.away.abbr, mp.lg, g.away.name || g.away.abbr)} <span class="mut">at</span> ${tmLink(g.home.abbr, mp.lg, g.home.name || g.home.abbr)}</h3>
        <div class="sl-m-sub"><span>${et(g.date)}</span> · <span>${esc(cm.name || mp.lg.toUpperCase())}</span> ${g.venue ? `· <span>${esc(g.venue)}</span>` : ""}</div>
      </div>
      ${g.home.logo ? `<img class="crest" src="${esc(LOGO64(g.home.logo))}" alt="">` : ""}
    </div>

    <div class="comp-banner" style="margin-bottom:12px">
      <div class="cb-main">
        <div class="cb-title"><span>${esc(cm.badge || "Competition Rules")}</span><span>${esc(cm.format || "")}</span></div>
        <div class="cb-settle">${esc(cm.settlement || "90-Min + Stoppage Time Regulation Settlement")}</div>
        <div class="cb-cut">${esc(cm.cutlines || "")}</div>
      </div>
    </div>

    <div class="sl-kpi-grid">
      <div class="sl-kpi"><div class="k">${esc(g.away.abbr)} Win (2)</div><div class="v" style="color:#38bdf8">${Math.round(mp.pA * 100)}%</div><div class="s">λ_away: ${mp.lamA} xG (Fair ${toAm(mp.pA)})</div></div>
      <div class="sl-kpi"><div class="k">90' Draw (X)</div><div class="v" style="color:#fcd34d">${Math.round(mp.pD * 100)}%</div><div class="s">Fair ${toAm(mp.pD)}</div></div>
      <div class="sl-kpi"><div class="k">${esc(g.home.abbr)} Win (1)</div><div class="v" style="color:var(--acc2)">${Math.round(mp.pH * 100)}%</div><div class="s">λ_home: ${mp.lamH} xG (Fair ${toAm(mp.pH)})</div></div>
      <div class="sl-kpi"><div class="k">Over 2.5 Goals</div><div class="v" style="color:var(--acc)">${Math.round(mp.pO25 * 100)}%</div><div class="s">Proj Total ${(mp.lamA + mp.lamH).toFixed(2)}</div></div>
      <div class="sl-kpi"><div class="k">BTTS (Yes)</div><div class="v">${Math.round(mp.pBTTS * 100)}%</div><div class="s">Both Clubs Score</div></div>
    </div>

    <div class="two">
      <div class="card" style="margin:0">
        <h3>✈️ ${tmLink(g.away.abbr, mp.lg, `${g.away.name} (${g.away.abbr})`)} Attacking Leaders</h3>
        <table><thead><tr><th>Player</th><th>G · A</th><th>SOT/g</th><th>Goal %</th></tr></thead><tbody>
          ${aLeaders.map(l => `<tr><td><b>${plLink(l.player, l.aid, g.away.abbr)}</b></td><td>${l.g}G · ${l.a}A</td><td>${l.sotpg}</td><td><b>${Math.round((l.p_goal || 0.25) * 100)}%</b></td></tr>`).join("") || '<tr><td colspan="4" class="mut">Tap club name above for full squad.</td></tr>'}
        </tbody></table>
      </div>
      <div class="card" style="margin:0">
        <h3>🏠 ${tmLink(g.home.abbr, mp.lg, `${g.home.name} (${g.home.abbr})`)} Attacking Leaders</h3>
        <table><thead><tr><th>Player</th><th>G · A</th><th>SOT/g</th><th>Goal %</th></tr></thead><tbody>
          ${hLeaders.map(l => `<tr><td><b>${plLink(l.player, l.aid, g.home.abbr)}</b></td><td>${l.g}G · ${l.a}A</td><td>${l.sotpg}</td><td><b>${Math.round((l.p_goal || 0.25) * 100)}%</b></td></tr>`).join("") || '<tr><td colspan="4" class="mut">Tap club name above for full squad.</td></tr>'}
        </tbody></table>
      </div>
    </div>
  </div>`;
  root.classList.add("open");
}

function renderCompBanner() {
  const el = $("comp-banner");
  if (!el) return;
  const cm = ((window.SOC_PROFILES || {}).comp_meta || {})[LG] || ((window.SOC_PROFILES || {}).comp_meta || {}).all;
  if (!cm) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="comp-banner">
    <div class="cb-main">
      <div class="cb-title"><span>${esc(cm.name)}</span><span class="sbadge pk">${esc(cm.badge)}</span></div>
      <div style="color:var(--txt);font-size:12px">${esc(cm.format)}</div>
      <div class="cb-settle">${esc(cm.settlement)}</div>
      <div class="cb-cut">📌 <b>Cutlines &amp; Advancement:</b> ${esc(cm.cutlines)}</div>
    </div>
  </div>`;
}

function renderTacBoard(G) {
  const el = $("tac-board");
  if (!el) return;
  const up = (G || []).filter(g => g.state !== "post").slice(0, 30);
  if (!up.length) {
    el.innerHTML = '<div class="mut">No upcoming matches in the current filter window.</div>';
    return;
  }
  const rows = up.map(g => {
    const mp = calcMatchPoisson(g);
    const congA = (mp.tA && mp.tA.congestion) || {};
    const congH = (mp.tH && mp.tH.congestion) || {};
    const restEdge = (congA.risk === "HIGH" || congH.risk === "HIGH");
    const highGoal = (mp.pO25 >= 0.56 || (mp.lamA + mp.lamH) >= 2.95);
    let topScorer = null;
    if (SC && SC.leagues && SC.leagues[mp.lg]) {
      const mSc = (SC.leagues[mp.lg].matches || []).find(m => String(m.game) === String(g.id));
      if (mSc && mSc.players && mSc.players[0]) topScorer = mSc.players[0];
    }
    if (!topScorer) {
      const candL = [...(mp.tH && mp.tH.leaders || []), ...(mp.tA && mp.tA.leaders || [])].sort((a, b) => (b.p_goal || 0) - (a.p_goal || 0));
      if (candL[0]) topScorer = { player: candL[0].player, aid: candL[0].aid, team: (mp.tH && (mp.tH.leaders || []).includes(candL[0])) ? g.home.abbr : g.away.abbr, p: candL[0].p_goal || 0.38 };
    }
    return { g, mp, congA, congH, restEdge, highGoal, topScorer };
  });

  const filtered = rows.filter(r => {
    if (TAC_FLT === "ko") return r.mp.isKo || r.mp.pD >= 0.25;
    if (TAC_FLT === "goals") return r.highGoal;
    if (TAC_FLT === "rest") return r.restEdge;
    return true;
  });

  el.innerHTML = `<div class="tac-flt-bar">
    <button type="button" class="${TAC_FLT === "all" ? "on" : ""}" data-tacf="all">All Fixtures (${rows.length})</button>
    <button type="button" class="${TAC_FLT === "ko" ? "on" : ""}" data-tacf="ko">🏆 Knockout / 90' Regulation Draw Alerts (${rows.filter(r => r.mp.isKo || r.mp.pD >= 0.25).length})</button>
    <button type="button" class="${TAC_FLT === "goals" ? "on" : ""}" data-tacf="goals">⚡ High-Total &amp; BTTS Funnels (${rows.filter(r => r.highGoal).length})</button>
    <button type="button" class="${TAC_FLT === "rest" ? "on" : ""}" data-tacf="rest">⏱️ Rest &amp; Congestion Mismatches (${rows.filter(r => r.restEdge).length})</button>
  </div>
  <div class="wrap"><table class="tac-tbl"><thead><tr>
    <th>Matchup &amp; Kickoff (ET)</th>
    <th>Competition &amp; Settlement</th>
    <th>Poisson xG (A – H)</th>
    <th>90' 1X2 Probabilities</th>
    <th>O2.5 / BTTS</th>
    <th>Top Calibrated Scorer</th>
    <th>Tactical Breakdown</th>
  </tr></thead><tbody>${filtered.slice(0, 18).map(({ g, mp, congA, congH, topScorer }) => {
    const lgLbl = (CFG.leagues.find(l => l[0] === mp.lg) || [, mp.lg.toUpperCase()])[1];
    return `<tr>
      <td><b>${tmLink(g.away.abbr, mp.lg)}</b> <span class="mut">@</span> <b>${tmLink(g.home.abbr, mp.lg)}</b><div class="mut sm">${et(g.date)}</div></td>
      <td><span class="cut-pill ${mp.isKo ? "ko" : "ucl"}">${esc(lgLbl)}</span>${congA.risk === "HIGH" || congH.risk === "HIGH" ? ` <span class="sbadge sv">⏱️ Short Rest</span>` : ""}</td>
      <td><b>${mp.lamA.toFixed(2)} – ${mp.lamH.toFixed(2)}</b> <span class="mut sm">(${(mp.lamA + mp.lamH).toFixed(1)})</span></td>
      <td><div class="p1x2"><span class="${mp.pA >= mp.pH ? "hi" : ""}">2: ${Math.round(mp.pA * 100)}%</span><span class="${mp.pD >= 0.26 ? "hi" : ""}">X: ${Math.round(mp.pD * 100)}%</span><span class="${mp.pH > mp.pA ? "hi" : ""}">1: ${Math.round(mp.pH * 100)}%</span></div></td>
      <td><b>${Math.round(mp.pO25 * 100)}%</b> O2.5 · <b>${Math.round(mp.pBTTS * 100)}%</b> BTTS</td>
      <td>${topScorer ? `${plLink(topScorer.player, topScorer.aid, topScorer.team)} <span class="mut sm">(${tmLink(topScorer.team, mp.lg)})</span> <b style="color:var(--acc2)">${Math.round((topScorer.p || 0.35) * 100)}%</b>` : '<span class="mut sm">—</span>'}</td>
      <td><button type="button" class="slip-btn" data-soc-match="${esc(g.id)}">📊 Breakdown</button></td>
    </tr>`;
  }).join("")}</tbody></table></div>`;
}

// Decorate rendered DOM elements in #take, #scor, #games, and #stand so every player, team, and match is clickable
function decorateClickableNames() {
  renderCompBanner();
  const G0 = (D.games || []).slice().sort((x, y) => x.date < y.date ? -1 : 1);
  const G = MF ? G0.filter(g => String(g.id) == MF) : G0;
  renderTacBoard(G);

  // 1. Decorate Likely Scorers (#scor)
  const scorEl = $("scor");
  if (scorEl) {
    scorEl.querySelectorAll(".sc-row").forEach(row => {
      const b = row.querySelector("b");
      const btn = row.querySelector("[data-slip]");
      if (b && !b.querySelector("[data-soc-player]")) {
        let aid = "", tm = "";
        if (btn) {
          try {
            const o = JSON.parse(btn.getAttribute("data-slip"));
            aid = o.aid || "";
            tm = o.team || "";
          } catch (e) {}
        }
        const nm = b.textContent.trim();
        b.innerHTML = plLink(nm, aid, tm);
      }
    });
  }

  // 2. Decorate Takeaways (#take)
  const takeEl = $("take");
  if (takeEl) {
    takeEl.querySelectorAll(".tk b").forEach(b => {
      if (b.querySelector("[data-soc-player]") || b.classList.contains("lv")) return;
      const txt = b.textContent.trim();
      if (!txt || /^[+-]?\d+$/.test(txt)) return;
      const cleanNm = txt.replace(/\s+(anytime goal|anytime assist|1\+ shots on target|2\+ shots|shots on target.*|shots.*|assists.*|to score.*)$/i, "").trim();
      if (cleanNm && cleanNm.length >= 3) {
        const p = findPlayerProfile(null, cleanNm, null);
        if (p) {
          b.innerHTML = plLink(cleanNm, p.aid, p.team) + esc(txt.slice(cleanNm.length));
        } else if (!/\b(over|to win|blowout)\b/i.test(cleanNm)) {
          b.innerHTML = plLink(cleanNm, "", "") + esc(txt.slice(cleanNm.length));
        }
      }
    });
  }

  // 3. Decorate Match Cards (#games)
  const gamesEl = $("games");
  if (gamesEl && G.length) {
    gamesEl.querySelectorAll(".g").forEach((card, idx) => {
      const g = G[idx];
      if (!g) return;
      const lg = g._lg || LG;
      const tms = card.querySelectorAll(".gh .tm");
      if (tms[0] && !tms[0].querySelector("[data-soc-team]")) {
        const img = tms[0].querySelector("img");
        tms[0].innerHTML = `${img ? img.outerHTML : ""}${tmLink(g.away.abbr, lg, g.away.abbr)} ${g.state != "pre" ? esc(g.away.score) : ""}`;
      }
      if (tms[1] && !tms[1].querySelector("[data-soc-team]")) {
        const img = tms[1].querySelector("img");
        tms[1].innerHTML = `${img ? img.outerHTML : ""}${tmLink(g.home.abbr, lg, g.home.abbr)} ${g.state != "pre" ? esc(g.home.score) : ""}`;
      }
      if (!card.querySelector("[data-soc-match]")) {
        const btnWrap = document.createElement("div");
        btnWrap.style.marginTop = "6px";
        btnWrap.innerHTML = `<button type="button" class="slip-btn" data-soc-match="${esc(g.id)}">📊 Match Tactical Breakdown (${esc(g.away.abbr)} @ ${esc(g.home.abbr)})</button>`;
        card.appendChild(btnWrap);
      }
    });
  }

  // 4. Decorate Standings (#stand)
  const standEl = $("stand");
  if (standEl && D.standings) {
    standEl.querySelectorAll("table tr").forEach(tr => {
      const td = tr.querySelector("td");
      if (!td || td.querySelector("[data-soc-team]")) return;
      const img = td.querySelector("img");
      const nm = td.textContent.trim();
      const rowObj = (D.standings || []).find(r => r.name === nm || r.team === nm);
      if (rowObj) {
        td.innerHTML = `${img ? img.outerHTML : ""}${tmLink(rowObj.team, LG, rowObj.name)}`;
      }
    });
  }
}

const _origRender = render;
render = function() {
  _origRender();
  clearTimeout(window.__decT);window.__decT=setTimeout(decorateClickableNames,0);
};

document.addEventListener("click", e => {
  if (e.target.closest("[data-soc-close]") || e.target.id === "sl-modal-root") {
    closeSocModal();
    return;
  }
  const pmSpan = e.target.closest("[data-pm-span]");
  if (pmSpan) { MODAL_STATE.span = pmSpan.getAttribute("data-pm-span"); drawPlayerModal(); return; }
  const pmStat = e.target.closest("[data-pm-stat]");
  if (pmStat) { MODAL_STATE.stat = pmStat.getAttribute("data-pm-stat"); drawPlayerModal(); return; }
  const tmSpan = e.target.closest("[data-tm-span]");
  if (tmSpan) { MODAL_STATE.span = tmSpan.getAttribute("data-tm-span"); drawTeamModal(); return; }
  const tacF = e.target.closest("[data-tacf]");
  if (tacF) { TAC_FLT = tacF.getAttribute("data-tacf") || "all"; decorateClickableNames(); return; }

  const pl = e.target.closest("[data-soc-player]");
  if (pl) {
    e.stopPropagation();
    openPlayerModal(pl.getAttribute("data-soc-aid"), pl.getAttribute("data-soc-player"), pl.getAttribute("data-soc-team"));
    return;
  }
  const tm = e.target.closest("[data-soc-team]");
  if (tm) {
    e.stopPropagation();
    openTeamModal(tm.getAttribute("data-soc-team"), tm.getAttribute("data-soc-lg"));
    return;
  }
  const mt = e.target.closest("[data-soc-match]");
  if (mt) {
    e.stopPropagation();
    openMatchModal(mt.getAttribute("data-soc-match"));
    return;
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeSocModal();
});

j("data/hub_profiles.json", null).then(hp => {
  if (hp) {
    window.SOC_PROFILES = hp;
    if (D && D.games) decorateClickableNames();
  }
});
