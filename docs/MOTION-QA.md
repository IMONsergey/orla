# ORLA motion regression

## Run

The default run starts the existing Astro development wrapper on port 4314,
launches Chromium and then WebKit, and closes both browsers and its server.
Owned Astro processes receive --ignore-lock so Astro 7's agent detection keeps
them in the foreground. The script can then terminate its actual server child.

~~~sh
node scripts/motion-qa.mjs
~~~

An installed local Playwright package is preferred. The existing project's
toolkit path is the fallback:

~~~text
/home/sergey/.local/share/imon-toolkit/node/node_modules/playwright
~~~

Overrides:

~~~sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/motion-qa.mjs
MOTION_QA_PORT=4316 node scripts/motion-qa.mjs
MOTION_QA_BASE_URL=http://127.0.0.1:4321 node scripts/motion-qa.mjs
~~~

With MOTION_QA_BASE_URL, the script uses the already-running site and does not
start or stop that external server. The original public image assets, generated
responsive images and /media/orla-film-preview.mp4 must already be available.
Chromium and WebKit binaries and their system dependencies must be installed.

The total watchdog is 95 seconds, followed by bounded emergency cleanup.
Normal runs are intended to finish well below that limit. Browsers execute
sequentially to avoid concurrent rendering/decoding load.

## Coverage

1. **Normal-motion hero:** starts at 1440×900 with no-preference; waits for
   actual app initialization, fonts, hero image data and the opening entrance.
   Reads the title, architecture and hotspot geometry. Scroll distance is
   derived from the real hero/title/header rectangles, then checks that the
   title fades and the architecture moves.
2. **Hotspots:** waits for stable geometry, verifies the hit target, then opens
   each hotspot with a real coordinate mouse click. The card and its close
   control must fit inside the visual viewport, and the close control must pass
   a hit test. Animation-frame samples require opening and closing to preserve
   page scroll within 1px. Only the selected trigger may be aria-expanded;
   closing by its button or Escape must restore focus.
3. **Authored reveals:** crosses an initially unrevealed rectangular photograph
   and editorial heading, then checks opacity/visibility and cleared clipping.
4. **Gallery:** samples real DOM matrices and opacity each animation frame.
   Next must enter from the right and Previous from the left; there must be no
   vertical displacement or gap in opaque image coverage. Rapid Next → Next →
   Previous must settle at the expected DOM-derived index with matching counter,
   aria-hidden, inert state and image decode.
5. **Cancelled gestures:** begins with a real Playwright mouse/pointer sequence
   and verifies native pointer capture. One case injects a PointerEvent
   pointercancel; another releases capture to generate lostpointercapture.
   Neither may change the slide, and the following deliberate Next must work.
   This covers cancellation handlers; it is not a hardware multi-touch test.
6. **Motion preference changes:** switches to reduced motion during an actual
   wipe, checks immediate settlement, and scans the existing reveal targets for
   stranded hidden states. It restores normal motion.
7. **Residence dialog:** opens the existing first category and its residence
   details, waits for the real plan image, captures WebKit and checks Escape,
   scroll-lock removal and focus restoration. No form is filled or submitted.
8. **Responsive recovery:** resizes desktop → 390×844 → desktop, checks hero
   visibility and previously revealed photo/heading, then toggles reduced motion
   again to detect retained hidden state.
9. **Short landscape:** uses 844×390, opens the actual hotspot with a coordinate
   click and checks card/close bounds, close accessibility and stable scroll.
10. **Film lifecycle:** before any explicit open, requires no video src,
    currentSrc or media request. Opens the real control, waits for real video
    metadata, confirms opening does not autoplay, then starts muted playback
    for the check. Closing must pause it, stop its timeline and restore focus.

Horizontal overflow is checked at desktop, gallery, mobile, returned desktop
and short landscape sizes. The comparison accounts for the design's reserved
scrollbar gutter.

The test fails on page errors, missing/undecodable sampled imagery, invalid
gallery settlement, film media errors, failed geometry/focus assertions or the
time budget. Console errors and video codec/readiness state are retained for
diagnosis. Any attempted enquiry API request is blocked and fails the run;
the test does not send enquiries.

## Artifacts

Output directory: artifacts/motion-qa/.

- report.json: pass/fail by engine and step, measured rectangles/styles,
  actual currentSrc and natural image dimensions, gallery animation frames,
  video requests/responses, runtime errors and failure DOM.
- webkit-hero.png, webkit-interior.png, webkit-residence.png:
  viewport screenshots with motion enabled.
- chromium-failure.png or webkit-failure.png when a failure can be captured.
- dev-server.log: output of the server owned by this run.

Transitions use requestAnimationFrame sampling/polling and observable settled
states. There are no fixed animation sleeps. Short timer polling is used only
for server startup and shutdown cleanup.

## Focused hotspot regression

Run against an already-running development or preview server:

~~~sh
MOTION_QA_BASE_URL=http://127.0.0.1:4314 node scripts/hotspot-qa.mjs
~~~

It uses the same PLAYWRIGHT_MODULE override and runs engines sequentially.
HOTSPOT_QA_ENGINE=chromium or webkit can narrow a diagnostic run. The complete
run covers native mobile touch, desktop mouse, keyboard Tab/Enter/Space/Escape,
both trigger states, close-button hit testing, rAF scroll samples, scrolling
away, open-card resize through 390×390, 844×390, 1101×600, 1101×900 and 1440×900,
preserved authored card size limits at the desktop breakpoint, and reduced motion
both during an entrance and before a new entrance. Chromium additionally changes
its native visual viewport scale to 2 through CDP and checks the narrowed card
and close control. This scale check does not claim physical pinch-gesture or
WebKit visual-viewport panning coverage.

