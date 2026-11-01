import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const project=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).name.includes('six')?'six':'orla';
const require=createRequire(import.meta.url);
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const phase=process.env.VISUAL_PHASE||'before';
const base=process.env.VISUAL_BASE_URL||`http://127.0.0.1:${project==='six'?14326:14324}`;
const artifacts=resolve(root,'artifacts/pixel-audit-20261101-v2',phase);
const profiles=[{width:1440,height:900},{width:1920,height:1080},{width:1024,height:900},{width:768,height:1024},{width:390,height:844},{width:320,height:800},{width:844,height:390}];
const widths=(process.env.VISUAL_WIDTHS||(phase==='before'?'1440,390':'1440,1920,1024,768,390,320,844')).split(',').map(Number);
const report={project,base,phase,startedAt:new Date().toISOString(),completed:false,viewports:[],pageErrors:[],assetFailures:[],apiRequests:[]};
const glyphs=/[\u2190-\u21ff\u27a0-\u27bf\u276e-\u276f\u2039\u203a\u00ab\u00bb\u2303\u2304\u25b2\u25b6\u25bc\u25c0]/u;
await mkdir(artifacts,{recursive:true});

async function stable(page){
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const nodes=[...document.querySelectorAll('header,main>section,.chapter__stage,.state-primary,.state-secondary,h1,h2,h3,h1>*,h2>*,h3>*,[data-reveal],[data-reveal]>*,.lifestyle__copy,.nature__copy,.alike__copy,.arrival__copy,.category-row,.architecture-photo,.architecture-copy,.invitation-card,.gallery,.gallery__main img,.gallery__preview img,.interiors__slide,.hero-card,.hero__architecture,.hero__water,.hotspot,dialog[open]')];
    let previous='',steady=0,frames=0,raf;const start=performance.now();
    const timer=setTimeout(()=>{cancelAnimationFrame(raf);reject(new Error('Rendered geometry did not settle'));},5500);
    function sample(){
      frames++;const signature=JSON.stringify([Math.round(scrollY*10),innerWidth,innerHeight,...nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return [Math.round(r.x*10),Math.round(r.y*10),Math.round(r.width*10),Math.round(r.height*10),s.opacity,s.visibility,s.transform,s.clipPath,s.backgroundColor,s.color];})]);
      steady=signature===previous?steady+1:0;previous=signature;
      if(steady>=7&&performance.now()-start>=350){clearTimeout(timer);resolve({frames,ms:Math.round(performance.now()-start),scrollY});}else raf=requestAnimationFrame(sample);
    }sample();
  }));
}
async function auditGlyphs(page){
  return page.evaluate(source=>{
    const regex=new RegExp(source,'u'),found=[];
    const describe=n=>n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(n.className&&typeof n.className==='string'?'.'+n.className.trim().replace(/\s+/g,'.'):'');
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let text; text=walker.nextNode();){
      const parent=text.parentElement;if(!parent||parent.closest('script,style,noscript'))continue;
      if(regex.test(text.textContent))found.push({kind:'text',element:describe(parent),text:text.textContent.trim().slice(0,120)});
    }
    for(const node of document.body.querySelectorAll('*'))for(const pseudo of ['::before','::after']){
      const content=getComputedStyle(node,pseudo).content;if(regex.test(content))found.push({kind:pseudo,element:describe(node),text:content});
    }
    return found;
  },glyphs.source);
}
async function prepare(page){
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:15000});
  if(response.status()!==200)throw new Error('Page HTTP '+response.status());
  await page.waitForFunction(project=>project==='orla'?document.querySelector('#interior .interiors__slides')?.style.isolation==='isolate':document.querySelector('#home')?.dataset.view!==undefined,project);
  await page.waitForFunction(()=>document.fonts.status==='loaded'&&!document.querySelector('.intro.is-active'));
  const images=await page.evaluate(async()=>{
    const results=[];for(const image of document.images){if(!image.getAttribute('src'))continue;image.loading='eager';await image.decode().catch(()=>{});results.push({src:image.currentSrc||image.src,ok:image.naturalWidth>0});}return results;
  });
  await stable(page);return images;
}
async function capture(page,result,label,detail={}){
  let settled;try{settled=await stable(page);}catch(error){settled={error:error.message};}
  const file=`${result.engine}-${result.width}x${result.height}-${String(result.captures.length+1).padStart(3,'0')}-${label.replaceAll(/[^a-z0-9_-]/gi,'-')}.png`;
  const metrics=await page.evaluate(()=>{
    const header=document.querySelector('.site-header').getBoundingClientRect();
    const shown=n=>{let opacity=1;for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p);if(s.visibility==='hidden'||s.display==='none')return false;opacity*=Number(s.opacity);}return opacity>.9;};
    const headings=[...document.querySelectorAll('main h1,main h2,main h3')].filter(n=>!n.classList.contains('sr-only')&&shown(n)).map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent.trim().replace(/\s+/g,' ').slice(0,100),top:r.top,bottom:r.bottom,left:r.left,right:r.right};}).filter(r=>r.bottom>0&&r.top<innerHeight);
    return {scrollY,scrollX,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,headerBottom:header.bottom,headings};
  });
  await page.screenshot({path:resolve(artifacts,file),fullPage:false,timeout:20000});
  const entry={file,label,...detail,settled,metrics};result.captures.push(entry);
  console.log(JSON.stringify({project,engine:result.engine,viewport:result.width,label,file}));
  return entry;
}
async function scroll(page,top){await page.evaluate(top=>scrollTo({top:Math.max(0,top),behavior:'instant'}),top);}
async function allSections(page,result){
  const sections=await page.evaluate(()=>[...document.querySelectorAll('main>section')].map((n,index)=>{
    const r=n.getBoundingClientRect(),stage=n.querySelector('.chapter__stage');
    const parts=n.classList.contains('is-story')?[]:[...n.querySelectorAll(':scope>.chapter__stage>.state-primary,:scope>.chapter__stage>.state-secondary')].map(p=>{const b=p.getBoundingClientRect();return {name:p.classList.contains('state-primary')?'primary':'secondary',top:b.top+scrollY,height:b.height};});
    return {id:n.id||n.classList[0]||'section-'+index,top:r.top+scrollY,height:r.height,story:n.classList.contains('is-story'),range:stage?n.offsetHeight-stage.offsetHeight:0,parts};
  }));
  result.sections=sections;
  for(const section of sections){
    if(section.story){
      for(const progress of [.07,.43,section.id==='about'?.76:.88,.995]){
        await scroll(page,section.top+section.range*progress);
        await capture(page,result,`${section.id}-story-${Math.round(progress*1000)}`,{section:section.id,progress});
      }
      await scroll(page,section.top+section.height-result.height*.5);
      await capture(page,result,`${section.id}-boundary`,{section:section.id,boundary:true});
    }else{
      for(const part of section.parts.length?section.parts:[{name:'section',top:section.top,height:section.height}]){
        const readable=Math.max(180,result.height-130),last=Math.max(0,part.height-readable),offsets=[0];
        for(let offset=readable*.82;offset<last-20;offset+=readable*.82)offsets.push(offset);
        if(last>20)offsets.push(last);
        for(let index=0;index<offsets.length;index++){
          await scroll(page,part.top+offsets[index]-(part.top===0?0:100));
          await capture(page,result,`${section.id}-${part.name}-${index+1}`,{section:section.id,part:part.name,offset:offsets[index]});
        }
      }
    }
  }
  const bottom=await page.evaluate(()=>Math.max(0,document.documentElement.scrollHeight-innerHeight));
  await scroll(page,bottom);const footer=await capture(page,result,'footer');
  if(Math.abs(footer.metrics.scrollY-bottom)>2)throw new Error('Footer scroll did not reach the document end');
}
async function navigation(page,result){
  const visibleNavigation=await page.locator('.desktop-nav').isVisible()?'.desktop-nav':'#menu-dialog nav';
  const links=await page.locator(visibleNavigation+' a[href^="#"]').evaluateAll(nodes=>nodes.map(n=>({hash:n.hash,label:n.textContent.trim()})));
  for(const link of links){
    if(await page.locator('.desktop-nav').isVisible())await page.locator(`.desktop-nav a[href="${link.hash}"]`).click();
    else{
      await page.locator('.menu-toggle').click();await page.waitForFunction(()=>document.querySelector('#menu-dialog').open);
      await page.locator(`#menu-dialog a[href="${link.hash}"]`).first().click();
      await page.waitForFunction(()=>!document.querySelector('#menu-dialog').open&&!document.documentElement.classList.contains('modal-open'));
    }
    const shot=await capture(page,result,'nav-'+link.hash.slice(1),{navigation:link});
    result.navigation.push({hash:link.hash,file:shot.file,scrollY:shot.metrics.scrollY,headings:shot.metrics.headings,headerBottom:shot.metrics.headerBottom});
  }
}
async function readingContinuity(page,result){
  const targetId=project==='six'?'interiors':'interior';
  const requested=await page.evaluate(id=>{
    const n=document.getElementById(id),r=n.getBoundingClientRect(),stage=n.querySelector('.chapter__stage');
    const gallery=n.querySelector('.gallery')||n;
    const top=n.classList.contains('is-story')?r.top+scrollY+(n.offsetHeight-stage.offsetHeight)*.88:gallery.getBoundingClientRect().top+scrollY-100;
    scrollTo({top,behavior:'instant'});return top;
  },targetId);
  const state=()=>page.evaluate(id=>{
    const line=innerHeight*.3,active=[...document.querySelectorAll('main>section')].find(n=>{const r=n.getBoundingClientRect();return r.top<=line&&r.bottom>line;});
    const target=document.getElementById(id),r=target.getBoundingClientRect(),gallery=target.querySelector('.gallery')||target,g=gallery.getBoundingClientRect();
    let visible=g.bottom>95&&g.top<innerHeight;for(let node=gallery;node;node=node.parentElement){const style=getComputedStyle(node);if(style.visibility==='hidden'||Number(style.opacity)<.9)visible=false;}
    return {gallery:{top:g.top,bottom:g.bottom,visible},active:active?.id||active?.classList[0],scrollY,viewport:{width:innerWidth,height:innerHeight},targetTop:r.top,targetBottom:r.bottom,view:target.dataset.view,scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches};
  },targetId);
  await capture(page,result,'continuity-before',{targetId});const before=await state();
  await page.emulateMedia({reducedMotion:'reduce'});await capture(page,result,'continuity-reduced',{targetId});const reduced=await state();
  await page.emulateMedia({reducedMotion:'no-preference'});await capture(page,result,'continuity-restored',{targetId});const restored=await state();
  const observed={requested,before,reduced,restored,honorsReducedScroll:reduced.scrollBehavior==='auto',preservesSection:[before,reduced,restored].every(s=>s.active===targetId&&s.gallery.visible),preservesOrlaScroll:project!=='orla'||[reduced,restored].every(s=>Math.abs(s.scrollY-before.scrollY)<=2)};
  if(result.width===1440){
    await page.setViewportSize({width:390,height:844});await capture(page,result,'continuity-resize-mobile',{targetId});observed.mobile=await state();
    await page.setViewportSize({width:1440,height:900});await capture(page,result,'continuity-resize-desktop',{targetId});observed.desktop=await state();
    observed.preservesResizeSection=[observed.mobile,observed.desktop].every(s=>s.active===targetId&&s.gallery.visible);
  }
  result.continuity=observed;console.log(JSON.stringify({project,engine:result.engine,continuity:observed}));
}

