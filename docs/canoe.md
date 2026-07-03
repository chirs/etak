# Carolinian sailing canoe — form reference

What the real boat looks like, gathered to drive the **"Authentic canoe"** roadmap item: the
boat-view hull silhouette (`drawBoatView` in `src/app.js`) is currently a generic yacht bow, and
this is the reference for reshaping it. Same house style as `sources.md` — each claim tagged:

- **[verified]** — stated in a primary/academic source (see Sources) and cross-checked.
- **[caution]** — attested but thinly sourced, or a detail that varies island to island.
- **[myth]** — commonly shown but wrong; do not reproduce.

> Scope note: this is a *form* document (what the vessel looks like), a companion to `sources.md`
> (which covers the star compass and the etak method). It is written from the standard literature;
> the actual construction plates and photos to trace still need to be dropped into `refs/` — see
> §6. Indigenous part-names are deliberately left to the primary sources rather than guessed.


## 1. The vessel

**[verified]** The boat in this app is the **Carolinian single-outrigger voyaging canoe** (Puluwatese
/ Satawalese **_waa_**) — the ocean-going proa of the central Caroline outer islands (Puluwat,
Satawal, Lamotrek, Woleai). Gladwin's Puluwat fieldwork describes and measures these directly; the
app's canoe speed (**5.3 kn**, `CFG.canoeKn`) is his measured figure — see `sources.md` §3.

**[verified]** It is a **proa**, not a symmetric double-canoe: **one hull + one outrigger float**,
the float always carried to **windward**. Three features define its look, and all three should read
in silhouette:

1. a **double-ended, upswept-endpiece hull** (§2),
2. a single **outrigger float on booms** off to one side (§3),
3. an **Oceanic-lateen "crab-claw" sail** (§4).

**[myth]** It is **not** a Western hull: no rounded yacht bow, no transom stern, no keel fin, no
jib/mainsail Bermuda rig. The current boat-view bow is a placeholder to replace.


## 2. Hull

- **[verified] Double-ended and symmetric fore-and-aft.** Bow and stern are interchangeable so the
  canoe can **shunt** rather than tack: to change tack the crew walks the whole rig to the far end,
  the old stern becomes the new bow, and the float stays to windward throughout. There is no fixed
  "front."
- **[verified] Transversely asymmetric.** The **windward (outrigger) side is flatter**, the **lee
  side more rounded/bellied**. Sailing, this asymmetry makes the hull develop lift to windward and
  resist leeway — a foil, not just a float. (Classic Micronesian "flying-proa" hull; Haddon &
  Hornell.)
- **[verified] Raised, pointed endpieces.** The hull is a deep, narrow rounded-V dugout base built
  up with sewn washstrakes; the two ends **sweep up to a point** in carved endpieces — the single
  most recognizable profile cue. Not a smooth convex bump.
- **[caution] Build & decoration.** Planks lashed with coconut **sennit**, caulked with breadfruit-sap
  putty; **no metal**. Hull commonly dark/blackened with **white and red endpieces**, sometimes
  cowrie shells or streamers at the tips. Exact decoration varies by island and era.
- **[caution] Size.** Outer-island voyaging canoes run roughly **6–8 m** (~20–26 ft) on the hull;
  Gladwin gives specifics for Puluwat. Treat any single number as approximate.


## 3. Outrigger (float + booms)

- **[verified] One float, to windward.** A shaped **solid log**, shorter than the hull and **pointed
  at both ends**, riding parallel to the hull a few metres out on the **weather** side. Which side
  that is depends on the current tack; for a given leg it is fixed.
- **[verified] Two main booms + connective struts.** Two transverse **booms** arch from the hull
  gunwale out and down to the float; the float is joined to the boom-ends not directly but through a
  small network of short **stanchion struts** pegged into the log (Micronesian "indirect" / stick
  attachment). This strut cluster is visible and distinctive up close.
- **[caution] Lee platform.** A light **platform** is often built across the booms or on the lee
  side for cargo, crew, and sometimes a hearth or low shelter — where the navigator and passengers
  sit. This is roughly the app's eye-point.


## 4. Rig — the crab-claw sail

- **[verified] Oceanic lateen ("crab-claw").** A **triangular** sail set on **two spars** — a lower
  **boom** and an upper **yard** — lashed together at the **tack**, a low point footed at the **bow
  end**. From the tack the two spars **splay upward and aft** in a narrow V; the free third edge
  (the leech) **curves** between the spar tips — the "claw." The sail is woven **pandanus matting**.
