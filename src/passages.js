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
];

if (typeof module !== 'undefined' && module.exports)
  module.exports = { ETAK_ISLANDS, ETAK_PASSAGES };
