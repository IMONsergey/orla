import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
let playwright;
if(process.env.PLAYWRIGHT_MODULE)playwright=require(process.env.PLAYWRIGHT_MODULE);
else {try{playwright=require('playwright');}catch{playwright=require('/home/sergey/.local/share/imon-toolkit/node/node_modules/playwright');}}
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.MOTION_QA_BASE_URL||'http://127.0.0.1:4314';
const reproOnly=process.env.HOTSPOT_QA_REPRO==='1';
const artifacts=resolve(root,'artifacts/hotspot-qa',reproOnly?'before-fix':'current');
const report={base,reproOnly,startedAt:new Date().toISOString(),passed:false,engines:[]};
await mkdir(artifacts,{recursive:true});

async function frames(page,count=4){
  await page.evaluate(count=>new Promise(resolve=>{const tick=()=>--count<=0?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);}),count);
}
async function stable(page,index){
  await page.evaluate(index=>new Promise((resolve,reject)=>{
    const button=document.querySelectorAll('[data-hotspot]')[index];
    let previous,steady=0,raf;
    const timer=setTimeout(()=>{cancelAnimationFrame(raf);reject(new Error('Hotspot geometry did not settle'));},4000);
    const tick=()=>{
      const r=button.getBoundingClientRect(),css=getComputedStyle(button),next=[r.x,r.y,r.width,r.height,scrollY];
      steady=previous&&next.every((n,i)=>Math.abs(n-previous[i])<.15)&&Number(css.opacity)>.98&&css.visibility!=='hidden'?steady+1:0;
      previous=next;
      if(steady>=6){clearTimeout(timer);resolve();}else raf=requestAnimationFrame(tick);
    };tick();
  }),index);
}
async function geometry(page){
  return page.evaluate(()=>{
    const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const describe=node=>node?.tagName+(node?.id?'#'+node.id:'')+(node?.className?'.'+String(node.className).trim().replace(/\s+/g,'.'):'');
    const card=document.querySelector('#hero-hotspot'),close=card.querySelector('[data-hotspot-close]'),r=close.getBoundingClientRect();
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),v=visualViewport;
    return {scrollX,scrollY,hidden:card.hidden,active:describe(document.activeElement),card:rect(card),close:rect(close),closeHit:describe(hit),closeAccessible:hit===close||close.contains(hit),
      reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,animations:card.getAnimations().map(a=>({state:a.playState,time:a.currentTime,duration:a.effect.getTiming().duration,frames:a.effect.getKeyframes()})),
      viewport:{x:v?.offsetLeft||0,y:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight,scale:v?.scale||1},
      triggers:[...document.querySelectorAll('[data-hotspot]')].map(n=>({bounds:rect(n),expanded:n.getAttribute('aria-expanded'),focused:document.activeElement===n})),
      header:rect(document.querySelector('.site-header')),events:window.__hotspotQA.events};
  });
}
async function boot(browser,size,{touch=false,reducedMotion='no-preference'}={}){
  const context=await browser.newContext({viewport:size,deviceScaleFactor:1,hasTouch:touch,isMobile:touch,reducedMotion});
  const page=await context.newPage();page.setDefaultTimeout(6000);
  await page.addInitScript(()=>{
    window.__hotspotQA={events:[],frames:[],raf:0};
    for(const type of ['pointerdown','pointerup','click','focusin','scroll','resize'])document.addEventListener(type,event=>{
      window.__hotspotQA.events.push({type,trusted:event.isTrusted,pointerType:event.pointerType,detail:event.detail,scrollY,target:event.target?.id||event.target?.className||event.target?.nodeName});
    },{capture:true,passive:true});
    matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',event=>window.__hotspotQA.events.push({type:'reduced-motion-change',matches:event.matches,scrollY}));
  });
  page.on('pageerror',error=>{report.errors??=[];report.errors.push(error.message);});
  await context.route('**/api/enquiry',route=>route.abort('blockedbyclient'));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#interior .interiors__slides')?.style.isolation==='isolate');
  await page.waitForFunction(()=>document.fonts.status==='loaded'&&[...document.querySelectorAll('.hero__layers img')].every(i=>i.complete&&i.naturalWidth>0));
  return {context,page};
}
async function startScrollProbe(page){
  return page.evaluate(()=>{
    const qa=window.__hotspotQA;cancelAnimationFrame(qa.raf);qa.frames=[];
    const tick=()=>{qa.frames.push({x:scrollX,y:scrollY});qa.raf=requestAnimationFrame(tick);};tick();
    return {x:scrollX,y:scrollY};
  });
}
async function checkScroll(page,before){
  const samples=await page.evaluate(()=>{cancelAnimationFrame(window.__hotspotQA.raf);return [...window.__hotspotQA.frames,{x:scrollX,y:scrollY}];});
  assert.ok(samples.every(s=>Math.abs(s.x-before.x)<=1&&Math.abs(s.y-before.y)<=1),'Interaction changed page scroll: '+JSON.stringify({before,samples}));
  return {before,samples};
}
async function pointer(page,selector,touch=false){
  const point=await page.locator(selector).evaluate(button=>{
    const r=button.getBoundingClientRect(),v=visualViewport,left=v?.offsetLeft||0,top=v?.offsetTop||0,width=v?.width||innerWidth,height=v?.height||innerHeight;
    const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
    if(r.left<left||r.top<top||r.right>left+width||r.bottom>top+height||!r.width||!r.height)throw new Error('Pointer target is not entirely inside the visual viewport');
    if(!hit||!(hit===button||button.contains(hit)))throw new Error('Pointer target is obscured by '+hit?.tagName+'.'+hit?.className);
    return {x,y};
  });
  if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  return point;
}
async function settledOpen(page){
  await page.waitForFunction(()=>{const card=document.querySelector('#hero-hotspot');return !card.hidden&&card.getAnimations().every(a=>a.playState!=='running');});
  await frames(page,3);
}
function inViewport(observed){
  const v=observed.viewport;
  for(const [name,r] of [['card',observed.card],['close',observed.close]])assert.ok(r.width>0&&r.height>0&&r.x>=v.x-1&&r.y>=v.y-1&&r.right<=v.x+v.width+1&&r.bottom<=v.y+v.height+1,name+' escapes visual viewport: '+JSON.stringify(observed));
  assert.equal(observed.closeAccessible,true,'Close is obscured: '+JSON.stringify(observed));
}
function activeTrigger(observed,index){
  assert.deepEqual(observed.triggers.map(n=>n.expanded),observed.triggers.map((_,i)=>String(i===index)),'Only the active hotspot must be expanded');
}
async function closed(page,index){
  await page.waitForFunction(()=>document.querySelector('#hero-hotspot').hidden);await frames(page,3);
  const observed=await geometry(page);activeTrigger(observed,-1);
  if(index!==undefined)assert.equal(observed.triggers[index].focused,true,'Closing did not restore the active trigger');
  assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('[hidden]'))),false,'Focus remained in the hidden callout');
  return observed;
}

