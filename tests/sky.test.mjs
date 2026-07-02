// Tests for the alt/az astronomy used by the boat-view sky. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { altAz, riseAz, gmst } = require(path.join(here, '..', 'src', 'core.js'));
const { compass } = require(path.join(here, '..', 'src', 'stars.js'));

const star = g => compass.find(c => c.group === g);
const LAT = 7.4;   // Satawal — the latitude the sources.md §1 azimuths were computed at

test('Polaris altitude ≈ observer latitude at any sidereal time', () => {
  const p = star('Polaris');
  for (const lst of [0, 97, 184, 301]) {
    const { alt } = altAz(p.ra, p.dec, LAT, lst);
    assert.ok(Math.abs(alt - LAT) < 1.1, `alt ${alt.toFixed(2)} at lst ${lst}`);
  }
});

test('a star transits (max altitude, due N/S azimuth) at HA = 0', () => {
  const v = star('Vega');
  const atTransit = altAz(v.ra, v.dec, LAT, v.ra).alt;
  for (const off of [-30, -5, 5, 30])
    assert.ok(altAz(v.ra, v.dec, LAT, v.ra + off).alt < atTransit);
  const { az } = altAz(v.ra, v.dec, LAT, v.ra);
  assert.ok(Math.abs(az - 0) < 0.5 || Math.abs(az - 360) < 0.5, `az ${az}`);  // Vega transits north of zenith at 7.4°N
});

test('rising azimuths reproduce the sources.md §1 compass table (±1.5°)', () => {
  const expected = { Vega: 51, Pleiades: 66, Aldebaran: 73, Altair: 81, Antares: 117, Shaula: 127 };
  for (const [g, azExp] of Object.entries(expected)) {
    const s = star(g);
    const az = riseAz(s.dec, LAT);
    assert.ok(Math.abs(az - azExp) < 1.5, `${g}: riseAz ${az.toFixed(1)} vs table ${azExp}`);
  }
});

test('gmst matches the textbook value at the J2000 epoch day', () => {
  const jd = Date.UTC(2000, 0, 1, 0, 0, 0) / 86400000 + 2440587.5;   // 2000-01-01 00:00 UT
  assert.ok(Math.abs(gmst(jd) - 99.9678) < 0.01, `gmst ${gmst(jd).toFixed(4)}`);
});

test('a star on the celestial equator rises due east and sets due west', () => {
  assert.ok(Math.abs(riseAz(0, LAT) - 90) < 0.01);
  // and altAz agrees just after the horizon crossing (HA ≈ −89.6°)
  const { alt, az } = altAz(100, 0, LAT, 100 - 89.6);
  assert.ok(alt > 0 && alt < 1.5, `alt ${alt.toFixed(2)}`);
  assert.ok(Math.abs(az - 90) < 1.5, `az ${az.toFixed(2)}`);
});
