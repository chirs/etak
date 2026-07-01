# Roadmap


## Refactor index.html

- [ ] Split the single `src/index.html` into separate HTML, CSS, and JS files
- [ ] Extract the pure geometry/scoring core (`bearing`, `houseOf`, `boundariesFor`, `scoreFor`) into its own module
- [ ] Single source of truth for the palette — drive canvas colors from the `:root` custom properties instead of duplicated hex literals

> Currently everything lives in one IIFE, and the canvas hard-codes hex values that shadow the
> CSS variables. Both have to be kept in sync by hand.


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