- **[verified] Short raked mast, and the shunt.** A short mast stepped near midships supports the
  yard; the tack is held forward at the bow. To shunt, the entire spars-and-sail assembly is lifted
  and **carried to the other end** and re-footed. There is no boom sweeping a fixed cockpit.
- **[caution]** Rig proportions and stay arrangement vary; trace from a plate rather than inventing
  the exact spar angles.


## 5. Silhouette cheat-sheet (for `drawBoatView`)

Translating the form above into the boat view's first-person azimuth frame (gaze centered on the
heading; `azX(az)` maps an azimuth to screen x). What the sitter on the lee platform actually sees:

- **Forward hull / bow** — anchored at the **heading** azimuth, at the screen bottom: the deck lines
  narrow away and **sweep up to a single raised, pointed endpiece**. Replace the symmetric convex
  bump with this upswept point. Occludes the swell (no water through the hull).
- **Outrigger** — off to **one fixed side (≈90° from heading)**, appearing only when the gaze swings
  abeam: a **long low float** on the near water, its two **booms arching down** from the near gunwale,
  the little **strut cluster** where they meet the log. Pick the windward side and keep it consistent
  for the leg.
- **Crab-claw sail** — a tall **narrow triangle on two splayed spars** rising from the bow area,
  prominent above the horizon when looking forward. *Caveat:* the boat view's whole point is the real
  sky, so a sail large enough to be authentic will occlude stars — hint it, or make it a thin outline,
  or gate it. This is the open design question for the reshape.
- **Eye-point** — low, ~1–1.5 m above the water, on the lee platform amidships.

Open decisions the reshape must make (were surfaced to the user, not yet answered): how much of the
boat to draw (prow only / prow + outrigger / full rig), and whether/how to show the sail without
burying the sky.


## 6. Reference imagery

**A starter set of free-licensed images is now in `refs/canoe-images/`** — ten public-domain / CC
photos and engravings of Pacific proas (Caroline, Marshall, Yap, Fiji), with per-file attribution
in `refs/canoe-images/CREDITS.md`. Highlights for the reshape:

- **`choris-caroline-islands-boat.jpg`** — Choris' c.1822 Caroline plate, in **two views**:
  broadside (crab-claw sail, upswept endpieces, deck shelter) *and* end-on (outrigger float,
  booms, asymmetric hull). The single best silhouette reference.
- **`satawal-canoe-sesario-sawralur.png`** — a modern Satawal _waa_ under sail; the actual target
  vessel, and roughly the aboard eye-level of the boat view.
- **`fijian-drua-*`**, **`marshall-*`** — clean crab-claw and outrigger forms for cross-checking.

None of the three PDFs already in `refs/` cover canoe *construction* — they are navigation/astronomy
sources. For measured lines to trace precisely, the canonical references still worth adding:

- **Haddon, A.C. & Hornell, J. *Canoes of Oceania,* Vol. I (Micronesia).** Bishop Museum, 1936. —
  **the** measured lines, plates, and construction drawings of Carolinian outrigger canoes. Primary
  target for tracing the hull and outrigger.
- **Gladwin, *East Is a Big Bird* (1970).** — photos and description of the Puluwat _waa_ in use;
  already cited in `sources.md`, full text on archive.org.
- **Alkire, W. *Coral Islanders* / Lamotrek ethnography.** — outer-island canoe context.
- **Modern documentation** of the revived Satawal/Puluwat canoes and of Mau Piailug's vessels
  (and the Hōkūleʻa lineage they informed) — good photographic reference for the crab-claw rig and
  sennit lashing under sail.

Until real plates are in `refs/`, §2–§5 are a knowledge synthesis, not a trace — treat the exact
spar angles, endpiece carving, and dimensions as **[caution]**.


## Sources

- **Haddon & Hornell. *Canoes of Oceania,* Vol. I.** Bishop Museum Special Pub. 27, 1936.
- **Gladwin, Thomas. *East Is a Big Bird.*** Harvard Univ. Press, 1970 — see `sources.md`.
- **Lewis, David. *We, the Navigators.*** ANU Press, 1972 — voyaging canoes in use.
- General Micronesian proa / asymmetric-hull background: standard Oceanic small-craft literature.

See `sources.md` for the navigation sources and the shared `refs/` PDFs.
