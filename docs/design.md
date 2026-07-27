# Etak — game design

> Status: **design intent**, not a spec. This document decides *what kind of game this is* and
> what may and may not go in it. Implementation sequencing lives in `ROADMAP.md`; historical
> claims live in `docs/sources.md` and are cited here rather than restated.


## 1. The problem

The simulator works. The game does not.

What exists is a **god's-eye scoring quiz**: the chart shows labeled islands and the true course,
the player picks one of four reference islands, and a number out of 100 comes back. Everything
genuinely interesting — the etak frame shift, the boat view, the real sky — is decoration around a
multiple-choice question that the interface has already answered before it asks.

The diagnosis, stated plainly: **the app shows the player the thing the navigator cannot see.**


## 2. Thesis

> **Etak is a navigation simulator whose subject is not knowing where you are.**

The game is the gap between where the player *thinks* they are and where they *are*. Every mechanic
either widens that gap (drift, cloud, the guide star climbing out of use, daylight) or lets the
player narrow it (holding a house cleanly, reading etak, recognizing signs of land).

This is the one thing no shipped game does. The precedent survey (§3) turned up realistic sailing,
abstract navigation UIs, and one Hawaiian training sim — but nothing built on **etak's relative
reference frame**, where the canoe is held at rest and the world moves past it (`sources.md` §2).
That frame is the moat, and it is currently presented as a view toggle rather than as the thing the
player has to think in.


## 3. Precedents

What to take, and what to leave.

| Work | Take | Leave |
|---|---|---|
| **Kilo Hōkū VR** (UH Mānoa) — Hawaiian star compass in VR | Closest existing thing to this project. Its *drill* structure (name the house on demand) is a good warm-up exercise. | It is a training sim with no loop, no stakes, no failure. Being a good teaching tool did not make it a game. |
| **Sailwind** | Ships **no position HUD** — getting lost is a designed outcome. Instruments are period-real and skill is the player's, not the avatar's. Landfall verified against expectation. | The entire economy: cargo runs, money, upgrades, progression-by-purchase. Rejected on principle, not on balance. |
| **In Other Waters** | Proves an abstract navigation interface can carry a whole game. UI as thematic filter, not as overlay. | Its register — clinical, scientific, instrument-panel. Ours must read as pre-modern and Oceanic (see **R1**, §5). |
| **Return of the Obra Dinn** | **Commit-and-verify**: declare an answer, then find out. Knowledge is the progression; the player levels up, not the character. | The detective fiction. We are not importing deduction-as-genre — commit-and-verify is simply what navigating *is*. |
| **Windbound** | Landmark-and-silhouette navigation on the horizon. | Its lesson in the negative: realistic sailing without a reason to care became a chore. Fidelity is not motivation. |
| **Sunless Sea** | The crossing itself as the threat, rather than travel-as-filler between content. | Combat, terror meters, death spirals. |

**The engines we have ruled out are trade, combat, and mystery.** That leaves exactly one
motivation — the one the real navigators had:

> You are trying to reach a place you cannot see, and you might miss it.

Missing is real, recoverable, and dramatic without violence. No other genre gets to use *lost* as
its central failure state.


## 4. The core loop

One voyage. Target length **5–15 minutes** (see §8 on time).

1. **Departure.** Choose the star course (*wofanu*) and the etak island. This is today's puzzle —
   but it becomes a **bet the player lives with** for the next ten minutes instead of a graded
   answer. The score panel goes away.

2. **Steering.** Hold the rising or setting house. Two real complications, both already supported
   by the data:
   - the guide star **climbs out of usefulness** and the navigator switches to its `tan`/`tubul`
     partner — the reciprocal pairs are memorized precisely because of this (`sources.md` §1);
   - **by day there is no star at all**, and the course is held by sun and swell. Daylight is
     therefore the natural source of accumulated error, not a cosmetic state.

3. **Drift.** Current and leeway push the canoe sideways, invisibly. The player infers it from etak
   failing to advance as expected — never from a readout.

4. **Etak.** The reference island's bearing sweeping house to house is the **only** progress
   signal. Diegetic, authentic, and already built.

5. **Commit.** The player declares *etak of birds* — "we are inside the destination's ring." This
   is the Obra Dinn moment, and it is also literally what a navigator does.

6. **Landfall or search.** Land is not hit directly; the **expanded target** is hit — the bird
   range (~18 mi, `sources.md` §2), cloud over lagoon, swell refraction. Then either the island
   resolves on the horizon, or the search begins (§6).

