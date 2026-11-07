// jsdom checks for integrated Soccer visuals. Run: NODE_PATH=/workspace/visual-preview-tests/node_modules node tests/hub_viz.cjs
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');const R=path.join(__dirname,'..');let ok=0,bad=0;
const t=(c,m)=>{c?ok++:(bad++,console.log('FAIL',m))};
const fetchStub=u=>{const f=path.join(R,String(u).split('?')[0]);return Promise.resolve(fs.existsSync(f)?{ok:true,json:async()=>JSON.parse(fs.readFileSync(f,'utf8'))}:{ok:false,json:async()=>null})};
(async()=>{for(const v of['viz-shotmap','viz-xgflow','viz-zones']){
 const dom=new JSDOM('<!doctype html><body><div class="w"><header>h</header><div class="lay">main</div><footer>f</footer></div></body>',{url:'https://x.test/index.html#'+v,runScripts:'outside-only'});
 const w=dom.window;w.fetch=fetchStub;w.HUB={leagues:[['all','All'],['eng.1','PL'],['esp.1','L'],['uefa.champions','UCL'],['uefa.europa','UEL']]};
 w.eval(fs.readFileSync(path.join(R,'navcfg.js'),'utf8'));w.eval(fs.readFileSync(path.join(R,'side.js'),'utf8'));w.eval(fs.readFileSync(path.join(R,'soccer-viz.js'),'utf8'));
 await new Promise(r=>setTimeout(r,400));const d=w.document,root=d.getElementById('viz-root');
 t(d.body.classList.contains('viz-on')&&!root.hidden,v+' visible in hub');t(d.querySelector('.sl-side a.cur')?.getAttribute('href')==='./index.html#'+v,v+' sidebar current');
 t(!d.querySelector('iframe'),v+' no iframe');t(root.querySelectorAll('svg').length>=1,v+' chart container');t(/unavailable|not available/i.test(root.textContent),v+' missing data labelled');
 t(!/<circle[^>]*class="shot/.test(root.innerHTML),v+' no invented shot dots');
 if(v==='viz-shotmap'){t(root.querySelectorAll('.vz-kpi>div').length===4,'kpi 2x2');t(root.querySelectorAll('.vz-meter').length===2,'model/book meters');const b=root.querySelector('button[data-k="side"][aria-pressed="false"]');b.click();await new Promise(r=>setTimeout(r,50));t(root.querySelector(`button[data-v="${b.dataset.v}"]`).getAttribute('aria-pressed')==='true','side toggle works');}
 if(v==='viz-xgflow'){t(root.querySelector('.vz-sb'),'scoreboard');t(/no xG line/.test(root.textContent),'no fabricated xG line')}
 if(v==='viz-zones'){t(root.querySelectorAll('.vz-two svg').length===2,'side-by-side pitches');t(root.querySelectorAll('.vz-t tr').length===7,'zones table')}
 w.location.hash='';await new Promise(r=>setTimeout(r,100));t(!d.body.classList.contains('viz-on'),v+' hub restored on exit');}
 console.log(`hub_viz: ${ok} passed, ${bad} failed`);process.exit(bad?1:0)})();
