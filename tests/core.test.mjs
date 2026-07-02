// Tests for the pure spherical core. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const EtakCore = require(path.join(here, '..', 'src', 'core.js'));

// Real coordinates from docs/sources.md §3
const Puluwat = { lat: 7.3543, lon: 149.2002 };
const Chuuk   = { lat: 7.42,   lon: 151.78 };
const Satawal = { lat: 7.3579, lon: 147.0373 };

test('Puluwat -> Chuuk is nearly due east', () => {
  const b = EtakCore.gcBearing(Puluwat, Chuuk);
  assert.ok(Math.abs(b - 90) < 5, `bearing ${b.toFixed(1)} not ~90`);
});

test('Puluwat -> Chuuk is ~150 nautical miles', () => {
  const d = EtakCore.gcDistNm(Puluwat, Chuuk);
  assert.ok(d > 130 && d < 170, `distance ${d.toFixed(1)} nm out of range`);
});

test('Puluwat -> Satawal heads WNW (west of due west, near ~280)', () => {
  const b = EtakCore.gcBearing(Puluwat, Satawal);
  assert.ok(b > 265 && b < 295, `bearing ${b.toFixed(1)} not WNW`);
});

test('gcInterp endpoints and midpoint stay on the leg', () => {
  const m = EtakCore.gcInterp(Puluwat, Chuuk, 0.5);
  assert.ok(Math.abs(m.lat - 7.39) < 0.2);
  assert.ok(m.lon > Puluwat.lon && m.lon < Chuuk.lon);
  const a = EtakCore.gcInterp(Puluwat, Chuuk, 0);
  assert.ok(Math.abs(a.lat - Puluwat.lat) < 1e-6 && Math.abs(a.lon - Puluwat.lon) < 1e-6);
});

test('boundary t values are strictly increasing and in (0,1)', () => {
  const ref = { lat: 9.0, lon: 150.4 };   // abeam-ish reference
  const b = EtakCore.boundariesFor(Puluwat, Chuuk, ref);
  for (let i = 1; i < b.length; i++) assert.ok(b[i] > b[i - 1]);
  b.forEach(t => assert.ok(t > 0 && t < 1));
});

test('a reference in line with the course yields ~1 segment', () => {
  // reference far beyond the destination, on the course line
  const inline = EtakCore.gcInterp(Puluwat, Chuuk, 5);
  const s = EtakCore.scoreFor(Puluwat, Chuuk, inline);
  assert.ok(s.segs <= 2, `expected ~1 segment, got ${s.segs}`);
});

test('houseOf wraps around north (house 0 straddles 0°)', () => {
  assert.equal(EtakCore.houseOf(359.9), 0);
  assert.equal(EtakCore.houseOf(0), 0);
  assert.equal(EtakCore.houseOf(5.624), 0);   // just inside house 0
  assert.equal(EtakCore.houseOf(5.626), 1);   // just past the half-house edge
});

test('a well-abeam reference outscores an on-course-line one', () => {
  // The invariant the puzzles rest on: Pisaras abeam of Puluwat->Chuuk is a good
  // reference; Satawal sits nearly on the Puluwat->Lamotrek course line and is not.
  const Lamotrek = { lat: 7.4833, lon: 146.3333 };
  const Pisaras  = { lat: 8.569,  lon: 150.4185 };
  const abeam  = EtakCore.scoreFor(Puluwat, Chuuk, Pisaras);
  const inline = EtakCore.scoreFor(Puluwat, Lamotrek, Satawal);
  assert.ok(abeam.total > inline.total,
    `abeam ${abeam.total} should beat inline ${inline.total}`);
});

test('reversing the leg preserves the etak boundary count', () => {
  const Pisaras = { lat: 8.569, lon: 150.4185 };
  const fwd = EtakCore.boundariesFor(Puluwat, Chuuk, Pisaras);
  const rev = EtakCore.boundariesFor(Chuuk, Puluwat, Pisaras);
  assert.equal(fwd.length, rev.length);
});