Steps 2–4 run under the **watch mechanic** (§8): the player chooses continuously between keeping
watch (real time, tight steering, signs readable) and resting (time runs fast, drift accumulates
uncorrected). That choice, repeated, is what makes the middle of a voyage a game rather than a
wait.

**The output is not a score out of 100.** It is *how far off you were*, expressed in **houses and
etaks**.


## 5. Rules

Constraints that override convenience. If a proposed feature violates one, the feature is wrong.

- **R1 — No Western units in the interface.** Nothing may be expressible only in modern terms: no
  degrees, no latitude/longitude, no north-up, no nautical miles, no clock face. Units are
  **houses**, **etaks**, **nights**, **hand-spans**. This is the single rule that gives us In Other
  Waters' information density in an anti-modern register. (Internals stay spherical and metric —
  this is a rule about the *interface*, not about `core.js`.)

- **R2 — Real geography, always.** Real coordinates, real coastlines, real sky. No procedural
  archipelagos. This costs us discovery-as-replay-motivation, and that cost is accepted: the
  authenticity claim is what makes the project worth existing.

- **R3 — No economy, no combat, no levels.** Nothing is bought, killed, or upgraded. The canoe
  never gets faster. See §7 for what progression means instead.

- **R4 — Every mechanic traces to an attested technique or is marked as a concession.** Cite
  `sources.md`, or write the concession down in §8. Silent invention is how a project like this
  rots into folklore — the myth watchlist at the top of `ROADMAP.md` exists for the same reason.

- **R5 — Failure is being lost, never dying.** No drowning, no starvation, no game over.


## 6. Failure and recovery

The failure state is **uncertainty that has grown too large to resolve** — the player commits, and
the island is not there.

Recovery is the real historical technique, not a game-ism:

- **Aim off deliberately.** Steer knowingly to one side of the destination so that on reaching the
  target's latitude the navigator knows *which way to turn*. A player who sailed a perfect course
  and missed has no information; a player who aimed off has a direction.
- **Search the expanded target.** Run down the bird line, reading signs.

This makes a "wrong" decision at departure interesting rather than punishing, and it gives the
last third of a voyage its own distinct texture.

**Open:** whether a voyage can be failed outright, or only completed with a worse error figure.
Current lean — **no hard fail**; you always arrive somewhere, and the record is how well.


## 7. Progression

**Your inventory is a memorized network of sea-paths.**

The Carolinian schools (Weriyeng, Fanur) taught rote route knowledge: a star course plus an etak
island for every island pair. So completing a voyage writes that *wofanu* into the player's own
chant. It does not make the canoe faster or unlock an ability. It means **you know the way.**

That gives us collection, permanence, and mastery with nothing bought, killed, or upgraded — and it
is historically what learning to navigate actually was.

Difficulty escalates by **removing information**, not by adding enemies: chart → occasional glances
→ boat view only. (Already sketched as *The apprenticeship* in `ROADMAP.md`.)


## 8. Time, scale, and honest concessions

Real legs run days. A playable leg runs minutes. Rather than let the fudge accrete silently, the
concessions are listed here and nowhere else:

- **C1 — Time dilation, under player control.** Sailing time and wall time decouple. **Distances
  stay real** (R2); the clock runs fast. This is the concession that makes day/night a feature
  rather than a problem — a leg can cross a dawn. But the rate is **not** a fixed constant; see
  the watch mechanic below, which is the more important half of this.
- **C2 — Confidence, not position.** The one HUD affordance we grant: the player sees *how sure
  they are*, never *where they are*. Holding a house cleanly tightens it; ignored drift widens it.
  Rendered in the R1 idiom — a spread of houses, not an error radius in miles.
- **C3 — Forgiving drift.** The real drift a canoe accumulates over three days would be
  unrecoverable in a ten-minute leg. Tuned for readability, kept in `CFG`.
- **C4 — Signs are legible.** Real bird behaviour and swell refraction take a lifetime to read. The
  game makes them noticeable on first encounter.

### The watch — time control as the central decision

Time acceleration is the obvious answer to a slow game, and the obvious way to get it wrong is to
make it free. A lossless speed control gets held down, the player fast-forwards the leg, and the
game becomes a cutscene.

So the control is not *speed*. It is **attention**:

- **Keeping watch** — real time. The player is holding the house, correcting drift, and can read
  signs as they pass.
- **Resting** — time runs fast. Nobody is correcting precisely, so **drift accumulates
  uncorrected**, and signs may slip past unnoticed.

