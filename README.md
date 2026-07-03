# Etak

An interactive canvas visualization of Micronesian star-path (*etak*) navigation, drawn over a
real, zoomable chart of the Pacific (Natural Earth coastlines, scroll to zoom, drag to pan).

A canoe sails a straight leg from home to destination while a **reference island** sits off to
the side. As the canoe advances, the bearing to that island sweeps across the 32-point sidereal
star compass — and each time it crosses into a new star "house" (an 11.25° wedge), it marks an
**etak**, dividing the voyage into legs. A well-placed reference island produces a handful of
even, easy-to-feel etaks; a poorly-placed one gives too few divisions or a confetti of tiny ones.

The visualization renders the same voyage in **three reference frames**:

- **Chart** — the canoe moves, the islands are fixed (the outside map view).
- **Navigator** — the canoe is fixed and the islands drift past, the way the etak system is
  actually held in the mind.
- **Boat** — the horizon from the deck: the real night sky (Yale Bright Star Catalog, Moon,
  naked-eye planets) turning with sailing time, star houses ticked along the horizon, rolling
  swell below it. Drag to look around; click a named compass star for its card.

## Modes

- **Puzzle** — a documented real passage (e.g. Puluwat → Chuuk, Gladwin's worked example) with
  four real Caroline Islands as candidate references; choose the one that best segments the
  voyage. A live score rates each on etak *count* and *evenness*. All bearings and distances are
  true great-circle values.
- **Sandbox** — drag a single hypothetical reference island and watch how its position reshapes
  the etaks.
- **Settlement** — the migration story as an explorable map: every voyage of the Pacific
  expansion on a year timeline (~2350 BCE → 1250 CE), with era flights and clickable landfalls.

## Running

Zero dependencies, no build step. Open `src/index.html` in a browser, or serve the directory
statically:

```sh
python3 -m http.server --directory src
```

(Typography loads from Google Fonts, so a network connection gives the intended look.)

## Tests

The spherical geometry/scoring core has a Node test suite (no dependencies):

```sh
node --test 'tests/**/*.test.mjs'
```

Sources for the passages, island coordinates, and star-compass points are documented in
[`docs/sources.md`](docs/sources.md); the form of the canoe itself (for the boat view) is in
[`docs/canoe.md`](docs/canoe.md), with reference imagery in `docs/refs/canoe-images/`.
