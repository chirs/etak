# Roadmap

> Myth watchlist to keep out of the app: "*etak* = refuge", "compass = 32 *stars*" (it's 32
> *points* from ~15 stars), and Gladwin's "big bird" gloss of Altair (a mistranslation — see
> Holton et al. 2015). Details and citations in `docs/sources.md`.


## Intermezzo

- [x] Reduce maximum zoom out to full screen
- [ ] UI redesign - unify, less messy
- [x] Clickable star labels (info? distance? names?)
- [ ] Constellations
- [ ] **Authentic canoe** — reshape the boat-view hull silhouette to match the real Carolinian
      proa (single outrigger, crab-claw sail, double-ended shunting hull) instead of the generic
      yacht bow. Form reference written up in `docs/canoe.md` (hull, outrigger, rig, plus a
      silhouette cheat-sheet for `drawBoatView`) and a starter set of PD/CC reference images in
      `docs/refs/canoe-images/`. Decided: full rig, **semi-transparent sail** (crisp spars, sheer
      cloth), outrigger on the **windward** side driven by a wind constant (~060° NE trades) so
      it's wind-ready. Still to do: measured construction plates (Haddon & Hornell — see §6) and
      the reshape itself.
- [x] Make ocean prettier - mesh, pseudo-waves
- [ ] Voyage picker!


## Second act — from simulator to game

The simulator is built. What's missing is a game that makes the player *use* it — the puzzle
is one multiple-choice guess, and the boat view (the whole point) carries no gameplay.

> Design intent for this section — thesis, core loop, the rules it must obey, and the
> concession list — is written up in **`docs/design.md`**. Read it before starting any item
> below; it constrains how they're built (notably **R1: no Western units in the interface**).

- [x] **The blind passage (v1)** — the core loop. SAIL THE PASSAGE commits to a reference island
      (chosen sight unseen — scores stay hidden until landfall) and sails it boat-view only: no
      chart, no scrubber, no progress %. At random moments the navigator asks *which etak are we
      in?*; errors are revealed only at landfall, in etaks (design.md R1), alongside the verdict.
      Still open from the original sketch: the *how far to landfall?* question variant, and any
      cost to attention (no drift yet, so watching the caret answers the question — see the watch
      mechanic and *steer by the stars* below).
- [x] **Landfall as the win condition (v1)** — during a blind leg a single CALL · ETAK OF BIRDS
      button declares "we are inside the ring"; the landfall card scores the call in etaks
      (early/dead on/late/never called). Any real island within `CFG.sightNm` now rises as a
      silhouette on the boat-view horizon at its true azimuth — in all boat-view use, so calling
      only once you *see* land is possible but self-penalizing. No birds rendered (deliberate:
      without drift they'd trivialize the call); the §6 search-the-expanded-target texture for a
      missed call is still open.
- [ ] **The apprenticeship** — wrap the passages in a progression with escalating blindness
      (chart → glances → boat-only), ending in a *pwo*-style title
- [ ] **Progress persistence** — localStorage record of passages done per blindness level
      (same pattern as `etakStorySeen`)
- [ ] *Stretch:* **steer by the stars** — at each etak boundary, confirm the heading by picking
      the right star house from the boat view; wind/leeway drift pushes the canoe off-course
      and the reference island's bearing betrays it. **The drift model is built** (core
      `driftTrack`: held-course integration under a per-voyage current, blind runs sail the
      lived track, landfall discloses the set in star-house terms, the true wake ghosts onto
      the chart afterward) — what remains is the steering *counter-mechanic*, and the watch
      mechanic that makes attention the price of correcting it


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

- [ ] **Day and night** — the boat view is permanently at night. Sailing time already advances
      the sky (`t · legNm / CFG.canoeKn` hours from `CFG.depart`), so the sun is computable from
      the same `EtakCore.altAz` machinery the stars use: solar position, sunrise/sunset,
      twilight bands, a daytime sky gradient, stars fading out through civil twilight.
      This is a **gameplay** fact, not just a visual one — by day the star compass is
      unavailable and the navigator holds course by sun and swell, which is the real
      technique and the natural source of accumulated drift. Sailing time and wall time must
      decouple explicitly — real legs run days, a playable leg runs minutes — but the rate is
      **player-controlled, not a constant**: see the *watch* mechanic in `docs/design.md` §8
      (keep watch = real time and tight steering; rest = fast time and uncorrected drift).
      Day/night is what gives that choice its rhythm, since the star compass is only up at night.
- [ ] **Hipparcos/HYG star field** — Yale BSC tops out at ~9,100 stars; HYG carries ~120k
      (enough for 15k+ field stars) and has an `hr` column, so the compass-star mapping in
      `tools/build_stars.py` carries over


## Other oceans (post-design-doc)

- [ ] **Region as mechanic, not reskin** — real geography everywhere (Caribbean, Mediterranean,
      Indian Ocean, Norse Atlantic), but each ocean taught a *different* real method, so a new
      region is a new verb set rather than new coastlines: etak and the sidereal compass in
      Micronesia, latitude sailing with the kamal in the Indian Ocean, coastal pilotage and
      periplus distances in the Mediterranean. `PACIFIC_MAP`/`STAR_MAP`/`ETAK_ISLANDS` would all
      need to become per-region datasets. Scope and sequencing to be settled in the design doc.


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
