/* Native profile entry adapter: exact dataset IDs only, never name guesses. */
(function(){'use strict';
const q=new URLSearchParams(location.search),id=q.get('visualPlayer'),team=q.get('visualTeam');
if(!id&&!team)return;
function notice(message){const p=document.createElement('p');p.textContent=message;p.setAttribute('role','status');document.body.prepend(p)}
async function run(){
 if(typeof window.openPlayerModal==='function'||typeof window.openTeamModal==='function'){
  try{
   const r=await fetch('data/hub_profiles.json',{mode:'same-origin',credentials:'same-origin',redirect:'error'});if(!r.ok)throw Error('Profile dataset unavailable');const d=await r.json();window.SOC_PROFILES=d;
   if(id&&/^\d+$/.test(id)&&d.players?.[id]&&typeof window.openPlayerModal==='function'){const p=d.players[id];window.openPlayerModal(id,p.player,p.team)}
   else if(team&&Object.prototype.hasOwnProperty.call(d.teams||{},team)&&typeof window.openTeamModal==='function'){window.openTeamModal(team,d.teams[team].lg)}
   else notice('No supported native soccer profile for this identifier.');
  }catch{notice('Native soccer profile data unavailable.')}
 }
}
if(document.readyState==='complete')run();else window.addEventListener('load',run,{once:true});
})();
