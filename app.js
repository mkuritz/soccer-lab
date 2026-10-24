const LOGO64=u=>u&&/^https:\/\/a\.espncdn\.com\/i\//.test(u)?"https://a.espncdn.com/combiner/i?img="+encodeURIComponent(u.replace("https://a.espncdn.com",""))+"&h=64&w=64":u;
/* Sports Labs hub v1 — display only. */
const CFG=window.HUB,$=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const BL="https://betlab.sportslabshq.com/";
const j=(u,d)=>fetch(u+(u.includes("?")?"&":"?")+"t="+Date.now()).then(r=>r.ok?r.json():d).catch(()=>d);
const et=t=>t?new Date(t).toLocaleString("en-US",{timeZone:"America/New_York",weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})+" ET":"";
const ago=t=>{if(!t)return"";const m=Math.round((Date.now()-new Date(t))/60000);return m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"};
const ALL=CFG.leagues.length>1;if(ALL&&CFG.leagues[0][0]!="all")CFG.leagues.unshift(["all","All"]);
let LG=CFG.leagues[0][0],MF="",D={},EX={},REC=[],ALG={},SC=null,STAND_ALL={},LSG={};
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
 if(/Penalty/i.test(t))return"sbadge pk";
 if(/Set-Piece|Aerial/i.test(t))return"sbadge sp";
 if(/Bottom-5|Sieve|Defense/i.test(t))return"sbadge sv";
 if(/High-Total/i.test(t))return"sbadge ht";
 return"sbadge cal";
}

