(function(){'use strict';
const {node:n,text,card,num,pc,table,select,bars,meter,json}=PV;
const app=document.getElementById('preview-app'),controls=document.getElementById('preview-controls'),q=new URLSearchParams(location.search);let P,S,rows=[],playerId=q.get('player')||'';
const et=v=>new Date(v).toLocaleString('en-US',{timeZone:'America/New_York'})+' ET';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d&&d<=today;
const logs=p=>(p.this_szn||[]).filter(x=>validDate(x.d)&&typeof x.g==='number'&&Number.isFinite(x.g)&&x.g>=0).slice().sort((a,b)=>a.d.localeCompare(b.d));
function nativePlayer(p,id){return /^\d+$/.test(id)&&Object.hasOwn(P.players,id)?n('a',{href:'index.html?'+new URLSearchParams({visualPlayer:id})},p.player):p.player}
function nativeTeam(p){return Object.hasOwn(P.teams||{},p.team)?n('a',{href:'index.html?'+new URLSearchParams({visualTeam:p.team})},p.team):p.team}
function render(){
 if(!Object.hasOwn(P.players,playerId)||!logs(P.players[playerId]).length)playerId=String(rows.find(x=>P.players[String(x.aid)]&&logs(P.players[String(x.aid)]).length&&typeof x.price==='number'&&Math.abs(x.price)>=100)?.aid||'');
 const p=P.players[playerId]||Object.values(P.players).find(x=>logs(x).length);if(!p)throw Error('No supported recorded player logs');playerId=String(p.aid||Object.entries(P.players).find(([,v])=>v===p)?.[0]||'');
 const history=logs(p),recent=history.slice(-10),candidates=rows.filter(x=>String(x.aid)===playerId),pick=candidates.find(x=>Date.parse(x.start)>=Date.now())||candidates.at(-1),rate=history.length?history.filter(x=>x.g>=1).length/history.length:null;
 const price=pick?.price,implied=typeof price==='number'&&Number.isFinite(price)&&Math.abs(price)>=100?(price>0?100/(price+100):Math.abs(price)/(Math.abs(price)+100)):null;
 const located=recent.filter(x=>typeof x.sh==='number'&&Number.isFinite(x.sh));
 app.replaceChildren(n('div',{class:'pv-two'},card('Recorded shot volume · last '+recent.length+' appearances',located.length?bars(located.map(x=>x.d),located.map(x=>x.sh)):text('No numeric shot counts in this player’s logged appearances.'),text('Counts per completed appearance, not shot coordinates or xG. Missing shot counts are omitted, never converted to zero.'),table(['Date','Shots','On target','Goals'],recent.map(x=>[x.d,num(x.sh,0),num(x.sot,0),num(x.g,0)]))),card('Anytime-goal comparison',n('h3',{},nativePlayer(p,playerId),' · ',nativeTeam(p)),pick?text(pick.matchup+' · '+et(pick.start)+' · '+(Date.parse(pick.start)<Date.now()?'recorded fixture, not upcoming':'recorded upcoming fixture')):text('No matching scorer projection in the current recorded slate.'),meter('Existing goal estimate',typeof pick?.p==='number'?pick.p:null,'The existing scorer model output is displayed unchanged.'),meter('Recorded price · implied',implied,implied===null?'No usable recorded American price.':'Raw implied probability, not no-vig; bookmaker identity and live freshness are not supplied.','#72afff'),meter('Observed scoring-game rate',rate,history.filter(x=>x.g>=1).length+' scoring appearances / '+history.length+' logged current-season appearances; not a calibrated forecast.','#f2b36d'))));
 PV.controls(select('Player',Object.entries(P.players).filter(([,p])=>logs(p).length).sort((a,b)=>a[1].player.localeCompare(b[1].player)).map(([id,p])=>[id,p.player+' · '+p.team]),playerId,v=>{playerId=v;render()}));historyReplace();
}
function historyReplace(){window.history.replaceState(null,'','?'+new URLSearchParams({player:playerId}))}
async function boot(){PV.nav();[P,S]=await Promise.all([json('data/hub_profiles.json'),json('data/scorers.json')]);
 for(const l of Object.values(S.leagues||{}))for(const m of l.matches||[])for(const p of m.players||[])rows.push({...p,start:m.start,matchup:m.matchup});
 PV.status('Recorded scorer comparison · model / price / appearances · not live','Scorer snapshot '+et(S.updated)+' · profile/log snapshot '+et(P.updated)+' · not a live poll. Separate refresh times; logged appearances may be incomplete.');render()}
document.addEventListener('pv-reset',()=>{playerId='';render()});
boot().catch(e=>app.replaceChildren(card('Unavailable',text(e.message))));
})();