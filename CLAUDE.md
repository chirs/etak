# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Etak is a zero-dependency interactive canvas visualization of Micronesian star-path ("etak")
navigation, rendered over a real, zoomable chart of the Pacific. No build step, no package
manager. The app is these files in `www/`:

- `index.html` — markup only; links the stylesheet and scripts in load order.
- `styles.css` — all CSS, including the `:root` color tokens (the single source of truth for the palette).
- `core.js` — the pure spherical geometry/scoring core, global `EtakCore` (no DOM, canvas, or
  projection): great-circle math over `{lat,lon}` plus the `altAz`/`riseAz` astronomy behind the
  boat-view sky.
- `map-data.js` — **generated** Pacific coastlines (`PACIFIC_MAP`); never hand-edit.
- `stars.js` — **generated** star catalog (`STAR_MAP`): Yale BSC field stars to V≤3 plus the named
  Carolinian compass stars, whose `group` strings match `ETAK_COMPASS`; never hand-edit.
- `passages.js` — hand-authored content: the `ETAK_ISLANDS` gazetteer, `ETAK_PASSAGES`,
  `ETAK_COMPASS`, `ETAK_PLACES`, and `ETAK_STORY`.
- `app.js` — everything else: projection, camera, state, rendering, UI wiring, the rAF loop.

`tools/build_map.py` regenerates `map-data.js` (Natural Earth 10m land plus OSM coastlines for the
outer-Caroline atolls Natural Earth lacks); `tools/build_stars.py` regenerates `stars.js` (Yale
Bright Star Catalog). Both are stdlib-only, with source data checked in next to them. To widen or
shift the chart, change the bounds/tolerance constants at the top of `build_map.py` and re-run.
Tests: `node --test 'tests/**/*.test.mjs'`.

Scripts are classic `<script>` tags (not ES modules) so `index.html` works over `file://`. Load
order matters: `core.js` → `map-data.js` → `stars.js` → `passages.js` → `app.js`. The data/content
scripts expose a `module.exports` bridge for Node tests; it is inert in the browser. To run: open
`www/index.html`, or `python3 -m http.server --directory www`. Fonts load from Google Fonts, so
the intended typography needs a network connection.

## Domain concepts

A canoe sails a straight leg from HOME (`A`) to DESTINATION (`B`); a **reference island** (`C`)
sits off to the side. As the canoe advances, the bearing canoe→reference sweeps across the
32-point sidereal star compass (each point a `HOUSE = 11.25°` wedge). Each crossing into a new
house marks an **etak** boundary, segmenting the voyage. A good reference island produces ~6
evenly-spaced etaks.

Everything is drawn **east-up** (world rotated −90°) — the traditional Carolinian alignment,
compass anchored on Altair.

Three **frames** render the same voyage. CHART↔NAVIGATOR cross-fade by `f`; BOAT is a discrete
third state faded through night by `b` (different projection — no blend possible):
- **CHART** (`f=0`): canoe moves, islands fixed — the outside/map view (camera-centered).
- **NAVIGATOR** (`f=1`): canoe fixed at center, islands drift past — the etak mental model.
  The crossfade blends centering only; rotation is constant.
- **BOAT** (`b=1`): the first-person horizon from the canoe (`drawBoatView`) — a `CFG.fov` window
  of azimuth centered on the course heading plus the gaze (`look` yaw, `pitch` tilt; drag the
  canvas or use the arrow keys; both reset on boarding). Star houses tick along the horizon line,
  the reference island's caret sliding across them (one etak = one house). The hull silhouette
  anchors to the *heading* azimuth — it leaves the frame when you look abeam — and occludes the
  swell. The vessel is a Carolinian proa (`docs/canoe.md`): upswept endpiece, crab-claw sail on
  two splayed spars, and an outrigger float to windward on arching booms. Each part is a point in
  **metres from the eye** (x forward along the heading, y to starboard, z up) turned into
  azimuth/altitude, so it projects through the same frame as the sky — the `CFG` values are real
  dimensions, and the eye sits aft rather than amidships because this projection cannot draw
  geometry that wraps behind the viewer. The sky is the real one
  (`STAR_MAP` + `EtakCore.altAz`), rotating with sailing time (`t · legNm / CFG.canoeKn` hours
  from `CFG.depart`, adjustable while aboard via the departure picker); the current house's
  physical star glows amber. The sky is also **day-aware**: the sun (validated `sunPos`
  ephemeris) drives a day wash, a twilight glow at its true azimuth, and star visibility —
  by day there is no star to steer by or click, though house ticks and carets (instrument UI)
  remain. Islands within `CFG.sightNm` rise as horizon silhouettes at their true azimuths.
  A still click picks the nearest named compass star (via `starHits`) and opens its card
  (`#starCard`). Pure screen space; chart pan/zoom are disabled while aboard.

