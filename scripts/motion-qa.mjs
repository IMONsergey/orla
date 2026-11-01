import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const toolkit = '/home/sergey/.local/share/imon-toolkit/node/node_modules/playwright';
let playwright;
if (process.env.PLAYWRIGHT_MODULE) playwright = require(process.env.PLAYWRIGHT_MODULE);
else {
  try { playwright = require('playwright'); }
  catch { playwright = require(toolkit); }
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = resolve(root, 'artifacts/motion-qa');
const externalBase = process.env.MOTION_QA_BASE_URL;
const port = process.env.MOTION_QA_PORT || '4314';
const base = externalBase || 'http://127.0.0.1:' + port;
const focusDiagnostic = process.env.MOTION_QA_FOCUS_ONLY === '1';
const debugScroll = focusDiagnostic || process.env.MOTION_QA_DEBUG_SCROLL === '1';
// A real pointer action must not inherit locator.click() preparation scrolls.
// The locator path remains an explicit diagnostic, never the default UI check.
const pointerClick = process.env.MOTION_QA_POINTER_CLICK !== '0';
const started = Date.now(), deadline = started + 95_000;
const report = {base, scope:focusDiagnostic?'hero-film-hotspot diagnostic':'full motion regression', debugScroll, hotspotClickMode:pointerClick?'observed mouse coordinate':'locator', passed:false, startedAt:new Date(started).toISOString(), engines:[], errors:[]};
let server, activeBrowser, serverLog = '', stopped = false, watchdog;
const timeout = (limit=4000) => Math.max(1, Math.min(limit, deadline-Date.now()));
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
await mkdir(artifacts, {recursive:true});

async function startServer() {
  if (externalBase) return;
  server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--ignore-lock', '--host', '127.0.0.1', '--port', port], {
    cwd:root, stdio:['ignore','pipe','pipe'],
  });
  server.stdout.on('data', data => { serverLog += data; });
  server.stderr.on('data', data => { serverLog += data; });
  server.on('error', error => { serverLog += error.stack; });
  const readyBy = Math.min(deadline, Date.now()+14_000);
  while (Date.now()<readyBy && !stopped) {
    if (server.exitCode !== null) throw new Error('Astro exited before readiness:\n' + serverLog);
    try {
      if ((await fetch(base, {signal:AbortSignal.timeout(700)})).ok) return;
    } catch {}
    await delay(150); // Server readiness only. Animation assertions use rAF below.
  }
  throw new Error('Astro readiness timeout:\n' + serverLog);
}

async function frames(page, count=4) {
  await page.evaluate(count => new Promise(resolve => {
    const tick = () => --count <= 0 ? resolve() : requestAnimationFrame(tick);
    requestAnimationFrame(tick);
  }), count);
}
async function wait(page, predicate, arg=null, limit=4000) {
  await page.waitForFunction(predicate, arg, {polling:'raf', timeout:timeout(limit)});
}
async function scrollTo(page, selector) {
  await page.locator(selector).first().evaluate(element => {
    const box = element.getBoundingClientRect();
    window.scrollTo({top:Math.max(0,scrollY+box.top-(innerHeight-box.height)/2), behavior:'instant'});
  });
  await frames(page);
}
async function visible(page, selector) {
  await wait(page, selector => {
    const nodes = [...document.querySelectorAll(selector)];
    return nodes.length > 0 && nodes.every(node => window.__orlaMotionQA.shown(node));
  }, selector);
}
async function read(page, selector) {
  return page.evaluate(selector => [...document.querySelectorAll(selector)].map(node => window.__orlaMotionQA.read(node)), selector);
}
async function clickHotspot(page, locator) {
  await locator.evaluate(button=>new Promise((resolve,reject)=>{
    let previous,steady=0,frame;
    const timer=setTimeout(()=>{cancelAnimationFrame(frame);reject(new Error('Hotspot geometry did not settle'));},4000);
    const sample=()=>{
      const r=button.getBoundingClientRect(),next=[r.x,r.y,r.width,r.height,scrollY];
      steady=previous&&next.every((n,i)=>Math.abs(n-previous[i])<.15)&&window.__orlaMotionQA.shown(button)?steady+1:0;
      previous=next;
      if(steady>=6){clearTimeout(timer);resolve();}else frame=requestAnimationFrame(sample);
    };sample();
  }));
  const point=await locator.evaluate(button=>{
    const r=button.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    const hit=document.elementFromPoint(x,y),v=visualViewport,left=v?.offsetLeft||0,top=v?.offsetTop||0;
    if(r.width<=0||r.height<=0||r.left<left||r.top<top||r.right>left+(v?.width||innerWidth)||r.bottom>top+(v?.height||innerHeight))
      throw new Error('Coordinate click requires a fully visible control');
    if(!hit||!(hit===button||button.contains(hit)))
      throw new Error('Coordinate click is obscured by '+window.__orlaMotionQA.describe(hit));
    return {x,y,hit:window.__orlaMotionQA.describe(hit),target:window.__orlaMotionQA.describe(button),scrollY,time:performance.now()};
  });
  if(pointerClick)await page.mouse.click(point.x,point.y);else await locator.click();
  return {...point,mode:pointerClick?'observed mouse coordinate':'locator'};
}
async function hotspotScroll(page,before,label){
  const observed=await page.evaluate(before=>{
    const samples=window.__orlaMotionQA.hotspotProbes.at(-1).frames.filter(f=>f.time>=before.time);
    return {initial:before.scrollY,final:scrollY,samples:samples.map(f=>({time:f.time,scrollY:f.scrollY}))};
  },before);
  assert.ok(observed.samples.length>1,'No scroll samples for '+label);
  assert.ok(Math.abs(observed.final-observed.initial)<=1&&observed.samples.every(f=>Math.abs(f.scrollY-observed.initial)<=1),label+' changed scroll: '+JSON.stringify(observed));
  return observed;
}
async function hotspotBounds(page){
  return page.locator('#hero-hotspot').evaluate(n=>{
    const close=n.querySelector('[data-hotspot-close]'),r=close.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),v=visualViewport;
    return {bounds:window.__orlaMotionQA.read(n).bounds,close:window.__orlaMotionQA.read(close).bounds,
      closeAccessible:hit===close||close.contains(hit),left:v?.offsetLeft||0,top:v?.offsetTop||0,w:v?.width||innerWidth,h:v?.height||innerHeight};
  });
}
function verifyHotspotBounds(card,label){
  for(const box of [card.bounds,card.close])assert.ok(box.x>=card.left-1&&box.y>=card.top-1&&box.right<=card.left+card.w+1&&box.bottom<=card.top+card.h+1,label+': '+JSON.stringify(card));
  assert.equal(card.closeAccessible,true,'Hotspot close is obscured: '+JSON.stringify(card));
}
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    label: null, viewport:innerWidth, height:innerHeight, clientWidth:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth, scrollX,
  }));
  dimensions.label = label;
  // innerWidth includes the reserved scrollbar gutter used by this design.
  assert.ok(dimensions.scrollWidth <= dimensions.viewport+1, JSON.stringify(dimensions));
  assert.ok(Math.abs(dimensions.scrollX)<1, 'Unexpected horizontal scroll: ' + JSON.stringify(dimensions));
  return dimensions;
}
async function screenshot(page, engine, name, result) {
  if (engine !== 'webkit') return;
  const file = engine+'-'+name+'.png';
  await page.screenshot({path:resolve(artifacts,file), fullPage:false, timeout:timeout(4500)});
  result.screenshots.push(file);
}

