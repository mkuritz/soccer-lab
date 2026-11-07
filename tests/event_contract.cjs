// Validates sl-soccer-events/1 files. Usage: node tests/event_contract.cjs [file...]; with no args runs a self-test.
const fs=require('fs');
function validate(e){const err=[];const n=v=>v===null||(typeof v==='number'&&isFinite(v));
 if(e.schema!=='sl-soccer-events/1')err.push('schema');if(!/^\d{1,12}$/.test(String(e.game_id)))err.push('game_id');
 if(!e.source||e.source.license_ok!==true||!e.source.attribution||!e.source.provider)err.push('source/license');
 if(!Array.isArray(e.shots))err.push('shots');else e.shots.forEach((s,i)=>{if(!(s.x>=0&&s.x<=105&&s.y>=0&&s.y<=68))err.push('shot '+i+' coords');if(!n(s.xg)||(s.xg!==null&&(s.xg<0||s.xg>1)))err.push('shot '+i+' xg');if(s.xg!=null&&!s.xg_model)err.push('shot '+i+' xg_model');if(!['goal','saved','blocked','off_target','post'].includes(s.outcome))err.push('shot '+i+' outcome');if(!(s.minute>=0&&s.minute<=130))err.push('shot '+i+' minute')});
 return err}
const files=process.argv.slice(2);let bad=0;
if(!files.length){const good={schema:'sl-soccer-events/1',game_id:'1',source:{provider:'p',attribution:'a',license_ok:true},shots:[{x:90,y:30,xg:.2,xg_model:'m',outcome:'goal',minute:10}]};
 const r1=validate(good),r2=validate({...good,source:{...good.source,license_ok:false}}),r3=validate({...good,shots:[{...good.shots[0],xg:null,x:200}]});
 bad=(r1.length?1:0)+(r2.length?0:1)+(r3.length===1?0:1);console.log('event_contract self-test',bad?'FAILED':'3 passed');}
for(const f of files){const r=validate(JSON.parse(fs.readFileSync(f,'utf8')));console.log(f,r.length?'INVALID: '+r.join(', '):'valid');bad+=r.length?1:0}
process.exit(bad?1:0);module.exports=validate;
