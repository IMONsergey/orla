# ORLA V3 verification evidence

Baseline: `cd66952ebb37c4a8214f37cdedde8f27657e1dce`.

## Final results

| Gate | Scope | Result |
|---|---|---|
| `behavioral-results.json` | Chromium 1440×900:9 groups; Chromium touch 390×844:10; WebKit touch 390×844:10 |29/29 passed, zero page errors, six intercepted synthetic requests total |
| `motion-focus-results.json` | Hero, explicit Watch playback, hotspot pointer/focus/scroll in Chromium and WebKit |6/6 passed; no unexpected submissions |
| `feature-logo-final.json` | Photograph failure/Retry, out-of-order completion, pending Close, decoded desktop/mobile wordmarks |4/4 passed; zero page errors |
| `contrast-results.json` | Six final CTA foreground/background pairs from computed CSS |6/6 at least 4.5:1; cream-sheet bronze 5.03:1, photograph retry 18.01:1 |
| `checks.json` | TypeScript, production build, existing enquiry test module, whitespace diff gate |Passed |

The original main harness also captured three preliminary logo geometry groups. Those groups and their screenshots were superseded by the final feature/logo probe because visual inspection found opaque export backgrounds and an image captured before lazy decode. They are not counted as final behavioral coverage here. The rejected images remain only in ignored intermediate artifacts, not as final proof in this directory.

## Selected visual evidence

- `before-footer.jpg` and `after-footer-desktop.png`: published malformed logos versus the corrected transparent wordmarks and partner canvas.
- `after-partner-mobile.png` and `after-footer-mobile.png`: decoded 390 px layout, with the original transparent white source and stable proportions.
- `before-film.jpg` and `after-film-mobile.png`: original dark CTA versus readable film enquiry; playback and pause are asserted in the JSON reports.
- `after-server-error-mobile.png`: a synthetic 422 field error after pending close/reopen, with the input enabled and focused and the error in view.
- `after-menu-mobile.png`: source-correct ORLA canvas in the menu.
- `before-mansion-401.jpg`: the published misleading category-to 401 shortcut, removed by the behavioral correction.
- `feature-image-error.png` and `feature-image-retry.png`: failure and successful Retry structure. These were captured before the final small-action color correction; `contrast-results.json` records the final darker action colors. They do not serve as final color proof.

`action-inventory.json` enumerates rendered links, buttons, form fields and media. It is an inventory, not a claim that each entry received its own independent runtime test.

## Reproduction

The scripts are `scripts/interaction-v3.mjs`, `scripts/feature-logo-v3.mjs` and the existing `scripts/motion-qa.mjs` with `MOTION_QA_FOCUS_ONLY=1`. The latter's video assertion now checks the requested single-click Watch behavior. Use the installed Playwright module via `PLAYWRIGHT_MODULE`, its browser cache via `PLAYWRIGHT_BROWSERS_PATH`, and a local preview through `INTERACTION_BASE` or `MOTION_QA_BASE_URL`.

The preview must support video byte ranges. A plain Python HTTP server produced a local WebKit media failure; the Range-aware server returned 206/Content-Range and WebKit played the unchanged MP4. All enquiry responses in the behavioral suite are intercepted. No real endpoint, recipient or production data is written by these tests.

The named gates establish functional and visual state observations. They do not claim 60 fps on every device or a new complete replay of the unchanged gallery animation. The full scope, corrected contracts, Figma node provenance and remaining limits are in `../../INTERACTION-AUDIT-2026-11-01-V3.md`.
