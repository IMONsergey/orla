# ORLA checkpoint, 2026-11-01

Original Figma implementation retained from commit 40cec3fe. Fresh production build, TypeScript check, five enquiry backend tests and browser QA passed. Browser widths1440/1024/768/390/320: no horizontal overflow, no missing images, no JS errors. Verified menu focus, hotspots, gallery, features, residence selection, nested plan zoom, enquiry validation, error retention and stable retry UUID.

Fixes: bounds aligned with server, preferred contact prefix included in message limit, same UUID across unchanged retries and reopening, new UUID after edited submitted payload, truthful success state, configured storage readiness. No external notification is sent.

Vercel project: orla-imon / prj_KhdhyqgDAC2ngjav8TOjX1rWkupn. Private store: store_AEcgaRBGLN2sbvKY. Encrypted store token configured. At the initial checkpoint, publication and production HTTP/storage acceptance were the next steps; their completed results are recorded below. Publication was authorized in the original conversation.

## Continuation and production acceptance, 2026-11-01

Production publication is confirmed at https://orla-imon.vercel.app. The real enquiry endpoint passed creation (201), unchanged retry with the same receipt (200), changed payload rejection (409), missing consent (422), and cross-origin rejection (403) at 11:26-11:27 UTC. The public desktop/mobile resource check passed all 83 image decodes, local fonts, overflow and browser error checks.

The release checker initially rejected concurrent image decodes; all 83 unchanged elements decoded successfully in sequence. No ORLA image was replaced.

Added the missing canonical and Open Graph URL using SITE_URL, PUBLIC_SITE_URL or the assigned ORLA origin. Fresh production build and TypeScript passed in job 20261101T113242-e1bee8bed0, and the generated HTML contains exactly one canonical and matching og:url. The release report and reusable production checker are maintained in IMONsergey/LuxuryRealty under docs/RELEASE-2026-11-01.md and scripts/production-qa.mjs.

At that release checkpoint, the actual film and presentation PDF were absent from source materials; contextual requests remained. The motion continuation below subsequently adds the supplied film preview. Enquiries are privately stored without outgoing email/CRM delivery.

## Initial Dprofile motion staging, 2026-11-01

Inspected all eight ORLA clips in https://dprofile.ru/case/103839/orla-dorchester-collection-dubai. Added registered architecture/water/hotspot movement, line-by-line headings, rectangular photograph reveals, subdued leaf and collage movement, horizontal interior wipes after decode, and in-viewport interactive callouts. The film action opens the supplied 15.63s genuine promotional excerpt on demand; full presentation remains an enquiry. The film does not preload or autoplay on page entry.

Gallery/zoom handle last request, cancellation, resize and nested focus restoration. Responsive image generation was prepared in this initial staging handoff. The following continuation records the completed local acceptance; publication and live acceptance are tracked in the shared release record.

## Completed local continuation and release handoff, 2026-11-01

The mobile hotspot defect was reproduced with native touch in both Chromium and WebKit at 390x844, scrollY=710. A visible second hotspot opened the card at y=-24; its close button at y=22..78 was covered by the header logo. The hero-height clamp overrode viewport positioning. This was independent of the separate locator-mode desktop scroll diagnostic.

The callout now uses bounded fixed positioning with visualViewport coordinates, preserves the authored CSS dimensions before constraining them, keeps the close control reachable, follows its visible selected point and dismisses when scrolling away. Only the selected trigger is aria-expanded. Explicit closing restores focus without moving the page. Resize and reduced-motion changes are handled, including cancellation of an active entrance.

The full motion suite exposed and verified two further corrections. Gallery cancellation now finishes and kills the exact current GSAP tween before resetting all slides, preventing an uninitialized fromTo from restoring translate(100%,0). The hero title uses explicit start values and invalidateOnRefresh, resolving WebKit's observed trigger.progress=0 / animation.progress=1 mismatch after desktop/mobile/desktop reentry.

Final source acceptance in the isolated Linux workspace:

- Full motion: Chromium 9/9 and WebKit 9/9, passed, 45.417s total.
- Focused hotspots: Chromium 8/8 and WebKit 7/7, passed. Native mouse, touch and keyboard; scroll traces; close hit testing; resize and short landscape; reduced motion; Chromium visual viewport scale 2.
- Existing browser QA: five widths from 320 to 1440px, six interaction groups, no broken-image entries or page errors.
- Production build and TypeScript: exit 0. All three QA scripts passed syntax checks.
- Owned Astro startup/shutdown: foreground HTTP 200, confirmed process exit and closed port. Both harnesses use --ignore-lock to prevent Astro's agent-inferred daemon mode.

Reports and exact coverage are documented in docs/MOTION-QA.md. Final execution sessions: 90858 (focused), 15681 (full motion and base browser), 59104 (build/type/syntax/server lifecycle). The source was handed to the release owner without commit, push or deployment from this continuation. The authoritative final commit, deployment and live acceptance record is [MOTION-RELEASE-2026-11-01.md](https://github.com/IMONsergey/LuxuryRealty/blob/main/docs/MOTION-RELEASE-2026-11-01.md).


## Fresh visual and interaction continuation, 2026-11-01 v2

A fresh audit began from published source 56634c9, with new captures of all thirteen sections, actual navigation, all feature/residence states and modal flows. Text arrows and close/plus/minus glyphs were replaced with decorative SVG controls while preserving authored assets, fonts, colors and geometry.

Confirmed repairs: reading-position continuity across motion preferences and responsive layouts; mobile feature-grid min-content overflow; three dialog photograph selectors honoring their existing aspect ratios; native scrollable close controls and their opaque inherited backdrop; gallery recovery after a failed image; and clipped/overlapping heading text on 320px phones. The earlier hotspot, exact gallery tween cancellation and title-refresh repairs remain intact.

Local acceptance: all seven requested Chromium viewport sizes plus desktop/mobile WebKit; 355 broad visual captures, with the complete 33-frame 320px profile repeated after its CSS fix; 142 interaction captures; four both-engine narrow-text profiles; motion 9/9 + 9/9; hotspots 8/8 + 7/7; failed-image recovery in both engines; existing five-width/six-group browser QA; final TypeScript and production build exit 0. Enquiry requests were mocked or blocked. No real submission was sent. The full motion/hotspot checks preceded only the final below-388px typography CSS; their viewports and JavaScript were unchanged, and the affected narrow range plus base browser QA were rerun.

See docs/VISUAL-AUDIT-2026-11-01.md for actual commands, findings, coverage and limits. Six compact selected screenshots and source-hashed results are committed-ready under docs/verification/design-2026-11-01/. Final execution sessions: 82612 (broad/full regression), 3765 (final type/build), 12007 (narrow, fresh 320px sweep and base browser), all exit 0. This is a completed local handoff. Publication and live acceptance remain recorded by the release owner in the shared MOTION-RELEASE-2026-11-01.md link above.
