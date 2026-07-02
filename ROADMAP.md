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

- [ ] Replace the procedurally generated blobs with actual Caroline Islands geography
- [ ] Real inter-island bearings and distances for a chosen sailing passage (e.g. Puluwat → Satawal)
- [ ] Overlay the sidereal compass on a real chart so the etaks land on true reference islands
