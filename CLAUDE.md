# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Etak is a single-file, zero-dependency interactive canvas visualization of Micronesian
star-path ("etak") navigation. The entire app — HTML, CSS, and JS — lives in `src/index.html`.
There is no build step, package manager, test suite, or git repository.

To run it: open `src/index.html` in a browser (or serve the directory statically). Fonts load
from Google Fonts, so a network connection is needed for the intended typography.

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

## Architecture (all in the one IIFE in `src/index.html`)

The code is organized top-to-bottom into commented sections. Key pieces and their coupling:

- **Geometry / scoring core** (`bearing`, `houseOf`, `boundariesFor`, `scoreFor`): pure functions
  over `A`, `B`, `ref`. `boundariesFor` samples the leg at N=2000 steps and records the `t`
  values where the star house changes — these boundary `t`s drive both the ticks drawn on the
  course and the score. `scoreFor` combines *count fitness* (gaussian around `SWEET=6` etaks) and
  *evenness* (1 − coefficient of variation of segment lengths), 50/50, scaled to 100.
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

- It's one file; DOM ids/classes in the top HTML+CSS are wired to `getElementById` calls at the
  bottom. Changing an id means updating both places.
- Colors are CSS custom properties in `:root`, but the canvas drawing code uses hard-coded hex
  literals (canvas can't read CSS vars) — many duplicate the `:root` values. Keep them in sync by hand.
- `reduceMotion` (prefers-reduced-motion) gates star twinkle and frame-ease speed; preserve it.
