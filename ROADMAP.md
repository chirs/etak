# Roadmap


## Refactor index.html

- [x] Split the single `src/index.html` into separate HTML, CSS, and JS files (`index.html`, `styles.css`, `core.js`, `app.js`)
- [x] Extract the pure geometry/scoring core (`bearing`, `houseOf`, `boundariesFor`, `scoreFor`) into its own module — `core.js`, exposed as `EtakCore`
- [x] Single source of truth for the palette — canvas colors now read from the `:root` custom properties via the `PAL` object in `app.js`


## Gather etak documents

Findings collected in [`docs/sources.md`](docs/sources.md) (fact-checked, confidence-tagged).

- [x] Gladwin, *East Is a Big Bird* (Puluwat navigation) — the primary etak account (full text located)
- [x] Lewis, *We, the Navigators* — comparative Pacific wayfinding (full text located)
- [x] Reference-island terminology — etak method, "etak of birds" / "of sighting", relative frame
- [x] **Full 32-point star-compass** — transcribed from Goodenough & Thomas (1987), Fig. 2, with Puluwat/Satawal star names + computed azimuths (see `docs/sources.md` §1)

> Myth watchlist to keep out of the app: "*etak* = refuge", "compass = 32 *stars*" (it's 32
> *points* from ~15 stars), and Gladwin's "big bird" gloss of Altair (a mistranslation — see
> Holton et al. 2015). Details and citations in `docs/sources.md`.


## Use real maps

- [x] Replace the procedurally generated blobs with actual Caroline Islands geography
      (`src/passages.js` gazetteer; Natural Earth coastlines in `src/map-data.js`)
- [x] Real inter-island bearings and distances for chosen sailing passages — the core is now
      spherical (great-circle) and puzzle mode runs documented legs (Puluwat→Chuuk with Pisaras,
      Satawal→Lamotrek, Puluwat→Lamotrek)
- [x] Overlay the sidereal compass on a real chart so the etaks land on true reference islands
      — the app draws a zoomable whole-Pacific chart with the rose over the live canoe position


## Make the puzzle a real puzzle

- [x] Hide candidate scores until a choice is made — right now the chooser shows every score up
      front, so there is nothing to guess. Pick first, then reveal all four scores + the verdict.


## Name the stars

The full 32-point compass (Carolinian names + azimuths) is already transcribed in
`docs/sources.md` §1 — the app currently uses only the four cardinal labels.

