import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const require = createRequire(import.meta.url);
const {chromium, webkit} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.INTERACTION_BASE || 'http://127.0.0.1:14324';
const output = resolve('artifacts/logic-audit-20261101-v3');
await mkdir(output, {recursive: true});
const report = {base, startedAt: new Date().toISOString(), profiles: [], pass: false};
const profiles = [
  {name: 'chromium-desktop', engine: chromium, width: 1440, height: 900, touch: false},
  {name: 'chromium-touch', engine: chromium, width: 390, height: 844, touch: true},
  {name: 'webkit-desktop', engine: webkit, width: 1440, height: 900, touch: false},
  {name: 'webkit-touch', engine: webkit, width: 390, height: 844, touch: true},
].filter(profile => !process.env.INTERACTION_PROFILES || process.env.INTERACTION_PROFILES.split(',').includes(profile.name));
for (const profile of profiles) {
  const result = {profile: profile.name, checks: [], errors: [], screenshots: []};
  report.profiles.push(result);
  const browser = await profile.engine.launch({headless: true, ...(profile.engine === chromium ? {args: ['--no-sandbox']} : {})});
  const context = await browser.newContext({viewport: {width: profile.width, height: profile.height}, hasTouch: profile.touch, isMobile: profile.touch, reducedMotion: 'no-preference'});
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => result.errors.push(error.message));
  let responseMode = 'hold', held, sent = [];
  await page.route('**/api/enquiry', async route => {
    const payload = route.request().postDataJSON(); sent.push(payload);
    const answer = (body = {ok: true, id: payload.submissionId}, status = 201) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
    if (responseMode === 'hold') held = answer;
    else if (responseMode === 'invalid') await route.fulfill({status: 201, contentType: 'application/json', body: JSON.stringify({ok: true})});
    else await answer();
  });
  const check = text => { result.checks.push(text); console.log(profile.name + ': ' + text); };
  const opened = async ids => {
    await page.waitForFunction(ids => JSON.stringify([...document.querySelectorAll('dialog[open]')].map(node => node.id).sort()) === JSON.stringify(ids.slice().sort()), ids);
    assert.equal(await page.locator('html').evaluate(node => node.classList.contains('modal-open')), ids.length > 0);
    assert.equal(await page.locator('body').evaluate(node => node.classList.contains('modal-open')), ids.length > 0);
  };
  const go = async (query = '') => {
    await page.goto(base + '/' + query, {waitUntil: 'domcontentloaded', timeout: 20000});
    await page.waitForFunction(() => Boolean(history.state?.orlaDialogsV1));
    await page.waitForFunction(() => document.fonts.status === 'loaded');
  };
  const click = async selector => {
    const locator = typeof selector === 'string' ? page.locator(selector).first() : selector;
    await locator.scrollIntoViewIfNeeded();
    await locator.click();
  };
  const enquiryParents = profile.touch ? ['menu-dialog'] : [];
  const openEnquiry = async () => {
    if (profile.touch) {
      if (!await page.locator('#menu-dialog').evaluate(node => node.open)) { await click('.menu-toggle'); await opened(['menu-dialog']); }
      await click('#menu-dialog [data-enquire]');
    } else await click('.header-enquire');
    await opened([...enquiryParents, 'enquiry-dialog']);
  };
  const finishEnquiry = async () => { await page.keyboard.press('Escape'); await opened(enquiryParents); };
  const closeEnquiryParents = async () => { if (profile.touch) { await page.keyboard.press('Escape'); await opened([]); } };
  const shot = async name => {
    const file = profile.name + '-' + name + '.png';
    await page.screenshot({path: resolve(output, file)}); result.screenshots.push(file);
  };
  try {
    await go();
    await click('[data-category="mansion"]'); await opened(['residence-dialog']);
    assert.equal(await page.locator('[data-collection-panel] [data-show-residence]').isVisible(), false);
    assert.equal(new URL(page.url()).searchParams.get('collection'), 'mansion');
    await click('[data-category-enquire]'); await opened(['residence-dialog', 'enquiry-dialog']);
    assert.match(await page.locator('[data-interest]').textContent(), /mansion/i);
    await page.goBack(); await opened(['residence-dialog']);
    await page.goForward(); await opened(['residence-dialog', 'enquiry-dialog']);
    assert.match(await page.locator('[data-interest]').textContent(), /mansion/i);
    await page.keyboard.press('Escape'); await opened(['residence-dialog']);
    await page.goBack(); await opened([]);
    assert.equal(new URL(page.url()).searchParams.has('collection'), false);
    await page.goForward(); await opened(['residence-dialog']);
    await page.keyboard.press('Escape'); await opened([]);
    check('Mansion category has no unrelated 401 CTA; nested Back/Forward/Escape preserves context and locks');

    await go('?collection=sky-palaces#residences'); await opened(['residence-dialog']);
    assert.equal(await page.locator('[data-collection-panel] [data-show-residence]').isVisible(), false);
    await click('#residence-dialog > [data-close]'); await opened([]);
    assert.equal(new URL(page.url()).search, ''); assert.equal(new URL(page.url()).hash, '#residences');
    check('Direct collection URL closes to its base URL without consuming another document');

    await go();
    await click('[data-modal="residence-dialog"]'); await opened(['residence-dialog']);
    await click('[data-collection-panel] [data-show-residence]');
    assert.equal(new URL(page.url()).searchParams.get('residence'), '401');
    assert.match(await page.evaluate(() => document.activeElement?.textContent), /Residence\s*401/);
    await click('[data-plan-zoom]'); await opened(['residence-dialog', 'zoom-dialog']);
    await page.waitForFunction(() => !document.querySelector('[data-zoom-image]').hidden && !document.querySelector('.zoom-stage').hasAttribute('aria-busy'));
    const plan = await page.locator('[data-zoom-image]').getAttribute('src');
    await click('[data-zoom-in]');
    await page.goBack(); await opened(['residence-dialog']);
    await page.goForward(); await opened(['residence-dialog', 'zoom-dialog']);
    await page.waitForFunction(() => !document.querySelector('[data-zoom-image]').hidden);
    assert.equal(await page.locator('[data-zoom-image]').getAttribute('src'), plan);
    await shot('plan-forward');
    await page.keyboard.press('Escape'); await opened(['residence-dialog']);
    await page.keyboard.press('Escape'); await opened([]);
    check('Generic 401 plan, heading focus, nested zoom and Forward image payload work');

    await go('?feature=arrival'); await opened(['feature-dialog']);
    await click('.feature-sidebar [data-feature="landscape"]');
    assert.equal(new URL(page.url()).searchParams.get('feature'), 'landscape');
    await page.keyboard.press('Escape'); await opened([]);
    assert.equal(new URL(page.url()).search, '');
    await go(); await click('main [data-feature="arrival"]'); await opened(['feature-dialog']);
    await click('.feature-sidebar [data-feature="landscape"]');
    const featureTitle = await page.locator('#feature-title').textContent();
    await page.goBack(); await opened([]); await page.goForward(); await opened(['feature-dialog']);
    assert.equal(await page.locator('#feature-title').textContent(), featureTitle);
    await page.keyboard.press('Escape'); await opened([]);
    check('Feature tabs replace the active route and restore their actual content on Forward');

    await go(); await openEnquiry();
    await click('#enquiry-form [type="submit"]');
    assert.ok(await page.locator('#enquiry-form [aria-invalid="true"]').count() > 0);
    await page.locator('#enquiry-form [name="name"]').fill('Synthetic Local Audit');
    await page.locator('#enquiry-form [name="email"]').fill('audit@example.invalid');
    await page.locator('#enquiry-form [name="phone"]').fill('+971501234567');
    await page.locator('#enquiry-form [name="consent"]').check();
    await click('#enquiry-form [type="submit"]');
    await page.waitForFunction(() => document.querySelector('#enquiry-form').getAttribute('aria-busy') === 'true');
    assert.equal(await page.locator('#enquiry-form input:not(:disabled),#enquiry-form textarea:not(:disabled),#enquiry-form select:not(:disabled),#enquiry-form button:not(:disabled)').count(), 0);
    await finishEnquiry();
    await openEnquiry();
    assert.equal(await page.locator('#enquiry-form [name="name"]').inputValue(), 'Synthetic Local Audit');
    assert.equal(await page.locator('#enquiry-form [name="name"]').isDisabled(), true);
    assert.equal(await page.locator('#enquiry-dialog').evaluate(node => node.scrollTop), 0);
    assert.ok(held, 'Synthetic route must be intercepted before completing it');
    await held(); held = undefined;
    await page.waitForFunction(() => !document.querySelector('.enquiry__success').hidden);
    assert.equal(await page.locator('#enquiry-dialog').evaluate(node => node.scrollTop), 0);
    await shot('synthetic-success');
    await finishEnquiry();
    await openEnquiry();
    assert.equal(await page.locator('#enquiry-form [name="name"]').inputValue(), '');
    assert.equal(await page.locator('#enquiry-dialog').evaluate(node => node.scrollTop), 0);
    await page.locator('#enquiry-form [name="name"]').fill('Synthetic Local Audit');
    await page.locator('#enquiry-form [name="email"]').fill('audit@example.invalid');
    await page.locator('#enquiry-form [name="phone"]').fill('+971501234567');
    await page.locator('#enquiry-form [name="consent"]').check();
    await click('#enquiry-form [type="submit"]');
    await page.waitForFunction(() => document.querySelector('#enquiry-form').getAttribute('aria-busy') === 'true');
    await finishEnquiry(); await openEnquiry();
    assert.equal(await page.locator('#enquiry-dialog').evaluate(node => node.scrollTop), 0);
    await held({ok: false, error: 'Please correct the highlighted field.', fields: {email: 'Use a different email address.'}}, 422); held = undefined;
    await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'email' && !document.activeElement.disabled);
    const errorBounds = await page.locator('#error-email').boundingBox();
    assert.ok(errorBounds && errorBounds.y >= 0 && errorBounds.y + errorBounds.height <= profile.height);
    await shot('server-field-error');
    await finishEnquiry();
    await closeEnquiryParents();
    check('Validation, pending close/reopen at top, synthetic success/reset and visible focused 422 field error pass; no real POST');

    if (profile.touch) {
      await go(); await click('.menu-toggle'); await opened(['menu-dialog']);
      await click('#menu-dialog a[href="#features"]'); await opened([]);
      await page.waitForFunction(() => location.hash === '#features');
      await page.goBack(); await opened([]);
      assert.equal(new URL(page.url()).hash, '');
      await page.goForward(); await opened([]);
      assert.equal(new URL(page.url()).hash, '#features');
      check('Mobile menu anchor closes before navigation; Back/Forward does not resurrect the menu');
    }

    await go(); await click('.watch'); await opened(['media-dialog']);
    await page.waitForFunction(() => { const video = document.querySelector('#orla-film'); return !video.paused && video.currentTime > 0; }, null, {timeout: 12000});
    assert.notEqual(await page.locator('.media-action .action__text').evaluate(node => getComputedStyle(node).color), 'rgb(7, 14, 31)');
    await click('#media-dialog [data-enquire]'); await opened(['media-dialog', 'enquiry-dialog']);
    assert.equal(await page.locator('#orla-film').evaluate(video => video.paused), true);
    await page.keyboard.press('Escape'); await opened(['media-dialog']);
    assert.equal(await page.locator('#orla-film').evaluate(video => video.paused), true);
    await shot('film-cta');
    await page.keyboard.press('Escape'); await opened([]);
    assert.equal(await page.locator('#orla-film').evaluate(video => video.paused), true);
    check('Watch starts playback with one click; nested enquiry and close pause video; dark CTA is readable');

    await go();
    await page.route('**/media/orla-film-preview.mp4', route => route.abort());
    await click('.watch'); await opened(['media-dialog']);
    await page.locator('[data-film-retry]').waitFor({state: 'visible'});
    await page.unroute('**/media/orla-film-preview.mp4');
    await click('[data-film-retry]');
    await page.waitForFunction(() => { const video = document.querySelector('#orla-film'); return !video.paused && video.currentTime > 0; }, null, {timeout: 12000});
    await page.keyboard.press('Escape'); await opened([]);
    check('Failed preview exposes a real retry; retry loads and plays the same genuine film');

    await page.emulateMedia({reducedMotion: 'reduce'});
    await openEnquiry();
    await page.goBack(); await opened(enquiryParents);
    await page.goForward(); await opened([...enquiryParents, 'enquiry-dialog']);
    await finishEnquiry(); await closeEnquiryParents();
    const arrows = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(node => !node.matches('script,style') && [...node.childNodes].some(text => text.nodeType === 3 && /[\u2190-\u21ff\u27a0-\u27bf\u276e-\u276f]/u.test(text.textContent))).length);
    assert.equal(arrows, 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    check('Reduced-motion dialog history, no textual arrows and no horizontal document overflow');
    await go(); await click('main [data-feature="arrival"]'); await opened(['feature-dialog']);
    await page.evaluate(touch => {
      document.querySelector('#feature-dialog > [data-close]').click();
      document.querySelector(touch ? '.menu-toggle' : '.header-enquire').click();
    }, profile.touch);
    await opened([profile.touch ? 'menu-dialog' : 'enquiry-dialog']);
    assert.equal(new URL(page.url()).search, '');
    await page.keyboard.press('Escape'); await opened([]);
    check('A same-task Close then CTA preserves the complete queued intent and URL');
    await page.locator('.partners').scrollIntoViewIfNeeded();
    await page.locator('.partners img').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
    await shot('partner-wordmark');
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await page.locator('.footer-brand img').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
    await shot('footer-wordmarks');
    const logos = await page.locator('.footer-brand .brand-wordmark,.partner--dorchester>img').evaluateAll(nodes => nodes.map(node => ({source: (node.matches('img') ? node : node.querySelector('img')).getAttribute('src'), natural: [(node.matches('img') ? node : node.querySelector('img')).naturalWidth, (node.matches('img') ? node : node.querySelector('img')).naturalHeight], width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height})));
    result.logoGeometry = logos;
    assert.ok(Math.abs(logos[0].width / logos[0].height - 315 / 44) < .02);
    assert.ok(Math.abs(logos[1].width / logos[1].height - 81 / 29) < .02);
    assert.ok(Math.abs(logos[2].width / logos[2].height - 182 / 29) < .02);
    if (profile.touch) { await click('.menu-toggle'); await shot('menu-wordmark'); await page.keyboard.press('Escape'); await opened([]); }
    check('Source logo canvas ratios retained in partner, footer and mobile menu; screenshots captured for review');
    result.syntheticPosts = sent.length;
    assert.equal(result.errors.length, 0, 'No client runtime errors');
  } catch (error) {
    result.errors.push(error.stack || String(error));
    await shot('failure').catch(() => {});
    console.error(error);
  } finally {
    await context.close(); await browser.close();
    await writeFile(resolve(output, 'regression.json'), JSON.stringify(report, null, 2));
  }
}
report.pass = report.profiles.every(profile => !profile.errors.length);
report.completedAt = new Date().toISOString();
await writeFile(resolve(output, 'regression.json'), JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
