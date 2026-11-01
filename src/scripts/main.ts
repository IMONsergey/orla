import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initializeMediaInteractions } from './media-interactions';

type Category = { id: string; count: string; title: string; subtitle?: string; area: string };
type Feature = { id: string; title: string; image: string; detailImage?: string; caption: string };
type GalleryImage = { image: string; alt: string };
type Config = { categories: Category[]; features: Feature[]; gallery: GalleryImage[]; skyPalacesCopy: string; interiorCopy: string; arrivalCopy: string; layoutCopy: string };
const config: Config = JSON.parse(document.querySelector('#orla-data')?.textContent || '{}');
const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector)!;
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [...root.querySelectorAll<T>(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const previousFocus = new WeakMap<HTMLDialogElement, HTMLElement>();
const dialogStack: HTMLDialogElement[] = [];
let dialogClickOrigin: HTMLElement | undefined;
function syncDialogLock() {
  const open = Boolean(document.querySelector('dialog[open]'));
  document.documentElement.classList.toggle('modal-open', open);
  document.body.classList.toggle('modal-open', open);
}

function openDialog(id: string, trigger?: HTMLElement) {
  const dialog = document.getElementById(id) as HTMLDialogElement | null;
  if (!dialog || dialog.open) return;
  // Safari does not always focus a button when it is clicked.
  const origin = trigger || dialogClickOrigin || document.activeElement;
  if (origin instanceof HTMLElement) previousFocus.set(dialog, origin);
  dialog.showModal();
  dialogStack.push(dialog);
  syncDialogLock();
  if (id === 'menu-dialog') $('.menu-toggle').setAttribute('aria-expanded', 'true');
}
function closeDialog(dialog: HTMLDialogElement) { dialog.close(); }
$$<HTMLDialogElement>('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => {
    const index = dialogStack.indexOf(dialog);
    if (index !== -1) dialogStack.splice(index, 1);
    syncDialogLock();
    if (dialog.id === 'menu-dialog') $('.menu-toggle').setAttribute('aria-expanded', 'false');
    const target = previousFocus.get(dialog);
    const remaining = dialogStack.filter(item => item.open).at(-1);
    if (target?.isConnected && target.getClientRects().length && !target.closest('dialog:not([open]),[inert]') && (!remaining || target.closest('dialog') === remaining)) target.focus({ preventScroll: true });
    if (dialog.id === 'residence-dialog' || dialog.id === 'feature-dialog') {
      const url = new URL(location.href);
      for (const key of ['collection', 'residence', 'feature']) url.searchParams.delete(key);
      history.replaceState({}, '', url);
    }
  });
  dialog.addEventListener('click', event => {
    if (!dialog.classList.contains('small-sheet') || event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
});
function setQuery(key: string, value: string) {
  const url = new URL(location.href);
  for (const name of ['collection', 'residence', 'feature']) url.searchParams.delete(name);
  url.searchParams.set(key, value);
  history.replaceState({}, '', url);
}

let selectedCategory: Category | undefined;
function showCollection() {
  $('[data-collection-panel]').hidden = false;
  $('[data-residence-panel]').hidden = true;
  $('[data-collection-title]').textContent = selectedCategory?.title || 'No two are quite alike';
  $('[data-collection-detail]').textContent = selectedCategory
    ? `${selectedCategory.count} ${selectedCategory.id === 'sky-palaces' ? 'sky palaces' : selectedCategory.id === 'mansion' ? 'mansion' : 'residences'} · ${selectedCategory.area}${selectedCategory.subtitle ? ' · ' + selectedCategory.subtitle : ''}`
    : 'Explore a residence at ORLA.';
  if (selectedCategory) setQuery('collection', selectedCategory.id);
}
function selectCategory(id: string, trigger?: HTMLElement) {
  selectedCategory = config.categories.find(item => item.id === id);
  $$('[data-select-category]').forEach(button => {
    const selected = button.dataset.selectCategory === id;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  showCollection();
  openDialog('residence-dialog', trigger);
  if (window.matchMedia('(max-width:1100px)').matches) {
    requestAnimationFrame(() => $('.residence-main').scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' }));
  }
}
function showResidence(trigger?: HTMLElement) {
  $('[data-collection-panel]').hidden = true;
  $('[data-residence-panel]').hidden = false;
  openDialog('residence-dialog', trigger);
  setQuery('residence', '401');
}

let selectedFeature = 'sky-palaces';
let featureImageRequest=0;
function showFeature(id: string, trigger?: HTMLElement) {
  const feature = config.features.find(item => item.id === id);
  if (!feature) return;
  selectedFeature = id;
  $('#feature-title').textContent = feature.title;
  const image = $<HTMLImageElement>('[data-feature-image]');
  const request=++featureImageRequest,source=feature.detailImage||feature.image;
  image.setAttribute('aria-busy','true');
  const prepared=new Image();prepared.decoding='async';prepared.src=source;
  void prepared.decode().catch(()=>undefined).then(()=>{
    if(request!==featureImageRequest)return;
    image.removeAttribute('aria-busy');
    if(!prepared.naturalWidth)return;
    // Commit a decoded photograph; a slow new request never blanks the last one.
    image.src=source;image.alt=feature.title;
  });
  const copies: Record<string, string> = {
    'sky-palaces': config.skyPalacesCopy,
    interiors: config.interiorCopy,
    arrival: config.arrivalCopy,
    layouts: config.layoutCopy,
    landscape: 'ORLA immerses you in balance and beauty, fostering a deep connection with your space and surroundings. The architecture is conceptualised through the lens of natural elements, integrating flowing water features and lush greenery to erase boundaries and let positive energy flow through the property.',
    infrastructure: 'Offering the finest amenities and five-star service, for the pleasure of residents of ORLA’s 85 residences, 3 sky palaces and 1 luxury mansion.',
    mansion: 'Step into a lifestyle as extraordinary as the views from this most iconic of peninsulas, where scenic sunrises and glorious sunsets glint over the sea.',
    'beach-club': 'Situated on the crescent of the world-renowned landmark, Palm Jumeirah, ORLA occupies a beachfront position right at the pinnacle of Dubai’s archipelago.'
  };
  $('[data-feature-copy]').textContent = copies[id];
  $$('.feature-sidebar [data-feature]').forEach(button => {
    const selected = button.dataset.feature === id;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-current', selected ? 'true' : 'false');
  });
  openDialog('feature-dialog', trigger);
  setQuery('feature', id);
  $('#feature-dialog').scrollTo({ top: 0, behavior: 'instant' });
}

const {stepGallery,openGallery,openZoom,changeZoom,resetZoom} = initializeMediaInteractions({...config,openDialog},reducedMotion);

const form = $<HTMLFormElement>('#enquiry-form');
let startedAt = Date.now(), submissionId = crypto.randomUUID(), enquiryContext = 'ORLA, Dorchester Collection', submitting = false, lastSubmittedPayload = '';
function clearErrors() {
  $$('[data-error]', form).forEach(node => node.textContent = '');
  $$<HTMLInputElement>('[aria-invalid]', form).forEach(node => node.removeAttribute('aria-invalid'));
  $('[data-form-status]', form).textContent = '';
}
function fieldError(name: string, text: string) {
  const field = form.elements.namedItem(name) as HTMLInputElement | null;
  if (field) field.setAttribute('aria-invalid', 'true');
  const error = form.querySelector(`[data-error="${name}"]`); if (error) error.textContent = text;
}
function openEnquiry(context: string) {
  if (submitting) return;
  const wasSuccessful = !$('.enquiry__success').hidden;
  if (wasSuccessful) { form.reset(); submissionId = crypto.randomUUID(); lastSubmittedPayload = ''; startedAt = Date.now(); }
  enquiryContext = context;
  $<HTMLInputElement>('input[name=context]', form).value = context;
  $('[data-interest]').textContent = context;
  $('[data-interest-summary]').textContent = context;
  $('#enquiry-title').hidden = false; $('.enquiry__subtitle').hidden = false;
  form.hidden = false; $('.enquiry__success').hidden = true;
  clearErrors(); $('[data-submit-label]').textContent = 'Send interest';
  if (Date.now() - startedAt > 6 * 24 * 60 * 60 * 1000) startedAt = Date.now();
  openDialog('enquiry-dialog');
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (submitting) return; clearErrors();
  const values = new FormData(form);
  const name = String(values.get('name') || '').trim(), email = String(values.get('email') || '').trim(), phone = String(values.get('phone') || '').trim();
  let valid = true;
  if (name.length < 2 || name.length > 100) { fieldError('name', 'Please enter your name (2 to 100 characters).'); valid = false; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldError('email', 'Enter a valid email address.'); valid = false; }
  if (!/^[+()\d\s.\-]+$/.test(phone) || phone.replace(/\D/g,'').length < 7 || phone.replace(/\D/g,'').length > 15) { fieldError('phone', 'Enter a valid phone number, including the country code.'); valid = false; }
  if (values.get('consent') !== 'on') { fieldError('consent', 'Please agree before sending your enquiry.'); valid = false; }
  if (!valid) { $<HTMLInputElement>('[aria-invalid=true]', form)?.focus(); return; }
  const message = `Preferred contact method: ${values.get('method') || 'Email'}${values.get('message') ? '\n' + String(values.get('message')).trim() : ''}`;
  const signature = JSON.stringify({context:enquiryContext,name,email,phone,message});
  if (lastSubmittedPayload && signature !== lastSubmittedPayload) submissionId = crypto.randomUUID();
  lastSubmittedPayload = signature;
  const payload = { project:'orla', context:enquiryContext, name, email, phone, consent:true, website:String(values.get('website') || ''), startedAt, submissionId, message };
  submitting = true; form.setAttribute('aria-busy','true');
  const submit = $<HTMLButtonElement>('button[type=submit]', form); submit.disabled = true;
  $('[data-submit-label]').textContent = 'Sending...';
  $('[data-form-status]', form).textContent = 'Sending your enquiry…';
  const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api/enquiry', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) {
      if (result?.fields && typeof result.fields === 'object') for (const [key,value] of Object.entries(result.fields)) fieldError(key,String(value));
      throw new Error(typeof result?.error === 'string' ? result.error : 'Your enquiry could not be sent. Please try again.');
    }
    form.hidden = true; $('#enquiry-title').hidden = true; $('.enquiry__subtitle').hidden = true;
    $('[data-success-interest]').textContent = enquiryContext;
    $('.enquiry__success').hidden = false; $('.enquiry__success').focus();
    $('#enquiry-dialog').scrollTo({ top:0, behavior:'instant' });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'The connection timed out. Your details are still here; please try again.' : error instanceof Error ? error.message : 'Your enquiry could not be sent. Please try again.';
    $('[data-form-status]', form).textContent = message;
    $('[data-submit-label]').textContent = 'Try again';
  } finally {
    clearTimeout(timeout); submitting = false; form.removeAttribute('aria-busy'); submit.disabled = false;
  }
});
form.addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (input.name) { input.removeAttribute('aria-invalid'); const error = form.querySelector(`[data-error="${input.name}"]`); if (error) error.textContent = ''; }
});

