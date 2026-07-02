// Hand-authored Etak content: a gazetteer of real Caroline Islands and a set
// of documented sailing passages. Coordinates are decimal degrees {lat,lon}
// from docs/sources.md §3 (Pisaras verified separately — see that file).
// Loaded as a classic script; consumed by app.js as globals. No build step.

const ETAK_ISLANDS = {
  puluwat:  { name: 'PULUWAT',   lat: 7.3543, lon: 149.2002 },
  pulusuk:  { name: 'PULUSUK',   lat: 6.6898, lon: 149.3021 },
  satawal:  { name: 'SATAWAL',   lat: 7.3579, lon: 147.0373 },
  lamotrek: { name: 'LAMOTREK',  lat: 7.4833, lon: 146.3333 },
  pikelot:  { name: 'PIKELOT',   lat: 8.08,   lon: 147.62   },
  westfayu: { name: 'WEST FAYU', lat: 8.08,   lon: 146.72   },
  elato:    { name: 'ELATO',     lat: 7.47,   lon: 146.18   },
  chuuk:    { name: 'CHUUK',     lat: 7.42,   lon: 151.78   },
  pisaras:  { name: 'PISARAS',   lat: 8.569,  lon: 150.4185 },
  gaferut:  { name: 'GAFERUT',   lat: 9.2283, lon: 145.3843 },
  saipan:   { name: 'SAIPAN',    lat: 15.18,  lon: 145.75   },
};

// Each passage: a real leg (from -> to) and four real islands offered as
// candidate references. Scores are computed live by EtakCore — nothing here is
// hand-tuned; the candidate *sets* are curated so each puzzle has a clear (or
// interestingly ambiguous) answer alongside instructive traps.
const ETAK_PASSAGES = [
  {
    name: 'Puluwat → Chuuk',
    from: 'puluwat', to: 'chuuk',
    candidates: ['pikelot', 'pisaras', 'satawal', 'pulusuk'],
    note: 'Gladwin’s worked example — steered on rising Altair, dragging Pisaras well abeam to the north.',
  },
  {
    name: 'Satawal → Lamotrek',
    from: 'satawal', to: 'lamotrek',
    candidates: ['elato', 'westfayu', 'pulusuk', 'pikelot'],
    note: 'A short inter-island hop. West Fayu sits cleanly abeam; Elato lies just past the destination.',
  },
  {
    name: 'Puluwat → Lamotrek',
    from: 'puluwat', to: 'lamotrek',
    candidates: ['pisaras', 'satawal', 'westfayu', 'pulusuk'],
    note: 'A long westward run. Satawal lies almost on the course line itself — its bearing barely moves.',
  },
  {
    name: 'Satawal → Pikelot',
    from: 'satawal', to: 'pikelot',
    candidates: ['westfayu', 'puluwat', 'lamotrek', 'pulusuk'],
    note: 'The turtle-hunting run to uninhabited Pikelot. West Fayu sits cleanly abeam to the west.',
  },
  {
    name: 'Satawal → West Fayu',
    from: 'satawal', to: 'westfayu',
    candidates: ['lamotrek', 'elato', 'pikelot', 'puluwat'],
    note: 'A short northward hop. Lamotrek and Elato are near-twins to the southwest — seven miles apart.',
  },
  {
    name: 'Pikelot → Saipan',
    from: 'pikelot', to: 'saipan',
    candidates: ['pisaras', 'chuuk', 'gaferut', 'westfayu'],
    note: 'Hipour’s 1969 revival — 450 nm of open sea that no island segments; the seaway of ghost islands.',
  },
];

// The 32 star houses, clockwise from north; index matches EtakCore.houseOf.
// Puluwat/Satawal names transcribed from Goodenough & Thomas (1987) — see
// docs/sources.md §1. The native compass is conventional (evenly spaced points,
// Altair rising called "due east"), so each 11.25° wedge is labeled with the
// conventional point name, not the star's true azimuth. `car` is null where the
// source gives no independent Carolinian name (Dubhe, the Máálap wing stars, the
// Crux elevations). `pre` is the rising/setting prefix: `tan` rises, `tubul` sets;
// the anchors and Crux elevations take none.
const ETAK_COMPASS = [
  { car: 'Fúsemakut',       pre: '',      star: 'Polaris' },            //  0 · N
  { car: 'Maylap-en-efeng', pre: 'tan',   star: 'Kochab rising' },
  { car: null,              pre: '',      star: 'Dubhe rising' },
  { car: 'Úgúlúg',          pre: 'tan',   star: 'Cassiopeia rising' },
  { car: 'Máán',            pre: 'tan',   star: 'Vega rising' },
  { car: 'Maríger',         pre: 'tan',   star: 'Pleiades rising' },
  { car: 'Úún',             pre: 'tan',   star: 'Aldebaran rising' },
  { car: null,              pre: '',      star: 'Tarazed rising' },
  { car: 'Máálap',          pre: 'tan',   star: 'Altair rising' },      //  8 · E
  { car: null,              pre: '',      star: 'Alshain rising' },
  { car: 'Elúél',           pre: 'tan',   star: 'Orion’s Belt rising' },
  { car: 'Sárapúl',         pre: 'tan',   star: 'Corvus rising' },
  { car: 'Túmur',           pre: 'tan',   star: 'Antares rising' },
  { car: 'Mesáárú',         pre: 'tan',   star: 'Shaula rising' },
  { car: 'Wénéwén',         pre: 'tan',   star: 'Crux rising' },
  { car: null,              pre: '',      star: 'Crux at 45° east' },
  { car: 'Wénéwén',         pre: '',      star: 'Crux upright' },       // 16 · S
  { car: null,              pre: '',      star: 'Crux at 45° west' },
  { car: 'Wénéwén',         pre: 'tubul', star: 'Crux setting' },
  { car: 'Mesáárú',         pre: 'tubul', star: 'Shaula setting' },
  { car: 'Túmur',           pre: 'tubul', star: 'Antares setting' },
  { car: 'Sárapúl',         pre: 'tubul', star: 'Corvus setting' },
  { car: 'Elúél',           pre: 'tubul', star: 'Orion’s Belt setting' },
  { car: null,              pre: '',      star: 'Alshain setting' },
  { car: 'Máálap',          pre: 'tubul', star: 'Altair setting' },     // 24 · W
  { car: null,              pre: '',      star: 'Tarazed setting' },
  { car: 'Úún',             pre: 'tubul', star: 'Aldebaran setting' },
  { car: 'Maríger',         pre: 'tubul', star: 'Pleiades setting' },
  { car: 'Máán',            pre: 'tubul', star: 'Vega setting' },
  { car: 'Úgúlúg',          pre: 'tubul', star: 'Cassiopeia setting' },
  { car: null,              pre: '',      star: 'Dubhe setting' },
  { car: 'Maylap-en-efeng', pre: 'tubul', star: 'Kochab setting' },
];

if (typeof module !== 'undefined' && module.exports)
  module.exports = { ETAK_ISLANDS, ETAK_PASSAGES, ETAK_COMPASS };
