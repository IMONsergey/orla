import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Category = { id: string; count: string; title: string; subtitle?: string; area: string };
type Feature = { id: string; title: string; image: string; detailImage?: string; caption: string };
type GalleryImage = { image: string; alt: string };
type Config = { categories: Category[]; features: Feature[]; gallery: GalleryImage[]; skyPalacesCopy: string; interiorCopy: string; arrivalCopy: string; layoutCopy: string };
const config: Config = JSON.parse(document.querySelector('#orla-data')?.textContent || '{}');
const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector)!;
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [...root.querySelectorAll<T>(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const previousFocus = new WeakMap<HTMLDialogElement, HTMLElement>();

function openDialog(id: string) {
  const dialog = document.getElementById(id) as HTMLDialogElement | null;
  if (!dialog) return;
  if (dialog.open) return;
  previousFocus.set(dialog, document.activeElement as HTMLElement);
  dialog.showModal();
  document.body.classList.add('modal-open');
  if (id === 'menu-dialog') $('.menu-toggle').setAttribute('aria-expanded', 'true');
}
function closeDialog(dialog: HTMLDialogElement) { dialog.close(); }
$$<HTMLDialogElement>('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    if (dialog.id === 'menu-dialog') $('.menu-toggle').setAttribute('aria-expanded', 'false');
    const target = previousFocus.get(dialog);
    if (target?.isConnected && !target.closest('dialog:not([open])')) target.focus({ preventScroll: true });
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
function selectCategory(id: string) {
  selectedCategory = config.categories.find(item => item.id === id);
  $$('[data-select-category]').forEach(button => {
    const selected = button.dataset.selectCategory === id;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  showCollection();
  openDialog('residence-dialog');
  if (window.matchMedia('(max-width:1100px)').matches) {
    requestAnimationFrame(() => $('.residence-main').scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'instant' : 'smooth' }));
  }
}
function showResidence() {
  $('[data-collection-panel]').hidden = true;
  $('[data-residence-panel]').hidden = false;
  openDialog('residence-dialog');
  setQuery('residence', '401');
}

let selectedFeature = 'sky-palaces';
function showFeature(id: string) {
  const feature = config.features.find(item => item.id === id);
  if (!feature) return;
  selectedFeature = id;
  $('#feature-title').textContent = feature.title;
  const image = $<HTMLImageElement>('[data-feature-image]');
  image.src = feature.detailImage || feature.image; image.alt = feature.title;
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
  openDialog('feature-dialog');
  setQuery('feature', id);
  $('#feature-dialog').scrollTo({ top: 0, behavior: 'instant' });
}

let currentSlide = 0;
function showSlide(index: number) {
  currentSlide = (index + config.gallery.length) % config.gallery.length;
  $$('.interiors__slide').forEach((slide, i) => {
    slide.classList.toggle('is-active', i === currentSlide);
    slide.setAttribute('aria-hidden', String(i !== currentSlide));
  });
  $('[data-gallery-current]').textContent = String(currentSlide + 1);
}
let swipeStart: { x: number; y: number } | undefined;
$('#interior').addEventListener('pointerdown', event => {
  if ((event.target as HTMLElement).closest('button')) return;
  swipeStart = { x: event.clientX, y: event.clientY };
});
$('#interior').addEventListener('pointerup', event => {
  if (!swipeStart) return;
  const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showSlide(currentSlide + (dx < 0 ? 1 : -1));
  swipeStart = undefined;
});
$('#interior').addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault(); showSlide(currentSlide + (event.key === 'ArrowRight' ? 1 : -1));
  }
});

