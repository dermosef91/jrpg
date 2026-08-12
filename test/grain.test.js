import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAIN, relation, multiplier, feedsTarget, rotate, acrossFrom, RELATION,
} from '../src/game/battle/grain.js';

test('force two steps off the fibre is across it', () => {
  assert.equal(relation(GRAIN.RISING, GRAIN.TWISTED), RELATION.ACROSS);
  assert.equal(relation(GRAIN.LATERAL, GRAIN.COMPACTED), RELATION.ACROSS);
  assert.equal(multiplier(GRAIN.RISING, GRAIN.TWISTED), 1.75);
});

test('force along the fibre is absorbed, not resisted', () => {
  assert.equal(relation(GRAIN.LATERAL, GRAIN.LATERAL), RELATION.ALONG);
  assert.equal(multiplier(GRAIN.LATERAL, GRAIN.LATERAL), 0.25);
  assert.ok(feedsTarget(GRAIN.LATERAL, GRAIN.LATERAL));
  assert.ok(!feedsTarget(GRAIN.LATERAL, GRAIN.RISING));
});

test('adjacent positions are oblique in both directions', () => {
  for (const g of [0, 1, 2, 3]) {
    assert.equal(relation(g, rotate(g, 1)), RELATION.OBLIQUE);
    assert.equal(relation(g, rotate(g, 3)), RELATION.OBLIQUE);
  }
});

test('rotation wraps in both directions', () => {
  assert.equal(rotate(GRAIN.COMPACTED, 1), GRAIN.RISING);
  assert.equal(rotate(GRAIN.RISING, -1), GRAIN.COMPACTED);
  assert.equal(rotate(GRAIN.RISING, 8), GRAIN.RISING);
});

test('acrossFrom names the grain that would split a given fibre', () => {
  for (const g of [0, 1, 2, 3]) {
    assert.equal(relation(acrossFrom(g), g), RELATION.ACROSS);
  }
});

// The central design claim of the system: exploiting a weakness destroys it,
// so no single character can chain across-grain hits.
test('an across-grain hit rotates the target out of that vulnerability', () => {
  const target = GRAIN.TWISTED;
  const best = acrossFrom(target);
  assert.equal(relation(best, target), RELATION.ACROSS);
  const afterHit = rotate(target, 1);
  assert.notEqual(relation(best, afterHit), RELATION.ACROSS);
});
