# ORLA motion regression

## Run

The default run starts the existing Astro development wrapper on port 4314,
launches Chromium and then WebKit, and closes both browsers and its server.

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
2. **Hotspots:** opens every existing hotspot, checks the settled card is inside
   the viewport, closes by its button or Escape, and checks focus restoration.
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
9. **Short landscape:** uses 844×390, opens the actual hotspot and checks both
   the card and its close control remain within viewport bounds.
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

## Verification status

Only node --check scripts/motion-qa.mjs has been executed in the source snapshot.
No browser, page, playback, screenshot or timing pass is claimed until this
script runs on the server with the full assets and browser engines.
