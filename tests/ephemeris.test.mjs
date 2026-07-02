// Tests for the wanderer ephemerides (sunPos/moonPos/planetPos) against JPL
// Horizons reference positions (geocentric apparent RA/Dec of date, degrees;
// fetched 2026-07-02 from ssd.jpl.nasa.gov/api/horizons.api). Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { sunPos, moonPos, planetPos, PLANETS } = require(path.join(here, '..', 'src', 'core.js'));

const JD1969 = 2440412.875; // 1969-07-10 09:00 UTC — the app's departure epoch
const JD2026 = 2461224.0;   // 2026-07-02 12:00 UTC

// [body, jd, ra, dec, mag] from Horizons; mag tolerances are loose because the
// low-precision magnitude formulas are only meant to size the drawn dot.
const FIX = [
  ['sun',     JD1969, 109.41583,  22.24568, null],
  ['sun',     JD2026, 101.56414,  23.01209, null],
  ['moon',    JD1969,  58.60357,  25.10191, null],
  ['moon',    JD2026, 311.24756, -20.08509, null],
  ['mercury', JD1969,  94.50160,  23.25567, -1.110],
  ['mercury', JD2026, 117.39102,  18.10775,  2.555],
  ['venus',   JD1969,  62.21315,  18.14928, -4.195],
  ['venus',   JD2026, 144.84134,  15.84819, -4.078],
  ['mars',    JD1969, 238.89001, -23.77707, -1.512],
  ['mars',    JD2026,  60.61916,  20.40695,  1.400],
  ['jupiter', JD1969, 179.87379,   1.41861, -1.876],
  ['jupiter', JD2026, 122.78498,  20.47633, -1.806],
  ['saturn',  JD1969,  35.90143,  11.74489,  0.433],
  ['saturn',  JD2026,  14.04311,   3.41521,  0.769],
];

const posOf = (body, jd) =>
  body === 'sun' ? sunPos(jd) : body === 'moon' ? moonPos(jd) : planetPos(body, jd);
const raDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

for (const [body, jd, ra, dec, mag] of FIX) {
  const year = jd < 2450000 ? 1969 : 2026;
  test(`${body} position vs Horizons, ${year}`, () => {
    const p = posOf(body, jd);
    const tol = body === 'moon' ? 0.35 : 0.15; // arcmins claimed; allow generous margin
    // compare great-circle-ish: RA error scaled by cos(dec)
    assert.ok(raDiff(p.ra, ra) * Math.cos(dec * Math.PI / 180) < tol,
      `RA ${p.ra.toFixed(3)} vs ${ra}`);
    assert.ok(Math.abs(p.dec - dec) < tol, `Dec ${p.dec.toFixed(3)} vs ${dec}`);
    if (mag != null) {
      const mtol = body === 'mercury' ? 0.8 : 0.5;
      assert.ok(Math.abs(p.mag - mag) < mtol, `mag ${p.mag.toFixed(2)} vs ${mag}`);
    }
  });
}

test('moon phase: waning crescent at the 1969 departure, near-full 2026-07-02', () => {
  assert.ok(moonPos(JD1969).phase > 0.05 && moonPos(JD1969).phase < 0.30,
    `1969 phase ${moonPos(JD1969).phase.toFixed(3)}`);
  assert.ok(moonPos(JD2026).phase > 0.90, `2026 phase ${moonPos(JD2026).phase.toFixed(3)}`);
});

test('PLANETS lists the five naked-eye wanderers', () => {
  assert.deepEqual(PLANETS, ['mercury', 'venus', 'mars', 'jupiter', 'saturn']);
});