The callout follows a visible selected point and closes when that point leaves
the visible hero area. It never changes the document's scroll position. Its
position and dimensions use visualViewport when available, include the circular
close control's 27px overhang, and update once per animation frame during scroll,
viewport changes and the hero's authored parallax. Only explicit closing returns
focus to the trigger; scroll-away dismissal does not focus an offscreen control.

Focused output is artifacts/hotspot-qa/current/report.json. With
HOTSPOT_QA_REPRO=1, the script runs only the original boundary scenario and writes
artifacts/hotspot-qa/before-fix/. This mode is intended for a pre-fix checkout.

## Confirmed defect and evidence, 2026-11-01

The pre-fix 390×844 touch test scrolled to 710px and tapped the fully visible
second hotspot at y=85..136. Chromium and WebKit both placed the card at y=-24,
because the final hero-height clamp overrode the viewport clamp. The close
control occupied y=22..78 below the fixed header; elementFromPoint returned the
Dorchester logo. The document remained at scrollY=710 throughout. This was a
real placement/occlusion bug independent of focus or test preparation scrolling.

The original locator-based desktop diagnostic separately recorded Chromium
scrolling from 381px to 0 after the native click/focus events and a card bottom
of 1196.5px in a 900px viewport. The equivalent explicit-pointer diagnostic passed
both engines. That evidence establishes a mode-dependent reproduction, not a
proven browser or application cause for the delayed scroll. The old report is
preserved as artifacts/motion-qa/locator-before-hotspot-fix.json. The regression
now defaults to actual pointer actions and independently asserts unchanged
scroll; MOTION_QA_POINTER_CLICK=0 retains the locator diagnostic.

The fix uses a bounded fixed card, keeps the authored dimensions, right-side
composition and reveal, preserves an anchor while it remains visible, and clears the state on
scroll-away. It also cancels the entrance on a reduced-motion change. A targeted
transition-property:none prevents the global 0.01ms reduced-motion transition
rule from creating a fresh CSS top transition on each positioning update.

The continuation also exposed two separate motion lifecycle defects:

- **Gallery cancellation before initialization:** the selected slide, counter
  and accessibility state were correct after enabling reduced motion, but its
  transform remained translate(100%,0), or 1425px beyond the left edge. In the
  installed GSAP implementation, killing an array of all slide targets can miss
  an uninitialized single-target fromTo tween. The code now finishes and kills
  the exact current tween before normalizing all slides. The original wipe
  direction, duration, opaque coverage and reversal behavior are retained.
  Evidence: artifacts/motion-qa/gallery-reduce-state-before-fix.json.
- **WebKit desktop reentry:** after desktop → mobile → desktop and returning to
  scrollY=0, the single title ScrollTrigger had progress=0, start=72 and end=630,
  but its animation remained at progress=1 with opacity=0 and y=-70. The scrub
  tween was inactive. Explicit title start values plus invalidateOnRefresh now
  synchronize the animation during refresh. No visibility override or scroll
  compensation was added. Evidence:
  artifacts/motion-qa/webkit-title-trigger-before-fix.json.

Normal-motion residence preparation now explicitly scrolls the real target
into view and waits for that row's authored reveal before clicking. A locator
cannot reach an offscreen control while its reveal still has visibility:hidden;
the assertions and reveal animation remain unchanged.

## Verification status, 2026-11-01

The final continuation source was checked in an isolated Linux workspace with
the full source assets, responsive images and supplied film preview:

| Check | Confirmed result |
| --- | --- |
| Full motion regression | Chromium 9/9 and WebKit 9/9, passed; 45.417s total |
| Focused hotspot regression | Chromium 8/8 and WebKit 7/7, passed |
| Existing browser acceptance | 1440, 1024, 768, 390 and 320px; all 6 interaction groups passed; errors [] |
| Production build | npm run build, exit 0; Vercel static/function output generated |
| TypeScript | node node_modules/typescript/bin/tsc --noEmit, exit 0 |
| QA script syntax | motion-qa.mjs, browser-qa.mjs and hotspot-qa.mjs, exit 0 |
| Owned server lifecycle | HTTP 200 with child still in foreground; SIGTERM exited with code 143; its port closed |

The latest reports are artifacts/motion-qa/report.json,
artifacts/hotspot-qa/current/report.json, artifacts/browser-report.json,
artifacts/final-build-typecheck.json and artifacts/owned-server-report.json.
Build/type logs are artifacts/final-build.log and artifacts/final-typecheck.log.
The final focused screenshots were visually checked at mobile and short
landscape sizes. The browser suites used the development server; production
build completion is a separate confirmed gate, not a claim about live deployment.

Execution references for this continuation: focused suite 90858; full motion
and existing browser suite 15681; build, typecheck, syntax and owned-server
lifecycle 59104. These are isolated-workspace process session IDs, not server
queue jobs. The source was handed to the release owner without a local commit,
push or deployment. The final commit, deployment and live acceptance record is
[MOTION-RELEASE-2026-11-01.md](https://github.com/IMONsergey/LuxuryRealty/blob/main/docs/MOTION-RELEASE-2026-11-01.md).
