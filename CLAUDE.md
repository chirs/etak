# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Etak is a zero-dependency interactive canvas visualization of Micronesian star-path ("etak")
navigation, rendered over a real, zoomable chart of the Pacific. There is no build step or
package manager at runtime. The app is these files in `src/`:

- `index.html` — markup only; links the stylesheet and the scripts, in load order.
- `styles.css` — all CSS, including the `:root` color tokens (the single source of truth for the palette).
- `core.js` — the pure **spherical** geometry/scoring core, exposed as the global `EtakCore`
  (no DOM, no canvas, no projection — just great-circle math over `{lat,lon}`).
- `map-data.js` — **generated** Pacific coastlines (`const PACIFIC_MAP`); do not edit by hand.
- `passages.js` — hand-authored content: the `ETAK_ISLANDS` gazetteer and `ETAK_PASSAGES` list.
- `app.js` — everything else: projection, camera, puzzle/sandbox state, canvas rendering, UI wiring, the rAF loop.

`tools/build_map.py` regenerates `map-data.js` from Natural Earth 50m land (stdlib-only, run
once: `python3 tools/build_map.py`). `tests/core.test.mjs` covers the core (`node --test 'tests/**/*.test.mjs'`).

Scripts are plain classic `<script>` tags (not ES modules) so `src/index.html` still works opened
directly over `file://`. Load order matters: `core.js` → `map-data.js` → `passages.js` → `app.js`
(`app.js` consumes all three globals). `core.js`/`map-data.js`/`passages.js` also expose a
`module.exports` bridge so Node tests can `require` them; this is inert in the browser.

To run it: open `src/index.html` in a browser, or serve the directory (`python3 -m http.server
--directory src`). Fonts load from Google Fonts, so a network connection is needed for the intended typography.

## Domain concepts (needed to make sense of the code)

The premise: a canoe sails a straight leg from HOME (`A`) to DESTINATION (`B`). A **reference
island** (`C`) sits off to the side. As the canoe advances, the *bearing* from canoe→reference
sweeps across the 32-point sidereal "star compass" (each point is a `HOUSE = 11.25°` wedge).
Each time the bearing crosses into a new star house, that marks an **etak** boundary —
segmenting the voyage into legs. A good reference island produces ~6 evenly-spaced etaks.

The whole view is drawn **east-up** (world rotated −90°) — the traditional Carolinian
alignment, compass anchored on Altair with east at the top.

Three **frames** render the *same* voyage. CHART↔NAVIGATOR cross-fade by `f`; BOAT is a
discrete third state faded through night by `b` (different projection — no blend possible):
- **CHART** (`f=0`): canoe moves, islands fixed — the outside/map view (camera-centered).
- **NAVIGATOR** (`f=1`): canoe fixed at center, islands drift past — the Etak mental model
  where the reference island "moves." The crossfade blends centering only (rotation is constant).
- **BOAT** (`b=1`): the horizon from the canoe (`drawBoatView`) — full 360° of azimuth across
  the width, centered on the course heading; star houses ticked along the horizon line, the
  reference island's caret sliding across them (one etak = one house). Pure screen space; pan/
  zoom/drag are disabled while active.

Two **modes**:
- **PUZZLE**: a documented real passage with 4 real candidate islands; pick the one that best
  segments the voyage. Score panel + chooser visible. NEW VOYAGE cycles `ETAK_PASSAGES`.
- **SANDBOX**: one draggable *hypothetical* reference island; free exploration.

`A`, `B`, `C` are `{lat,lon,name}` points. All navigation math is spherical (great-circle), so
bearings and etaks are correct regardless of the render projection.

## Architecture

`core.js` is one pure module (`EtakCore`); `app.js` is one IIFE organized top-to-bottom into
commented sections. Key pieces and their coupling:

- **Geometry / scoring core** (`core.js`: `gcBearing`, `gcDistNm`, `gcInterp`, `houseOf`,
  `boundariesFor`, `scoreFor`, plus `HOUSE`, `SWEET`, `verdictText`): pure spherical functions over
  `{lat,lon}` points, with no DOM/canvas/projection dependency. `boundariesFor` samples the leg
  (great-circle interpolated) at N=2000 steps and records the `t` values where the star house of
  the canoe→ref bearing changes — these boundary `t`s drive both the ticks drawn on the course and
  the score. `scoreFor` combines *count fitness* (gaussian around `SWEET=6` etaks) and *evenness*
  (1 − coefficient of variation of segment lengths), 50/50, scaled to 100. `app.js` pulls what it
  needs from `EtakCore` via a destructuring line at the top.
