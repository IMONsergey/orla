import {gsap} from 'gsap';

type GalleryItem = {image: string; alt: string};
type MediaConfig = {gallery: GalleryItem[]; openDialog: (id: string, trigger?: HTMLElement) => void};
type Point = {x: number; y: number};

export function initializeMediaInteractions(config: MediaConfig, reduced: MediaQueryList) {
  const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector)!;
  const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [...root.querySelectorAll<T>(selector)];
  const events = new AbortController();
  const {signal} = events;
  const decoded = new Map<string, Promise<{src: string} | null>>();
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  function loadImage(src: string) {
    let pending = decoded.get(src);
    if (!pending) {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      pending = image.decode().catch(() => undefined).then(() => {
        if (image.naturalWidth) return {src: image.src};
        decoded.delete(src);
        return null;
      });
      decoded.set(src, pending);
    }
    return pending;
  }

  const gallery = $('#interior');
  const track = $('.interiors__slides', gallery);
  const slides = $$<HTMLElement>('.interiors__slide', gallery);
  const count = $('[data-gallery-current]', gallery);
  let requestedGallery = 0, displayedGallery = 0, galleryRequest = 0;
  let galleryTween:gsap.core.Tween|undefined;
  let swipe: {id: number; x: number; y: number} | null = null;
  let suppressClickUntil = 0;
  gallery.style.touchAction = 'pan-y';
  // Keep crossfade layers below the source's separate title/shade/control overlays.
  track.style.isolation = 'isolate';
  slides.forEach(slide => {
    // One animation owner; the old CSS transition must not interpolate GSAP writes.
    slide.style.transition = 'none';
    const image = $<HTMLImageElement>('img', slide);
    image.draggable = false;
    image.decoding = 'async';
  });
  function settleGallery(index: number) {
    // A target-array kill can miss a single-target fromTo before it initializes.
    // Finish and kill that exact tween so its start-state cannot render later.
    galleryTween?.progress(1,true).kill();galleryTween=undefined;
    gsap.killTweensOf(slides);
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
      slide.setAttribute('aria-hidden', String(i !== index));
      slide.inert = i !== index;
      slide.style.opacity = i === index ? '1' : '0';
      slide.style.removeProperty('z-index');
      gsap.set(slide,{xPercent:0,lazy:false});
    });
  }
  async function showGallery(index: number, direction=1) {
    if (!slides.length) return;
    requestedGallery = (index + slides.length) % slides.length;
    const next = requestedGallery;
    const id = ++galleryRequest;
    let image = $<HTMLImageElement>('img', slides[next]);
    gallery.setAttribute('aria-busy', 'true');
    image.loading = 'eager';
    if (image.complete && !image.naturalWidth) {
      // WebKit can retain a failed responsive request after an identical src
      // assignment. A fresh image retries while retaining every source attribute.
      const retry = image.cloneNode(false) as HTMLImageElement;
      image.replaceWith(retry);
      image = retry;
    }
    await image.decode().catch(() => undefined);
    if (id !== galleryRequest) return;
    gallery.removeAttribute('aria-busy');
    settleGallery(displayedGallery);
    // A failed photograph keeps the last decoded frame; another Next can pass it.
    if (!image.naturalWidth) return;
    if (next === displayedGallery) return;
    const outgoing = slides[displayedGallery], incoming = slides[next];
    displayedGallery = next;
    outgoing.classList.remove('is-active');
    outgoing.setAttribute('aria-hidden', 'true');
    outgoing.inert = true;
    incoming.classList.add('is-active');
    incoming.setAttribute('aria-hidden', 'false');
    incoming.inert = false;
    incoming.style.zIndex = '1';
    count.textContent = String(next + 1);
    if (reduced.matches) { settleGallery(next); return; }
    // The authored interior sequence uses a horizontal wipe over an opaque frame.
    galleryTween=gsap.fromTo(incoming, {opacity:1,xPercent:direction<0?-100:100}, {opacity:1,xPercent:0,duration:.65,ease:'power3.inOut',lazy:false,onComplete:()=>{
      if (id === galleryRequest) settleGallery(next);
    }});
  }
  function stepGallery(delta: number) { void showGallery(requestedGallery + delta,delta); }
  gallery.addEventListener('keydown', event => {
    if ((event.target as HTMLElement).closest('input,textarea,select')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      stepGallery(event.key === 'ArrowRight' ? 1 : -1);
    }
  }, {signal});
  gallery.addEventListener('pointerdown', event => {
    suppressClickUntil = 0;
    if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest('button,a')) return;
    const box = track.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return;
    swipe = {id: event.pointerId, x: event.clientX, y: event.clientY};
    gallery.setPointerCapture(event.pointerId);
  }, {signal});
  gallery.addEventListener('pointerup', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    swipe = null;
    if (gallery.hasPointerCapture(event.pointerId)) gallery.releasePointerCapture(event.pointerId);
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClickUntil = performance.now() + 500;
      stepGallery(dx < 0 ? 1 : -1);
      event.preventDefault();
    }
  }, {signal});
  gallery.addEventListener('pointercancel', () => { swipe = null; suppressClickUntil = 0; }, {signal});
  gallery.addEventListener('lostpointercapture', () => { swipe = null; }, {signal});
  gallery.addEventListener('click', event => {
    if (event.detail !== 0 && performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation(); suppressClickUntil = 0;
    }
  }, {capture: true, signal});
  settleGallery(0);

  const zoomDialog = $<HTMLDialogElement>('#zoom-dialog');
  const zoomStage = $('.zoom-stage');
  const zoomCanvas = $('.zoom-canvas');
  const zoomImage = $<HTMLImageElement>('[data-zoom-image]');
  const zoomReset = $('[data-zoom-reset]');
  const zoomIn = $<HTMLButtonElement>('[data-zoom-in]');
  const zoomOut = $<HTMLButtonElement>('[data-zoom-out]');
  const loading = document.createElement('p');
  loading.setAttribute('role', 'status');
  loading.hidden = true;
  loading.style.cssText = 'position:absolute;left:24px;right:24px;top:45%;text-align:center;color:var(--bronze);font-size:14px';
  zoomStage.append(loading);
  zoomCanvas.style.willChange = 'auto';
  zoomImage.draggable = false;
  let zoom = 1, panX = 0, panY = 0, zoomFrame = 0, zoomRequest = 0;
  let isPlan = false, fitScale = 1;
  let ready = false;
  const pointers = new Map<number, Point>();
  let drag: {point: Point; x: number; y: number} | null = null;
  let pinch: {distance: number; zoom: number; anchor: Point} | null = null;
  let bounds = {width: 0, height: 0, imageWidth: 0, imageHeight: 0, left: 0, top: 0};

  function updateZoom() {
    zoom = clamp(zoom, 1, 5);
    const x = Math.max(0, (bounds.imageWidth * zoom - bounds.width) / 2);
    const y = Math.max(0, (bounds.imageHeight * zoom - bounds.height) / 2);
    panX = clamp(panX, -x, x);
    panY = clamp(panY, -y, y);
    if (zoomFrame) return;
    zoomFrame = requestAnimationFrame(() => {
      zoomFrame = 0;
      zoomCanvas.style.transform = `${isPlan ? 'translate(-50%,-50%) ' : ''}translate(${panX}px,${panY}px) scale(${fitScale * zoom})`;
      zoomReset.textContent = zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`;
      zoomIn.disabled = !ready || zoom >= 5;
      zoomOut.disabled = !ready || zoom <= 1;
      zoomStage.classList.toggle('is-dragging', zoom > 1 && pointers.size > 0);
    });
  }
  function measureZoom() {
    const rect = zoomStage.getBoundingClientRect();
    const width = zoomStage.clientWidth, height = zoomStage.clientHeight;
    let imageWidth: number, imageHeight: number;
    if (isPlan) {
      // This is a crop of the supplied brochure page, not a standalone plan image.
      // Keep the source canvas and its percentage image offsets unchanged.
      const canvasWidth = zoomCanvas.clientWidth, canvasHeight = zoomCanvas.clientHeight;
      fitScale = Math.min(1, width / (canvasWidth || 1), height / (canvasHeight || 1));
      imageWidth = canvasWidth * fitScale;
      imageHeight = canvasHeight * fitScale;
    } else {
      fitScale = 1;
      imageWidth = zoomImage.clientWidth;
      imageHeight = zoomImage.clientHeight;
    }
    bounds = {width, height, imageWidth, imageHeight, left: rect.left, top: rect.top};
    updateZoom();
  }
  function clearPointers() {
    for (const id of pointers.keys()) if (zoomStage.hasPointerCapture(id)) zoomStage.releasePointerCapture(id);
    pointers.clear(); drag = null; pinch = null;
    zoomStage.classList.remove('is-dragging');
  }
  function resetZoom() { clearPointers(); zoom = 1; panX = 0; panY = 0; updateZoom(); }
  function zoomAt(value: number, point: Point = {x: 0, y: 0}) {
    if (!ready) return;
    const next = clamp(value, 1, 5);
    panX = point.x - (point.x - panX) * next / zoom;
    panY = point.y - (point.y - panY) * next / zoom;
    zoom = next;
    updateZoom();
  }
  function changeZoom(amount: number) { zoomAt(zoom + amount); }
  function local(point: Point): Point { return {x: point.x - bounds.left - bounds.width / 2, y: point.y - bounds.top - bounds.height / 2}; }
  function beginPinch() {
    const [a, b] = [...pointers.values()];
    const center = local({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
    pinch = {distance: Math.hypot(a.x - b.x, a.y - b.y), zoom, anchor: {x: (center.x - panX) / zoom, y: (center.y - panY) / zoom}};
    drag = null;
  }
  async function openZoom(src: string, alt: string, title: string, plan = false, trigger?: HTMLElement) {
    const id = ++zoomRequest;
    ready = false;
    zoomImage.hidden = true;
    loading.textContent = 'Loading image…';
    loading.hidden = false;
    zoomStage.setAttribute('aria-busy', 'true');
    $('#zoom-title').textContent = title;
    isPlan = plan;
    zoomCanvas.classList.toggle('is-plan', plan);
    config.openDialog('zoom-dialog', trigger);
    zoomCanvas.style.willChange = 'transform';
    resetZoom();
    measureZoom();
    const image = await loadImage(src);
    if (id !== zoomRequest || !zoomDialog.open) return;
    if (!image) {
      loading.textContent = 'The image could not be loaded. Close and try again.';
      zoomStage.removeAttribute('aria-busy');
      return;
    }
    zoomImage.src = image.src;
    zoomImage.alt = alt;
    await zoomImage.decode().catch(() => undefined);
    if (id !== zoomRequest || !zoomDialog.open) return;
    ready = true;
    zoomImage.hidden = false;
    loading.hidden = true;
    zoomStage.removeAttribute('aria-busy');
    measureZoom();
  }
  function openGallery(trigger?: HTMLElement) {
    const item = config.gallery[displayedGallery];
    if (item) void openZoom(item.image, item.alt, 'ORLA Interiors', false, trigger);
  }
  zoomStage.addEventListener('pointerdown', event => {
    if (!ready || event.button !== 0 || pointers.size >= 2) return;
    measureZoom();
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    zoomStage.setPointerCapture(event.pointerId);
    if (pointers.size === 2) beginPinch();
    else drag = {point: {x: event.clientX, y: event.clientY}, x: panX, y: panY};
    updateZoom();
  }, {signal});
  zoomStage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const center = local({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
      zoom = clamp(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.distance), 1, 5);
      panX = center.x - pinch.anchor.x * zoom;
      panY = center.y - pinch.anchor.y * zoom;
    } else if (drag) {
      panX = drag.x + event.clientX - drag.point.x;
      panY = drag.y + event.clientY - drag.point.y;
    }
    updateZoom();
  }, {signal});
  function endPointer(event: PointerEvent) {
    if (!pointers.delete(event.pointerId)) return;
    pinch = null;
    const remaining = [...pointers.values()][0];
    // Rebase at the remaining finger's current position after a pinch.
    drag = remaining ? {point: {...remaining}, x: panX, y: panY} : null;
    updateZoom();
  }
  zoomStage.addEventListener('pointerup', endPointer, {signal});
  zoomStage.addEventListener('pointercancel', endPointer, {signal});
  zoomStage.addEventListener('lostpointercapture', endPointer, {signal});
  zoomStage.addEventListener('wheel', event => {
    event.preventDefault();
    const point = local({x: event.clientX, y: event.clientY});
    zoomAt(zoom + (event.deltaY < 0 ? .15 : -.15), point);
  }, {passive: false, signal});
  zoomStage.addEventListener('keydown', event => {
    if (!['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === '+' || event.key === '=') changeZoom(.5);
    else if (event.key === '-') changeZoom(-.5);
    else if (event.key === '0') resetZoom();
    else {
      panX += event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0;
      panY += event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0;
      updateZoom();
    }
  }, {signal});
  const zoomResize = new ResizeObserver(() => { if (zoomDialog.open) { clearPointers(); measureZoom(); } });
  zoomResize.observe(zoomStage, {box: 'border-box'});
  zoomDialog.addEventListener('close', () => {
    zoomRequest++;
    clearPointers();
    zoomCanvas.style.willChange = 'auto';
  }, {signal});
  reduced.addEventListener('change', () => settleGallery(displayedGallery), {signal});
  return {
    stepGallery, openGallery, openZoom, changeZoom, resetZoom,
    destroy() {
      events.abort(); galleryRequest++; zoomRequest++;
      settleGallery(displayedGallery); clearPointers(); zoomResize.disconnect();
      cancelAnimationFrame(zoomFrame); loading.remove(); zoomCanvas.style.willChange = 'auto';
    },
  };
}