async function installProbe(page) {
  await page.addInitScript(debug => {
    const matrix = node => {
      const value = getComputedStyle(node).transform;
      const m = new DOMMatrix(value === 'none' ? undefined : value);
      return {x:m.m41, y:m.m42};
    };
    const shown = node => {
      if (!node || !node.getClientRects().length || node.closest('[hidden]')) return false;
      let opacity=1;
      for (let current=node; current; current=current.parentElement) {
        const css=getComputedStyle(current);
        if (css.visibility==='hidden' || css.display==='none') return false;
        opacity*=Number(css.opacity);
      }
      return opacity>.98;
    };
    const read = node => {
      const css=getComputedStyle(node), r=node.getBoundingClientRect();
      return {
        tag:node.tagName, id:node.id, className:String(node.className), text:node instanceof HTMLImageElement ? node.alt : node.textContent.trim().slice(0,100),
        opacity:Number(css.opacity), visibility:css.visibility, clipPath:css.clipPath, transform:matrix(node), shown:shown(node),
        bounds:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom},
        ...(node instanceof HTMLImageElement ? {currentSrc:node.currentSrc,naturalWidth:node.naturalWidth,naturalHeight:node.naturalHeight}:{}),
      };
    };
    const describe = node => {
      if(node===window)return 'window';
      if(node===document)return 'document';
      if(!node)return null;
      return (node.tagName||node.nodeName)+(node.id?'#'+node.id:'')+
        (typeof node.className==='string'&&node.className?'.'+node.className.trim().replace(/\s+/g,'.'):'');
    };
    const qa=window.__orlaMotionQA = {matrix, shown, read, describe, probe:null, pointer:null,
      stage:'initialization',events:[],marks:[],hotspotProbes:[],hotspotRAF:0};
    qa.trace = (type, extra={}) => {
      qa.events.push({time:performance.now(),type,stage:qa.stage,scrollY,scrollX,
        active:describe(document.activeElement),readyState:document.readyState,...extra});
      if(qa.events.length>400)qa.events.shift();
    };
    qa.geometry = (index=0) => {
      const hero=document.querySelector('.hero'),card=document.querySelector('#hero-hotspot'),button=document.querySelectorAll('[data-hotspot]')[index];
      const ancestors=[];
      for(let node=button;node;node=node.parentElement){
        const css=getComputedStyle(node);
        ancestors.push({node:describe(node),scrollTop:node.scrollTop,scrollHeight:node.scrollHeight,
          clientHeight:node.clientHeight,overflowX:css.overflowX,overflowY:css.overflowY,
          scrollBehavior:css.scrollBehavior,scrollPaddingTop:css.scrollPaddingTop,scrollMarginTop:css.scrollMarginTop,
          position:css.position,contain:css.contain,contentVisibility:css.contentVisibility});
      }
      return {time:performance.now(),scrollY,scrollX,htmlScrollTop:document.documentElement.scrollTop,
        bodyScrollTop:document.body?.scrollTop,scrollingElement:describe(document.scrollingElement),
        active:describe(document.activeElement),readyState:document.readyState,
        viewport:{width:innerWidth,height:innerHeight},
        hero:hero?read(hero):null,button:button?read(button):null,
        card:card?{...read(card),hidden:card.hidden,styleTop:card.style.top,computedTop:getComputedStyle(card).top,
          styleLeft:card.style.left,offsetTop:card.offsetTop,offsetParent:describe(card.offsetParent)}:null,
        ancestors,openDialogs:[...document.querySelectorAll('dialog[open]')].map(n=>n.id),
        locks:{html:document.documentElement.classList.contains('modal-open'),body:document.body?.classList.contains('modal-open')},
      };
    };
    qa.mark = (name,index=0) => {const mark={name,stage:qa.stage,...qa.geometry(index)};qa.marks.push(mark);qa.trace('mark',{name});return mark;};
    qa.startHotspot = index => {
      cancelAnimationFrame(qa.hotspotRAF);
      const probe={index,frames:[]};qa.hotspotProbes.push(probe);
      const sample=()=>{
        const hero=document.querySelector('.hero'),card=document.querySelector('#hero-hotspot'),button=document.querySelectorAll('[data-hotspot]')[index];
        probe.frames.push({time:performance.now(),scrollY,active:describe(document.activeElement),
          heroTop:hero.getBoundingClientRect().top,buttonTop:button.getBoundingClientRect().top,
          cardTop:card.getBoundingClientRect().top,cardStyleTop:card.style.top,cardHidden:card.hidden,
          headerScrolled:document.querySelector('.site-header').classList.contains('is-scrolled')});
        if(probe.frames.length<100)qa.hotspotRAF=requestAnimationFrame(sample);
      };
      sample();
    };
    for(const type of ['focus','blur','focusin','focusout','pointerdown','mousedown','mouseup','click','close','cancel']){
      document.addEventListener(type,event=>qa.trace(type,{target:describe(event.target),trusted:event.isTrusted}),true);
    }
    for(const type of ['scroll','scrollend','resize','load','pageshow','hashchange','popstate']){
      window.addEventListener(type,event=>{
        if(type==='load'&&event.target!==document)return;
        qa.trace(type,{target:describe(event.target),targetScrollTop:event.target?.scrollTop});
      },{capture:true,passive:true});
    }
    document.fonts.addEventListener('loadingdone',()=>qa.trace('fonts-loadingdone'));
    if(debug){
      const stack=()=>new Error().stack?.split('\n').slice(1,9).join('\n');
      for(const method of ['scrollTo','scrollBy','scroll']){
        const original=window[method];
        window[method]=function(...args){qa.trace('js:'+method,{args,stack:stack()});return Reflect.apply(original,this,args);};
      }
      const focus=HTMLElement.prototype.focus;
      HTMLElement.prototype.focus=function(...args){qa.trace('js:focus',{target:describe(this),args,stack:stack()});return Reflect.apply(focus,this,args);};
      const scrollIntoView=Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView=function(...args){qa.trace('js:scrollIntoView',{target:describe(this),args,stack:stack()});return Reflect.apply(scrollIntoView,this,args);};
      for(const method of ['scroll','scrollTo','scrollBy','scrollIntoViewIfNeeded']){
        const original=Element.prototype[method];
        if(typeof original==='function')Element.prototype[method]=function(...args){
          qa.trace('js:Element.'+method,{target:describe(this),args,stack:stack()});return Reflect.apply(original,this,args);
        };
      }
      for(const name of ['scrollTop','scrollLeft']){
        const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,name);
        if(descriptor?.configurable&&descriptor.set)Object.defineProperty(Element.prototype,name,{
          ...descriptor,set:function(value){
            qa.trace('js:set '+name,{target:describe(this),value,stack:stack()});
            return Reflect.apply(descriptor.set,this,[value]);
          },
        });
      }
    }
  },debugScroll);
}
async function startGalleryProbe(page) {
  await page.evaluate(() => {
    const qa=window.__orlaMotionQA, gallery=document.querySelector('#interior'), track=gallery.querySelector('.interiors__slides');
    if (qa.probe) cancelAnimationFrame(qa.probe.raf);
    const probe=qa.probe={frames:[],raf:0};
    const sample=() => {
      const box=track.getBoundingClientRect();
      const slides=[...gallery.querySelectorAll('.interiors__slide')].map((slide,index) => {
        const css=getComputedStyle(slide), r=slide.getBoundingClientRect(), image=slide.querySelector('img');
        return {index,active:slide.classList.contains('is-active'),opacity:Number(css.opacity),visibility:css.visibility,
          ...qa.matrix(slide),left:r.left,right:r.right,top:r.top,bottom:r.bottom,decoded:Boolean(image.naturalWidth)};
      });
      const spans=slides.filter(s=>s.opacity>.98&&s.visibility!=='hidden'&&s.decoded&&s.top<=box.top+1&&s.bottom>=box.bottom-1)
        .map(s=>[Math.max(box.left,s.left),Math.min(box.right,s.right)]).filter(s=>s[1]>s[0]).sort((a,b)=>a[0]-b[0]);
      let length=0, end=box.left;
      for(const [left,right] of spans){length+=Math.max(0,right-Math.max(left,end));end=Math.max(end,right);}
      probe.frames.push({time:performance.now(),width:box.width,coverage:box.width?length/box.width:0,slides});
      if(probe.frames.length<240)probe.raf=requestAnimationFrame(sample);
    };
    sample();
  });
}
async function finishGalleryProbe(page) {
  return page.evaluate(() => {
    const probe=window.__orlaMotionQA.probe;
    cancelAnimationFrame(probe.raf);window.__orlaMotionQA.probe=null;
    return probe.frames;
  });
}
async function galleryIndex(page) {
  return page.locator('#interior .interiors__slide.is-active').evaluate(node => Number(node.dataset.slide));
}
async function settledGallery(page, expected) {
  await wait(page, expected => {
    const gallery=document.querySelector('#interior'), slides=[...gallery.querySelectorAll('.interiors__slide')];
    if (gallery.hasAttribute('aria-busy') || Number(gallery.querySelector('[data-gallery-current]').textContent)!==expected+1) return false;
    return slides.every((slide,index) => {
      const css=getComputedStyle(slide), active=index===expected, position=window.__orlaMotionQA.matrix(slide);
      return slide.classList.contains('is-active')===active && slide.getAttribute('aria-hidden')===String(!active) &&
        slide.inert===!active && (active?Number(css.opacity)>.98:Number(css.opacity)<.02) &&
        Math.abs(position.x)<.75 && Math.abs(position.y)<.75 &&
        (!active || slide.querySelector('img').naturalWidth>0);
    });
  }, expected, 5000);
  await frames(page,2);
}
function verifyWipe(samples, expected, direction) {
  assert.ok(samples.length>1, 'No gallery animation frames captured');
  assert.ok(samples.every(frame=>frame.coverage>=.99), 'A gallery frame lost opaque image coverage');
  assert.ok(samples.some(frame=>frame.slides.some(slide=>slide.index===expected&&slide.active&&
    direction*slide.x>Math.max(1,frame.width*.005))), 'Expected horizontal wipe was not observed');
  assert.ok(samples.every(frame=>frame.slides.every(slide=>Math.abs(slide.y)<1)), 'Gallery unexpectedly moved vertically');
}

