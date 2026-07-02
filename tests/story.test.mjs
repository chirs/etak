// Tests for the ETAK_STORY settlement walkthrough data. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { ETAK_STORY } = require(path.join(here, '..', 'src', 'passages.js'));
const { bounds } = require(path.join(here, '..', 'src', 'map-data.js'));

const lon360 = lon => ((lon % 360) + 360) % 360;
const onChart = p =>
  Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
  p.lat > bounds.latMin && p.lat < bounds.latMax &&
  lon360(p.lon) > bounds.lonMin && lon360(p.lon) < bounds.lonMax;

test('story has the six beats, each fully written', () => {
  assert.equal(ETAK_STORY.length, 6);
  for (const b of ETAK_STORY) {
    assert.ok(b.title.length > 3 && b.era.length > 3, b.title);
    assert.ok(b.text.length > 80, `${b.title} text too thin`);
    assert.ok(Array.isArray(b.fit) && b.fit.length >= 2, `${b.title} fit frame`);
    assert.ok(Array.isArray(b.arcs), `${b.title} arcs`);
  }
});

test('every waypoint lands inside the chart', () => {
  for (const b of ETAK_STORY) {
    b.fit.forEach(p => assert.ok(onChart(p), `${b.title} fit point ${JSON.stringify(p)}`));
    for (const a of b.arcs) {
      assert.ok(onChart(a.from), `${b.title}: from ${JSON.stringify(a.from)}`);
      assert.ok(onChart(a.to), `${b.title}: ${a.name} to ${JSON.stringify(a.to)}`);
      assert.ok(a.name.length > 1, `${b.title}: arc missing name`);
    }
  }
});

test('the story opens on the whole ocean and ends on the Carolines hand-off', () => {
  assert.ok(ETAK_STORY[0].arcs.length === 0, 'beat 1 is the empty ocean');
  const last = ETAK_STORY[ETAK_STORY.length - 1];
  assert.match(last.text, /reference island/i, 'final beat hands off to the puzzle');
  assert.match(last.text, /Hipour/, 'final beat cites the 1969 revival');
});
