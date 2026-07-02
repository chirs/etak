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
- [ ] *Stretch:* east-up compass orientation option — Carolinian navigators anchor the compass on
      Altair with east at the top; touches `viewParams()`, so all three transform functions move together


## Show the etak stages

- [x] Etak strip on the scrubber — mark the boundary `t`s along the progress bar so segmentation
      evenness is legible at a glance (the scrubber becomes the lesson)
- [x] Bird/sighting range rings — faint ~18 mi rings around home and destination on the chart, so
      "etak of birds" / "of sighting" in the readout visibly correspond to something physical


## View from the boat

A third frame alongside CHART and NAVIGATOR: what the navigator actually sees.

- [ ] Horizon view from the canoe — horizon band with the star houses arrayed along it, the
      reference island's bearing point sliding across them as the voyage advances (each etak
      boundary = it slips to the next house); destination/home direction marked
- [ ] Decide how it joins the frame toggle — CHART↔NAVIGATOR crossfade by `f` blends one world
      transform, but the boat view is a different projection entirely, so it is likely a discrete
      third state (fade to black / cut) rather than a blend


## More passages

- [x] Add the near-free legs — the gazetteer already has the islands (e.g. Puluwat→Pikelot,
      Satawal→West Fayu, a documented turtle-hunting run); curate candidate sets with one clear
      answer + instructive traps, as before — added Satawal→Pikelot (turtle run) and
      Satawal→West Fayu (Lamotrek/Elato near-twins)
- [x] Research one longer documented voyage (e.g. the 1970s revival sailings toward Saipan) —
      needs new gazetteer coordinates sourced into `docs/sources.md` §3, and possibly wider chart
      bounds (`tools/build_map.py` constants + regenerate) — added Pikelot→Saipan (Hipour's 1969
      revival, Lewis *JPS* 79(4) 1970); Saipan was already inside the chart bounds, no regen needed
