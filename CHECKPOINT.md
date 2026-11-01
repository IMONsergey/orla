# ORLA checkpoint, 2026-11-01

Original Figma implementation retained from commit 40cec3fe. Fresh production build, TypeScript check, five enquiry backend tests and browser QA passed. Browser widths1440/1024/768/390/320: no horizontal overflow, no missing images, no JS errors. Verified menu focus, hotspots, gallery, features, residence selection, nested plan zoom, enquiry validation, error retention and stable retry UUID.

Fixes: bounds aligned with server, preferred contact prefix included in message limit, same UUID across unchanged retries and reopening, new UUID after edited submitted payload, truthful success state, configured storage readiness. No external notification is sent.

Vercel project: orla-imon / prj_KhdhyqgDAC2ngjav8TOjX1rWkupn. Private store: store_AEcgaRBGLN2sbvKY. Encrypted store token configured. Next: push this verified patch, deploy production, test actual HTTP and synthetic private enquiry persistence. Publication was authorized in the original conversation.

## Continuation and production acceptance, 2026-11-01

Production publication is confirmed at https://orla-imon.vercel.app. The real enquiry endpoint passed creation (201), unchanged retry with the same receipt (200), changed payload rejection (409), missing consent (422), and cross-origin rejection (403) at 11:26-11:27 UTC. The public desktop/mobile resource check passed all 83 image decodes, local fonts, overflow and browser error checks.

The release checker initially rejected concurrent image decodes; all 83 unchanged elements decoded successfully in sequence. No ORLA image was replaced.

Added the missing canonical and Open Graph URL using SITE_URL, PUBLIC_SITE_URL or the assigned ORLA origin. Fresh production build and TypeScript passed in job 20261101T113242-e1bee8bed0, and the generated HTML contains exactly one canonical and matching og:url. The release report and reusable production checker are maintained in IMONsergey/LuxuryRealty under docs/RELEASE-2026-11-01.md and scripts/production-qa.mjs.

The actual film and presentation PDF are still absent from source materials; contextual requests remain. Enquiries are privately stored without outgoing email/CRM delivery.

## Dprofile motion polish in progress, 2026-11-01

Inspected all eight ORLA clips in https://dprofile.ru/case/103839/orla-dorchester-collection-dubai. Added registered architecture/water/hotspot movement, line-by-line headings, rectangular photograph reveals, subdued leaf and collage movement, horizontal interior wipes after decode, and in-viewport interactive callouts. The film action opens the supplied 15.63s genuine promotional excerpt on demand; full presentation remains an enquiry. The film does not preload or autoplay on page entry.

Gallery/zoom now handle last request, cancellation, resize and nested focus restoration. Responsive image generation is ready. Source remains unpublished pending server generation, build, normal-motion Chromium/WebKit and production verification.
