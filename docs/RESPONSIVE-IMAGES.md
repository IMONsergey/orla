# Responsive source images

## Build workflow

Run these commands in this project's root after the original `public/assets` files
are present:

```sh
python3 scripts/generate-responsive-images.py
python3 scripts/generate-responsive-images.py --check
npm run build
```

The generator requires Python 3.10+ and Pillow with WebP support. It does not
download anything or require Node image-processing packages. To run it from a
different directory, pass `--project-root /absolute/path/to/project`.

Ship the generated `public/assets/responsive/*.webp` files together with
`src/data/responsive-images.json`. The empty bootstrap manifest keeps the
original images working before generation; `--check` rejects an incomplete or
stale manifest. A production build without generation will not gain srcset
variants.

## What changes

- `ResponsiveImage.astro` renders exactly one native `img`. There is no wrapper,
  browser JavaScript, resize observer, or new image runtime.
- `src`, existing width/height attributes, alt text, data attributes,
  loading/fetchpriority, Figma offsets and CSS remain in place. Native
  `decoding="async"` is the default. Missing dimensions use the source dimensions.
- Width descriptors let the browser choose a derivative using viewport size,
  DPR and the supplied `sizes`. The untouched original is always the largest
  candidate. No variant is upscaled.
- `scripts/responsive-image-sources.json` is an explicit allowlist. Other assets
  are untouched. Default photo candidates are 640, 960, 1440 and 1920 pixels wide.
  A candidate must be at least 10% narrower than its source and smaller in bytes,
  so a 1024-pixel source does not also create a near-duplicate 960-pixel file.
- Photography uses WebP quality 86. Alpha, ICC profile, complete canvas and aspect
  ratio are retained; nothing is cropped or composited. Raster artwork uses
  lossless WebP. Logos and very small thumbnail slots have a narrower explicit
  width list. SVGs and floor-plan originals are retained.
- The generator processes one source at a time. Identical source bytes and
  encoding settings share the same derivative URL, including repeated assets
  with different original filenames. Filenames include a digest of the source
  and encoder settings. The manifest has sorted keys and no timestamps.
- The generator never overwrites source assets and does not delete existing
  derivatives. Rerunning it reuses matching derivatives. Changing the source,
  settings or Pillow/WebP encoder version creates a new digest.

## Interaction boundaries

Images switched by JavaScript keep their original raw `img` without srcset:
`data-zoom-image`, `data-feature-image`, `data-gallery-image`,
`data-gallery-preview`, `data-media-image` and `data-interior-preview`.
The component also guards these attributes if a future callsite passes one.
This prevents a src update from leaving a stale srcset image on screen.

A gallery containing several permanent image elements can use responsive
images: its controller changes the active element, not that element's source.
Zoom/lightbox configuration still points to original assets.

## Validation

A small isolated Pillow fixture verified derivative generation, transparent
alpha, no upscaling, byte-for-byte original preservation, duplicate-source reuse,
a deterministic second generation, and `--check`. The source allowlist was
checked against the original image inventory.

Full source encoding, production compilation and visual/network checks must run
where the original public assets are available. Check `currentSrc` on a mobile
viewport and DPR 2, along with desktop and the original-image zoom. A crop can
legitimately require a larger file than the visible viewport. No measured
page-byte or timing improvement is claimed before that check.

## ORLA source slots

The allowlist contains 40 unique source paths. `src/data/image-sizes.ts` follows
the 1100px / 600px CSS breakpoints. Examples:

| Image | Complete canvas used by sizes |
| --- | --- |
| Architecture and water | 850px on phones, 950px on tablets, original desktop width |
| Location aerial | Width required by the tall cover crop, not the narrow visible rectangle |
| Nature palm | 204.69% of its nested crop slot |
| Presentation | 148.39vw desktop; the mobile cover height and 200vw canvas are both considered |
| Interior slides | Full permanent slide image; zoom continues to use the original |
| Header/footer marks | Small lossless derivatives with the original transparent canvas |

Plans, modal feature image, zoom image, SVG controls and the low-resolution map
remain original. The forms' fields, validation and submission behavior are
unchanged. Only the static enquiry photograph uses the component.