This is the mechanic the loop in §4 was missing. It makes the tension continuous rather than
confined to the departure choice and the final commit: *you cannot afford to attend the whole way,
and you cannot afford to rest the whole way.*

Three consequences, all good:

- **It satisfies R1 for free.** A "×16" speed slider is a modern clock idiom and would have
  violated the units rule. *Keep watch / rest* is a navigator's verb and is the same control.
- **It gives day and night a strategic rhythm.** The star compass is only available at night
  (§4.2). So: rest through the day, when there is less to lose; keep watch at night, when the
  compass is up. A tactical pattern that falls out of the real technique rather than being
  imposed on it.
- **It hands session length to the player.** A voyage runs five minutes or twenty depending on
  how much the player is willing to not-look.

*Sourcing note:* the general shape — the navigator attends, crew hold the steering, precision
degrades when the navigator is not on it — is consistent with the ethnography, but Gladwin's
account of the navigator's sleep discipline on a passage **has not been checked** for this
document. Verify before the framing appears in player-facing text (R4).

**The hole this design does not close:** a sim with no economy and no combat can go boring at
minute 20. The watch mechanic mitigates this — it lets the player skip the flat parts and gives
them a reason to care about the sharp ones — but it does not fix an empty sea, it only shortens
the player's exposure to one. The content budget still has to go into **signs, weather shifts, the
day/night handover, the guide star setting, birds at dawn**. This remains the project's main design
risk and should be tested early with a deliberately short leg.


## 9. Other oceans

A region is **a new verb set, not new coastlines.** Each ocean taught a different real method, so
porting the game is porting a technique:

| Region | Method | Confidence |
|---|---|---|
| **Micronesia** | Etak, sidereal compass | Built; sourced in `sources.md` |
| **Indian Ocean** | Latitude sailing with the *kamal*; monsoon timing makes **season** a mechanic | Attested — needs a sourcing pass |
| **Mediterranean** | Coastal pilotage, *periplus* distances; deliberately little open-water technique — a region where the sky barely helps | Attested — needs a sourcing pass |
| **Norse Atlantic** | Latitude sailing, landmark chains | Needs care — the sunstone is contested, do not build on it |
| **Caribbean** | — | **Research first.** The Taíno/Carib navigational record is far thinner than the Pacific's; do not assert a method before checking. |

This also makes §7 scale: the player is not collecting islands, they are collecting **methods**.

**Architectural cost, stated up front:** `PACIFIC_MAP`, `STAR_MAP`, and `ETAK_ISLANDS` are
single-region globals, and both generators in `tools/` are hardcoded to Caroline bounds.
Multi-region means per-region datasets and a region-selection layer. **Decision: defer.** Build v1
Pacific-only, but stop adding new single-region assumptions to `app.js` beyond what is already
there.


## 10. Open questions

1. **Steering granularity.** Continuous helm the player holds, or a discrete "commit to this house"
   choice at intervals? Continuous is more simulator; discrete is more legible and fits R1 better.
   *Leaning discrete-with-drift.*
2. **How drift is communicated.** It must be inferable but never displayed. Swell angle against the
   hull? The reference caret advancing off-schedule? Both?
3. **Does the departure choice stay a 4-way pick,** or become free selection from the gazetteer
   once it carries real consequence?
4. **Session shape.** Single voyages, or the settlement timeline as a campaign spine?
5. **Is the chart ever available mid-voyage,** as a costly glance, or never once underway?
6. **Can rest be interrupted?** Does a passing sign (birds, a squall, the guide star setting) snap
   the player back to real time automatically, or is missing it entirely the price of resting?
   Auto-interrupt is kinder and risks making rest strictly dominant; no-interrupt is harsher and
   makes the choice real. *Leaning: interrupt on weather and landfall signs only, never on drift.*


## 11. What this means for the roadmap

The *Second act* section of `ROADMAP.md` already anticipates most of this loop — the blind passage,
landfall as win condition, escalating blindness, star-steering with drift. This document does not
replace it; it supplies the spine those items were missing:

- **the failure/recovery model** (§6) — aim off, then search;
- **the units rule** (§5, R1) — which constrains every UI decision downstream;
- **progression as a sea-path network** (§7) — the answer to "why sail voyage #7";
- **the concession list** (§8) — so playability fudges stay visible and few.

Build order stays as sequenced in `ROADMAP.md`. The first thing worth testing is the shortest
possible blind leg, because §8's risk — an empty sea — invalidates everything else if it is real.