// Keep the architectural callout beside its point without scrolling the page.
const heroDetail=$('#hero-hotspot');
let heroDetailTrigger:HTMLElement|undefined,heroDetailAnimation:Animation|undefined;
let heroDetailFrame=0,heroDetailLayoutDirty=true;
let heroDetailLayout={left:0,width:0,height:0};
function closeHeroDetail(restoreFocus=false){
  const trigger=heroDetailTrigger;
  cancelAnimationFrame(heroDetailFrame);heroDetailFrame=0;
  heroDetailAnimation?.cancel();heroDetailAnimation=undefined;
  heroDetail.hidden=true;heroDetailTrigger=undefined;
  $$('[data-hotspot]').forEach(button=>button.setAttribute('aria-expanded','false'));
  if(restoreFocus)trigger?.focus({preventScroll:true});
}
function positionHeroDetail(){
  heroDetailFrame=0;
  if(heroDetail.hidden||!heroDetailTrigger)return;
  const viewport=window.visualViewport;
  const view={left:viewport?.offsetLeft||0,top:viewport?.offsetTop||0,width:viewport?.width||innerWidth,height:viewport?.height||innerHeight};
  const point=heroDetailTrigger.getBoundingClientRect(),hero=$('.hero').getBoundingClientRect();
  const header=$('.site-header').getBoundingClientRect();
  const visibleTop=Math.max(view.top,Math.min(header.bottom,view.top+view.height));
  // A callout belongs to a visible point; scrolling away dismisses it without
  // sending focus back to an offscreen control or fighting the user's scroll.
  if(point.bottom<=visibleTop||point.top>=view.top+view.height||point.right<=view.left||point.left>=view.left+view.width||hero.bottom<=visibleTop||hero.top>=view.top+view.height){
    closeHeroDetail();return;
  }
  if(heroDetailLayoutDirty){
    heroDetailLayoutDirty=false;
    for(const property of ['left','width','height','min-width','min-height'])heroDetail.style.removeProperty(property);
    const authored=heroDetail.getBoundingClientRect();
    // The circular close control extends 27px past the card's left edge.
    // Measure the authored min/max sizes before applying the viewport limits.
    heroDetail.style.minWidth='0';heroDetail.style.minHeight='0';
    heroDetail.style.width=`${Math.max(1,Math.min(authored.width,view.width-32-27))}px`;
    heroDetail.style.height=`${Math.max(1,Math.min(authored.height,view.height-32))}px`;
    const box=heroDetail.getBoundingClientRect();
    heroDetailLayout={left:box.left,width:heroDetail.offsetWidth,height:heroDetail.offsetHeight};
  }
  const {left,width,height}=heroDetailLayout;
  const minTop=view.top+16,maxTop=view.top+view.height-height-16;
  const preferredTop=Math.max(point.top+20,header.bottom+16);
  heroDetail.style.top=`${Math.max(minTop,Math.min(preferredTop,maxTop))}px`;
  heroDetail.style.left=`${Math.max(view.left+16+27,Math.min(left,view.left+view.width-width-16))}px`;
}
function scheduleHeroDetail(layoutChanged=false){
  heroDetailLayoutDirty=heroDetailLayoutDirty||layoutChanged;
  if(!heroDetail.hidden&&!heroDetailFrame)heroDetailFrame=requestAnimationFrame(positionHeroDetail);
}
function toggleHeroDetail(trigger:HTMLElement){
  if(!heroDetail.hidden&&heroDetailTrigger===trigger){closeHeroDetail(true);return;}
  const opening=heroDetail.hidden;
  heroDetailAnimation?.cancel();heroDetailAnimation=undefined;
  heroDetailTrigger=trigger;heroDetail.hidden=false;
  heroDetailLayoutDirty=true;positionHeroDetail();
  if(heroDetail.hidden)return;
  $$('[data-hotspot]').forEach(button=>button.setAttribute('aria-expanded',String(button===trigger)));
  if(opening&&!reducedMotion.matches)heroDetailAnimation=heroDetail.animate([{opacity:0,clipPath:'inset(0 100% 0 0)'},{opacity:1,clipPath:'inset(0 0 0 0)'}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});
  $('[data-hotspot-close]',heroDetail).focus({preventScroll:true});
}
window.addEventListener('scroll',()=>scheduleHeroDetail(),{passive:true});
window.addEventListener('resize',()=>scheduleHeroDetail(true),{passive:true});
window.visualViewport?.addEventListener('scroll',()=>scheduleHeroDetail(),{passive:true});
window.visualViewport?.addEventListener('resize',()=>scheduleHeroDetail(true),{passive:true});
reducedMotion.addEventListener('change',()=>{
  if(reducedMotion.matches){heroDetailAnimation?.cancel();heroDetailAnimation=undefined;}
  scheduleHeroDetail(true);
});

