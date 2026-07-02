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

// Story mode: the settlement of the Pacific, told on the chart in six beats.
// Each beat: a camera frame (`fit`), migration arcs drawn as great circles, and
// a text card. Dates and directions from docs/sources.md §4 (confidence-tagged);
// waypoints are story-only landmarks, deliberately coarse (one point per
// island group), not gazetteer entries.
const ETAK_STORY = (() => {
  const taiwan   = { lat: 22.75,  lon: 121.15 };
  const luzon    = { lat: 18.0,   lon: 121.7  };
  const halmahera= { lat: -1.4,   lon: 128.2  };
  const guam     = { lat: 13.45,  lon: 144.75 };
  const bismarcks= { lat: -4.2,   lon: 152.2  };
  const santacruz= { lat: -10.7,  lon: 165.8  };
  const vanuatu  = { lat: -17.7,  lon: 168.3  };
  const fiji     = { lat: -17.8,  lon: 178.0  };
  const tonga    = { lat: -21.13, lon: -175.2 };
  const samoa    = { lat: -13.9,  lon: -171.75};
  const tahiti   = { lat: -17.65, lon: -149.42};
  const marquesas= { lat: -8.9,   lon: -140.1 };
  const hawaii   = { lat: 19.6,   lon: -155.5 };
  const rapanui  = { lat: -27.11, lon: -109.35};
  const aotearoa = { lat: -35.5,  lon: 173.8  };
  const pohnpei  = { lat: 6.85,   lon: 158.2  };
  const chuuk    = { lat: 7.42,   lon: 151.78 };
  const puluwat  = { lat: 7.35,   lon: 149.20 };
  const lamotrek = { lat: 7.48,   lon: 146.33 };
  const saipan   = { lat: 15.18,  lon: 145.75 };
  return [
    {
      title: 'The Blue Continent', era: 'one ocean · a third of the earth',
      text: 'The Pacific covers more of the planet than all dry land combined. Nearly every ' +
            'habitable island in it was found and settled by people sailing canoes — without ' +
            'metal, writing, or instruments. This chart is their sea. This is how it happened.',
      fit: [{ lat: 55, lon: 115 }, { lat: -48, lon: -150 }],   // Asia out past Hawaiʻi
      arcs: [],
    },
    {
      title: 'Out of Asia', era: '~3000–2000 BCE',
      text: 'Farmers and fishers crossed from Taiwan to Luzon and spread south through island ' +
            'Southeast Asia. Their descendants — the Austronesians — carried the outrigger ' +
            'canoe, and a language family that would one day stretch halfway around the world.',
      fit: [{ lat: 28, lon: 116 }, { lat: -8, lon: 140 }],
      arcs: [
        { from: taiwan, fromName: 'TAIWAN', to: luzon, name: 'LUZON', date: '~2200 BCE' },
        { from: luzon, to: halmahera, name: 'ISLAND SE ASIA', date: '~2000 BCE' },
      ],
    },
    {
      title: 'Into the Open Ocean', era: '~1500–850 BCE',
      text: 'Around 1500 BCE, canoes out of the Philippines made the Marianas — 2,000 km of ' +
            'open water, the longest sea crossing humanity had yet made. Soon after, the Lapita ' +
            'people struck east past the Solomons into empty ocean: Vanuatu, Fiji, Tonga, Samoa.',
      fit: [{ lat: 22, lon: 118 }, { lat: -26, lon: -168 }],
      arcs: [
        { from: luzon, to: guam, name: 'MARIANAS', date: '~1500 BCE' },
        { from: bismarcks, fromName: 'BISMARCKS', to: santacruz, name: 'SANTA CRUZ', date: '~1100 BCE' },
        { from: santacruz, to: vanuatu, name: 'VANUATU', date: '~1000 BCE' },
        { from: vanuatu, to: fiji, name: 'FIJI', date: '~950 BCE' },
        { from: fiji, to: tonga, name: 'TONGA', date: '~880 BCE' },
        { from: tonga, to: samoa, name: 'SAMOA', date: '~850 BCE' },
      ],
    },
    {
      title: 'The Far Corners', era: '~1025–1290 CE',
      text: 'Then a pause of nearly two thousand years — its cause still argued. When voyagers ' +
            'pushed east again they went fast: the Societies by ~1050 CE, and within a few ' +
            'generations the far corners of the triangle — Hawaiʻi, Rapa Nui, Aotearoa.',
      fit: [{ lat: 28, lon: -178 }, { lat: -44, lon: -104 }],
      arcs: [
        { from: samoa, to: tahiti, name: 'SOCIETIES', date: '~1050 CE' },
        { from: tahiti, to: marquesas, name: 'MARQUESAS', date: '~1150 CE' },
        { from: marquesas, to: hawaii, name: 'HAWAIʻI', date: '~1200 CE' },
        { from: tahiti, to: rapanui, name: 'RAPA NUI', date: '~1200 CE' },
        { from: tahiti, to: aotearoa, name: 'AOTEAROA', date: '~1250 CE' },
      ],
    },
    {
      title: 'The Carolines', era: '~100 BCE–1000 CE',
      text: 'A second stream had meanwhile flowed north from the Lapita world into Micronesia, ' +
            'then worked westward atoll by atoll: Chuuk, Puluwat, Satawal, Lamotrek — the low ' +
            'islands this app sails, where landfall is a palm top on the horizon.',
      fit: [{ lat: 20, lon: 138 }, { lat: -14, lon: 172 }],
      arcs: [
        { from: santacruz, to: pohnpei, name: 'POHNPEI', date: '~100 CE' },
        { from: pohnpei, to: chuuk, name: 'CHUUK', date: '~100 CE' },
        { from: chuuk, to: puluwat, name: 'PULUWAT', date: '' },
        { from: puluwat, to: lamotrek, name: 'LAMOTREK', date: 'by ~1000 CE' },
      ],
    },
    {
      title: 'The Art That Survived', era: '1969',
      text: 'Colonization ended; the knowledge did not. On Puluwat and Satawal the star compass ' +
            'and etak are still taught. In 1969 the navigator Hipour sailed the old seaway to ' +
            'Saipan without instruments. You have the same tool he did: a reference island abeam. ' +
            'Choose the one whose bearing best divides the voyage.',
      fit: [{ lat: 17, lon: 142 }, { lat: 4, lon: 154 }],
      arcs: [
        { from: puluwat, fromName: 'PULUWAT', to: saipan, name: 'SAIPAN', date: '1969 CE' },
      ],
    },
  ];
})();

if (typeof module !== 'undefined' && module.exports)
  module.exports = { ETAK_ISLANDS, ETAK_PASSAGES, ETAK_COMPASS, ETAK_STORY };
