import generatedManifest from './responsive-images.json';

type Variant = { src: string; width: number; height: number; bytes: number };
type ImageEntry = { width: number; height: number; variants: Variant[] };
const manifest = generatedManifest as Record<string, ImageEntry>;

/**
 * Native width descriptors. The original remains the final candidate so high-DPR
 * screens and large Figma crop canvases never need an upscaled derivative.
 * Only use this for images whose src is not switched by client-side code.
 */
export function responsiveImage(src: string) {
  const entry = manifest[src];
  if (!entry) return { src };
  const variants = entry.variants.filter(variant => variant.width < entry.width);
  return {
    src,
    width: entry.width,
    height: entry.height,
    srcset: variants.length
      ? [...variants.map(variant => `${variant.src} ${variant.width}w`), `${src} ${entry.width}w`].join(', ')
      : undefined,
  };
}