let activeBrowser;
try{
  for(const engine of (process.env.VISUAL_ENGINES||'chromium').split(',')){
    const browser=activeBrowser=await playwright[engine].launch({headless:true,timeout:12000,...(engine==='chromium'?{args:['--no-sandbox']}:{})});
    for(const profile of profiles.filter(p=>widths.includes(p.width)&&(engine!=='webkit'||[1440,390].includes(p.width)))){
      const result={engine,...profile,captures:[],navigation:[],images:[],glyphs:[],errors:[]};report.viewports.push(result);
      const context=await browser.newContext({viewport:profile,deviceScaleFactor:1,reducedMotion:'no-preference',...(profile.width===390||profile.width===320?{hasTouch:true,isMobile:true}:{})});
      const page=await context.newPage();page.setDefaultTimeout(7000);
      page.on('pageerror',error=>report.pageErrors.push({engine,width:profile.width,message:error.message}));
      page.on('response',response=>{if(response.status()>=400&&/\/(assets|media|fonts)\//.test(response.url()))report.assetFailures.push({engine,width:profile.width,url:response.url(),status:response.status()});});
      await context.route('**/api/**',route=>{report.apiRequests.push({url:route.request().url(),method:route.request().method()});return route.abort('blockedbyclient');});
      try{
        result.images=await prepare(page);result.glyphs=await auditGlyphs(page);
        await capture(page,result,'initial');
        if([1440,390,844].includes(profile.width)){await readingContinuity(page,result);if(!process.env.VISUAL_CONTINUITY_ONLY)await prepare(page);}
        if(!process.env.VISUAL_CONTINUITY_ONLY){await allSections(page,result);if([1440,390,320].includes(profile.width))await navigation(page,result);}
      }catch(error){result.errors.push(error.stack);await capture(page,result,'failure').catch(()=>{});}
      finally{await context.close();await writeFile(resolve(artifacts,'report.json'),JSON.stringify(report,null,2)+'\n');}
    }
    await browser.close();activeBrowser=undefined;
  }
  report.completed=true;
}finally{
  await activeBrowser?.close().catch(()=>{});
  report.finishedAt=new Date().toISOString();
  report.pass=report.completed&&!report.pageErrors.length&&!report.assetFailures.length&&!report.apiRequests.length&&report.viewports.every(v=>!v.errors.length&&v.images.every(i=>i.ok)&&v.captures.every(c=>!c.settled.error&&c.metrics.documentWidth<=c.metrics.viewport+1)&&(phase==='before'||!v.glyphs.length)&&(!v.continuity||v.continuity.preservesSection&&v.continuity.honorsReducedScroll&&v.continuity.preservesOrlaScroll&&v.continuity.preservesResizeSection!==false));
  await writeFile(resolve(artifacts,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({project,completed:report.completed,pass:report.pass,captures:report.viewports.reduce((n,v)=>n+v.captures.length,0),report:resolve(artifacts,'report.json')}));
}
if(!report.pass)process.exitCode=1;