async function cancelGesture(page, kind) {
  const point=await page.locator('#interior .interiors__slides').evaluate(track => {
    const r=track.getBoundingClientRect(), header=document.querySelector('.site-header').getBoundingClientRect();
    const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(header.bottom+8,r.top),bottom=Math.min(innerHeight,r.bottom);
    const x=left+(right-left)*.72,y=top+(bottom-top)*.46;
    const target=document.elementFromPoint(x,y);
    if(bottom<=top || !target?.closest('#interior') || target.closest('button,a')) throw new Error('No unobstructed photo gesture point');
    const gallery=document.querySelector('#interior');
    window.__orlaMotionQA.pointer=null;
    gallery.addEventListener('pointerdown', event => {
      window.__orlaMotionQA.pointer={id:event.pointerId,type:event.pointerType};
    }, {capture:true,once:true});
    return {x,y,end:x-Math.min(160,(right-left)*.3)};
  });
  await page.mouse.move(point.x,point.y);await page.mouse.down();
  await page.mouse.move(point.end,point.y,{steps:4});
  const pointer=await page.evaluate(kind => {
    const gallery=document.querySelector('#interior'), pointer=window.__orlaMotionQA.pointer;
    if(!pointer || !gallery.hasPointerCapture(pointer.id)) throw new Error('Photo gesture did not acquire native pointer capture');
    if(kind==='pointercancel') gallery.dispatchEvent(new PointerEvent('pointercancel',{
      bubbles:true,pointerId:pointer.id,pointerType:pointer.type,isPrimary:true,
    }));
    else gallery.releasePointerCapture(pointer.id);
    return pointer;
  },kind);
  await frames(page,2);
  await page.mouse.up();
  await frames(page,4);
  return {kind,point,pointer};
}