const zoomStage = $('.zoom-stage'), zoomCanvas = $('.zoom-canvas');
let zoom = 1, panX = 0, panY = 0, isPlan = false;
const pointers = new Map<number, { x: number; y: number }>();
let dragOrigin = { x: 0, y: 0, panX: 0, panY: 0 }, pinchOrigin = { distance: 0, zoom: 1 };
function updateZoom() {
  zoom = Math.max(1, Math.min(5, zoom));
  const limitX = zoomStage.clientWidth * (zoom - 1) / 2;
  const limitY = zoomStage.clientHeight * (zoom - 1) / 2;
  panX = Math.max(-limitX, Math.min(limitX, panX));
  panY = Math.max(-limitY, Math.min(limitY, panY));
  zoomCanvas.style.transform = `${isPlan ? 'translate(-50%,-50%) ' : ''}translate(${panX}px, ${panY}px) scale(${zoom})`;
  $('[data-zoom-reset]').textContent = zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`;
}
function resetZoom() { zoom = 1; panX = 0; panY = 0; updateZoom(); }
function openZoom(src: string, alt: string, title: string, plan: boolean) {
  const image = $<HTMLImageElement>('[data-zoom-image]'); image.src = src; image.alt = alt;
  $('#zoom-title').textContent = title;
  isPlan = plan; zoomCanvas.classList.toggle('is-plan', plan);
  openDialog('zoom-dialog'); resetZoom();
}
zoomStage.addEventListener('pointerdown', event => {
  zoomStage.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  dragOrigin = { x: event.clientX, y: event.clientY, panX, panY };
  if (pointers.size === 2) {
    const [a,b] = [...pointers.values()];
    pinchOrigin = { distance: Math.hypot(a.x-b.x,a.y-b.y), zoom };
  }
  zoomStage.classList.add('is-dragging');
});
zoomStage.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    const [a,b] = [...pointers.values()];
    zoom = pinchOrigin.zoom * Math.hypot(a.x-b.x,a.y-b.y) / Math.max(1,pinchOrigin.distance);
  } else { panX = dragOrigin.panX + event.clientX - dragOrigin.x; panY = dragOrigin.panY + event.clientY - dragOrigin.y; }
  updateZoom();
});
const endPointer = (event: PointerEvent) => { pointers.delete(event.pointerId); if (!pointers.size) zoomStage.classList.remove('is-dragging'); };
zoomStage.addEventListener('pointerup', endPointer); zoomStage.addEventListener('pointercancel', endPointer);
zoomStage.addEventListener('wheel', event => {
  event.preventDefault(); zoom += event.deltaY < 0 ? .15 : -.15; updateZoom();
}, { passive: false });
zoomStage.addEventListener('keydown', event => {
  if (['+', '=', '-', '0', 'ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) event.preventDefault();
  if (event.key === '+' || event.key === '=') zoom += .5;
  else if (event.key === '-') zoom -= .5;
  else if (event.key === '0') { resetZoom(); return; }
  else if (event.key === 'ArrowLeft') panX -= 40;
  else if (event.key === 'ArrowRight') panX += 40;
  else if (event.key === 'ArrowUp') panY -= 40;
  else if (event.key === 'ArrowDown') panY += 40;
  updateZoom();
});

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

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('button, a'); if (!target) return;
  if (target.hasAttribute('data-close')) { const dialog = target.closest<HTMLDialogElement>('dialog'); if (dialog) closeDialog(dialog); }
  else if (target.hasAttribute('data-enquire')) openEnquiry(target.dataset.enquire || 'ORLA, Dorchester Collection');
  else if (target.hasAttribute('data-privacy')) openDialog('privacy-dialog');
  else if (target.dataset.modal) { if (target.dataset.modal === 'residence-dialog') { selectedCategory = undefined; showCollection(); } openDialog(target.dataset.modal); }
  else if (target.dataset.category) selectCategory(target.dataset.category);
  else if (target.dataset.selectCategory) selectCategory(target.dataset.selectCategory);
  else if (target.hasAttribute('data-show-residence')) showResidence();
  else if (target.hasAttribute('data-show-collection')) showCollection();
  else if (target.hasAttribute('data-category-enquire')) openEnquiry(selectedCategory ? `${selectedCategory.title}${selectedCategory.subtitle ? ' / '+selectedCategory.subtitle : ''}` : 'ORLA residence collection');
  else if (target.dataset.feature) showFeature(target.dataset.feature);
  else if (target.hasAttribute('data-feature-enquire')) openEnquiry(config.features.find(f => f.id === selectedFeature)?.title || 'ORLA features');
  else if (target.hasAttribute('data-plan-zoom')) openZoom($<HTMLImageElement>('.plan-preview img').src, 'Residence 401 floor plan', 'Residence 401', true);
  else if (target.hasAttribute('data-gallery-prev')) showSlide(currentSlide - 1);
  else if (target.hasAttribute('data-gallery-next')) showSlide(currentSlide + 1);
  else if (target.hasAttribute('data-gallery-zoom')) { const item = config.gallery[currentSlide]; openZoom(item.image,item.alt,'ORLA Interiors',false); }
  else if (target.hasAttribute('data-zoom-in')) { zoom += .5; updateZoom(); }
  else if (target.hasAttribute('data-zoom-out')) { zoom -= .5; updateZoom(); }
  else if (target.hasAttribute('data-zoom-reset')) resetZoom();
  else if (target.hasAttribute('data-hotspot')) {
    const open = $('#hero-hotspot').hidden; $('#hero-hotspot').hidden = !open;
    $$('[data-hotspot]').forEach(button => button.setAttribute('aria-expanded', String(open)));
  } else if (target.hasAttribute('data-hotspot-close')) {
    $('#hero-hotspot').hidden = true; $$('[data-hotspot]').forEach(button => button.setAttribute('aria-expanded','false'));
  }
  if (target.matches('#menu-dialog a[href^="#"]')) {
    closeDialog($<HTMLDialogElement>('#menu-dialog'));
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#hero-hotspot').hidden && !document.querySelector('dialog[open]')) {
    $('#hero-hotspot').hidden = true; $$('[data-hotspot]').forEach(button => button.setAttribute('aria-expanded','false'));
  }
});

const header = $('.site-header');
function updateHeader() { header.classList.toggle('is-scrolled', window.scrollY > 70); }
window.addEventListener('scroll',updateHeader,{passive:true}); updateHeader();
const navObserver = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    $$('.desktop-nav a').forEach(link => {
      if ((link as HTMLAnchorElement).hash === '#'+entry.target.id) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
}, { rootMargin:'-10% 0px -65% 0px' });
for (const id of ['home','about','residences','features','interior']) navObserver.observe(document.getElementById(id)!);

gsap.registerPlugin(ScrollTrigger);
const motion = gsap.matchMedia();
motion.add('(prefers-reduced-motion: no-preference)', () => {
  $$('[data-reveal]').forEach(element => gsap.from(element,{ y:35,opacity:0,duration:1.05,ease:'power2.out',scrollTrigger:{trigger:element,start:'top 94%',once:true} }));
});
motion.add('(min-width:1101px) and (prefers-reduced-motion: no-preference)', () => {
  $$('[data-parallax]').forEach(element => gsap.to(element,{yPercent:Number(element.dataset.parallax),ease:'none',scrollTrigger:{trigger:element.closest('section'),start:'top bottom',end:'bottom top',scrub:1.1}}));
  gsap.to('.hero__title-wrap',{y:-90,opacity:.35,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'65% top',scrub:1}});
  gsap.fromTo('.nature__leaf',{rotation:-2},{rotation:2,ease:'none',scrollTrigger:{trigger:'.nature',start:'top bottom',end:'bottom top',scrub:1.4}});
  gsap.fromTo('.category-art',{y:25},{y:-35,ease:'none',scrollTrigger:{trigger:'.categories',start:'top bottom',end:'bottom top',scrub:1.2}});
});
window.addEventListener('load',() => ScrollTrigger.refresh(),{once:true});
document.fonts.ready.then(() => ScrollTrigger.refresh());
const params = new URLSearchParams(location.search);
if (params.get('residence') === '401') showResidence();
else if (params.has('collection')) selectCategory(params.get('collection')!);
else if (params.has('feature')) showFeature(params.get('feature')!);
