const LOGO64=u=>u&&/^https:\/\/a\.espncdn\.com\/i\//.test(u)?"https://a.espncdn.com/combiner/i?img="+encodeURIComponent(u.replace("https://a.espncdn.com",""))+"&h=64&w=64":u; // 64px logos via ESPN image resizer (500px originals were up to 560 KB each)
/* Sports Labs hub v1 — display only. Data: ESPN public site API (scores, standings, news, DraftKings lines via ESPN) + Bet Lab published display data. */
const CFG=window.HUB,$=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const BL="https://betlab.sportslabshq.com/";
const j=(u,d)=>fetch(u+(u.includes("?")?"&":"?")+"t="+Date.now()).then(r=>r.ok?r.json():d).catch(()=>d);
const et=t=>t?new Date(t).toLocaleString("en-US",{timeZone:"America/New_York",weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})+" ET":"";
const ago=t=>{if(!t)return"";const m=Math.round((Date.now()-new Date(t))/60000);return m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"};
const ALL=CFG.leagues.length>1;if(ALL&&CFG.leagues[0][0]!="all")CFG.leagues.unshift(["all","All"]);
let LG=CFG.leagues[0][0],D={},EX={},REC=[],ALG={};
function tabs(){$("lgs").innerHTML=CFG.leagues.length>1?CFG.leagues.map(([k,n])=>`<button data-l="${k}" class="${k==LG?"on":""}">${n}</button>`).join(""):"";document.querySelectorAll("#lgs button").forEach(b=>b.onclick=()=>{LG=b.dataset.l;load()})}
async function load(){tabs();
 if(LG=="all"){const L=await Promise.all(CFG.leagues.filter(l=>l[0]!="all").map(l=>j(`data/${l[0]}.json`,{games:[],news:[]})));
  D={updated:L.map(x=>x.updated).filter(Boolean).sort().pop(),league:"All leagues",games:L.flatMap(x=>x.games||[]),news:L.flatMap(x=>x.news||[]).sort((a,b)=>a.d<b.d?1:-1).slice(0,12),standings:[]}}
 else D=await j(`data/${LG}.json`,{games:[],news:[],standings:[]});render()}
const recLg=r=>{if(r.lg)return r.lg;const m=String((r.ref||{}).rec||r.id||"").match(/\|(\d+)~/)||String((r.ref||{}).aid||"").match(/(\d+)/);return m?ALG[m[1]]:null};
function story(g){const h=g.home,a=g.away,out=[];const fav=g.line&&g.line!="EVEN"?g.line.split(" ")[0]:null;
 out.push(`${esc(a.name)} (${esc(a.record||"—")}) at ${esc(h.name)} (${esc(h.record||"—")}).`);
 if(g.line)out.push(`Market: ${esc(g.line)}${g.total?`, total ${g.total}`:""} (${esc(g.odds_src||"sportsbook")} via ESPN).`);
 const x=CFG.extra?CFG.extra(g,EX):[];return out.concat(x)}
function render(){const G=(D.games||[]).slice().sort((x,y)=>x.date<y.date?-1:1);
 $("upd").innerHTML=`Data updated ${ago(D.updated)} (${et(D.updated)}) · ${esc(D.league||"")}${D.week?" · Week "+D.week:""} ${D.season||""}`;
 const rec=REC.filter(r=>CFG.recSport.includes(r.sport)&&(LG=="all"||recLg(r)==LG));
 const lgName=(CFG.leagues.find(l=>l[0]==LG)||[,""])[1];
 $("take").innerHTML=rec.length?rec.slice(0,10).map(r=>`<div class="tk"><span class="pill">${r.gp?"GOAL PICK · "+esc(r.tier.toUpperCase()):"SPORTS LABS RECOMMENDED"}</span> <b>${esc(r.title)}</b>${r.gp?` <b>${r.price>0?"+"+r.price:r.price}</b> <span class="mut">${esc(r.book)} · our chance ${Math.round(r.p*100)}% vs ${Math.round(r.nv*100)}% no-vig · ${esc(r.xi)} · ${esc(r.season)}</span>`:""} <span class="mut">${et(r.start)}</span>${window.LR?LR.tag(r.sport,(r.ref||{}).aid||"",r.market,(r.ref||{}).line,(r.ref||{}).player||r.title.replace(/ (anytime|over|under|to score).*$/i,"")):""}</div>`).join("")+`<a href="${BL}sharp.html">All Sharp Picks in Bet Lab →</a>`:LG!="all"?`<div class="mut">No Recommended ${esc(lgName)} picks today. Pick <b>All</b> for every league. <a href="${BL}sharp.html">Sharp Picks in Bet Lab →</a></div>`:`<div class="mut">No Recommended ${CFG.short} picks have cleared our bar right now. When they do, they show here. <a href="${BL}sharp.html">Sharp Picks in Bet Lab →</a></div>`;
 $("games").innerHTML=G.length?G.map(g=>`<div class="g"><div class="gh"><span class="tm"><img loading="lazy" decoding="async" width="32" height="32" src="${esc(LOGO64(g.away.logo))}" alt="">${esc(g.away.abbr)} ${g.state!="pre"?esc(g.away.score):""}</span><span class="mut">@</span><span class="tm"><img loading="lazy" decoding="async" width="32" height="32" src="${esc(LOGO64(g.home.logo))}" alt="">${esc(g.home.abbr)} ${g.state!="pre"?esc(g.home.score):""}</span><span class="st ${g.state}">${esc(g.status)}</span></div><div class="mut sm">${et(g.date)}${g.venue?" · "+esc(g.venue):""}${g.bc&&g.bc[0]?" · 📺 "+esc(g.bc.filter(Boolean).join(", ")):""}</div><ul class="sl">${story(g).map(s=>`<li>${s}</li>`).join("")}</ul></div>`).join(""):'<div class="mut">No games in the current window.</div>';
 const S=D.standings||[],grps=[...new Set(S.map(r=>r.grp))];
 $("stand").innerHTML=grps.map(gp=>`<h3>${esc(gp)}</h3><div class="wrap"><table><tr><th>Team</th>${CFG.cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr>${S.filter(r=>r.grp==gp).map(r=>`<tr><td><img class="lg" loading="lazy" decoding="async" width="32" height="32" src="${esc(LOGO64(r.logo))}" alt="">${esc(r.name)}</td>${CFG.cols.map(c=>`<td>${esc(r.st[c[0]]??"")}</td>`).join("")}</tr>`).join("")}</table></div>`).join("")||'<div class="mut">Standings unavailable.</div>';
 if(LG=="all")$("stand").innerHTML='<div class="mut">Pick a league above for its table.</div>';
 $("news").innerHTML=(D.news||[]).map(n=>`<div class="nw"><a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}</a><div class="mut sm">${et(n.d)} · ESPN</div></div>`).join("")||'<div class="mut">No headlines.</div>';
 if(CFG.renderExtra)CFG.renderExtra(EX)}
(async()=>{if(ALL)j(BL+"data/soccer_aidlg.json",{}).then(M=>{ALG=M||{};if(REC.length)render()});
 const [ex,tiers,txt,SG]=await Promise.all([CFG.loadExtra?CFG.loadExtra():{},j(BL+"data/edge_tiers.json",{}),fetch(BL+"data/edge_log.jsonl?t="+Date.now()).then(r=>r.ok?r.text():"").catch(()=>""),j(BL+"data/soccer_goals.json",{rows:[]})]);EX=ex||{};
 const now=Date.now();REC=txt.split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l)}catch(e){return null}}).filter(p=>p&&(tiers[p.id]||{}).tier==="recommended"&&new Date(p.start||0)>now-24*3600e3);REC=((SG||{}).rows||[]).filter(r=>r.tier!="Pass"&&new Date(r.start)>now-3*3600e3).map(r=>Object.assign({gp:1},r)).concat(REC);load()})();