- **Passages / puzzle** (`makePuzzle`): loads `ETAK_PASSAGES[passageIndex]` — a real leg and four
  real candidate islands — and scores each candidate live with the core. Nothing is hand-tuned;
  the candidate *sets* are curated so each puzzle has a clear (or interestingly ambiguous) answer
  plus instructive traps (e.g. Satawal sits on the Puluwat→Lamotrek course line → its bearing
  barely moves). Island coordinates live in `ETAK_ISLANDS` (`passages.js`), sourced from
  `docs/sources.md` §3.
- **Projection + camera** (`app.js`): `project({lat,lon})→{x,y}` is plain equirectangular in a
  Pacific-centered lon360 space (`x=lon360`, `y=−lat`); `unproject` inverts it. The camera
  (`cam.{cx,cy,zoom}`) supports wheel-zoom-to-cursor and drag-pan (chart frame). Coastlines are
  built once into a world-space `Path2D` from `PACIFIC_MAP.polys`.
- **State**: `A,B,C` are the *active* leg/reference (`{lat,lon,name}`); `boundaries` and `live`
  (the current score object) are recomputed by `recompute()` whenever the reference changes
  (choice or drag). `t` = voyage progress 0..1; `f` = frame crossfade; `mode`.
- **Rendering** (`draw`): a single canvas redrawn each rAF frame. `viewParams()` is the **single
  source** for the view transform (east-up rotation, constant; `f` blends the camera center toward
  the canoe); `applyTransform`, `worldToScreen`, and `screenToWorld` all derive from it and must
  stay mutual inverses — **change one, change all.** `draw()` computes the per-frame values once
  (canoe position, canoe→ref bearing, `v` — `viewParams(cn)` takes the precomputed canoe point and
  returns its projection as `v.P`) and delegates to named layer functions in paint order:
  `drawSky` → world pass (`drawCoast`, `drawRangeRings`, `drawCourse`, `drawTrails`, `drawRose`, `drawBearings`,
  `drawCanoe`, all under `applyTransform(v)`) → screen pass (`drawGazetteer`, `drawMarkersAndLabels`, via
  `worldToScreen`, so text stays crisp and upright at any zoom). A new visual feature should be a
  new layer function slotted into that order. Screen-constant sizes are `pixels / v.Z` in world units.
- **Loop**: `requestAnimationFrame(loop)` advances `t` when playing and eases `f` toward `fTarget`.

## Editing conventions here

- DOM ids/classes live in `index.html`/`styles.css` and are wired to `getElementById` calls in
  `app.js`. Changing an id means updating both places.
- **Palette single source of truth**: all colors are CSS custom properties in `:root` (`styles.css`),
  including canvas-only tokens (`--course`, `--tick`, `--rose-ring`, `--rose-minor`, `--ghost`,
  `--island`, `--ref-fill`, `--dim`, `--land`, `--coast`). `app.js` reads them once via `getComputedStyle` into the `PAL`
  object; canvas code references `PAL.*` (with `hexA(hex, alpha)` or a `'88'`-style suffix for
  translucency). Add or change a color in `:root`, not in the drawing code.
- `viewParams()` (in `app.js`) is the one place the view transform is defined; `applyTransform`,
  `worldToScreen`, and `screenToWorld` all derive from it and must stay mutual inverses.
- **Tuning constants live in `CFG`** (top of `app.js`, next to `PAL`): rose radius, trail
  count/spacing, playback rate, zoom step, drag hit radius, fit fraction, max zoom, crossfade
  speeds. Put new magic numbers there, not inline in drawing/interaction code.
- The readout only rewrites its `innerHTML` when the composed string changes (`lastReadout`), and
  per-leg values (`legNm`) are cached in `recompute()` — don't reintroduce per-frame DOM writes or
  recomputation of leg constants.
- Regenerate `map-data.js` only via `tools/build_map.py`; never hand-edit it. To widen/shift the
  chart, change the bounds/tolerance constants at the top of that script and re-run.
- `reduceMotion` (prefers-reduced-motion) gates the frame-ease speed; preserve it.
