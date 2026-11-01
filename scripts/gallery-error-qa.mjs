import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),project=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).name.includes('six')?'six':'orla';
const base=process.env.VISUAL_BASE_URL||`http://127.0.0.1:${project==='six'?14326:14324}`,phase=process.env.GALLERY_ERROR_PHASE||'gallery-error-after';
const directory=resolve(root,'artifacts/pixel-audit-20261101-v2',phase);await mkdir(directory,{recursive:true});
const html=await(await fetch(base)).text(),config=JSON.parse(html.match(/<script id="(?:orla|six)-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const manifest=JSON.parse(await readFile(resolve(root,'src/data/responsive-images.json'),'utf8'));
const failed=config.gallery[1].image,blocked=new Set([failed,...(manifest[failed]?.variants||[]).map(v=>v.src)]);
const require=createRequire(import.meta.url),playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const report={project,startedAt:new Date().toISOString(),pass:false,engines:[]};let browser;
async function settled(page){
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  const nodes=[...document.querySelectorAll('.interiors__slide,.gallery__main img,.gallery__preview img')];let old='',stable=0,raf;const started=performance.now(),timer=setTimeout(()=>{cancelAnimationFrame(raf);reject(new Error('Gallery did not settle'));},5000);
  function frame(){const signature=JSON.stringify(nodes.map(n=>{const c=getComputedStyle(n);return[c.opacity,c.transform,c.visibility,n.src,n.currentSrc];}));stable=signature===old?stable+1:0;old=signature;if(stable>=7&&performance.now()-started>800){clearTimeout(timer);resolve();}else raf=requestAnimationFrame(frame);}frame();
 }));
}
try{
 for(const engine of(process.env.GALLERY_ERROR_ENGINES||'chromium,webkit').split(',')){
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{args:['--no-sandbox']}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),page=await context.newPage();page.setDefaultTimeout(8000);
  const result={engine,blocked:[],captures:[],states:[],errors:[]};report.engines.push(result);let unavailable=true;
  await context.route('**/api/**',route=>route.abort('blockedbyclient'));
  await context.route('**/*',route=>{
   if(unavailable&&blocked.has(new URL(route.request().url()).pathname)){result.blocked.push(route.request().url());return route.abort('failed');}
   return route.fallback();
  });
  page.on('pageerror',error=>result.errors.push(error.message));
  const id=project==='six'?'interiors':'interior',controls=project==='six'?'.gallery__controls':'.gallery-controls';
  async function state(label){
   await settled(page);const data=await page.evaluate(project=>{
    const current=document.querySelector('[data-gallery-current]').textContent.trim(),image=document.querySelector(project==='six'?'[data-gallery-image]':'.interiors__slide.is-active img');
    const preview=document.querySelector('[data-gallery-preview]');
    return {current,image:{loaded:image.complete&&image.naturalWidth>0,alt:image.alt,src:image.currentSrc||image.src},preview:preview&&{loaded:preview.complete&&preview.naturalWidth>0,alt:preview.alt,src:preview.src},scrollY};
   },project);result.states.push({label,...data});const file=engine+'-'+label+'.png';await page.screenshot({path:resolve(directory,file)});result.captures.push(file);return data;
  }
  async function advance(direction){await page.locator(`${controls} [data-gallery-${direction}]`).click();await page.waitForFunction(id=>!document.getElementById(id).hasAttribute('aria-busy')&&!document.querySelector('.gallery')?.hasAttribute('aria-busy'),id);}
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(project=>project==='six'?document.querySelector('#home')?.dataset.view!==undefined:document.querySelector('.interiors__slides')?.style.isolation==='isolate',project);
   await page.waitForFunction(()=>document.fonts.status==='loaded'&&!document.querySelector('.intro.is-active'));
   await page.evaluate(id=>{const n=document.getElementById(id),stage=n.querySelector('.chapter__stage');scrollTo({top:n.getBoundingClientRect().top+scrollY+(n.classList.contains('is-story')?(n.offsetHeight-stage.offsetHeight)*.88:-100),behavior:'instant'});},id);
   await state('initial');await advance('next');const rejected=await state('failed-second');
   await advance('next');const skipped=await state('next-reaches-third');
   unavailable=false;await advance('prev');const retried=await state('previous-retries-second');
   assert.ok(result.blocked.length,'The test must actually reject the original or responsive second image.');
   assert.equal(rejected.current,'1','Failed decode must keep the displayed photograph and counter.');assert.ok(rejected.image.loaded,'Failed decode blanked the current photograph.');
   assert.equal(skipped.current,'3','Next must move past an unavailable second photograph.');assert.ok(skipped.image.loaded);
   assert.equal(retried.current,'2','Previous must retry the now-available second photograph.');assert.ok(retried.image.loaded);
   assert.ok([rejected,skipped,retried].every(s=>!s.preview||s.preview.loaded),'A broken preview must retain a decoded photograph.');
   result.pass=!result.errors.length;
  }catch(error){result.error=error.stack;result.pass=false;}
  finally{await context.close();await browser.close();browser=undefined;}
 }
}finally{
 await browser?.close().catch(()=>{});report.finishedAt=new Date().toISOString();report.pass=report.engines.length>0&&report.engines.every(r=>r.pass);
 await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
if(!report.pass)process.exitCode=1;