// The film is fetched only after a deliberate open. Closing it stops playback.
const presentationVideo=$<HTMLVideoElement>('#orla-film');
const presentationDialog=$<HTMLDialogElement>('#media-dialog');
const originalOpenDialog=openDialog;
function openPresentation(trigger:HTMLElement){
  originalOpenDialog('media-dialog',trigger);
  if(!presentationVideo.getAttribute('src')){presentationVideo.poster=presentationVideo.dataset.poster!;presentationVideo.src=presentationVideo.dataset.src!;presentationVideo.load();}
}
presentationDialog.addEventListener('close',()=>presentationVideo.pause());
document.addEventListener('visibilitychange',()=>{if(document.hidden)presentationVideo.pause();});

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a'); if (!target) return;
  dialogClickOrigin = target;
  queueMicrotask(() => { if (dialogClickOrigin === target) dialogClickOrigin = undefined; });
  if (target.hasAttribute('data-close')) { const dialog = target.closest<HTMLDialogElement>('dialog'); if (dialog) closeDialog(dialog); }
  else if (target.hasAttribute('data-enquire')) openEnquiry(target.dataset.enquire || 'ORLA, Dorchester Collection');
  else if (target.hasAttribute('data-privacy')) openDialog('privacy-dialog', target);
  else if(target.dataset.modal==='media-dialog')openPresentation(target);
  else if (target.dataset.modal) { if (target.dataset.modal === 'residence-dialog') { selectedCategory = undefined; showCollection(); } openDialog(target.dataset.modal, target); }
  else if (target.dataset.category) selectCategory(target.dataset.category, target);
  else if (target.dataset.selectCategory) selectCategory(target.dataset.selectCategory, target);
  else if (target.hasAttribute('data-show-residence')) showResidence(target);
  else if (target.hasAttribute('data-show-collection')) showCollection();
  else if (target.hasAttribute('data-category-enquire')) openEnquiry(selectedCategory ? `${selectedCategory.title}${selectedCategory.subtitle ? ' / '+selectedCategory.subtitle : ''}` : 'ORLA residence collection');
  else if (target.dataset.feature) showFeature(target.dataset.feature, target);
  else if (target.hasAttribute('data-feature-enquire')) openEnquiry(config.features.find(f => f.id === selectedFeature)?.title || 'ORLA features');
  else if (target.hasAttribute('data-plan-zoom')) openZoom($<HTMLImageElement>('.plan-preview img').src, 'Residence 401 floor plan', 'Residence 401', true, target);
  else if (target.hasAttribute('data-gallery-prev')) stepGallery(-1);
  else if (target.hasAttribute('data-gallery-next')) stepGallery(1);
  else if (target.hasAttribute('data-gallery-zoom')) openGallery(target);
  else if (target.hasAttribute('data-zoom-in')) changeZoom(.5);
  else if (target.hasAttribute('data-zoom-out')) changeZoom(-.5);
  else if (target.hasAttribute('data-zoom-reset')) resetZoom();
  else if (target.hasAttribute('data-hotspot')) {
    toggleHeroDetail(target);
  } else if (target.hasAttribute('data-hotspot-close')) {
    closeHeroDetail(true);
  }
  if (target.matches('#menu-dialog a[href^="#"]')) {
    closeDialog($<HTMLDialogElement>('#menu-dialog'));
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#hero-hotspot').hidden && !document.querySelector('dialog[open]')) {
    closeHeroDetail(true);
  }
});

