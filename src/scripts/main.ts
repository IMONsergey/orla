import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initializeMediaInteractions } from './media-interactions';
import { createDialogHistory } from './dialog-history';

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
let dialogHistory: ReturnType<typeof createDialogHistory<DialogState>> | undefined;
type DialogState = { id: string; category?: string; view?: 'collection' | 'residence'; feature?: string; context?: string; zoom?: { src: string; alt: string; title: string; plan: boolean } };
function syncDialogLock() {
  const open = Boolean(document.querySelector('dialog[open]'));
  document.documentElement.classList.toggle('modal-open', open);
  document.body.classList.toggle('modal-open', open);
}

function openDialog(id: string, trigger?: HTMLElement) {
  const dialog = document.getElementById(id) as HTMLDialogElement | null;
  if (!dialog || dialogHistory?.pending) return;
  if (dialog.open) { dialogHistory?.record(false); return; }
  // Safari does not always focus a button when it is clicked.
  const origin = trigger || dialogClickOrigin || document.activeElement;
  if (origin instanceof HTMLElement) previousFocus.set(dialog, origin);
  dialog.showModal();
  dialogStack.push(dialog);
  syncDialogLock();
  if (id === 'menu-dialog') $('.menu-toggle').setAttribute('aria-expanded', 'true');
  if (id !== 'media-dialog') document.querySelector<HTMLVideoElement>('#orla-film')?.pause();
  dialogHistory?.record(true);
}
function finishDialogClose(dialog: HTMLDialogElement) {
  if (dialog.open) return; // A queued close event may follow a fast Forward reopen.
  const index = dialogStack.indexOf(dialog);
  if (index === -1) return;
  dialogStack.splice(index, 1);
  syncDialogLock();
  if (dialog.id === 'menu-dialog') $('.menu-toggle').setAttribute('aria-expanded', 'false');
  const target = previousFocus.get(dialog);
  const remaining = dialogStack.filter(item => item.open).at(-1);
  if (target?.isConnected && target.getClientRects().length && !target.closest('dialog:not([open]),[inert],[hidden]') && (!remaining || target.closest('dialog') === remaining)) target.focus({ preventScroll: true });
  else if (remaining) focusDialogHeading(remaining);
}
function dismissDialog(dialog: HTMLDialogElement) { dialog.close(); finishDialogClose(dialog); }
function closeDialog(dialog: HTMLDialogElement) {
  if (dialog !== dialogStack.at(-1)) return;
  if (dialogHistory) dialogHistory.close(); else dismissDialog(dialog);
}
function focusDialogHeading(dialog: HTMLElement) {
  const heading = [...dialog.querySelectorAll<HTMLElement>('h2,h3')].find(node => node.getClientRects().length && !node.closest('[hidden]'));
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}
$$<HTMLDialogElement>('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => finishDialogClose(dialog));
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
  dialog.addEventListener('click', event => {
    if (!dialog.classList.contains('small-sheet') || event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog(dialog);
  });
});

let selectedCategory: Category | undefined;
function showCollection() {
  $('[data-collection-panel]').hidden = false;
  $('[data-residence-panel]').hidden = true;
  $('[data-collection-title]').textContent = selectedCategory?.title || 'No two are quite alike';
  $('[data-collection-detail]').textContent = selectedCategory
    ? `${selectedCategory.count} ${selectedCategory.id === 'sky-palaces' ? 'sky palaces' : selectedCategory.id === 'mansion' ? 'mansion' : 'residences'} · ${selectedCategory.area}${selectedCategory.subtitle ? ' · ' + selectedCategory.subtitle : ''}`
    : 'Explore a residence at ORLA.';
  // The supplied 401 plan has no verified category mapping. Never advertise it
  // as the plan for a Mansion, Sky Palace, or another selected collection.
  $('[data-collection-panel] [data-show-residence]').hidden = Boolean(selectedCategory);
  $$('[data-select-category]').forEach(button => {
    const selected = button.dataset.selectCategory === selectedCategory?.id;
    button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
  });
  dialogHistory?.record(false);
  const dialog = $<HTMLDialogElement>('#residence-dialog');
  if (dialog.open) focusDialogHeading($('[data-collection-panel]'));
}
function selectCategory(id: string, trigger?: HTMLElement) {
  selectedCategory = config.categories.find(item => item.id === id);
  if (!selectedCategory) return;
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
  focusDialogHeading($('[data-residence-panel]'));
}