Three **modes**:
- **PUZZLE**: a documented real passage with 4 real candidate islands; pick the one that best
  segments the voyage. NEW VOYAGE cycles `ETAK_PASSAGES`. The **blind passage** (SAIL THE
  PASSAGE, `startBlind` in `app.js`) is the game loop layered on it: commit to a reference
  (scores stay hidden), sail boat-view-only under a per-voyage hidden current
  (`EtakCore.driftTrack` — the canoe holds the planned course while the sea displaces it),
  answer "which etak are we in?" at random pauses, declare *etak of birds* (`#birdsBtn`) when
  you believe you've entered the destination's ring, and get everything revealed only at
  landfall — errors in etaks, the arrival, the current named by its star house, then the chart
  with the true wake ghosted beside the planned course. All blind-run truths (positions,
  question answers, ring entry) come from the drifted track, never the ideal schedule; the
  interface never shows Western units mid-run (design.md R1).
- **SANDBOX**: one draggable *hypothetical* reference island; free exploration.
- **SETTLEMENT**: the explorable settlement map — every migration arc over bare coastlines,
  driven by a year timeline (`TL` in `app.js`): the bottom bar becomes a time slider from
  ~2350 BCE to 1250 CE, each arc growing toward its landfall year (`ETAK_PLACES[..].year`) and
  starting no earlier than its origin's own settlement, so voyages unfold chronologically. Era
  buttons fly the camera and play that era's years; landfalls open `ETAK_PLACES` cards; Hipour's
  1969 arc is a coda drawn only on the final era. Frames/readout/story-link are hidden; entry
  always opens on beat 0, the whole ocean.

## Helm mode

`const HELM = true` at the top of `app.js` is the current default entry: a stripped shell over
the machinery above, showing the boat and almost nothing else. Set it to `false` and everything
below reverts exactly — the full interface, the story on first visit, PUZZLE as the entry mode.

Nothing is removed to achieve this. `setMode('puzzle')` still runs at boot, every panel stays in
the DOM with its handlers live, and `enterHelm` only adds `helm` to `<body>`; `body.helm` in
`styles.css` hides the header, mode switch, frame picker, chooser, readout, new-voyage and birds
buttons, departure picker, and the scrubber, leaving the bar's play and speed. `body.helm.picking`
hides the bar too. Reintegration is a matter of choosing what to show again.

`helmPhase` runs `'select'` → `'sail'`:

- **select** — the voyage picker (`drawHelmPicker`), a chart branch in `draw()` alongside story
  and settlement. `HELM_PORTS` merges both gazetteers into one pick list; four names are in both
  (Puluwat, Lamotrek, Chuuk, Saipan) and `ETAK_ISLANDS` wins, its coordinates being the
  navigation ones. Caroline labels gate on `CFG.portZoom` since the cluster collides at ocean
  scale. `fitPorts` takes its zoom from the bounding box but its centre from the centroid —
  Saipan sits 8° north of the chain and centring the box shoves the dense cluster into a corner.
  Click home, then destination: the hovered leg previews with distance and duration, and the
  second click calls `startHelmVoyage`, which sets `A`/`B` (`C` stays null — no reference island
  in helm) and eases `b` toward the horizon.
- **sail** — the boat view plus `drawMiniMap`, a corner disc filling the same world-space
  `landPath` the chart does, through a `viewParams`-shaped object so `applyTransform` and
  `worldToScreen` apply unchanged. It carries the leg (dashed ahead, solid behind), the canoe,
  gazetteer marks for atolls too small to render at that scale, and a wedge for `CFG.fov` swung
  by `look`. Clicking it reopens the picker — the way back, without another button.

Two behaviours differ from the rest of the app, both because helm has no scrubber and no landfall
scoring to anchor to:

- **Sky time, not voyage fraction, is the clock.** `CFG.helmSkyRate` advances the sun and stars a
  fixed 0.75 h per real second at speed 1, so `t` moves at `helmSkyRate / legHours`. Helm legs run
  from 60nm to 4600nm; at a fixed fraction-per-second a three-week crossing would spin 36 days of
  sky through the same 33 seconds a day-long one gets.
- **Landfall stops the canoe, not the clock.** `afterHours` accumulates sailing time logged past
  `t = 1` and feeds `voyageMs`, so the sky keeps turning at the same rate instead of freezing.
  It resets with the voyage. Elsewhere `t >= 1` still stops playback, where the scrubber, the
  readout and the blind-passage scoring all depend on it.

