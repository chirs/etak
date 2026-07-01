# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Etak is a zero-dependency interactive canvas visualization of Micronesian star-path ("etak")
navigation. There is no build step, package manager, or test suite. The app is four files in `src/`:

- `index.html` — markup only; links the stylesheet and the two scripts (`core.js` then `app.js`).
- `styles.css` — all CSS, including the `:root` color tokens (the single source of truth for the palette).
- `core.js` — the pure geometry/scoring core, exposed as the global `EtakCore` (no DOM, no canvas).
- `app.js` — everything else: puzzle/sandbox state, canvas rendering, UI wiring, the rAF loop.

Scripts are plain classic `<script>` tags (not ES modules) so `src/index.html` still works opened
directly over `file://`. Load order matters: `core.js` defines `EtakCore` before `app.js` consumes it.

To run it: open `src/index.html` in a browser, or serve the directory (`python3 -m http.server
--directory src`). Fonts load from Google Fonts, so a network connection is needed for the intended typography.

## Domain concepts (needed to make sense of the code)

The premise: a canoe sails a straight leg from HOME (`A`) to DESTINATION (`B`). A **reference
island** (`C`) sits off to the side. As the canoe advances, the *bearing* from canoe→reference
sweeps across the 32-point sidereal "star compass" (each point is a `HOUSE = 11.25°` wedge).
Each time the bearing crosses into a new star house, that marks an **etak** boundary —
segmenting the voyage into legs. A good reference island produces ~6 evenly-spaced etaks.

Two **reference frames** render the *same* voyage, cross-faded by `f` (0=chart, 1=navigator):
- **CHART** (`f=0`): canoe moves, islands fixed — the outside/map view.
- **NAVIGATOR** (`f=1`): canoe fixed at center, islands drift past and the world rotates −90° —
  the Etak mental model where the reference island "moves."

Two **modes**:
- **PUZZLE**: 4 generated candidate islands; pick the one that best segments the voyage. Score panel + chooser visible.
- **SANDBOX**: one draggable reference island; free exploration.

## Architecture

`core.js` is one pure module (`EtakCore`); `app.js` is one IIFE organized top-to-bottom into
commented sections. Key pieces and their coupling:

- **Geometry / scoring core** (`core.js`: `bearing`, `houseOf`, `boundariesFor`, `scoreFor`, plus
  `HOUSE`, `SWEET`, `lerp`, `verdictText`): pure functions over `A`, `B`, `ref`, with no DOM or
  canvas dependency. `boundariesFor` samples the leg at N=2000 steps and records the `t` values
  where the star house changes — these boundary `t`s drive both the ticks drawn on the course and
  the score. `scoreFor` combines *count fitness* (gaussian around `SWEET=6` etaks) and *evenness*
  (1 − coefficient of variation of segment lengths), 50/50, scaled to 100. `app.js` pulls what it
  needs from `EtakCore` via a destructuring line at the top.
- **Puzzle generation** (`makePuzzle`): deterministic LCG (`rnd`, seeded from `Date.now()`).
  Deliberately builds one strong candidate, two traps (in-line-with-course → too few etaks;
  too-close-abeam → confetti of tiny etaks), and one middling. Then shuffles.
- **State**: `A,B,C` are the *active* leg/reference; `boundaries` and `live` (the current score
  object) are recomputed by `recompute()` whenever the reference changes (choice or drag).
  `t` = voyage progress 0..1; `f` = frame crossfade; `mode`.
- **Rendering** (`draw` → `worldTransform`, `drawIslandShape`, `drawRose`): a single canvas
  redrawn each rAF frame. `worldTransform` applies the frame crossfade (translate/rotate/scale)
  so all world-space drawing is frame-agnostic. `screenToWorld` is its inverse, used only for
  sandbox dragging — **if you change `worldTransform`, update `screenToWorld` to match.**
- **Loop**: `requestAnimationFrame(loop)` advances `t` when playing and eases `f` toward `fTarget`.

## Editing conventions here

- DOM ids/classes live in `index.html`/`styles.css` and are wired to `getElementById` calls in
  `app.js`. Changing an id means updating both places.
- **Palette single source of truth**: all colors are CSS custom properties in `:root` (`styles.css`),
  including canvas-only tokens (`--course`, `--tick`, `--rose-ring`, `--rose-minor`, `--ghost`,
  `--island`, `--ref-fill`, `--dim`). `app.js` reads them once via `getComputedStyle` into the `PAL`
  object; canvas code references `PAL.*` (with `hexA(hex, alpha)` or a `'88'`-style suffix for
  translucency). Add or change a color in `:root`, not in the drawing code.
- `worldTransform` (in `app.js`) applies the frame crossfade; `screenToWorld` is its inverse and is
  used for sandbox dragging — if you change one, update the other.
- `reduceMotion` (prefers-reduced-motion) gates star twinkle and frame-ease speed; preserve it.