- [x] Name the current star house in the readout — e.g. "house 6/32 — *tan* Máán (Vega rising)"
      instead of a bare index; use the *tan*/*tubul* rising/setting prefixes
- [x] Label the rose points with the real star names (all 32 when zoomed / the current house
      always; respect the myth watchlist — Mailap, not "big bird")
- [x] *Stretch:* east-up compass orientation option — Carolinian navigators anchor the compass on
      Altair with east at the top; touches `viewParams()`, so all three transform functions move together
      — made east-up the *only* orientation (both frames); the f crossfade now blends centering only


## Show the etak stages

- [x] Etak strip on the scrubber — mark the boundary `t`s along the progress bar so segmentation
      evenness is legible at a glance (the scrubber becomes the lesson)
- [x] Bird/sighting range rings — faint ~18 mi rings around home and destination on the chart, so
      "etak of birds" / "of sighting" in the readout visibly correspond to something physical


## View from the boat

A third frame alongside CHART and NAVIGATOR: what the navigator actually sees.

- [x] Horizon view from the canoe — horizon band with the star houses arrayed along it, the
      reference island's bearing point sliding across them as the voyage advances (each etak
      boundary = it slips to the next house); destination/home direction marked
- [x] Decide how it joins the frame toggle — CHART↔NAVIGATOR crossfade by `f` blends one world
      transform, but the boat view is a different projection entirely, so it is likely a discrete
      third state (fade to black / cut) rather than a blend — implemented as a third button that
      fades through `PAL.night` on an eased `b`, drawn as a pure screen-space layer
- [x] Real star map — Yale BSC catalog (`tools/build_stars.py` → `stars.js`) + `altAz`/`riseAz`
      in the core; the boat-view sky rotates with sailing time at Gladwin's 5.3 kn, the compass
      type-stars carry their Carolinian names, and the current house's star glows amber
- [x] The sky before civilization — the whole Yale BSC as the field, atmospheric extinction
      toward the sea line, a procedural Milky Way (galactic dust + glow, Great Rift), and the
      wanderers: the Moon with its true phase and the five naked-eye planets (Schlyter
      low-precision ephemerides in `core.js`, tested against JPL Horizons fixtures)
- [ ] Look into the Hipparcos-based HYG database (github.com/astronexus/HYG-Database) for a
      denser star field — the full Yale BSC tops out at ~9,100 stars (V ≤ 7.96); HYG carries
      ~120k, enough for 15k+ field stars if the sky should deepen further (HYG has an `hr`
      column, so the compass-star HR mapping in `build_stars.py` would carry over)


## Onboarding — the settlement story

- [x] Six-beat story mode on the real chart: the Austronesian expansion (out of Taiwan →
      Marianas → Lapita → the far corners of the triangle) and the westward filling of the
      Carolines, ending on Hipour's 1969 revival and the hand-off into the puzzle —
      `ETAK_STORY` (`passages.js`), chronology fact-checked in `docs/sources.md` §4;
      autoplays on first visit, replayable from the header, SKIP/ESC to exit


## More passages

- [x] Add the near-free legs — the gazetteer already has the islands (e.g. Puluwat→Pikelot,
      Satawal→West Fayu, a documented turtle-hunting run); curate candidate sets with one clear
      answer + instructive traps, as before — added Satawal→Pikelot (turtle run) and
      Satawal→West Fayu (Lamotrek/Elato near-twins)
- [x] Research one longer documented voyage (e.g. the 1970s revival sailings toward Saipan) —
      needs new gazetteer coordinates sourced into `docs/sources.md` §3, and possibly wider chart
      bounds (`tools/build_map.py` constants + regenerate) — added Pikelot→Saipan (Hipour's 1969
      revival, Lewis *JPS* 79(4) 1970); Saipan was already inside the chart bounds, no regen needed


## Pacific islands explorer

- [x] **SETTLEMENT tab** next to PUZZLE/SANDBOX — the settlement story as a persistent,
      explorable mode: migration arcs over the chart, an era selector (the six beats), free
      pan/zoom; the modal walkthrough stays as the first-visit intro / ⟲ replay
- [x] **Clickable landfalls** — every story waypoint promoted to `ETAK_PLACES` (name, date,
      sourced blurb); click a place dot for its info card, ✕ back to the era card
- [x] **Year timeline** — the bar becomes a time slider (~2350 BCE → 1250 CE, numeric
      `year` per place); arcs grow toward their landfall year, gated on their origin's own
      settlement so voyages run in true chronological order; play/scrub the whole expansion,
      era buttons play just their era's years; slider at the end = every connection at once
- [ ] Islands clickable in puzzle/sandbox too (same hit-test over `ETAK_ISLANDS`; needs
      blurbs for the Caroline gazetteer)
- [ ] Label collision at minimum zoom — the Carolines cluster overlaps when the whole
      ocean is framed; gate dates (or labels) by zoom the way the rose does
- [x] Coastlines for the missing atolls — Satawal, Lamotrek, West Fayu, Elato, Pikelot, and
      Gaferut had no land in the chart: Natural Earth has **no geometry for them in any
      dataset** (`ne_10m_minor_islands` evaluated 2026-07: zero coverage, and its only
      in-chart rings duplicate `ne_10m_land`) — fetched their coastline ways from OSM via
      the Overpass API instead (`OSM_ATOLLS` in `tools/build_map.py`, response cached in
      `tools/osm_atolls.json`); every `ETAK_ISLANDS` entry now has land within ~0.08°


## Second act — from simulator to game

The simulator is built: real chart, real sky, real passages, the settlement story. What's
missing is a game that makes the player *use* it — right now the puzzle is one multiple-choice
guess, and the boat view (the whole point) carries no gameplay at all.

- [ ] **Publish** — GitHub Pages serving `src/` so people can actually sail it (site becomes
      public; enable Pages, no build step needed)
- [ ] **URL state / permalinks** — encode passage, mode, `t`, and frame in the hash so a
      shared link lands on "look at this moment" and a refresh doesn't reset to the story;
      pairs with Publish
- [ ] **The blind passage** — the core loop. After choosing a reference island you *sail* it:
      boat view only — no chart, no scrubber, no progress % — watching the reference caret slip
      house to house. At unpredictable moments the navigator's question comes: *which etak are
      we in? how far to landfall?* Scored by error. Makes the island choice consequential (pick
      the bad reference and you are genuinely lost — the actual lesson) and makes the sky
      load-bearing.
- [ ] **Landfall as the win condition** — the blind passage ends the way the real voyage
      does: the player calls *etak of birds* when they believe they've entered the
      destination's ~18 mi ring, and land shows on the boat-view horizon only once truly
      inside sighting range — the range rings stop being decoration and become the payoff
- [ ] **The apprenticeship** — wrap the passages in a progression with escalating blindness
      (first voyage keeps the chart, later ones allow glances, the last is boat-only), ending
      in a *pwo*-style title. Cheap meta-structure once the blind passage exists.
- [ ] **Progress persistence** — localStorage record of which passages are done at which
      blindness level, so the apprenticeship survives a refresh (same pattern as
      `etakStorySeen`)
- [ ] *Stretch:* **steer by the stars** — at each etak boundary, confirm the heading by picking
      the right star house from the boat view; wind/leeway drift pushes the canoe off-course and
      the reference island's bearing is what betrays it (needs a small drift model in the core)
- [ ] Touch/mobile pass — everything is desktop-first; check story cards, boat-view drag, and
      the chooser on a phone
- [ ] Hipparcos/HYG sky deepening (see the item under *View from the boat* above)
