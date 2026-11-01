import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.VISUAL_BASE_URL||'http://127.0.0.1:14324',phase=process.env.TEXT_QA_PHASE||'narrow-text-after';
const directory=resolve('artifacts/pixel-audit-20261101-v2',phase);await mkdir(directory,{recursive:true});
const report={startedAt:new Date().toISOString(),base,pass:false,profiles:[],pageErrors:[]};
async function settled(page){
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  const nodes=[...document.querySelectorAll('main h1,main h1>*,main h2,main h2>*,main h3,main h3>*,.interiors__copy')];let last='',stable=0,raf;const start=performance.now(),timer=setTimeout(()=>{cancelAnimationFrame(raf);reject(new Error('Text geometry did not settle'));},6000);
  function sample(){const signature=JSON.stringify([scrollY,...nodes.map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return[r.x,r.y,r.width,r.height,s.opacity,s.transform];})]);stable=signature===last?stable+1:0;last=signature;if(stable>=7&&performance.now()-start>400){clearTimeout(timer);resolve();}else raf=requestAnimationFrame(sample)}sample();
 }));
}
for(const engine of (process.env.TEXT_QA_ENGINES||'chromium,webkit').split(',')){
 const browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{args:['--no-sandbox']}:{})});
 try{for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true,reducedMotion:'no-preference'}),page=await context.newPage(),result={engine,width,headings:[],overlaps:[],captures:[],issues:[]};report.profiles.push(result);
  page.on('pageerror',error=>report.pageErrors.push(error.message));await context.route('**/api/**',route=>route.abort('blockedbyclient'));
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.interiors__slides')?.style.isolation==='isolate'&&document.fonts.status==='loaded');
   const selectors=['.lifestyle','.interiors','.closing'];
   for(const selector of selectors){
    await page.locator(selector).evaluate(n=>scrollTo({top:n.getBoundingClientRect().top+scrollY-100,behavior:'instant'}));await settled(page);
    const state=await page.locator(selector).evaluate(section=>{
     const headings=[...section.querySelectorAll('h1,h2,h3')].filter(n=>!n.classList.contains('sr-only')).map(n=>{
      const lines=[],walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);
      for(let text;text=walker.nextNode();)if(text.textContent.trim()){const range=document.createRange();range.selectNodeContents(text);for(const r of range.getClientRects())lines.push({text:text.textContent.trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom});}
      return{text:n.textContent.trim(),lines};
     });
     const title=section.querySelector('.interiors__title')?.getBoundingClientRect(),copy=section.querySelector('.interiors__copy')?.getBoundingClientRect();
     return{viewport:document.documentElement.clientWidth,headings,gap:title&&copy?copy.top-title.bottom:null,copyBottom:copy?.bottom,sectionBottom:section.getBoundingClientRect().bottom};
    });
    result.headings.push({selector,...state});
    for(const heading of state.headings)for(const line of heading.lines)if(line.left< -1||line.right>state.viewport+1)result.issues.push({selector,message:'Heading text is clipped horizontally',...line,viewport:state.viewport});
    if(state.gap!==null&&state.gap<8)result.issues.push({selector,message:'Gallery title overlaps or crowds its paragraph',gap:state.gap});
    if(state.copyBottom&&state.copyBottom>state.sectionBottom+1)result.issues.push({selector,message:'Gallery paragraph escapes the section',copyBottom:state.copyBottom,sectionBottom:state.sectionBottom});
    const file=`${engine}-${width}-${selector.slice(1)}.png`;await page.screenshot({path:resolve(directory,file)});result.captures.push(file);
   }
  }catch(error){result.issues.push({message:error.stack});}finally{await context.close();}
 }}finally{await browser.close();}
}
report.finishedAt=new Date().toISOString();report.pass=!report.pageErrors.length&&report.profiles.every(p=>!p.issues.length);await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,profiles:report.profiles.map(p=>({engine:p.engine,width:p.width,issues:p.issues})),report:resolve(directory,'report.json')}));if(!report.pass)process.exitCode=1;
