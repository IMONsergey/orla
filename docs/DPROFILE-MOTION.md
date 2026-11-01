# ORLA motion reference

Source: https://dprofile.ru/case/103839/orla-dorchester-collection-dubai by Sergei Imon. The authored Figma design remains the source for composition and real assets.

The clips show architecture rising beneath the opening title, interactive leaf callouts, staggered headline lines, rectangular collage reveals, quiet leaf movement, horizontal interior transitions and residence/enquiry panels. The implementation uses DOM/CSS/GSAP; no recording is substituted for UI.

## Film preview

The first case clip is a genuine 15.63-second promotional excerpt, separate from the interaction recordings. Kinescope ID: `12ff9d3a-a607-41c1-973b-77512f253c3c`; source video ID: `afb0ed52-05d3-4b97-8835-9dd6549f6a6f`. Its source H.264 1920x890 picture and AAC sound are remuxed without re-encoding into `public/media/orla-film-preview.mp4`, with MP4 metadata moved to the beginning for seeking. Temporary CDN URLs are not production dependencies.

The interface labels it as a short preview and offers the full presentation separately. No video URL or poster is attached until the visitor opens the film. Playback requires the native Play control and pauses when the dialog closes or the page is hidden.

## Motion and performance

Desktop-only continuous parallax requires a fine pointer, at least 1101px width and 650px height, and no reduced-motion preference. Other layouts keep the authored scene positions and brief entrances. Reduced motion removes entrances, parallax, wipes and dialog animation. Scroll animation uses transforms/opacity, and no permanent large-layer will-change hints are added. The native scroll, links, document flow and HTML dialogs remain in control.

Image variants are produced separately by `scripts/generate-responsive-images.py`; dynamic zoom images retain the full source. Browser validation is recorded in the checkpoint after the final runtime pass.