const header = $('.site-header');
let headerScrolled = false;
function updateHeader() {
  const scrolled = window.scrollY > 70;
  if (scrolled === headerScrolled) return;
  headerScrolled = scrolled;
  header.classList.toggle('is-scrolled', scrolled);
}
window.addEventListener('scroll', updateHeader, {passive:true}); updateHeader();
const navLinks = $$<HTMLAnchorElement>('.desktop-nav a');
const navObserver = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top-b.boundingClientRect.top);
  if (!visible.length) return;
  const id = visible[0].target.id;
  navLinks.forEach(link => {
    if (link.hash === '#'+id) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
}, {rootMargin:'-10% 0px -65% 0px'});
for (const id of ['home','about','residences','features','interior']) navObserver.observe(document.getElementById(id)!);

// ScrollTrigger clears its recorded scroll when the last trigger is removed.
// Preserve a reading anchor around its matchMedia transaction, including responsive scene layout.
// These runtime hooks are used by ScrollTrigger but omitted from GSAP's bundled types.
const motionLifecycle = gsap as typeof gsap & {
  addEventListener(type: 'matchMediaInit' | 'matchMedia', listener: () => void): void;
};
type MotionPosition = { anchor: HTMLElement | null; top: number; y: number; width: number; height: number };
function readMotionPosition(): MotionPosition {
  const readingLine = window.innerHeight * .35;
  const sections = [...document.querySelectorAll<HTMLElement>('main>section')];
  const anchor = sections.findLast(element => {
    const rect = element.getBoundingClientRect();
    return rect.top <= readingLine && rect.bottom > readingLine;
  }) || null;
  return { anchor, top: anchor?.getBoundingClientRect().top || 0, y: window.scrollY, width: innerWidth, height: innerHeight };
}
let stableMotionPosition = readMotionPosition();
let motionPosition: MotionPosition | null = null;
let positionFrame = 0;
window.addEventListener('scroll', () => {
  if (positionFrame || motionPosition) return;
  positionFrame = requestAnimationFrame(() => {
    positionFrame = 0;
    // Resize can clamp scroll before its media-query event. Keep the old anchor.
    if (!motionPosition && stableMotionPosition.width === innerWidth && stableMotionPosition.height === innerHeight) {
      stableMotionPosition = readMotionPosition();
    }
  });
}, { passive: true });
window.addEventListener('resize', () => {
  cancelAnimationFrame(positionFrame);
  positionFrame = requestAnimationFrame(() => {
    positionFrame = 0;
    if (!motionPosition) stableMotionPosition = readMotionPosition();
  });
}, { passive: true });
motionLifecycle.addEventListener('matchMediaInit', () => {
  cancelAnimationFrame(positionFrame); positionFrame = 0;
  motionPosition = stableMotionPosition.width !== innerWidth || stableMotionPosition.height !== innerHeight
    ? stableMotionPosition : readMotionPosition();
});
gsap.registerPlugin(ScrollTrigger);
// This listener follows ScrollTrigger's refresh. No delayed correction or smooth scroll.
motionLifecycle.addEventListener('matchMedia', () => {
  if (!motionPosition) return;
  const { anchor, top, y, width, height } = motionPosition;
  const resized = width !== innerWidth || height !== innerHeight;
  let next = y;
  if (y < 1) next = 0;
  else if (anchor?.isConnected) {
    const rect = anchor.getBoundingClientRect();
    const readingTop = resized ? Math.max(top, Math.min(0, innerHeight * .35 - rect.height)) : top;
    next = window.scrollY + rect.top - readingTop;
  }
  window.scrollTo({ top: Math.max(0, next), behavior: 'instant' });
  ScrollTrigger.update();
  motionPosition = null;
  stableMotionPosition = readMotionPosition();
});
ScrollTrigger.config({ignoreMobileResize:true});
const motion = gsap.matchMedia();
const revealed = new WeakSet<Element>();
const customReveals = '.editorial-title,.location-collage>img,.nature__architecture,.arrival__main,.feature-card';
motion.add('(prefers-reduced-motion:no-preference)', () => {
  function reveal(element:HTMLElement, children:HTMLElement[], from:gsap.TweenVars, duration=.85, stagger=0) {
    if (revealed.has(element)) return;
    gsap.fromTo(children, from, {
      autoAlpha:1, y:0, yPercent:0, clipPath:'inset(0% 0% 0% 0%)',
      duration, stagger, ease:'power3.out',
      scrollTrigger:{trigger:element,start:'top 92%',once:true,onEnter:()=>revealed.add(element)},
      // Leaving no layer hints on a long document limits compositor memory.
      clearProps:'transform,opacity,visibility,clipPath'
    });
  }
  $$<HTMLElement>('[data-reveal]').filter(element=>!element.matches(customReveals)).forEach(element=>reveal(element,[element],{autoAlpha:0,y:26}));
  $$<HTMLElement>('.editorial-title').forEach(heading=>reveal(heading,$$<HTMLElement>(':scope>span,:scope>strong',heading),{autoAlpha:0,yPercent:38},.9,.13));
  $$<HTMLElement>('.location-collage>img,.nature__architecture,.arrival__main,.arrival__detail').forEach(photo=>reveal(photo,[photo],{autoAlpha:0,y:24,clipPath:'inset(0% 0% 100% 0%)'},1.15));
  $$<HTMLElement>('.feature-card').forEach(card=>reveal(card,[card],{autoAlpha:0,y:30},.8));
  $$<HTMLElement>('.lifestyle__copy,.nature__copy,.alike__copy,.arrival__copy,.category-row').forEach(element=>reveal(element,[element],{autoAlpha:0,y:22},.8));
  // A short opening entrance uses children; scroll motion owns the parent only.
  if (!revealed.has($('.hero__title-wrap'))) {
    revealed.add($('.hero__title-wrap'));
    gsap.fromTo('.hero__title-wrap>h1,.hero__title-wrap>.watch',{autoAlpha:0,y:18},{autoAlpha:1,y:0,duration:.95,stagger:.15,ease:'power2.out',clearProps:'transform,opacity,visibility'});
  }
});
motion.add('(min-width:1101px) and (min-height:650px) and (pointer:fine) and (prefers-reduced-motion:no-preference)', () => {
  // Architecture, water and its interactive points move as one registered layer.
  // The natural page scroll supplies the building rise shown in the original case.
  gsap.fromTo('.hero__architecture,.hero__water,.hero>.hotspot',
    {y:()=>Math.min(innerHeight*.1,100)},
    {y:-100,ease:'none',onUpdate:()=>scheduleHeroDetail(),scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:.55,invalidateOnRefresh:true}});
  // Re-entering desktop motion must resync the tween with the refreshed scroll.
  gsap.fromTo('.hero__title-wrap',{y:0,autoAlpha:1},{y:-70,autoAlpha:0,ease:'none',lazy:false,scrollTrigger:{trigger:'.hero',start:'top -8%',end:'top -70%',scrub:.35,invalidateOnRefresh:true}});
  $$('.hotspot').forEach(point=>gsap.fromTo(point,{autoAlpha:0},{autoAlpha:1,duration:.45,ease:'power2.out',scrollTrigger:{trigger:point,start:'top 84%',once:true}}));
  gsap.fromTo('.lifestyle__back>img',{scale:1.07,yPercent:3},{scale:1.07,yPercent:-3,ease:'none',scrollTrigger:{trigger:'.lifestyle',start:'top bottom',end:'bottom top',scrub:.65}});
  gsap.fromTo('.nature__leaf',{rotation:-1.2,yPercent:0},{rotation:1.2,yPercent:-2,ease:'none',scrollTrigger:{trigger:'.nature',start:'top bottom',end:'bottom top',scrub:.8}});
  gsap.fromTo('.alike__back>img',{scale:1.07,yPercent:3},{scale:1.07,yPercent:-3,ease:'none',scrollTrigger:{trigger:'.alike',start:'top bottom',end:'bottom top',scrub:.65}});
  $$('.category-art>div').forEach((element,index)=>gsap.fromTo(element,{y:22+index*7},{y:-22-index*7,ease:'none',scrollTrigger:{trigger:'.categories',start:'top bottom',end:'bottom top',scrub:.7}}));
  gsap.fromTo('.presentation__image',{clipPath:'inset(7% 5% 7% 5%)'},{clipPath:'inset(0% 0% 0% 0%)',ease:'none',scrollTrigger:{trigger:'.presentation',start:'top 90%',end:'top 18%',scrub:.5}});
});
let refreshFrame=0;
function scheduleRefresh(){cancelAnimationFrame(refreshFrame);refreshFrame=requestAnimationFrame(()=>{if(ScrollTrigger.getAll().length)ScrollTrigger.refresh();});}
window.addEventListener('load',scheduleRefresh,{once:true});
window.addEventListener('pageshow',scheduleRefresh);
document.fonts.ready.then(scheduleRefresh);
const params = new URLSearchParams(location.search);
if (params.get('residence') === '401') showResidence();
else if (params.has('collection')) selectCategory(params.get('collection')!);
else if (params.has('feature')) showFeature(params.get('feature')!);
