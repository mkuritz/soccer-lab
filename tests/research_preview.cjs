// jsdom checks for the LOCAL research preview build and the fail-closed published Hub.
// Run after build: NODE_PATH=/workspace/visual-preview-tests/node_modules node tests/research_preview.cjs [/workspace/research-preview/soccer-hub-1106]
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');const REPO=path.join(__dirname,'..'),OUT=process.argv[2]||'/workspace/research-preview/soccer-hub-1106';
let ok=0,bad=0;const t=(c,m)=>{c?ok++:(bad++,console.log('FAIL',m))},wait=ms=>new Promise(r=>setTimeout(r,ms));
// published repo stays fail-closed
const idx=fs.readFileSync(path.join(REPO,'index.html'),'utf8');t(!/research-events|soccer-research/.test(idx),'published index has no research scripts');t(!fs.existsSync(path.join(REPO,'data','events')),'no public event data dir');
t(!fs.readdirSync(path.join(REPO,'data')).some(f=>/3943043|3869685/.test(f)),'no StatsBomb files in public data');t(/license_ok===true/.test(fs.readFileSync(path.join(REPO,'soccer-viz.js'),'utf8')),'license gate unchanged');
if(!fs.existsSync(path.join(OUT,'research-events.js'))){console.log('research build not present; built-output checks skipped');console.log(`research_preview: ${ok} passed, ${bad} failed`);process.exit(bad?1:0)}
t(!OUT.startsWith(REPO),'output outside repo');t(!fs.existsSync(path.join(OUT,'CNAME')),'build not deployable as prod domain');
(async()=>{const fetchStub=u=>{const f=path.join(OUT,String(u).split('?')[0].replace(/^\.\//,''));return Promise.resolve(fs.existsSync(f)?{ok:true,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))}:{ok:false,json:async()=>null})};
 const dom=new JSDOM('<!doctype html><body><div class="w"><header>h</header><footer>f</footer></div></body>',{url:'https://local.test/index.html#viz-shotmap',runScripts:'outside-only'});const w=dom.window;w.fetch=fetchStub;w.HUB={leagues:[['eng.1','PL']]};
 for(const f of['navcfg.js','side.js','research-events.js','soccer-research.js','soccer-viz.js'])w.eval(fs.readFileSync(path.join(OUT,f),'utf8'));await wait(400);const d=w.document,R=()=>d.getElementById('viz-root');
 const S=w.SL_RESEARCH_EVENTS;t(S.length===2&&S.every(m=>m.source.license_ok===false),'2 samples, license gate false');
 t(/Current hub data/.test(R().textContent)&&!R().querySelector('.vz-credit'),'defaults to current hub data');
 R().querySelector('button[data-k="src"][data-v="res"]').click();await wait(150);
 const m0=S.find(m=>m.match_id===w.SoccerViz._st.rm);t(R().querySelectorAll('svg[aria-label$="located shots"] circle').length===m0.shots.filter(s=>s.team===w.SoccerViz._st.rteam).length,'shot map plots every located shot of selected team');
 t(/StatsBomb Open Data/.test(R().textContent)&&/Historical research sample/.test(R().textContent)&&/Not current club coverage/.test(R().textContent),'attribution + historical label');t(/No market or model/.test(R().textContent),'no fabricated market');
 const ps=R().querySelector('select[data-k="rplayer"]');ps.value=ps.options[1].value;ps.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(150);const pid=ps.options[1].value;t(R().querySelectorAll('svg[aria-label$="located shots"] circle').length===m0.shots.filter(s=>s.player_id===pid).length,'player filter');
 w.location.hash='viz-xgflow';await wait(200);t(R().querySelectorAll('svg[aria-label="Cumulative xG by team"] path').length===2,'two-team xG steps');t(R().querySelectorAll('svg[aria-label="Cumulative xG by team"] circle').length===m0.goals.length,'goal markers = shot goals');
 t(/Field tilt/.test(R().textContent)&&R().textContent.includes(String(m0.field_tilt.denominator)),'field tilt from located pass origins');t(R().querySelectorAll('.vz-t tr').length===Math.min(8,m0.largest_chances.length)+1,'largest chances table');t(/own goals not covered/.test(R().textContent),'own-goal coverage note');
 const ms=R().querySelector('select[data-k="rm"]');ms.value=ms.options[1].value;ms.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(150);t(/shootout excluded/.test(R().textContent)&&R().querySelector('.vz-sb').textContent.includes(Object.values(S.find(m=>m.match_id===ms.options[1].value).teams)[0]),'match selector switches sample');
 w.location.hash='viz-zones';await wait(200);t(R().querySelectorAll('.vz-two svg[aria-label$="by zone"] rect').length===18,'two 3x3 zone pitches');t(R().querySelectorAll('.vz-t tr').length===4,'zone table');
 R().querySelector('button[data-k="rtype"][data-v="pass"]').click();await wait(150);t(/located passes by origin zone/.test(R().textContent),'action type filter');
 t(d.querySelector('.sl-side a.cur')?.getAttribute('href')==='./index.html#viz-zones','sidebar active in research build');
 console.log(`research_preview: ${ok} passed, ${bad} failed`);process.exit(bad?1:0)})();
