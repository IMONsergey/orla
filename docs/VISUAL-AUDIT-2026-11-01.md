# ORLA visual and interaction audit, 2026-11-01

This is the second, fresh audit of ORLA, starting from published source `56634c9`. The earlier hotspot, gallery cancellation and title refresh repairs remain in place. Older green reports are historical evidence and are not substituted for the current checks. Fresh screenshots and reports are under `artifacts/pixel-audit-20261101-v2/`.

## Author reference and scope

The source composition is Figma main frame `1:2`, 1440 x 17051, and the original [ORLA Dprofile case](https://dprofile.ru/case/103839/orla-dorchester-collection-dubai). The integration owner re-opened the reference for this continuation. Colors, photographs, fonts, authored image crops and section order remain unchanged.

The fresh scope includes all thirteen main sections and footer, actual anchor navigation, both hotspots, the film preview, all eight feature details, residence collections and Residence 401, nested plan/image zoom, gallery states, location/story sheets, enquiry validation and mocked error/success, keyboard focus and scroll locks. No test submits a real enquiry.

## Confirmed findings and corrections

### Text arrows and vector controls

The baseline DOM contained thirteen text arrows. They are now decorative SVG paths in `Icon.astro`, with `currentColor`, an explicit `viewBox` and stroke, `aria-hidden` and no font dependency. Textual close, plus and minus control glyphs also use SVG. Existing author SVG Action and hotspot assets are preserved.

Control wrappers retain their authored circles, sizes and colors. Close, gallery and zoom controls center the vector geometrically. The full source scan decodes HTML entities and includes Astro, TypeScript, CSS and original SVG files; the runtime scan also checks CSS pseudo-elements and dynamically generated UI text.

### Reading continuity

The fresh mobile reproduction started in Interiors at `scrollY=6820`, gallery top `100.265625`. Enabling reduced motion reset the page to `scrollY=0`; restoring normal motion left it at the hero. A separate desktop-to-mobile resize left the old raw scroll offset in place and moved the reader into Closing, with Interiors more than 4000 px above the viewport.

ScrollTrigger's final-trigger teardown clears its recorded scroller position. A reading anchor is now cached before responsive reflow, captured before the matchMedia transaction, and restored after ScrollTrigger refresh. A resized, shorter section clamps the anchor's offset so that the same section remains readable. No hotspot click uses scroll compensation.

Reduced transitions use zero duration instead of creating `.01ms` transitions on previously static geometry. Reduced native scrolling uses `auto!important`, so a delayed GSAP inline `smooth` write cannot override the preference. Deferred refresh helpers skip empty trigger sets. Normal-motion reveals and parallax remain active, including the previously fixed exact gallery tween ownership and hero title refresh behavior.

The before evidence is `continuity-before/report.json` and ten screenshots. The final both-engine result preserves the Interiors section through both preference changes and desktop/mobile/desktop resizing. Desktop gallery top is retained within 1px after resizing; preference changes preserve the original scroll position exactly. The full observations are retained in the compact result linked below.

### Mobile feature detail grid

The fresh full interaction pass exposed an internal overflow which the document-width check could not see: at 390px, the feature dialog had a 1282px grid column and `scrollWidth=1282`. The sidebar's automatic minimum width expanded the single column to the combined horizontal navigation width. Its automatically sized row then collapsed the navigation buttons to zero height inside the fixed-height dialog. Text was clipped and real clicks could not reach the controls.

The mobile column now uses `minmax(0,1fr)`, the sidebar can shrink with `min-width:0`, and the rows use their content height. The horizontal navigation keeps its own intentional scrollport. Fonts, image crops and spacing remain authored. The interaction audit now checks every open dialog's `scrollWidth` against `clientWidth`, as well as the document width. Before/after geometry and settled captures are in `feature-mobile-before.json`, `feature-mobile-after.json` and the corresponding PNGs.

### Authored image proportions inside dialogs

Fresh inspection of the complete feature/collection captures exposed three selectors where HTML image dimensions overrode the intended CSS ratio. A mobile related photograph was 165 x 1620 despite `aspect-ratio:1.1`; the collection photograph was 342 x 645 despite `aspect-ratio:1.54`. Desktop showed the same fixed-height problem. The measurements are retained in `image-aspect-before.json`.

The related, collection and desktop enquiry photograph selectors now specify `height:auto`, allowing their existing CSS aspect ratios and `object-fit:cover` to size and crop the same source photographs. No asset, font or desired ratio changed. The fresh interaction captures assert the rendered ratio of every related, collection and enquiry image, in addition to modal bounds.

### Scrollable dialogs and close controls

Native wheel input reproduced a lost close control: the mobile enquiry close moved to top -215 at scrollTop 235, and the short-landscape privacy close moved to top -13.5. Full-screen sheets now keep their close fixed to the viewport. The transformed, centered legal sheet uses a sticky close with padding-compensated margins, retaining its original placement without moving the heading or body copy. The control remains inside the visible scrollport after scrolling to the end.

A second settled capture at enquiry scrollTop 120 showed the close crossing the last letter of the heading. Its background now inherits the dialog's original color, so underlying text cannot obscure the vector. The dark film/story and cream enquiry/feature palettes are preserved. See `close-before`, `close-final` and `close-over-heading-before.png` / `close-over-heading-after.png`.

### Failed gallery photograph

The baseline repeatedly requested the blocked second photograph because it reset the request cursor to the displayed frame. The cursor now advances independently, while the displayed photograph and counter change only after a successful decode. Chromium and WebKit both verified `1 -> failed 2 keeps 1 -> Next reaches 3 -> Previous retries restored 2`.

WebKit retained the failed responsive request when only `src` was reassigned. Retrying replaces only that failed image node with an equivalent clone, retaining its responsive sources, sizes, alternative text and dimensions. The existing slide and exact tween ownership are preserved. The final both-engine report is `gallery-error-final/report.json`; `gallery-error-before` and `gallery-error-src-retry` retain the two observed failure cases.

### Narrow phone typography

A manual inspection of the fresh 320px screenshots found two defects missed by the document-width check because the page clips its overflow. The last Lifestyle word ended at x340.75 in Chromium and x341.04 in WebKit, outside the 320px viewport. The Interiors heading gained a fourth line while its paragraph retained a fixed top offset, giving a negative gap of -6.19px / -3px.

The Lifestyle display size now scales only below its existing 64px ceiling. At 320px, the word ends at x290.75 in both engines. Below 375px, the gallery paragraph moves down 40px; the title-to-copy gap is now 33.81px / 37px, and the complete paragraph remains inside its section. The 390px composition is unchanged. No font family, photograph, color or authored desktop spacing changed.

`narrow-text-qa.mjs` measures actual text-node Range rectangles, not only block widths. Both engines pass at 320px and 390px. The original failure and final measurements are retained in `narrow-text-before/report.json` and `narrow-text-after/report.json`. The entire 320x800 section/navigation sweep was repeated after the correction.

### Native keyboard focus evidence

A native modal permits keyboard focus to leave the document for browser chrome. The fresh mobile Shift+Tab trace recorded `document.hasFocus() === false`, then Tab returned directly into the open menu. This was not background-page focus. The audit preserves that trace, rejects any focused document state outside the open dialog, and separately verifies Escape, focus restoration and released scroll locks. No production focus trap was added for browser chrome.

## Fresh capture evidence

The first pass saved all mobile sections and five real menu-navigation landings at 390x844 (30 screenshots). The first desktop capture stopped after seven screenshots because a screenshot timed out during shared cloud resource pressure. This incomplete desktop run is not claimed as a complete desktop audit. No page error or failed original asset was recorded in that pass.

Several early baseline screenshots caught the remaining child stagger of a heading. The capture harness now observes child spans/strong elements and background color changes, in addition to parent geometry, before considering a reading frame settled. Intentional mid-transition story samples are distinguished from settled reading frames. The final pass repeats the desktop coverage on the final source.

## Commands and runtime

```sh
npx tsc --noEmit
npm run build
python -m http.server 14324 --bind 127.0.0.1 --directory .vercel/output/static
VISUAL_BASE_URL=http://127.0.0.1:14324 VISUAL_PHASE=after VISUAL_ENGINES=chromium,webkit node scripts/visual-audit.mjs
VISUAL_BASE_URL=http://127.0.0.1:14324 node scripts/narrow-text-qa.mjs
VISUAL_BASE_URL=http://127.0.0.1:14324 node scripts/interaction-audit.mjs
VISUAL_BASE_URL=http://127.0.0.1:14324 node scripts/gallery-error-qa.mjs
MOTION_QA_BASE_URL=http://127.0.0.1:14324 node scripts/hotspot-qa.mjs
MOTION_QA_BASE_URL=http://127.0.0.1:14324 node scripts/motion-qa.mjs
BROWSER_QA_BASE_URL=http://127.0.0.1:14324 node scripts/browser-qa.mjs
```

`PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH` point at the isolated cloud runtime: Node 24, Playwright 1.58.2, Chromium 145 and WebKit 26. Tests run sequentially with one engine/context at a time. Owned Astro uses foreground `--ignore-lock`; an external base URL is never terminated by a test.

The intended visual sizes are 1440x900, 1920x1080, 1024x900, 768x1024, 390x844, 320x800 and 844x390. `VISUAL_WIDTHS`, `VISUAL_ENGINES`, `INTERACTION_WIDTHS` and `INTERACTION_ENGINES` select a bounded reproduction while retaining the same assertions.

## Final continuation result

All planned local gates passed. The compact, durable [results.json](verification/design-2026-11-01/results.json) records source hashes, exact coverage, continuity measurements, check names and screenshot hashes.

| Gate | Fresh result |
| --- | --- |
| Section and real navigation captures | Chromium at all seven requested sizes; WebKit at 1440x900 and 390x844. 355 broad captures, with the complete 33-frame 320x800 profile regenerated after the narrow CSS correction. All sections and final Closing/footer tiles inspected. |
| Text bounds | Chromium and WebKit, 320/390px, all four profiles pass. Actual glyph rectangles, heading/copy gap and paragraph/section bounds checked. |
| Interactive states | 142 settled captures: 54 at 1440, 59 at 390, 12 at 320, 17 at 844x390. No dialog overflow, unreachable close, remaining text arrow, wrong photo ratio, page error or unexpected request. |
| Existing full motion | Chromium 9/9 and WebKit 9/9; 37.858s total. |
| Hotspots | Chromium 8/8 and WebKit 7/7, including native mouse/touch/keyboard, viewport geometry and scroll/focus invariants. |
| Failed gallery request | Both engines pass decoded-frame retention, next-image recovery and retry. |
| Existing browser QA | Five widths, six interaction groups; no broken images or page errors. Repeated on the final narrow CSS. |
| TypeScript and production build | Both exit 0 on final product source, execution session 3765. |
| Arrow scan | 60 source/SVG files, HTML entities decoded, zero matches; runtime text/pseudo-element scans also zero. |

The full motion and hotspot gates ran before the last narrow typography correction, on identical JavaScript and identical CSS for their 390px-and-wider viewports. The affected 320px range was then rechecked in both engines and in the full 320px section sweep; the existing base browser suite was also repeated. Execution sessions are 82612 for the full chain and 12007 for the final narrow/base chain, both exit 0.

The older visual harness requested the footer with `Number.MAX_SAFE_INTEGER`, which browsers normalized to the top. Those duplicate Hero frames are not footer evidence: the preceding final Closing tiles already contain the full footer. The harness now uses the finite document end and asserts arrival; the new 320px footer capture confirms it. No application scroll behavior was changed for that test.

Selected settled views:

- [Desktop hero](verification/design-2026-11-01/hero-desktop-1440.jpg)
- [Mobile feature detail](verification/design-2026-11-01/feature-mobile-390.png)
- [Mobile gallery vectors](verification/design-2026-11-01/gallery-mobile-390.png)
- [320px title and paragraph](verification/design-2026-11-01/interiors-mobile-320.png)
- [Mobile enquiry](verification/design-2026-11-01/enquiry-mobile-390.png)
- [Native short-landscape close](verification/design-2026-11-01/close-landscape-844.png)

The original high-resolution section, state and before/after evidence remains under the artifact paths above. The product source is frozen for release handoff; no commit, push or deployment was performed by this audit owner.

The report distinguishes local headless rendering/interaction evidence from physical-device FPS, real browser-chrome behavior and production loading performance. Publication commits, READY deployment and live acceptance are maintained by the release owner in [the shared release record](https://github.com/IMONsergey/LuxuryRealty/blob/main/docs/MOTION-RELEASE-2026-11-01.md).