function renderRibbon(G){
 const el=$("mrib");if(!el)return;
 const up=G.filter(g=>g.state!="post").slice(0,24);
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

function render(){
 const G0=(D.games||[]).slice().sort((x,y)=>x.date<y.date?-1:1);
 renderRibbon(G0);
 const G=MF?G0.filter(g=>String(g.id)==MF):G0;
 $("upd").innerHTML=`Data updated ${ago(D.updated)} (${et(D.updated)}) · ${esc(D.league||"")}${D.week?" · Week "+D.week:""} ${D.season||""}`;
 const rec=REC.filter(r=>CFG.recSport.includes(r.sport)&&(LG=="all"||recLg(r)==LG)&&(!MF||String(r.game||(r.ref||{}).game||"")==MF));
 const lgName=(CFG.leagues.find(l=>l[0]==LG)||[,""])[1];
 $("take").innerHTML=rec.length?rec.slice(0,10).map(r=>`<div class="tk"><span class="pill">${r.lh?"PRE-GAME LIST HIT · #"+r.rank+" most likely":r.gp?(/Goal|Assist/.test(r.market)?"GOAL HIGHLIGHT":"PROBABLE PLAY")+" · "+esc(r.tier.toUpperCase()):"SPORTS LABS HIGHLIGHTED"}</span> <b>${esc(r.title)}</b>${r.lh?` <span class="mut">our ${Math.round(r.ours*100)}% vs book ${Math.round(r.book*100)}% (${r.price>0?"+"+r.price:r.price}) pre-game</span>`:""}${r.gp?` <b>${r.price>0?"+"+r.price:r.price}</b> <span class="mut">${esc(r.book)} · our chance ${Math.round(r.p*100)}% vs ${Math.round(r.nv*100)}% no-vig · ${esc(r.xi)} · ${esc(r.season)}</span>`:""} <span class="mut">${et(r.start)}</span>${r.lh?` <b class="lv">✅ ${esc(r.lh)}</b>`:""}${window.LR&&r.gp&&r.aid?LR.tag("soccer",r.aid,r.market,null,r.player,"",r.start):""}${window.LR&&!r.gp&&!r.lh?LR.tag(r.sport,(r.ref||{}).aid||"",r.market,(r.ref||{}).line,(r.ref||{}).player||r.title.replace(/ (anytime|over|under|to score).*$/i,""),"",r.start):""}</div>`).join("")+`<a href="${BL}sharp.html">All Highlighted in Bet Lab →</a>`:LG!="all"?`<div class="mut">No other Highlighted ${esc(lgName)} highlights today${scN(LG)?" (see Likely Scorers below)":""}. Highlight <b>All</b> for every league. <a href="${BL}sharp.html">Highlighted in Bet Lab →</a></div>`:`<div class="mut">No Highlighted ${CFG.short} highlights have cleared our bar right now. When they do, they show here. <a href="${BL}sharp.html">Highlighted in Bet Lab →</a></div>`;
 $("games").innerHTML=G.length?G.map(g=>`<div class="g"><div class="gh"><span class="tm"><img loading="lazy" decoding="async" width="32" height="32" src="${esc(LOGO64(g.away.logo))}" alt="">${esc(g.away.abbr)} ${g.state!="pre"?esc(g.away.score):""}</span><span class="mut">@</span><span class="tm"><img loading="lazy" decoding="async" width="32" height="32" src="${esc(LOGO64(g.home.logo))}" alt="">${esc(g.home.abbr)} ${g.state!="pre"?esc(g.home.score):""}</span><span class="st ${g.state}">${esc(g.status)}</span></div><div class="mut sm">${et(g.date)}${g.venue?" · "+esc(g.venue):""}${g.bc&&g.bc[0]?" · 📺 "+esc(g.bc.filter(Boolean).join(", ")):""}</div>${matchGoalViz(g)}${matchBadges(g)}<ul class="sl">${story(g).map(s=>`<li>${s}</li>`).join("")}</ul>${matchQuickLegs(g)}</div>`).join(""):'<div class="mut">No games in the current window.</div>';
 const S=D.standings||[],grps=[...new Set(S.map(r=>r.grp))];
 $("stand").innerHTML=grps.map(gp=>`<h3>${esc(gp)}</h3><div class="wrap"><table><tr><th>Team</th>${CFG.cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr>${S.filter(r=>r.grp==gp).map(r=>`<tr><td><img class="lg" loading="lazy" decoding="async" width="32" height="32" src="${esc(LOGO64(r.logo))}" alt="">${esc(r.name)}</td>${CFG.cols.map(c=>`<td>${esc(r.st[c[0]]??"")}</td>`).join("")}</tr>`).join("")}</table></div>`).join("")||'<div class="mut">Standings unavailable.</div>';
 if(LG=="all")$("stand").innerHTML='<div class="mut">Select a league above for its table.</div>';
 $("news").innerHTML=(D.news||[]).map(n=>`<div class="nw"><a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}</a><div class="mut sm">${et(n.d)}</div></div>`).join("")||'<div class="mut">No headlines.</div>';
 if($("scor"))$("scor").innerHTML=scHTML();
 renderTray();
 if(CFG.renderExtra)CFG.renderExtra(EX);
}

const scN=l=>SC&&SC.leagues&&SC.leagues[l]?SC.leagues[l].n_players:0;
function scHTML(){
 if(!SC)return'<div class="mut">Loading…</div>';
 const ks=LG=="all"?Object.keys(SC.leagues):[LG],nm=k=>(CFG.leagues.find(l=>l[0]==k)||[,k])[1];
 let M=ks.flatMap(k=>((SC.leagues[k]||{}).matches||[]).map(m=>Object.assign({lg:k},m))).filter(m=>new Date(m.start)>Date.now()).sort((a,b)=>a.start<b.start?-1:1);
 if(MF)M=M.filter(m=>String(m.game)==MF);
 if(!M.length)return `<div class="mut">Not enough player data yet for upcoming ${esc(LG=="all"?"":nm(LG)+" ")}matches. This fills in once player markets and recent match logs are posted.</div>`;
 const calHdr=`<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px;padding:7px 10px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;font-size:12px"><span class="sbadge cal">✓ CALIBRATED · ${SC.bt.n} BACKTESTED (${Math.round(SC.bt.hit*100)}% ACTUAL HIT RATE)</span><span class="sbadge pk">✓ FIRST-TEAM ROSTER &amp; STARTER VERIFIED</span><span class="mut sm" style="margin-left:auto">Showing ${M.length} upcoming matches · tap <b>+ Slip</b> to build an SGP or Parlay</span></div>`;
 return calHdr+M.map(m=>`<div class="tk" style="margin-bottom:10px"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><b>${esc(m.matchup)}</b> <span class="mut">${LG=="all"?esc(nm(m.lg))+" · ":""}${et(m.start)}</span>${(m.match_tags||[]).map(t=>`<span class="${badgeCls(t)}">${esc(t)}</span>`).join("")}</div>${m.players.map(p=>{
  const lid=`s|${m.game}|${p.aid}`;
  const on=SLIP.some(x=>x.id==lid);
  const legObj={id:lid,game:String(m.game),matchup:m.matchup,kind:"scorer",aid:String(p.aid),label:`${p.player} (${p.team}) Anytime Goal`,team:p.team,opp:p.opp,p:p.p,price:p.price};
  const tags=(p.tags||[]).slice(0,2).map(t=>`<span class="${badgeCls(t)}">${esc(t)}</span>`).join("");
  const calBadge=p.cal_tier?`<span class="sbadge cal">${esc(p.cal_tier)}</span>`:"";
  const maxScale=0.65;
  const ourP=Math.max(0.05,Math.min(maxScale,p.p||0.2));
  const mktRaw=p.price!=null?imp(p.price):null;
  const refP=mktRaw!=null?mktRaw:Math.max(0.08,ourP*0.84);
  const ourW=Math.min(100,Math.round((ourP/maxScale)*1000)/10);
  const refLeft=Math.min(97,Math.max(3,Math.round((refP/maxScale)*1000)/10));
  const edgePts=Math.round((p.p-refP)*1000)/10;
  const vizBar=`<div class="sc-viz-bar" title="Our Calibrated Chance ${Math.round(p.p*100)}% vs ${mktRaw!=null?'Book Implied':'Baseline Prior'} ${Math.round(refP*100)}%"><div class="sc-viz-track"><div class="sc-viz-fill" style="width:${ourW}%"></div><div class="sc-viz-tick" style="left:${refLeft}%" title="${mktRaw!=null?'Book Implied':'Prior'}: ${Math.round(refP*100)}%"></div></div><div class="sc-viz-meta"><span class="our">Our <b>${Math.round(p.p*100)}%</b></span><span class="mkt">${mktRaw!=null?'Book Imp':'Prior'} <b>${Math.round(refP*100)}%</b></span>${edgePts>=0.5?`<span class="edg">+${edgePts.toFixed(1)}% Edge</span>`:""}</div></div>`;
  return `<div class="sc-row"><div style="flex:1;min-width:0"><div><span class="pill">${Math.round(p.p*100)}% TO SCORE</span> <b>${esc(p.player)}</b> <span class="mut">${esc(p.team)}${p.pos?" "+esc(p.pos):""} · ${esc(p.xi)}${p.price!=null?` · Book ${p.price>0?"+"+p.price:p.price}`:` · Fair ${toAm(p.p)}`}</span></div>${vizBar}<div style="margin-top:3px">${calBadge}${tags}</div><div class="mut sm" style="margin-top:2px">${esc(p.why.join(" · "))}</div></div><button type="button" class="slip-btn ${on?"on":""}" data-slip='${esc(JSON.stringify(legObj))}'>${on?"✓ In Slip":"+ Slip"}</button></div>`;
 }).join("")}</div>`).join("")+`<div class="mut sm" style="margin-top:6px">Chances are calibrated to past results: in our backtest, ${SC.bt.n} listed players scored ${Math.round(SC.bt.hit*100)}% of the time. Updated ${ago(SC.updated)}.</div>`;
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
