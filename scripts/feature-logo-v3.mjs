import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.INTERACTION_BASE || 'http://127.0.0.1:14324';
const output = resolve('artifacts/logic-audit-20261101-v3');
await mkdir(output, {recursive: true});
const report = {checks: [], screenshots: [], pageErrors: [], pass: false};
const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, reducedMotion: 'no-preference'});
  page.setDefaultTimeout(8000);
  await page.addInitScript(() => {
    window.__decodedV3 = [];
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function(...args) {
      return decode.apply(this, args).finally(() => window.__decodedV3.push(this.currentSrc || this.src));
    };
  });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.route('**/api/enquiry', route => route.abort());
  const opened = ids => page.waitForFunction(ids => JSON.stringify([...document.querySelectorAll('dialog[open]')].map(node => node.id).sort()) === JSON.stringify(ids.slice().sort()), ids);
  const shot = async name => { const file = 'final-' + name + '.png'; await page.screenshot({path: resolve(output, file)}); report.screenshots.push(file); };
  const settle = () => page.evaluate(() => new Promise(resolve => {
    let previous = '', count = 0, start = performance.now();
    const tick = () => {
      const current = JSON.stringify([scrollY, ...[...document.querySelectorAll('.site-header,.partner--dorchester,.brand-wordmark')].map(node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })]);
      count = current === previous ? count + 1 : 0; previous = current;
      if (count >= 6 && performance.now() - start > 350) resolve(); else requestAnimationFrame(tick);
    }; tick();
  }));
  await page.goto(base + '/?feature=arrival', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => history.state?.orlaDialogsV1 && document.fonts.status === 'loaded');
  await opened(['feature-dialog']);
  await page.waitForFunction(() => !document.querySelector('[data-feature-image]').hidden);
  const features = await page.locator('#orla-data').evaluate(node => JSON.parse(node.textContent).features);
  const landscape = new URL(features.find(feature => feature.id === 'landscape').image, base).href;
  const interiors = new URL(features.find(feature => feature.id === 'interiors').image, base).href;
  const arrival = new URL(features.find(feature => feature.id === 'arrival').image, base).href;
  await page.route(landscape, route => route.abort());
  await page.locator('.feature-sidebar [data-feature="landscape"]').click();
  await page.locator('[data-feature-retry]').waitFor({state: 'visible'});
  assert.equal(await page.locator('[data-feature-image]').isVisible(), false);
  assert.match(await page.locator('#feature-title').textContent(), /Landscape/);
  await shot('feature-failure');
  await page.unroute(landscape);
  await page.locator('[data-feature-retry]').click();
  await page.waitForFunction(src => { const image = document.querySelector('[data-feature-image]'); return image.src === src && !image.hidden && !image.hasAttribute('aria-busy'); }, landscape);
  assert.equal(await page.locator('[data-feature-feedback]').isVisible(), false);
  await shot('feature-retry');
  report.checks.push('Failed feature hides the old photograph, exposes a real Retry, and restores the selected photograph on success');

  let release, seen;
  let held = new Promise(resolve => { seen = resolve; });
  await page.route(interiors, async route => {
    await new Promise(resolve => { release = resolve; seen(); });
    await route.continue();
  });
  await page.evaluate(() => { window.__decodedV3 = []; });
  await page.locator('.feature-sidebar [data-feature="interiors"]').click(); await held;
  await page.locator('.feature-sidebar [data-feature="arrival"]').click();
  await page.waitForFunction(src => { const image = document.querySelector('[data-feature-image]'); return image.src === src && !image.hidden; }, arrival);
  release();
  await page.waitForFunction(src => window.__decodedV3.includes(src), interiors);
  await settle();
  assert.equal(await page.locator('[data-feature-image]').evaluate(image => image.src), arrival);
  assert.equal(new URL(page.url()).searchParams.get('feature'), 'arrival');
  assert.match(await page.locator('#feature-title').textContent(), /Convenient access/);
  report.checks.push('A late previous image decode cannot overwrite the newest feature title, URL or photograph');

  held = new Promise(resolve => { seen = resolve; });
  await page.evaluate(() => { window.__decodedV3 = []; });
  await page.locator('.feature-sidebar [data-feature="interiors"]').click(); await held;
  await page.keyboard.press('Escape'); await opened([]); release();
  await page.waitForFunction(src => window.__decodedV3.includes(src), interiors);
  await settle();
  assert.equal(await page.locator('#feature-dialog').evaluate(dialog => dialog.open), false);
  assert.equal(await page.locator('[data-feature-image]').evaluate(image => image.hasAttribute('aria-busy')), false);
  assert.equal(new URL(page.url()).search, '');
  await page.unroute(interiors);
  report.checks.push('Close invalidates the pending feature request and removes its busy state without reopening the dialog');

  await page.goto(base, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => history.state?.orlaDialogsV1 && document.fonts.status === 'loaded');
  report.logos = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: width === 1440 ? 900 : 844});
    await page.locator('.partner--dorchester').evaluate(node => window.scrollTo({top: scrollY + node.getBoundingClientRect().top - 115, behavior: 'instant'}));
    await page.locator('.partners img').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
    await settle();
    await shot('partner-' + width);
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await page.locator('.footer-brand img').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
    await settle();
    await shot('footer-' + width);
    const geometry = await page.locator('.partner--dorchester>img,.footer-brand .brand-wordmark').evaluateAll(nodes => nodes.map(node => {
      const image = node.matches('img') ? node : node.querySelector('img');
      const r = node.getBoundingClientRect(), css = getComputedStyle(node);
      return {label: node.getAttribute('aria-label') || image.alt, source: image.getAttribute('src'), decoded: image.complete && image.naturalWidth > 0, natural: [image.naturalWidth, image.naturalHeight], width: r.width, height: r.height, background: css.backgroundColor};
    }));
    assert.ok(geometry.every(item => item.decoded));
    assert.ok(Math.abs(geometry[0].width / geometry[0].height - 315 / 44) < .02);
    assert.ok(Math.abs(geometry[1].width / geometry[1].height - 81 / 29) < .02);
    assert.ok(Math.abs(geometry[2].width / geometry[2].height - 182 / 29) < .02);
    assert.ok(geometry.slice(1).every(item => item.background === 'rgba(0, 0, 0, 0)' && item.source.includes('1-1668-imgOrlaDcDubaiFullWhite2')));
    report.logos.push({width, geometry});
  }
  report.checks.push('Desktop and390px partner/footer photographed only after image decode and settled geometry; transparent original source retained');
  assert.equal(report.pageErrors.length, 0);
  report.pass = true;
} catch (error) { report.error = error.stack || String(error); console.error(error); process.exitCode = 1; }
finally { await browser.close(); report.completedAt = new Date().toISOString(); await writeFile(resolve(output, 'feature-logo-final.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