async function hiddenReveals(page) {
  return page.evaluate(() => {
    const selector='[data-reveal],.editorial-title>span,.editorial-title>strong,.arrival__detail,.lifestyle__copy,.nature__copy,.alike__copy,.arrival__copy,.category-row,.hero__title-wrap,.hero__title-wrap>h1,.hero__title-wrap>.watch';
    const nodes=[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length&&!n.closest('dialog:not([open])'));
    return {checked:nodes.length,hidden:nodes.filter(n=>!window.__orlaMotionQA.shown(n)).map(n=>window.__orlaMotionQA.read(n))};
  });
}

async function runEngine(engine) {
  const result={engine,passed:false,checks:[],screenshots:[],pageErrors:[],consoleErrors:[],mediaRequests:[],mediaResponses:[],unexpectedSubmissions:[]};
  report.engines.push(result);
  const browser=activeBrowser=await playwright[engine].launch({
    headless:true,timeout:timeout(8000),...(engine==='chromium'?{args:['--no-sandbox']}:{})
  });
  let page, currentStep='launch';
  try {
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'no-preference'});
    page=await context.newPage();page.setDefaultTimeout(4000);page.setDefaultNavigationTimeout(10000);
    await installProbe(page);
    page.on('pageerror',error=>result.pageErrors.push({step:currentStep,message:error.message,stack:error.stack}));
    page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push(message.text());});
    page.on('request',request=>{
      if(request.resourceType()==='media'||/\.(mp4|webm|m3u8)(?:[?#]|$)/i.test(request.url())) result.mediaRequests.push({url:request.url(),step:currentStep});
    });
    page.on('response',response=>{
      if(response.request().resourceType()==='media'||/\.(mp4|webm|m3u8)(?:[?#]|$)/i.test(response.url())) result.mediaResponses.push({url:response.url(),status:response.status()});
    });
    await context.route('**/api/enquiry',route=>{
      result.unexpectedSubmissions.push({url:route.request().url(),method:route.request().method()});
      return route.abort('blockedbyclient');
    });
    const step=async(name,run)=>{
      if(stopped)throw new Error('Global motion QA budget expired');
      currentStep=name;
      await page.evaluate(name=>{if(window.__orlaMotionQA){window.__orlaMotionQA.stage=name;window.__orlaMotionQA.mark('step:'+name);}},name);
      const at=Date.now(), check={name};result.checks.push(check);
      try {check.observed=await run();assert.deepEqual(result.pageErrors,[],'Runtime page errors');check.passed=true;}
      catch(error){check.passed=false;check.error=error.message;throw error;}
      finally {check.durationMs=Date.now()-at;}
      console.log(JSON.stringify({engine,step:name,passed:true,durationMs:check.durationMs}));
    };

    await step('normal-motion hero',async()=>{
      const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:timeout(10000)});
      assert.equal(response.status(),200);
      await wait(page,()=>document.querySelector('#interior .interiors__slides')?.style.isolation==='isolate',null,7000);
      await wait(page,()=>document.fonts.status==='loaded');
      await visible(page,'.hero__title-wrap,.hero__title-wrap>h1,.hero__title-wrap>.watch');
      await wait(page,()=>[...document.querySelectorAll('.hero__layers img')].every(i=>i.complete&&i.naturalWidth>0),null,5000);
      assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion:reduce)').matches),false);
      await screenshot(page,engine,'hero',result);
      return {title:await read(page,'.hero__title-wrap'),overflow:await noOverflow(page,'desktop initial')};
    });

    await step('film loads on explicit open and pauses on close',async()=>{
      const film=page.locator('#orla-film'), trigger=page.locator('[data-modal="media-dialog"]').first();
      const initial=await film.evaluate(v=>({src:v.getAttribute('src'),currentSrc:v.currentSrc,dataSrc:v.dataset.src,preload:v.preload,paused:v.paused}));
      assert.ok(initial.dataSrc,'Video data-src is missing');
      assert.equal(initial.src,null);assert.equal(initial.currentSrc,'');assert.equal(initial.preload,'none');assert.equal(initial.paused,true);
      assert.equal(result.mediaRequests.length,0,'Film was fetched before explicit open');
      await trigger.click();
      await wait(page,()=>document.querySelector('#media-dialog').open);
      await wait(page,()=>{
        const v=document.querySelector('#orla-film');
        if(v.error)throw new Error('Video media error '+v.error.code+': '+v.error.message);
        return v.readyState>=1&&Number.isFinite(v.duration)&&v.duration>0;
      },null,8000);
      const loaded=await film.evaluate(v=>({src:v.currentSrc,duration:v.duration,readyState:v.readyState,paused:v.paused,width:v.videoWidth,height:v.videoHeight}));
      assert.equal(loaded.paused,true,'Opening the preview must not autoplay');
      assert.ok(result.mediaRequests.some(request=>request.url===new URL(initial.dataSrc,base).href),'No video request followed explicit open');
      await film.evaluate(async v=>{v.muted=true;await v.play();});
      await wait(page,()=>{const v=document.querySelector('#orla-film');return !v.paused&&v.currentTime>.03;},null,5000);
      await page.locator('#media-dialog [data-close]').click();
      await wait(page,()=>!document.querySelector('#media-dialog').open&&document.querySelector('#orla-film').paused);
      const closedTime=await film.evaluate(v=>v.currentTime);await frames(page,5);
      assert.ok(Math.abs(await film.evaluate(v=>v.currentTime)-closedTime)<.05,'Closed preview continued playing');
      assert.equal(await trigger.evaluate(n=>n===document.activeElement),true,'Film close did not restore trigger focus');
      const afterClose=await page.evaluate(()=>window.__orlaMotionQA.mark('film close settled'));
      return {initial,loaded,closedTime,requests:result.mediaRequests.length,afterClose};
    });

    await step('hero scroll and hotspot focus',async()=>{
      await page.evaluate(()=>window.__orlaMotionQA.mark('hero scroll start'));
      const before=await read(page,'.hero__architecture,.hero__water,.hero>.hotspot,.hero__title-wrap');
      const target=await page.evaluate(()=>{
        const hero=document.querySelector('.hero').getBoundingClientRect(),title=document.querySelector('.hero__title-wrap').getBoundingClientRect();
        const header=document.querySelector('.site-header').getBoundingClientRect();
        return Math.min(scrollY+hero.bottom-innerHeight/4,scrollY+title.bottom+header.height);
      });
      await page.evaluate(top=>scrollTo({top,behavior:'instant'}),target);
      await wait(page,()=>Number(getComputedStyle(document.querySelector('.hero__title-wrap')).opacity)<.02);
      await page.evaluate(()=>window.__orlaMotionQA.mark('hero title hidden'));
      const after=await read(page,'.hero__architecture,.hero__water,.hero>.hotspot,.hero__title-wrap');
      assert.ok(Math.abs(after[0].transform.y-before[0].transform.y)>1,'Architectural layer did not move with scroll');
      const hotspots=page.locator('[data-hotspot]'), observed=[];
      for(let i=0;i<await hotspots.count();i++){
        const trigger=hotspots.nth(i);
        await page.evaluate(index=>window.__orlaMotionQA.mark('before hotspot centering',index),i);
        await trigger.evaluate(n=>{const r=n.getBoundingClientRect();scrollTo({top:Math.max(0,scrollY+r.top-innerHeight*.45),behavior:'instant'});});
        await wait(page,index=>window.__orlaMotionQA.shown(document.querySelectorAll('[data-hotspot]')[index]),i);
        await page.evaluate(index=>{window.__orlaMotionQA.mark('before hotspot click',index);window.__orlaMotionQA.startHotspot(index);},i);
        const click=await clickHotspot(page,trigger);
        await page.evaluate(index=>window.__orlaMotionQA.mark('after hotspot click',index),i);
        await wait(page,()=>{const card=document.querySelector('#hero-hotspot');return !card.hidden&&card.getAnimations().every(a=>a.playState!=='running');});
        await page.evaluate(index=>window.__orlaMotionQA.mark('hotspot animation settled',index),i);
        const card=await hotspotBounds(page);verifyHotspotBounds(card,'Hotspot card escapes viewport');
        const openingScroll=await hotspotScroll(page,click,'Hotspot opening');
        assert.deepEqual(await hotspots.evaluateAll((nodes,index)=>nodes.map((n,i)=>n.getAttribute('aria-expanded')===String(i===index)),i),Array(await hotspots.count()).fill(true),'Only the active hotspot should be expanded');
        const closeStart=await page.evaluate(index=>{window.__orlaMotionQA.startHotspot(index);return {time:performance.now(),scrollY};},i);
        if(i%2)await page.keyboard.press('Escape');else await clickHotspot(page,page.locator('[data-hotspot-close]'));
        await wait(page,()=>document.querySelector('#hero-hotspot').hidden);
        await frames(page,6);
        assert.equal(await trigger.evaluate(n=>n===document.activeElement),true,'Hotspot focus was not restored');
        assert.equal(await hotspots.evaluateAll(nodes=>nodes.every(n=>n.getAttribute('aria-expanded')==='false')),true);
        observed.push({...card,click,openingScroll,closingScroll:await hotspotScroll(page,closeStart,'Hotspot closing')});
      }
      return {target,before,after,hotspots:observed};
    });
    if(focusDiagnostic){result.passed=true;return;}

    await step('rectangle and editorial reveal',async()=>{
      const before={image:await read(page,'.location-collage__large'),heading:await read(page,'.lifestyle__title>span,.lifestyle__title>strong')};
      for(const selector of ['.location-collage__large','.lifestyle__title']){
        await scrollTo(page,selector);
        await visible(page,selector==='.lifestyle__title'?'.lifestyle__title>span,.lifestyle__title>strong':selector);
        await wait(page,selector=>[...document.querySelectorAll(selector)].every(node=>{
          const css=getComputedStyle(node);return css.clipPath==='none'||!css.clipPath.match(/(?:[1-9]\d*|\.\d+)(?:%|px)/);
        }),selector==='.lifestyle__title'?'.lifestyle__title>span,.lifestyle__title>strong':selector);
      }
      const after={image:await read(page,'.location-collage__large'),heading:await read(page,'.lifestyle__title>span,.lifestyle__title>strong')};
      assert.ok(before.image.some(n=>!n.shown)||before.heading.some(n=>!n.shown),'Reveal check did not cross an unrevealed target');
      return {before,after};
    });

    await step('horizontal gallery wipe, rapid reversal and cancellation',async()=>{
      await scrollTo(page,'#interior .interiors__slides');
      await wait(page,()=>[...document.querySelectorAll('#interior .interiors__slide img')].every(i=>i.complete&&i.naturalWidth>0),null,6000);
      const total=await page.locator('#interior .interiors__slide').count();assert.ok(total>1);
      const next=page.locator('[data-gallery-next]'),previous=page.locator('[data-gallery-prev]');
      const mod=value=>(value+total)%total, captures=[];
      for(const direction of [1,-1]){
        const expected=mod(await galleryIndex(page)+direction);
        await startGalleryProbe(page);await(direction>0?next:previous).click();await settledGallery(page,expected);
        const samples=await finishGalleryProbe(page);verifyWipe(samples,expected,direction);captures.push({direction,expected,samples});
      }
      const rapidExpected=mod(await galleryIndex(page)+1);
      await startGalleryProbe(page);await next.click();await next.click();await previous.click();await settledGallery(page,rapidExpected);
      const rapid=await finishGalleryProbe(page);assert.ok(rapid.every(f=>f.coverage>=.99),'Rapid reversal exposed a blank frame');
      const cancelled=[];
      for(const kind of ['pointercancel','lostpointercapture']){
        const before=await galleryIndex(page);
        cancelled.push(await cancelGesture(page,kind));
        assert.equal(await galleryIndex(page),before,'Cancelled gesture changed the gallery');
        await next.click();await settledGallery(page,mod(before+1));
      }
      await screenshot(page,engine,'interior',result);
      return {total,captures,rapidExpected,rapid,cancelled,settled:await read(page,'#interior .interiors__slide.is-active img'),overflow:await noOverflow(page,'desktop gallery')};
    });

    await step('reduced motion during wipe',async()=>{
      const count=await page.locator('#interior .interiors__slide').count(),expected=(await galleryIndex(page)+1)%count;
      await page.locator('[data-gallery-next]').click();
      await wait(page,expected=>Number(document.querySelector('#interior .interiors__slide.is-active').dataset.slide)===expected,expected);
      await page.emulateMedia({reducedMotion:'reduce'});await settledGallery(page,expected);await frames(page);
      const revealState=await hiddenReveals(page);assert.ok(revealState.checked>0);assert.deepEqual(revealState.hidden,[]);
      await page.emulateMedia({reducedMotion:'no-preference'});await frames(page);
      return {expected,revealState};
    });

    await step('residence dialog and focus',async()=>{
      await scrollTo(page,'[data-category]');await visible(page,'.category-list>[data-category]:first-child');
      const trigger=page.locator('[data-category]').first();await trigger.click();
      await wait(page,()=>document.querySelector('#residence-dialog').open);
      await page.locator('[data-collection-panel] [data-show-residence]').click();
      await visible(page,'[data-residence-panel]');
      await wait(page,()=>{const image=document.querySelector('[data-residence-panel] .plan-preview img');return image.complete&&image.naturalWidth>0;},null,5000);
      await screenshot(page,engine,'residence',result);
      const observed=await read(page,'[data-residence-panel] .plan-preview img');
      await page.keyboard.press('Escape');
      await wait(page,()=>!document.querySelector('#residence-dialog').open&&!document.documentElement.classList.contains('modal-open')&&!document.body.classList.contains('modal-open'));
      assert.equal(await trigger.evaluate(n=>n===document.activeElement),true,'Residence close did not restore focus');
      return observed;
    });

    await step('desktop to mobile to desktop and motion preference recovery',async()=>{
      const layouts=[];
      for(const size of [{width:390,height:844},{width:1440,height:900}]){
        await page.setViewportSize(size);await frames(page,6);
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        await visible(page,'.hero__title-wrap,.hero__title-wrap>h1,.hero__title-wrap>.watch');
        layouts.push(await noOverflow(page,size.width+'px'));
        for(const selector of ['.location-collage__large','.lifestyle__title']){
          await scrollTo(page,selector);
          await visible(page,selector==='.lifestyle__title'?'.lifestyle__title>span,.lifestyle__title>strong':selector);
        }
      }
      await page.emulateMedia({reducedMotion:'reduce'});await frames(page,5);
      const reduced=await hiddenReveals(page);assert.ok(reduced.checked>0);assert.deepEqual(reduced.hidden,[]);
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.emulateMedia({reducedMotion:'no-preference'});await frames(page,5);
      await visible(page,'.hero__title-wrap,.hero__title-wrap>h1,.hero__title-wrap>.watch');
      return {layouts,reduced};
    });

    await step('short landscape callout',async()=>{
      await page.setViewportSize({width:844,height:390});await frames(page,6);
      const trigger=page.locator('[data-hotspot]').first();
      await trigger.evaluate(n=>{const r=n.getBoundingClientRect();scrollTo({top:Math.max(0,scrollY+r.top-innerHeight*.45),behavior:'instant'});});
      await page.evaluate(()=>window.__orlaMotionQA.startHotspot(0));
      const click=await clickHotspot(page,trigger);
      await wait(page,()=>{const n=document.querySelector('#hero-hotspot');return !n.hidden&&n.getAnimations().every(a=>a.playState!=='running');});
      const observed=await hotspotBounds(page);verifyHotspotBounds(observed,'Short viewport bounds');
      const openingScroll=await hotspotScroll(page,click,'Short landscape opening');
      await page.keyboard.press('Escape');await wait(page,()=>document.querySelector('#hero-hotspot').hidden);
      assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
      return {...observed,click,openingScroll,overflow:await noOverflow(page,'short landscape')};
    });
    assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.unexpectedSubmissions,[]);
    result.passed=true;
  } catch(error) {
    result.error={step:currentStep,message:error.message,stack:error.stack};
    if(page&&!page.isClosed()){
      try {result.galleryAtFailure=await page.evaluate(()=>({
        counter:document.querySelector('[data-gallery-current]')?.textContent,busy:document.querySelector('#interior')?.getAttribute('aria-busy'),
        slides:[...document.querySelectorAll('#interior .interiors__slide')].map(n=>({...window.__orlaMotionQA.read(n),
          active:n.classList.contains('is-active'),inert:n.inert,ariaHidden:n.getAttribute('aria-hidden'),style:n.getAttribute('style'),decoded:n.querySelector('img').naturalWidth})),
      }));}catch{}
      try {result.heroTitleAtFailure=await read(page,'.hero__title-wrap,.hero__title-wrap>h1,.hero__title-wrap>.watch');}catch{}
      try {result.heroMotionAtFailure=await page.evaluate(async()=>{
        const response=await fetch('/src/scripts/main.ts');if(!response.ok)return null;
        const source=await response.text(),imports=[...source.matchAll(/from\s+["']([^"']+)["']/g)].map(m=>m[1]);
        const path=imports.find(p=>p.includes('gsap_ScrollTrigger'));if(!path)return null;
        const {ScrollTrigger}=await import(path),title=document.querySelector('.hero__title-wrap');
        return ScrollTrigger.getAll().filter(t=>t.animation?.targets().includes(title)).map(t=>({
          start:t.start,end:t.end,progress:t.progress,scroll:t.scroll(),enabled:t.enabled,
          animation:{progress:t.animation.progress(),time:t.animation.time(),duration:t.animation.duration(),active:t.animation.isActive()},
          scrub:t.getTween()?{progress:t.getTween().progress(),time:t.getTween().time(),duration:t.getTween().duration(),active:t.getTween().isActive()}:null,
        }));
      });}catch{}
      try {result.scrollFocusEvidence=await page.evaluate(()=>{
        const qa=window.__orlaMotionQA;
        if(!qa)return null;
        cancelAnimationFrame(qa.hotspotRAF);
        return {failure:qa.geometry(qa.hotspotProbes.at(-1)?.index||0),marks:qa.marks,events:qa.events,hotspotFrames:qa.hotspotProbes};
      });}catch{}
    }
    if(page&&!page.isClosed()&&!stopped){
      try {await page.screenshot({path:resolve(artifacts,engine+'-failure.png'),timeout:timeout(2000)});result.screenshots.push(engine+'-failure.png');}catch{}
      try {result.failureDOM=await page.evaluate(()=>({url:location.href,scrollY,viewport:{width:innerWidth,height:innerHeight},dialogs:[...document.querySelectorAll('dialog[open]')].map(n=>n.id),video:(()=>{const v=document.querySelector('#orla-film');return v?{src:v.currentSrc,readyState:v.readyState,networkState:v.networkState,error:v.error?{code:v.error.code,message:v.error.message}:null,codec:v.canPlayType('video/mp4; codecs="avc1.42E01E"')}:null;})()}));}catch{}
    }
  } finally {
    if(focusDiagnostic&&page&&!page.isClosed()&&!result.scrollFocusEvidence){
      try {result.scrollFocusEvidence=await page.evaluate(()=>{const qa=window.__orlaMotionQA;cancelAnimationFrame(qa.hotspotRAF);return {final:qa.geometry(),marks:qa.marks,events:qa.events,hotspotFrames:qa.hotspotProbes};});}catch{}
    }
    await browser.close().catch(()=>{});
    if(activeBrowser===browser)activeBrowser=undefined;
  }
}

