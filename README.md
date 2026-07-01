# Etak

An interactive canvas visualization of Micronesian star-path (*etak*) navigation.

A canoe sails a straight leg from home to destination while a **reference island** sits off to
the side. As the canoe advances, the bearing to that island sweeps across the 32-point sidereal
star compass — and each time it crosses into a new star "house" (an 11.25° wedge), it marks an
**etak**, dividing the voyage into legs. A well-placed reference island produces a handful of
even, easy-to-feel etaks; a poorly-placed one gives too few divisions or a confetti of tiny ones.

The visualization renders the same voyage in **two reference frames**:

- **Chart** — the canoe moves, the islands are fixed (the outside map view).
- **Navigator** — the canoe is fixed and the islands drift past, the way the etak system is
  actually held in the mind.

## Modes

- **Puzzle** — four candidate reference islands; choose the one that best segments the voyage.
  A live score rates each on etak *count* and *evenness*.
- **Sandbox** — drag a single reference island and watch how its position reshapes the etaks.

## Running

Zero dependencies, no build step. Open `src/index.html` in a browser, or serve the directory
statically:

```sh
python3 -m http.server --directory src
```

(Typography loads from Google Fonts, so a network connection gives the intended look.)
