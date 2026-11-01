import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const project=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).name.includes('six')?'six':'orla';
const require=createRequire(import.meta.url),playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.VISUAL_BASE_URL||`http://127.0.0.1:${project==='six'?14326:14324}`;
const phase=process.env.INTERACTION_PHASE||'interactions-after';
const directory=resolve(root,'artifacts/pixel-audit-20261101-v2',phase);
const widths=(process.env.INTERACTION_WIDTHS||'1440,390,320,844').split(',').map(Number);
const report={project,base,startedAt:new Date().toISOString(),completed:false,pass:false,profiles:[],pageErrors:[],unexpectedRequests:[]};
await mkdir(directory,{recursive:true});
let browser;

async function settle(page){
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  const nodes=[...document.querySelectorAll('header,.hotspot,.hero__architecture,.hero__water,.hero-card,dialog[open],dialog[open] h2,dialog[open] h3,.interiors__slide,.gallery__main img,.gallery__preview img,.zoom-canvas,.chapter__stage,.state-primary,.state-secondary,[data-reveal],[data-reveal]>*,.feature-content,.residence-main,.unit-detail:not([hidden])')];
  let old='',steady=0,frame;const start=performance.now(),timer=setTimeout(()=>{cancelAnimationFrame(frame);reject(new Error('Interaction geometry did not settle'));},6500);
  function sample(){
   const value=JSON.stringify([scrollY,...nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return[r.x,r.y,r.width,r.height,s.opacity,s.transform,s.visibility,n.scrollTop,n.scrollLeft];})]);
   steady=value===old?steady+1:0;old=value;
   if(steady>=7&&performance.now()-start>=450){clearTimeout(timer);resolve();}else frame=requestAnimationFrame(sample);
  }sample();
 }));
}
async function prepare(page){
 const response=await page.goto(base,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
 await page.waitForFunction(project=>project==='six'?document.querySelector('#home')?.dataset.view!==undefined:document.querySelector('.interiors__slides')?.style.isolation==='isolate',project);
 await page.waitForFunction(()=>document.fonts.status==='loaded'&&!document.querySelector('.intro.is-active'));
 await settle(page);
}
async function reach(page,id,view=1){
 await page.evaluate(({id,view})=>{
  const n=document.getElementById(id),stage=n.querySelector('.chapter__stage');
  const top=n.getBoundingClientRect().top+scrollY;
  scrollTo({top:n.classList.contains('is-story')?top+(n.offsetHeight-stage.offsetHeight)*(view?(id==='about'?.76:.88):.07):top-100,behavior:'instant'});
 },{id,view});
 await settle(page);
}
async function reveal(page,locator){
 await locator.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
 await page.waitForFunction(n=>{const s=getComputedStyle(n);return s.visibility==='visible'&&Number(s.opacity)>.99;},await locator.elementHandle());
 await settle(page);
}
async function click(page,selector){
 const locator=typeof selector==='string'?page.locator(selector).first():selector;
 await reveal(page,locator);await locator.click();await settle(page);
}
async function close(page,id){
 await page.keyboard.press('Escape');
 await page.waitForFunction(id=>!document.getElementById(id).open,id);
 await page.waitForFunction(()=>document.documentElement.classList.contains('modal-open')===!!document.querySelector('dialog[open]')&&document.body.classList.contains('modal-open')===!!document.querySelector('dialog[open]'));
 await settle(page);
}
async function capture(page,result,label,dialogId){
 await settle(page);
 const file=`${result.engine}-${result.width}x${result.height}-${String(result.captures.length+1).padStart(3,'0')}-${label}.png`;
 const measurement=await page.evaluate(dialogId=>{
  const rect=n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
  const dialog=dialogId&&document.getElementById(dialogId),button=dialog?.querySelector('[data-close]');
  const box=button&&rect(button),hit=box&&document.elementFromPoint((box.left+box.right)/2,(box.top+box.bottom)/2);
  const close=box&&{...box,hit:!!hit&&(button===hit||button.contains(hit)),name:button.getAttribute('aria-label')};
  return{scrollY,viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(n=>n.id),dialog:dialog&&{id:dialogId,...rect(dialog),scrollTop:dialog.scrollTop,scrollHeight:dialog.scrollHeight,clientWidth:dialog.clientWidth,scrollWidth:dialog.scrollWidth},close,
   glyphs:[...document.querySelectorAll('body *')].filter(n=>!n.matches('script,style')&&[...n.childNodes].some(t=>t.nodeType===3&&/[\u2190-\u21ff\u27a0-\u27bf\u276e-\u276f\u2039\u203a\u00ab\u00bb]/u.test(t.textContent))).map(n=>n.tagName+'.'+n.className),
   icons:[...document.querySelectorAll('.ui-icon')].filter(n=>n.getClientRects().length).length,
   modalImageRatios:[...(dialog?.querySelectorAll('.related-features img,.residence-collection>img,.enquiry__photo')||[])].map(n=>{const r=n.getBoundingClientRect(),parts=getComputedStyle(n).aspectRatio.split('/').map(Number);return{src:n.getAttribute('src'),width:r.width,height:r.height,expected:parts[0]/(parts[1]||1)};}).filter(n=>n.width>0&&n.height>0)};
 },dialogId);
 await page.screenshot({path:resolve(directory,file),timeout:20000});result.captures.push({file,label,...measurement});
 if(measurement.documentWidth>measurement.viewport.width+1)result.issues.push(`${label}: document overflow`);
 if(measurement.dialog&&measurement.dialog.scrollWidth>measurement.dialog.clientWidth+1)result.issues.push(`${label}: dialog content overflows horizontally`);
 if(measurement.glyphs.length)result.issues.push(`${label}: text arrow glyphs remain`);
 if(measurement.modalImageRatios.some(n=>Math.abs(n.height-n.width/n.expected)>1))result.issues.push(`${label}: authored image aspect ratio is distorted`);
 if(measurement.close&&(!measurement.close.hit||measurement.close.top<0||measurement.close.left<0||measurement.close.bottom>result.height+1||measurement.close.right>result.width+1))result.issues.push(`${label}: close control is outside the viewport or covered`);
 console.log(JSON.stringify({project,engine:result.engine,width:result.width,label,file}));
}
async function dialogShots(page,result,id,label,tiles=true){
 await page.waitForFunction(id=>document.getElementById(id).open,id);
 const sizes=await page.locator('#'+id).evaluate(n=>({height:n.clientHeight,range:n.scrollHeight-n.clientHeight}));
 const offsets=[0];if(tiles&&sizes.range>30){if(sizes.range>sizes.height)offsets.push(sizes.range/2);offsets.push(sizes.range);}
 for(let i=0;i<offsets.length;i++){await page.locator('#'+id).evaluate((n,top)=>n.scrollTo({top,behavior:'instant'}),offsets[i]);await capture(page,result,`${label}-${i+1}`,id);}
 await page.locator('#'+id).evaluate(n=>n.scrollTo({top:0,behavior:'instant'}));
}
async function zoom(page,result,label){
 await page.waitForFunction(()=>{const img=document.querySelector('[data-zoom-image]');return document.querySelector('#zoom-dialog').open&&!document.querySelector('.zoom-stage').hasAttribute('aria-busy')&&img.complete&&img.naturalWidth&&!img.hidden;});
 await dialogShots(page,result,'zoom-dialog',label+'-fit',false);
 await page.locator('[data-zoom-in]').click();await page.locator('[data-zoom-in]').click();await settle(page);
 await page.locator('.zoom-stage').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');
 await capture(page,result,label+'-zoom-pan','zoom-dialog');
 await page.locator('[data-zoom-reset]').click();await settle(page);assert.equal((await page.locator('[data-zoom-reset]').textContent()).trim(),'Fit');
 await close(page,'zoom-dialog');
}
async function gallery(page,result){
 const id=project==='six'?'interiors':'interior';await reach(page,id);
 for(let index=0;index<4;index++){
  if(index){await click(page,'[data-gallery-next]');await page.waitForFunction(n=>document.querySelector('[data-gallery-current]').textContent.trim()===String(n),index+1);}
  await capture(page,result,`gallery-${index+1}`);
 }
 await click(page,'[data-gallery-zoom]');await zoom(page,result,'gallery');
 await reach(page,id);const target=page.locator(project==='six'?'.gallery':'#interior');await target.focus();
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(()=>document.querySelector('[data-gallery-current]').textContent.trim()==='1');await settle(page);
 await capture(page,result,'gallery-rapid-keyboard');
 const y=await page.evaluate(()=>scrollY);await page.emulateMedia({reducedMotion:'reduce'});await settle(page);
 await capture(page,result,'gallery-reduced');
 const active=await page.evaluate(()=>{const n=[...document.querySelectorAll('main>section')].find(n=>{const r=n.getBoundingClientRect();return r.top<=innerHeight*.3&&r.bottom>innerHeight*.3;});return n?.id;});assert.equal(active,id,'Preference change lost the gallery');
 if(project==='orla')assert.ok(Math.abs(await page.evaluate(()=>scrollY)-y)<=2,'ORLA preference change moved the document');
 await page.emulateMedia({reducedMotion:'no-preference'});await settle(page);
 result.checks.push('all gallery photographs, zoom, rapid keyboard and live reduced-motion continuity');
}
async function form(page,result,id,modal,mock){
 const form=page.locator('#'+id);
 await click(page,form.locator('button[type=submit]'));assert.ok(await form.locator('[aria-invalid=true]').count()>0);
 await capture(page,result,id+'-validation',modal?'enquiry-dialog':undefined);
 if(project==='six'){
  await form.locator('[name=firstName]').fill('Visual');await form.locator('[name=lastName]').fill('Audit');
  await form.locator('[name=country]').selectOption('Other');await form.locator('[name=otherCountry]').fill('Test Country');
 }else await form.locator('[name=name]').fill('Visual Audit');
 await form.locator('[name=email]').fill('visual-audit@example.test');await form.locator('[name=phone]').fill('+971500000000');
 await form.locator('[name=message]').fill('Isolated visual QA. This request is intercepted locally.');await form.locator('[name=consent]').check();
 for(const kind of project==='six'?['privacy','terms']:['privacy']){
  await click(page,form.locator('[data-'+kind+']'));await dialogShots(page,result,kind+'-dialog',id+'-'+kind);await close(page,kind+'-dialog');
 }
 mock.value='error';await click(page,form.locator('button[type=submit]'));
 await page.waitForFunction(id=>document.querySelector('#'+id+' [data-submit-label]').textContent==='Try again',id);
 assert.equal(await form.locator('[name=email]').inputValue(),'visual-audit@example.test');await capture(page,result,id+'-retained-error',modal?'enquiry-dialog':undefined);
 mock.value='success';await click(page,form.locator('button[type=submit]'));
 await page.waitForFunction(id=>document.getElementById(id).hidden,id);
 await capture(page,result,id+'-success',modal?'enquiry-dialog':undefined);
 if(modal)await close(page,'enquiry-dialog');result.checks.push(id+': validation, other-country, legal dialogs, mocked error retention and success');
}
async function orla(page,result,mock,compact){
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await settle(page);
 for(const index of compact?[1]:[0,1]){
  const point=page.locator('[data-hotspot]').nth(index);await reveal(page,point);
  const r=await point.boundingBox();await (result.width<600?page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2):page.mouse.click(r.x+r.width/2,r.y+r.height/2));
  await page.waitForFunction(()=>!document.querySelector('#hero-hotspot').hidden);await capture(page,result,'hotspot-'+(index+1));
  await page.locator('[data-hotspot-close]').click();await page.waitForFunction(()=>document.querySelector('#hero-hotspot').hidden);
 }
 if(compact){await click(page,'.feature-card');await dialogShots(page,result,'feature-dialog','compact-feature');await close(page,'feature-dialog');}
 if(!compact){
  await click(page,'.watch');await page.waitForFunction(()=>document.querySelector('#orla-film').readyState>=1);
  await dialogShots(page,result,'media-dialog','film-preview',false);await page.locator('#orla-film').evaluate(video=>video.play());await capture(page,result,'film-playing','media-dialog');
  await close(page,'media-dialog');assert.equal(await page.locator('#orla-film').evaluate(video=>video.paused),true);
  await gallery(page,result);
  const features=await page.locator('.feature-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.feature));
  await click(page,'.feature-card');
  for(const id of features){await click(page,`.feature-sidebar [data-feature="${id}"]`);await page.waitForFunction(()=>!document.querySelector('[data-feature-image]').hasAttribute('aria-busy'));await dialogShots(page,result,'feature-dialog','feature-'+id);}
  await close(page,'feature-dialog');result.checks.push('all eight feature panels and source photographs');
 }
 await click(page,'[data-category]');const ids=await page.locator('[data-select-category]').evaluateAll(nodes=>nodes.map(n=>n.dataset.selectCategory));
 for(const id of compact?ids.slice(0,1):ids){await click(page,`[data-select-category="${id}"]`);await dialogShots(page,result,'residence-dialog','collection-'+id);}
 await click(page,'[data-collection-panel] [data-show-residence]');await dialogShots(page,result,'residence-dialog','residence-401');
 await click(page,'[data-plan-zoom]');await zoom(page,result,'residence-plan');assert.equal(await page.locator('#residence-dialog').evaluate(n=>n.open),true);
 await close(page,'residence-dialog');result.checks.push('all residence collections, residence 401, nested plan zoom and close');
 if(!compact){
  for(const [selector,id]of [['.palm [data-modal="location-dialog"]','location-dialog'],['.site-footer [data-modal="story-dialog"]','story-dialog']]){await click(page,selector);await dialogShots(page,result,id,id);await close(page,id);}
 }
 const enquiry=await page.locator('.header-enquire').isVisible()?'.header-enquire':'.nature [data-modal="residence-dialog"]';
 if(enquiry==='.header-enquire')await click(page,enquiry);else{await click(page,enquiry);await click(page,'[data-category-enquire]');}
 await dialogShots(page,result,'enquiry-dialog','enquiry-empty');
 if(compact)await close(page,'enquiry-dialog');else await form(page,result,'enquiry-form',true,mock);
 while(await page.locator('dialog[open]').count())await page.keyboard.press('Escape');await settle(page);
}
async function six(page,result,mock,compact){
 if(!compact){
  const chapters=await page.locator('[data-story]').evaluateAll(nodes=>nodes.map(n=>n.id));
  if(await page.locator('.is-story').count())for(const id of chapters)for(const view of [0,1]){await reach(page,id,view);await page.locator(`#${id} [data-story-switch="${view}"]`).click();await capture(page,result,`chapter-${id}-view-${view}`);assert.equal(await page.locator(`#${id} [data-story-switch="${view}"]`).getAttribute('aria-pressed'),'true');}
  await gallery(page,result);
 }
 await reach(page,'layouts');
 if(await page.locator('[data-layout-next]').isVisible()&&await page.locator('[data-layout-next]').isEnabled()){
  await click(page,'[data-layout-next]');await capture(page,result,'layout-rail-duplex');await click(page,'[data-layout-prev]');await capture(page,result,'layout-rail-triplex');
 }
 await click(page,'.layout-card [data-unit="triplex"]');
 for(const unit of compact?['triplex']:['triplex','duplex']){
  await click(page,`#unit-dialog [data-unit="${unit}"]`);await dialogShots(page,result,'unit-dialog','unit-'+unit);
  await click(page,`[data-unit-panel="${unit}"] [data-plan-zoom]`);await zoom(page,result,unit+'-plan');
 }
 await close(page,'unit-dialog');result.checks.push('both layouts, carousel controls, unit panels and nested plan zoom');
 if(!compact){
  await reach(page,'location');await click(page,'[data-location-zoom]');await zoom(page,result,'location-map');
  await reach(page,'infrastructure',0);const photos=page.locator('[data-photo]');
  for(let i=0;i<await photos.count();i++){await click(page,photos.nth(i));await zoom(page,result,'wellbeing-'+i);}
  await reach(page,'contact');await form(page,result,'contact-form',false,mock);
 }
 if(await page.locator('.header-register').isVisible())await click(page,'.header-register');else{await page.locator('.menu-toggle').click();await page.waitForFunction(()=>document.querySelector('#menu-dialog').open);await click(page,'#menu-dialog [data-enquire]');}
 await dialogShots(page,result,'enquiry-dialog','enquiry-empty');
 if(compact){
  for(const kind of ['privacy','terms']){
   await click(page,`#modal-form [data-${kind}]`);await dialogShots(page,result,kind+'-dialog','compact-'+kind);
   const box=await page.locator('#'+kind+'-dialog').boundingBox();await page.mouse.move(box.x+box.width/2,Math.min(result.height-20,box.y+box.height/2));await page.mouse.wheel(0,1200);await settle(page);
   await capture(page,result,'compact-'+kind+'-native-close',kind+'-dialog');
   const control=await page.locator('#'+kind+'-dialog [data-close]').boundingBox();
   // Coordinate input cannot repair an offscreen close by auto-scrolling it.
   await page.mouse.click(control.x+control.width/2,control.y+control.height/2);await page.waitForFunction(id=>!document.getElementById(id).open,kind+'-dialog');await settle(page);
  }
  await close(page,'enquiry-dialog');
 }else await form(page,result,'modal-form',true,mock);
 while(await page.locator('dialog[open]').count())await page.keyboard.press('Escape');await settle(page);
}

try{
 for(const engine of (process.env.INTERACTION_ENGINES||'chromium').split(',')){
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{args:['--no-sandbox']}:{})});
  for(const width of widths){
   const height=width===844?390:width===1440?900:844,result={engine,width,height,captures:[],checks:[],issues:[],mockedRequests:[]};report.profiles.push(result);
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'no-preference',...(width<600?{hasTouch:true,isMobile:true}:{})}),page=await context.newPage(),mock={value:'error'};
   page.setDefaultTimeout(10000);page.on('pageerror',error=>report.pageErrors.push({engine,width,message:error.message}));
   await context.route('**/api/**',route=>{
    if(!route.request().url().endsWith('/api/enquiry'))report.unexpectedRequests.push(route.request().url());
    const body=route.request().postDataJSON();result.mockedRequests.push({mode:mock.value,project:body.project,id:body.submissionId});
    return route.fulfill({status:mock.value==='success'?201:503,contentType:'application/json',body:JSON.stringify(mock.value==='success'?{ok:true,id:body.submissionId}:{ok:false,error:'Local QA response. Your details have been retained.'})});
   });
   try{
    await prepare(page);const compact=[320,844].includes(width);
    if(await page.locator('.menu-toggle').isVisible()){
     await page.locator('.menu-toggle').click();await dialogShots(page,result,'menu-dialog','menu');
     result.keyboardTrace=[];
     for(let i=0;i<10;i++){
      const key=i%3===0?'Shift+Tab':'Tab';await page.keyboard.press(key);
      const state=await page.locator('#menu-dialog').evaluate(n=>({documentFocused:document.hasFocus(),inside:n.contains(document.activeElement),active:document.activeElement?.tagName,id:document.activeElement?.id,dialogOpen:n.open}));
      result.keyboardTrace.push({key,...state});
      // A native modal permits leaving the document for browser chrome. While
      // the document owns focus, no background control may receive it.
      assert.equal(state.dialogOpen,true);assert.ok(!state.documentFocused||state.inside,'Keyboard focus reached the background while the modal was open');
     }
     await close(page,'menu-dialog');assert.equal(await page.locator('.menu-toggle').evaluate(n=>n===document.activeElement),true);result.checks.push('menu keyboard loop, Escape and focus restoration');
    }
    await (project==='orla'?orla:six)(page,result,mock,compact);
    assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.evaluate(()=>document.body.classList.contains('modal-open')||document.documentElement.classList.contains('modal-open')),false);
   }catch(error){result.issues.push(error.stack);await capture(page,result,'failure').catch(()=>{});}
   finally{await context.close();await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n');}
  }
  await browser.close();browser=undefined;
 }
 report.completed=true;
}finally{
 await browser?.close().catch(()=>{});report.finishedAt=new Date().toISOString();report.pass=report.completed&&!report.pageErrors.length&&!report.unexpectedRequests.length&&report.profiles.every(p=>!p.issues.length);
 await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({project,pass:report.pass,captures:report.profiles.reduce((n,p)=>n+p.captures.length,0),report:resolve(directory,'report.json')}));
}
if(!report.pass)process.exitCode=1;