for(const engine of (process.env.HOTSPOT_QA_ENGINE?[process.env.HOTSPOT_QA_ENGINE]:['chromium','webkit'])){
  const result={engine,passed:false,checks:[]};report.engines.push(result);
  const browser=await playwright[engine].launch({headless:true,timeout:12000,...(engine==='chromium'?{args:['--no-sandbox']}:{})});
  let page,context;
  const step=async(name,run)=>{
    const check={name};result.checks.push(check);
    try{check.observed=await run();check.passed=true;console.log(JSON.stringify({engine,step:name,passed:true}));}
    catch(error){check.passed=false;check.error=error.message;
      if(page){check.failure=await geometry(page).catch(()=>null);await page.screenshot({path:resolve(artifacts,engine+'-'+name.replaceAll(/[^a-z0-9]+/gi,'-')+'.png')}).catch(()=>{});}throw error;}
  };
  try{
    ({context,page}=await boot(browser,{width:390,height:844},{touch:true}));
    await step('mobile lower hotspot near header',async()=>{
      await page.evaluate(()=>scrollTo({top:710,behavior:'instant'}));await stable(page,1);
      const before=await startScrollProbe(page),click=await pointer(page,'[data-hotspot]:nth-of-type(2)',true);
      await settledOpen(page);const observed=await geometry(page),scroll=await checkScroll(page,before);
      inViewport(observed);if(!reproOnly)activeTrigger(observed,1);
      assert.ok(observed.events.some(e=>e.type==='pointerdown'&&e.pointerType==='touch'&&e.trusted),'No native touch event');
      if(!reproOnly)await page.screenshot({path:resolve(artifacts,engine+'-mobile-hotspot.png')});
      return {click,scroll,...observed};
    });
    if(!reproOnly){
      await step('touch close restores active trigger without scroll',async()=>{
        const before=await startScrollProbe(page);await pointer(page,'[data-hotspot-close]',true);
        const observed=await closed(page,1);
        return {scroll:await checkScroll(page,before),...observed};
      });
      await step('callout follows visible anchor and dismisses on scroll away',async()=>{
        await page.evaluate(()=>scrollTo({top:350,behavior:'instant'}));await stable(page,0);
        await pointer(page,'[data-hotspot]:nth-of-type(1)',true);await settledOpen(page);
        const initial=await geometry(page);inViewport(initial);
        await page.evaluate(()=>scrollTo({top:400,behavior:'instant'}));await frames(page,5);
        const scrolled=await geometry(page);inViewport(scrolled);activeTrigger(scrolled,0);
        assert.ok(Math.abs(scrolled.card.y-initial.card.y+50)<=1,'Callout lost its visible scroll anchor');
        await page.evaluate(()=>scrollTo({top:710,behavior:'instant'}));
        const dismissed=await closed(page);
        assert.ok(Math.abs(dismissed.scrollY-710)<=1,'Dismissal changed the requested scroll');
        return {initial,scrolled,dismissed};
      });
      await step('open callout survives mobile landscape desktop resize',async()=>{
        await page.evaluate(()=>scrollTo({top:350,behavior:'instant'}));await stable(page,0);
        await pointer(page,'[data-hotspot]:nth-of-type(1)',true);await settledOpen(page);
        const observed=[];
        for(const size of [{width:390,height:390},{width:844,height:390},{width:1101,height:600},{width:1101,height:900},{width:1440,height:900}]){
          await page.setViewportSize(size);await stable(page,0);await frames(page,4);
          const state=await geometry(page);assert.equal(state.hidden,false);inViewport(state);activeTrigger(state,0);observed.push({size,...state});
          if(size.width===1101){assert.ok(state.card.width>=259,'Authored minimum card width was lost');assert.ok(state.card.height>=319&&state.card.height<=363,'Authored minimum/maximum card height was lost');}
          if(size.width===844)await page.screenshot({path:resolve(artifacts,engine+'-landscape-hotspot.png')});
        }
        await page.keyboard.press('Escape');await closed(page,0);
        return observed;
      });
      await step('reduced motion cancels active entrance and prevents new entrance',async()=>{
        await pointer(page,'[data-hotspot]:nth-of-type(1)',true);
        await page.waitForFunction(()=>document.querySelector('#hero-hotspot').getAnimations().some(a=>a.playState==='running'));
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion:reduce)').matches&&document.querySelector('#hero-hotspot').getAnimations().length===0);
        // Preference changes can revert ScrollTrigger geometry. Start the next
        // input assertion only after that independent layout change settles.
        await stable(page,0);await settledOpen(page);
        const interrupted=await geometry(page);inViewport(interrupted);
        assert.equal(await page.locator('#hero-hotspot').evaluate(n=>n.getAnimations().length),0);
        await page.keyboard.press('Escape');await closed(page,0);
        const before=await startScrollProbe(page);await pointer(page,'[data-hotspot]:nth-of-type(1)',true);await settledOpen(page);
        assert.equal(await page.locator('#hero-hotspot').evaluate(n=>n.getAnimations().length),0);
        const reduced=await geometry(page);inViewport(reduced);const scroll=await checkScroll(page,before);
        await page.keyboard.press('Escape');await closed(page,0);await page.emulateMedia({reducedMotion:'no-preference'});
        return {interrupted,reduced,scroll};
      });
      if(engine==='chromium')await step('native visual viewport scale constrains card and close',async()=>{
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(()=>scrollTo({top:350,behavior:'instant'}));await stable(page,0);
        await pointer(page,'[data-hotspot]:nth-of-type(1)',true);await settledOpen(page);
        const session=await context.newCDPSession(page);
        await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
        await page.waitForFunction(()=>visualViewport.scale>1.9);await frames(page,6);
        const scaled=await geometry(page);assert.equal(scaled.hidden,false);inViewport(scaled);activeTrigger(scaled,0);
        await page.keyboard.press('Escape');await closed(page,0);
        await session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await session.detach();
        return scaled;
      });
      await context.close();({context,page}=await boot(browser,{width:1440,height:900}));
      await step('native mouse opening switching and toggle retain page position',async()=>{
        await page.locator('[data-hotspot]').first().evaluate(n=>{const r=n.getBoundingClientRect();scrollTo({top:scrollY+r.top-200,behavior:'instant'});});await stable(page,0);
        const initialScroll=await startScrollProbe(page);await pointer(page,'[data-hotspot]:nth-of-type(1)');await settledOpen(page);
        const first=await geometry(page);inViewport(first);activeTrigger(first,0);const openingScroll=await checkScroll(page,initialScroll);
        const switchScroll=await startScrollProbe(page);await pointer(page,'[data-hotspot]:nth-of-type(2)');await settledOpen(page);
        const second=await geometry(page);inViewport(second);activeTrigger(second,1);const switchingScroll=await checkScroll(page,switchScroll);
        const toggleScroll=await startScrollProbe(page);await pointer(page,'[data-hotspot]:nth-of-type(2)');const toggled=await closed(page,1);
        const closingScroll=await checkScroll(page,toggleScroll);
        assert.ok(first.events.some(e=>e.type==='pointerdown'&&e.pointerType==='mouse'&&e.trusted),'No native mouse event');
        await pointer(page,'[data-hotspot]:nth-of-type(1)');await settledOpen(page);
        const buttonScroll=await startScrollProbe(page);await pointer(page,'[data-hotspot-close]');const buttonClosed=await closed(page,0);
        return {first,second,toggled,buttonClosed,openingScroll,switchingScroll,closingScroll,buttonScroll:await checkScroll(page,buttonScroll)};
      });
      await step('keyboard Tab Enter Space Escape and close keep scroll and focus',async()=>{
        await page.goto(base,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>document.querySelector('#interior .interiors__slides')?.style.isolation==='isolate');
        await page.locator('[data-hotspot]').first().evaluate(n=>{const r=n.getBoundingClientRect();scrollTo({top:scrollY+r.top-200,behavior:'instant'});});await stable(page,0);
        let tabs=0;
        while(!await page.locator('[data-hotspot]').first().evaluate(n=>n===document.activeElement)&&tabs<35){await page.keyboard.press('Tab');tabs++;await frames(page,2);}
        assert.ok(tabs<35,'Tab did not reach the first hotspot');await stable(page,0);
        const observed=[];
        for(const key of ['Enter','Space']){
          const before=await startScrollProbe(page);await page.keyboard.press(key);await settledOpen(page);
          const opened=await geometry(page);inViewport(opened);activeTrigger(opened,0);
          assert.equal(await page.locator('[data-hotspot-close]').evaluate(n=>n===document.activeElement),true);
          const openingScroll=await checkScroll(page,before);
          const closeBefore=await startScrollProbe(page);await page.keyboard.press(key==='Enter'?'Escape':'Space');
          const dismissed=await closed(page,0),closingScroll=await checkScroll(page,closeBefore);
          observed.push({key,opened,dismissed,openingScroll,closingScroll});
        }
        return {tabs,observed};
      });
    }
    result.passed=true;
  }catch(error){result.error={message:error.message,stack:error.stack};}
  finally{await context?.close();await browser.close();}
}
report.passed=report.engines.every(e=>e.passed)&&!report.errors?.length;
report.finishedAt=new Date().toISOString();
await writeFile(resolve(artifacts,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,report:resolve(artifacts,'report.json')}));
if(!report.passed)process.exitCode=1;