The passage's candidate reference islands are not caret-drawn on the boat horizon under HELM:
they belong to whichever `ETAK_PASSAGES` entry was loaded at boot, and helm picks its own leg, so
sailing Taiwan→Aotearoa would otherwise draw three Caroline atolls 4000nm away.

A **story mode** overlays any of them: a six-beat walkthrough of the settlement of the Pacific
(`ETAK_STORY`; chronology sourced in `docs/sources.md` §4). While `story` is set, `draw()` swaps
the voyage layers for great-circle migration arcs (`drawArcs`/`drawArcLabels`, shared with
SETTLEMENT mode, which drives them from its own `settle` state) and `loop()` eases the camera
toward `camTarget`. Autoplays on first visit (localStorage `etakStorySeen`), replays from the
header button, exits via SKIP/ESC or the final SAIL hand-off into the puzzle. Skipped entirely
under HELM, which boots to its own picker instead.

`A`, `B`, `C` are `{lat,lon,name}` points. All navigation math is spherical (great-circle), so
bearings and etaks are correct regardless of the render projection.

## Architecture

`core.js` is one pure module (`EtakCore`); `app.js` is one IIFE organized top-to-bottom into
commented sections:

- **Core** (`gcBearing`, `gcDistNm`, `gcInterp`, `houseOf`, `boundariesFor`, `scoreFor`, plus
  `HOUSE`, `SWEET`, `verdictText`): `boundariesFor` samples the leg at N=2000 steps and records
  the `t` values where the house of the canoe→ref bearing changes — those boundary `t`s drive
  both the course ticks and the score. `scoreFor` combines count fitness (gaussian around
  `SWEET=6`) and evenness (1 − CV of segment lengths), 50/50, scaled to 100.
- **Puzzle** (`makePuzzle`): loads `ETAK_PASSAGES[passageIndex]` and scores each candidate live.
  Nothing is hand-tuned; the candidate *sets* are curated for a clear (or interestingly
  ambiguous) answer plus instructive traps (e.g. Satawal sits on the Puluwat→Lamotrek course
  line → its bearing barely moves). Coordinates live in `ETAK_ISLANDS` (`docs/sources.md` §3).
- **Projection + camera**: `project`/`unproject` are plain equirectangular in a Pacific-centered
  lon360 space (`x=lon360`, `y=−lat`). The camera (`cam.{cx,cy,zoom}`) supports
  wheel-zoom-to-cursor and drag-pan. Coastlines are built once into a world-space `Path2D`.
- **State**: `A,B,C` are the active leg/reference; `boundaries` and `live` (the current score)
  are recomputed by `recompute()` whenever the reference changes. `t` = voyage progress 0..1;
  `f` = frame crossfade; `mode`.
- **Rendering** (`draw`): a single canvas redrawn each rAF frame. `viewParams()` is the **single
  source** of the view transform; `applyTransform`, `worldToScreen`, and `screenToWorld` all
  derive from it and must stay mutual inverses — **change one, change all.** `draw()` computes
  per-frame values once and delegates to named layer functions in paint order: `drawSky` →
  `drawOcean` → world pass under `applyTransform` (`drawCoast`, `drawRangeRings`, `drawCourse`,
  `drawTrails`, `drawRose`, `drawBearings`, `drawCanoe`) → screen pass (`drawGazetteer`,
  `drawMarkersAndLabels`, via `worldToScreen`, so text stays crisp and upright at any zoom). A
  new visual feature should be a new layer function slotted into that order. Screen-constant
  sizes are `pixels / v.Z` in world units.
- **Loop**: `requestAnimationFrame(loop)` advances `t` when playing and eases `f` toward `fTarget`.

## Editing conventions here

- DOM ids/classes live in `index.html`/`styles.css` and are wired to `getElementById` calls in
  `app.js`. Changing an id means updating both places.
- All colors are CSS custom properties in `:root` (`styles.css`), read once into the `PAL` object;
  canvas code references `PAL.*` (with `hexA(hex, alpha)` or an `'88'`-style suffix for
  translucency). Add or change colors in `:root`, not in the drawing code.
- Tuning constants live in `CFG` (top of `app.js`). Put new magic numbers there, not inline.
- The readout only rewrites its `innerHTML` when the composed string changes (`lastReadout`), and
  per-leg values (`legNm`) are cached in `recompute()` — don't reintroduce per-frame DOM writes
  or recomputation of leg constants.
- Regenerate `map-data.js` and `stars.js` only via their `tools/` scripts; never hand-edit.
- `reduceMotion` (prefers-reduced-motion) gates the frame-ease speed; preserve it.
