// Tests for the hand-authored passage content. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const src = p => path.join(here, '..', 'src', p);
const { ETAK_ISLANDS, ETAK_PASSAGES } = require(src('passages.js'));
const { scoreFor } = require(src('core.js'));

test('every passage references only gazetteer islands', () => {
  for (const p of ETAK_PASSAGES) {
    assert.ok(ETAK_ISLANDS[p.from], `${p.name}: unknown from '${p.from}'`);
    assert.ok(ETAK_ISLANDS[p.to], `${p.name}: unknown to '${p.to}'`);
    for (const c of p.candidates)
      assert.ok(ETAK_ISLANDS[c], `${p.name}: unknown candidate '${c}'`);
  }
});

test('each passage offers 4 distinct candidates, none an endpoint', () => {
  for (const p of ETAK_PASSAGES) {
    assert.equal(p.candidates.length, 4, p.name);
    assert.equal(new Set(p.candidates).size, 4, `${p.name}: duplicate candidate`);
    assert.ok(!p.candidates.includes(p.from) && !p.candidates.includes(p.to),
      `${p.name}: endpoint used as candidate`);
  }
});

test('every passage has a single best-scoring candidate', () => {
  for (const p of ETAK_PASSAGES) {
    const A = ETAK_ISLANDS[p.from], B = ETAK_ISLANDS[p.to];
    const totals = p.candidates.map(c => scoreFor(A, B, ETAK_ISLANDS[c]).total);
    const best = Math.max(...totals);
    assert.equal(totals.filter(t => t === best).length, 1,
      `${p.name}: tied best score ${best} (${totals.join(', ')})`);
  }
});
