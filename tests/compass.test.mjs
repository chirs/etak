// Tests for the ETAK_COMPASS star-house table. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { ETAK_COMPASS } = require(path.join(here, '..', 'src', 'passages.js'));

test('compass has exactly 32 houses', () => {
  assert.equal(ETAK_COMPASS.length, 32);
});

test('cardinal anchors are correct', () => {
  assert.equal(ETAK_COMPASS[0].star, 'Polaris');
  assert.equal(ETAK_COMPASS[8].car, 'Máálap');
  assert.equal(ETAK_COMPASS[8].pre, 'tan');
  assert.equal(ETAK_COMPASS[16].car, 'Wénéwén');
  assert.equal(ETAK_COMPASS[24].car, 'Máálap');
  assert.equal(ETAK_COMPASS[24].pre, 'tubul');
});

test('setting side mirrors the rising side (house 32−i pairs house i)', () => {
  for (let i = 1; i <= 15; i++) {
    const rise = ETAK_COMPASS[i], set = ETAK_COMPASS[32 - i];
    assert.equal(set.car, rise.car, `house ${32 - i} name should mirror house ${i}`);
    if (rise.pre === 'tan') assert.equal(set.pre, 'tubul', `house ${32 - i} should be tubul`);
  }
});

test('rising prefix east of south, setting west; anchors unprefixed', () => {
  assert.equal(ETAK_COMPASS[0].pre, '');
  assert.equal(ETAK_COMPASS[16].pre, '');
  for (let i = 1; i <= 15; i++) assert.ok(['tan', ''].includes(ETAK_COMPASS[i].pre));
  for (let i = 17; i <= 31; i++) assert.ok(['tubul', ''].includes(ETAK_COMPASS[i].pre));
});
