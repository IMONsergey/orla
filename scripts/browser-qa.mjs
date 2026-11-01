import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/home/sergey/.local/share/imon-toolkit/node/node_modules/playwright');
const root='/tmp/realestate-publication/orla',base='http://127.0.0.1:4313';
await mkdir(root+'/artifacts',{recursive:true});
const server=spawn(process.execPath,['node_modules/astro/bin/astro.mjs','dev','--host','127.0.0.1','--port','4313'],{cwd:root,stdio:['ignore','pipe','pipe']});
let logs='',browser;server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
const report={viewports:[],interactions:[],errors:[]};
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw new Error(logs);
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({reducedMotion:'reduce'});page.on('pageerror',e=>report.errors.push(e.message));
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:900});const response=await page.goto(base,{waitUntil:'networkidle'});assert.equal(response.status(),200);
  await page.evaluate(async()=>{await document.fonts.ready;for(let y=0;y<document.body.scrollHeight;y+=900){window.scrollTo({top:y,behavior:'instant'});await new Promise(r=>setTimeout(r,40));}window.scrollTo({top:0,behavior:'instant'});});await page.waitForTimeout(200);
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>i.getAttribute('src')&&i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src'))}));
  assert.ok(metrics.scroll<=width+1,'Overflow '+width+': '+metrics.scroll);assert.deepEqual(metrics.broken,[]);report.viewports.push(metrics);
  if(width===1440||width===390){await page.screenshot({path:root+'/artifacts/home-'+width+'.png',fullPage:true});await page.screenshot({path:root+'/artifacts/hero-'+width+'.png'});}
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('.menu-toggle').click();assert.ok(await page.locator('#menu-dialog').evaluate(n=>n.open));await page.keyboard.press('Escape');assert.equal(await page.locator('.menu-toggle').evaluate(n=>n===document.activeElement),true);report.interactions.push('menu and focus restoration');
 await page.locator('[data-hotspot]').first().click();assert.ok(await page.locator('#hero-hotspot').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('#hero-hotspot').isVisible(),false);report.interactions.push('architecture hotspot');
 await page.locator('[data-gallery-next]').click();assert.equal(await page.locator('[data-gallery-current]').textContent(),'2');await page.locator('[data-gallery-zoom]').click();assert.ok(await page.locator('#zoom-dialog').evaluate(n=>n.open));await page.locator('[data-zoom-in]').click();await page.keyboard.press('Escape');report.interactions.push('gallery and image zoom');
 await page.locator('.feature-card').first().click();assert.ok(await page.locator('#feature-dialog').evaluate(n=>n.open));await page.keyboard.press('Escape');report.interactions.push('feature detail');
 await page.locator('[data-category]').first().click();assert.ok(await page.locator('#residence-dialog').evaluate(n=>n.open));await page.locator('[data-collection-panel] [data-show-residence]').click();assert.ok(await page.locator('[data-residence-panel]').isVisible());await page.locator('[data-plan-zoom]').click();assert.ok(await page.locator('#zoom-dialog').evaluate(n=>n.open));await page.keyboard.press('Escape');assert.ok(await page.locator('#residence-dialog').evaluate(n=>n.open));report.interactions.push('residence selection, floor plan and nested Escape');
 await page.locator('#residence-dialog [data-enquire="Residence 403"]').click();const form=page.locator('#enquiry-form');await form.locator('button[type=submit]').click();assert.equal(await form.locator('[name=name]').getAttribute('aria-invalid'),'true');
 await form.locator('[name=name]').fill('QA Test');await form.locator('[name=email]').fill('qa@example.com');await form.locator('[name=phone]').fill('+971 50 000 0000');await form.locator('[name=message]').fill('Local automated test');await form.locator('[name=consent]').check();await page.waitForTimeout(700);
 const requests=[];await page.route('**/api/enquiry',route=>{requests.push(route.request().postDataJSON());return route.abort('failed');});await form.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-submit-label]').textContent==='Try again');assert.equal(await form.locator('[name=name]').inputValue(),'QA Test');await page.unroute('**/api/enquiry');
 await page.route('**/api/enquiry',route=>{requests.push(route.request().postDataJSON());return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,id:requests.at(-1).submissionId})});});await form.locator('button[type=submit]').click();await page.locator('.enquiry__success').waitFor({state:'visible'});
 assert.equal(requests[0].submissionId,requests[1].submissionId);assert.equal(requests[0].project,'orla');assert.equal(requests[0].context,'Residence 403');report.interactions.push('validation, retained data, idempotent retry and truthful success');
 assert.deepEqual(report.errors,[]);await writeFile(root+'/artifacts/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,...report}));
}finally{if(browser)await browser.close();server.kill('SIGTERM');await writeFile(root+'/artifacts/dev-server.log',logs);}
