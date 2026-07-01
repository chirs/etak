# Roadmap


## Refactor index.html

- [x] Split the single `src/index.html` into separate HTML, CSS, and JS files (`index.html`, `styles.css`, `core.js`, `app.js`)
- [x] Extract the pure geometry/scoring core (`bearing`, `houseOf`, `boundariesFor`, `scoreFor`) into its own module — `core.js`, exposed as `EtakCore`
- [x] Single source of truth for the palette — canvas colors now read from the `:root` custom properties via the `PAL` object in `app.js`


## Gather etak documents

- [ ] Gladwin, *East Is a Big Bird* (Puluwat navigation) — the primary etak account
- [ ] Lewis, *We, the Navigators* — comparative Pacific wayfinding
- [ ] Collect the star-compass house names and the reference-island ("etak of birds" / "of sighting") terminology

> Sources mostly survive as scanned books rather than clean references; the in-app star and
> island names are placeholders pending real citations.


## Use real maps

- [ ] Replace the procedurally generated blobs with actual Caroline Islands geography
- [ ] Real inter-island bearings and distances for a chosen sailing passage (e.g. Puluwat → Satawal)
- [ ] Overlay the sidereal compass on a real chart so the etaks land on true reference islands