let selectedFeature = 'sky-palaces';
let featureImageRequest=0;
$<HTMLDialogElement>('#feature-dialog').addEventListener('close', () => {
  if (!$<HTMLDialogElement>('#feature-dialog').open) {
    featureImageRequest++;
    $('[data-feature-image]').removeAttribute('aria-busy');
  }
});
function showFeature(id: string, trigger?: HTMLElement) {
  const feature = config.features.find(item => item.id === id);
  if (!feature) return;
  selectedFeature = id;
  $('#feature-title').textContent = feature.title;
  const image = $<HTMLImageElement>('[data-feature-image]');
  const request=++featureImageRequest,source=feature.detailImage||feature.image;
  image.setAttribute('aria-busy','true');
  image.hidden = true;
  const feedback = $('[data-feature-feedback]'), status = $('[data-feature-image-status]'), retry = $('[data-feature-retry]');
  feedback.hidden = false; status.textContent = 'Loading photograph…'; retry.hidden = true;
  const prepared=new Image();prepared.decoding='async';prepared.src=source;
  void prepared.decode().catch(()=>undefined).then(()=>{
    if(request!==featureImageRequest)return;
    image.removeAttribute('aria-busy');
    if(!prepared.naturalWidth){
      status.textContent = 'The photograph could not be loaded. Please try again.'; retry.hidden = false;
      return;
    }
    // The photograph must belong to the same feature as the current heading.
    image.src=source;image.alt=feature.title;image.hidden=false;feedback.hidden=true;
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
  if (dialogHistory?.restoring) return;
  $('#feature-dialog').scrollTo({ top: 0, behavior: 'instant' });
}

const {stepGallery,openGallery,openZoom,changeZoom,resetZoom,getZoomState} = initializeMediaInteractions({...config,openDialog},reducedMotion);

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
  if (submitting) {
    openDialog('enquiry-dialog');
    $('#enquiry-dialog').scrollTo({ top: 0, behavior: 'instant' });
    return;
  }
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
  $('#enquiry-dialog').scrollTo({ top: 0, behavior: 'instant' });
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
  const controls = $$<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input,select,textarea,button', form).map(element => ({ element, disabled: element.disabled }));
  controls.forEach(({ element }) => element.disabled = true);
  $('[data-submit-label]').textContent = 'Sending...';
  $('[data-form-status]', form).textContent = 'Sending your enquiry…';
  const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 20000);
  let failureTarget: HTMLElement | null = null;
  try {
    const response = await fetch('/api/enquiry', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true || result?.id !== payload.submissionId) {
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
    failureTarget = form.querySelector<HTMLElement>('[aria-invalid=true]') || $<HTMLElement>('[data-form-status]', form);
  } finally {
    clearTimeout(timeout); submitting = false; form.removeAttribute('aria-busy'); controls.forEach(({ element, disabled }) => element.disabled = disabled);
    if (failureTarget && dialogStack.at(-1)?.id === 'enquiry-dialog') {
      if (!failureTarget.matches('input,select,textarea,button')) failureTarget.tabIndex = -1;
      failureTarget.focus({ preventScroll: true });
      (failureTarget.closest('.field') || failureTarget).scrollIntoView({ block: 'center', behavior: 'instant' });
    }
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

// Watch starts the genuine preview in the initiating click. The player remains
// usable when a browser blocks playback, and a failed fetch has an explicit retry.
const presentationVideo = $<HTMLVideoElement>('#orla-film');
const presentationDialog = $<HTMLDialogElement>('#media-dialog');
const videoStatus = $('[data-film-status]');
const videoRetry = $<HTMLButtonElement>('[data-film-retry]');
function preparePresentation() {
  if (!presentationVideo.getAttribute('src') || presentationVideo.error) {
    presentationVideo.poster = presentationVideo.dataset.poster!;
    presentationVideo.src = presentationVideo.dataset.src!;
    presentationVideo.load();
  }
}
function playPresentation() {
  preparePresentation();
  videoStatus.textContent = '';
  videoRetry.hidden = true;
  if (presentationVideo.ended) presentationVideo.currentTime = 0;
  void presentationVideo.play().catch(error => {
    if (!presentationDialog.open || error?.name === 'AbortError') return;
    videoStatus.textContent = presentationVideo.error ? 'The film could not be loaded. Please try again.' : 'Press Play in the video player to start the preview.';
    videoRetry.hidden = !presentationVideo.error;
  });
}
function openPresentation(trigger: HTMLElement) { openDialog('media-dialog', trigger); playPresentation(); }
presentationVideo.addEventListener('error', () => {
  videoStatus.textContent = 'The film could not be loaded. Please try again.';
  videoRetry.hidden = false;
});
presentationVideo.addEventListener('playing', () => {
  // A queued playback request must not start behind a nested enquiry.
  if (dialogStack.at(-1) !== presentationDialog || document.hidden) { presentationVideo.pause(); return; }
  videoStatus.textContent = ''; videoRetry.hidden = true;
});
presentationDialog.addEventListener('close', () => { if (!presentationDialog.open) presentationVideo.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) presentationVideo.pause(); });

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a'); if (!target) return;
  if (dialogHistory?.pending) {
    // Queue the whole intent before it mutates feature, form, or zoom state.
    event.preventDefault();
    dialogHistory.defer(() => { if (target.isConnected && target.getClientRects().length && !target.closest('dialog:not([open]),[inert],[hidden]')) target.click(); });
    return;
  }
  dialogClickOrigin = target;
  queueMicrotask(() => { if (dialogClickOrigin === target) dialogClickOrigin = undefined; });
  if (target.hasAttribute('data-close')) { const dialog = target.closest<HTMLDialogElement>('dialog'); if (dialog) closeDialog(dialog); }
  else if (target.hasAttribute('data-enquire')) openEnquiry(target.dataset.enquire || 'ORLA, Dorchester Collection');
  else if (target.hasAttribute('data-privacy')) openDialog('privacy-dialog', target);
  else if (target.hasAttribute('data-film-retry')) playPresentation();
  else if(target.dataset.modal==='media-dialog')openPresentation(target);
  else if (target.dataset.modal) { if (target.dataset.modal === 'residence-dialog') { selectedCategory = undefined; showCollection(); } openDialog(target.dataset.modal, target); }
  else if (target.dataset.category) selectCategory(target.dataset.category, target);
  else if (target.dataset.selectCategory) selectCategory(target.dataset.selectCategory, target);
  else if (target.hasAttribute('data-show-residence')) showResidence(target);
  else if (target.hasAttribute('data-show-collection')) showCollection();
  else if (target.hasAttribute('data-category-enquire')) openEnquiry(selectedCategory ? `${selectedCategory.title}${selectedCategory.subtitle ? ' / '+selectedCategory.subtitle : ''}` : 'ORLA residence collection');
  else if (target.hasAttribute('data-feature-retry')) showFeature(selectedFeature, target);
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
  if (target instanceof HTMLAnchorElement && target.hash && target.origin === location.origin && target.pathname === location.pathname && document.getElementById(target.hash.slice(1))) {
    event.preventDefault();
    const url = new URL(location.href);
    for (const key of ['collection', 'residence', 'feature']) url.searchParams.delete(key);
    url.hash = target.hash;
    dialogHistory!.navigate(url, () => navigateToHash(false));
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

function captureDialogs(): DialogState[] {
  return dialogStack.filter(dialog => dialog.open).map(dialog => {
    const state: DialogState = { id: dialog.id };
    if (dialog.id === 'residence-dialog') { state.category = selectedCategory?.id; state.view = $('[data-residence-panel]').hidden ? 'collection' : 'residence'; }
    if (dialog.id === 'feature-dialog') state.feature = selectedFeature;
    if (dialog.id === 'enquiry-dialog') state.context = enquiryContext;
    if (dialog.id === 'zoom-dialog') state.zoom = getZoomState();
    return state;
  });
}
function dialogsFromURL(): DialogState[] {
  const params = new URLSearchParams(location.search);
  if (params.get('residence') === '401') return [{ id: 'residence-dialog', view: 'residence' }];
  const category = params.get('collection');
  if (config.categories.some(item => item.id === category)) return [{ id: 'residence-dialog', view: 'collection', category: category! }];
  const feature = params.get('feature');
  if (config.features.some(item => item.id === feature)) return [{ id: 'feature-dialog', feature: feature! }];
  return [];
}
function restoreDialogs(states: DialogState[]) {
  const allowed = new Set($$<HTMLDialogElement>('dialog').map(dialog => dialog.id));
  const next = states.filter(state => allowed.has(state.id));
  const previous = captureDialogs();
  let common = 0;
  while (common < dialogStack.length && common < next.length && dialogStack[common].id === next[common].id) common++;
  for (const dialog of dialogStack.slice(common).reverse()) dismissDialog(dialog);
  for (const [index, state] of next.entries()) {
    // Closing a child must preserve the parent's scroll and return focus to its trigger.
    if (index < common && JSON.stringify(previous[index]) === JSON.stringify(state)) continue;
    const dialog = $<HTMLDialogElement>('#' + state.id);
    if (state.id === 'residence-dialog') {
      selectedCategory = config.categories.find(item => item.id === state.category);
      $$('[data-select-category]').forEach(button => {
        const selected = button.dataset.selectCategory === state.category;
        button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
      });
      if (state.view === 'residence') showResidence(); else { showCollection(); openDialog(state.id); }
    } else if (state.id === 'feature-dialog') showFeature(state.feature || 'sky-palaces');
    else if (state.id === 'zoom-dialog' && state.zoom) {
      // Recreate the exact photograph/plan if another viewer was opened since.
      const image = state.zoom;
      if (!dialog.open || JSON.stringify(getZoomState()) !== JSON.stringify(image)) void openZoom(image.src, image.alt, image.title, image.plan);
    } else {
      if (state.id === 'enquiry-dialog' && state.context && !submitting) {
        enquiryContext = state.context;
        $<HTMLInputElement>('input[name=context]', form).value = state.context;
        $('[data-interest]').textContent = state.context;
        $('[data-interest-summary]').textContent = state.context;
      }
      openDialog(state.id);
      if (state.id === 'media-dialog') preparePresentation();
    }
  }
  syncDialogLock();
}
function navigateToHash(instant = true) {
  const id = location.hash.slice(1) || 'home', target = document.getElementById(id);
  if (!target) return;
  const behavior = instant || reducedMotion.matches ? 'instant' : 'smooth';
  if (id === 'home') window.scrollTo({ top: 0, behavior });
  else target.scrollIntoView({ block: 'start', behavior });
  if (id === 'main-content') target.focus({ preventScroll: true });
}
dialogHistory = createDialogHistory<DialogState>({
  key: 'orlaDialogsV1', capture: captureDialogs, restore: restoreDialogs, fromURL: dialogsFromURL,
  url: states => {
    const url = new URL(location.href);
    for (const key of ['collection', 'residence', 'feature']) url.searchParams.delete(key);
    for (const state of states) {
      if (state.id === 'residence-dialog') {
        if (state.view === 'residence') url.searchParams.set('residence', '401');
        else if (state.category) url.searchParams.set('collection', state.category);
      }
      if (state.id === 'feature-dialog' && state.feature) url.searchParams.set('feature', state.feature);
    }
    return url;
  }, navigate: () => navigateToHash(),
});
dialogHistory.initialize();
