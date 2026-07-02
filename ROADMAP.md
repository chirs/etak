# Roadmap

> Myth watchlist to keep out of the app: "*etak* = refuge", "compass = 32 *stars*" (it's 32
> *points* from ~15 stars), and Gladwin's "big bird" gloss of Altair (a mistranslation — see
> Holton et al. 2015). Details and citations in `docs/sources.md`.


## Intermezzo

- [x] Reduce maximum zoom out to full screen
- [ ] UI redesign - unify, less messy
- [x] Clickable star labels (info? distance? names?)
- [ ] Constellations
- [ ] **Authentic canoe** — collect reference drawings/photos of the real boats (the Carolinian
      proa: single outrigger, crab-claw sail, double-ended shunting hull) into `docs/`, then
      reshape the boat-view hull silhouette to match — is a generic yacht bow even right?
- [x] Make ocean prettier - mesh, pseudo-waves
- [ ] Voyage picker!


## Second act — from simulator to game

The simulator is built. What's missing is a game that makes the player *use* it — the puzzle
is one multiple-choice guess, and the boat view (the whole point) carries no gameplay.

- [ ] **The blind passage** — the core loop. After choosing a reference island you *sail* it:
      boat view only — no chart, no scrubber, no progress % — watching the reference caret slip
      house to house. At unpredictable moments the navigator's question comes: *which etak are
      we in? how far to landfall?* Scored by error. Makes the island choice consequential and
      the sky load-bearing.
- [ ] **Landfall as the win condition** — the player calls *etak of birds* when they believe
      they've entered the destination's ~18 mi ring; land shows on the boat-view horizon only
      once truly inside sighting range — the range rings become the payoff
- [ ] **The apprenticeship** — wrap the passages in a progression with escalating blindness
      (chart → glances → boat-only), ending in a *pwo*-style title
- [ ] **Progress persistence** — localStorage record of passages done per blindness level
      (same pattern as `etakStorySeen`)
- [ ] *Stretch:* **steer by the stars** — at each etak boundary, confirm the heading by picking
      the right star house from the boat view; wind/leeway drift pushes the canoe off-course
      and the reference island's bearing betrays it (needs a small drift model in the core)


## Settlement explorer polish

- [ ] **Era list follows the timeline** — while the years play, highlight the era the current
      year sits in and swap the card as playback crosses era boundaries (today the card stays
      on whatever was last clicked)
- [ ] **Label declutter by zoom** — the Carolines cluster collides at whole-ocean zoom; gate
      the dates (or whole labels) by zoom the way the rose gates its 32 names
- [ ] **Islands clickable in puzzle/sandbox** — same hit-test over `ETAK_ISLANDS`; needs
      blurbs written for the Caroline gazetteer
- [ ] **Reefs and lagoons** — the atolls render as bare islets; OSM has `natural=reef`
      polygons, so a faint reef rim would make Chuuk's lagoon and the low atolls read as
      atolls (extend the Overpass query in `tools/build_map.py`)
- [ ] *Consider:* **fold the first-visit story into the settlement tab** — the modal
      walkthrough and the timeline now tell the same story twice; autoplaying the timeline
      with the era cards could replace the overlay entirely


## Deeper sky

- [ ] **Hipparcos/HYG star field** — Yale BSC tops out at ~9,100 stars; HYG carries ~120k
      (enough for 15k+ field stars) and has an `hr` column, so the compass-star mapping in
      `tools/build_stars.py` carries over


## Done

- [x] **Refactor** — split the monolith into `index.html`/`styles.css`/`core.js`/`app.js`;
      pure spherical core exposed as `EtakCore`; palette single-sourced in `:root`
- [x] **Sources** — Gladwin, Lewis, Goodenough & Thomas gathered and fact-checked into
      `docs/sources.md`, incl. the full 32-point compass with Carolinian names
- [x] **Real maps** — Natural Earth coastlines + real gazetteer; great-circle math throughout;
      documented legs as puzzles
- [x] **Real puzzle** — candidate scores hidden until a choice is made
- [x] **Named stars** — Carolinian house names in the readout and on the rose; east-up
      orientation made the only orientation
- [x] **Etak stages** — boundary ticks on the scrubber; bird/sighting range rings
- [x] **Boat view** — first-person horizon frame with the real Yale BSC sky, procedural Milky
      Way, Moon phase + naked-eye planets, sailing-time rotation, departure picker
- [x] **Settlement story** — six-beat onboarding walkthrough on the chart; autoplays once,
      replayable, hands off into the puzzle
- [x] **More passages** — Satawal→Pikelot turtle run, Satawal→West Fayu, and Pikelot→Saipan
      (Hipour's 1969 revival)
- [x] **Settlement tab** — persistent explorer mode: `ETAK_PLACES` gazetteer with clickable
      landfall cards, era selector, and a year timeline (~2350 BCE → 1250 CE) that plays the
      expansion in true chronological order; completed voyages stay as amber traces
- [x] **Map data quality** — mid-detail boxes for the story landfalls; OSM/Overpass coastlines
      for the six atolls absent from every Natural Earth dataset; coarse-region fidelity
      raised to ~1.7 km edges and ~24 km² floor (filtered on true pre-simplification area)
