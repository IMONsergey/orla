# ORLA, Dorchester Collection

Faithful, responsive implementation of the supplied ORLA Figma design. Built with Astro 7, TypeScript and GSAP. Static HTML is prerendered; `/api/enquiry` is a real Vercel server endpoint backed by private Vercel Blob storage.

## Run

Requires Node 24.x.

```sh
npm ci
ASTRO_TELEMETRY_DISABLED=1 npm run dev
ASTRO_TELEMETRY_DISABLED=1 npm run build
npx tsc --noEmit
node --test tests/enquiry.test.mjs
```

Copy `.env.example` to a local environment file for API development. The production Vercel project must have its private Blob token configured. Without working storage, the form reports an error and retains the visitor's values. It never simulates a successful submission.

## Design and content

- Figma source: https://www.figma.com/design/m3N3lJCoutaziEm4nt4CwO?node-id=1-2
- All narrative scenes are built from semantic text, original separate photographs and vector assets, with the original desktop composition and a readable mobile reflow.
- Original Catalina Village, Graphik LCG and SF UI Display fonts are hosted locally. Inter is used for the supplied navigation.
- Source image assets were downloaded from the Figma design, then converted to local WebP derivatives. Logos and floor plans use lossless conversion; photo dimensions are capped at 2880px without changing their crops. `source-manifest.json` records each source node, checksum and derivative dimensions.
- Asset exports are individual design images, never page screenshots. No temporary Figma URLs remain in runtime code.
- The main scene sequence includes the sky/building/water hero, coastal area, location collage, lifestyle, nature, presentation, arrival, feature collage, four-photo interior gallery, residences, Palm Jumeirah location and partner/footer composition.

## Interactions

- Desktop navigation and accessible mobile menu; header adapts on scroll.
- GSAP scroll reveals and parallax, with reduced-motion alternatives and normal native scrolling.
- Hero architecture hotspot, ORLA brand story, feature details, location view and map link.
- Eight original residence categories; neutral Residence 401 plan and orientation; other source residence numbers open contextual enquiries.
- Floor-plan and gallery viewer with button, keyboard, pointer and pinch zoom/pan. Four original interior photos support arrows and swiping.
- Native dialogs support Escape, focus restoration and nested enquiry/privacy states.
- Enquiry validates inputs and consent, posts to `/api/enquiry`, handles field/network/storage errors, preserves an idempotency ID across retries, and shows success only after server confirmation.

## Content limits preserved deliberately

The source contains inconsistent type/area labels for Residence 401. Those conflicting commercial details are not presented as confirmed data: the original plan is shown under the neutral label **Residence 401**, with an enquiry for current specifications. Category quantities/areas and the source's 85 residences, 3 sky palaces and 1 mansion are preserved. This is not a live inventory feed.

No video or downloadable presentation file was supplied. The presentation control opens an honest availability message and a contextual request form. It does not play unrelated media or produce a fake download.

Enquiries are saved privately for the website owner. The form does not claim direct transmission to the property developer or a third-party agent. The privacy notice reflects that actual flow.

## Verification

- Production Vercel adapter build and TypeScript check passed.
- Five backend validation/storage/idempotency tests passed.
- Real Chromium checked widths 1440, 1024, 768, 390 and 320px, local asset loading and horizontal overflow.
- Browser checks cover category → Residence 401 → plan zoom → return, gallery controls, feature details, mobile menu, form validation, failure/retry and confirmed success. API responses in browser UI tests were mocked; no real lead was sent.
- Original fonts load successfully; there were no browser JavaScript errors in the checked scenarios.
- Visual QA screenshots and the local browser report are in the ignored `artifacts/qa` directory.