try {
  const budget=new Promise((_,reject)=>{
    watchdog=setTimeout(()=>{stopped=true;reject(new Error('95-second total motion QA budget exceeded'));},Math.max(1,deadline-Date.now()));
  });
  await Promise.race([(async()=>{
    await startServer();
    for(const engine of (process.env.MOTION_QA_ENGINE?[process.env.MOTION_QA_ENGINE]:['chromium','webkit'])){
      if(stopped)break;
      try {await runEngine(engine);}
      catch(error){report.errors.push({engine,message:error.message,stack:error.stack});}
    }
  })(),budget]);
  report.passed=report.errors.length===0&&report.engines.length===2&&report.engines.every(r=>r.passed&&r.pageErrors.length===0&&r.unexpectedSubmissions.length===0);
} catch(error) {
  report.errors.push({message:error.message,stack:error.stack});
} finally {
  stopped=true;clearTimeout(watchdog);
  if(activeBrowser)await Promise.race([activeBrowser.close().catch(()=>{}),delay(2000)]);
  if(server){server.kill('SIGTERM');await delay(250);if(server.exitCode===null)server.kill('SIGKILL');}
  report.durationMs=Date.now()-started;
  await writeFile(resolve(artifacts,'report.json'),JSON.stringify(report,null,2)+'\n');
  await writeFile(resolve(artifacts,'dev-server.log'),serverLog);
}
console.log(JSON.stringify({scope:report.scope,hotspotClickMode:report.hotspotClickMode,passed:report.passed,durationMs:report.durationMs,engines:report.engines.map(r=>({engine:r.engine,passed:r.passed,error:r.error})),errors:report.errors,artifacts}));
if(!report.passed)process.exitCode=1;
