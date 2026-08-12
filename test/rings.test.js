import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCore, varianceProfile, detectEditedSpan, scoreClaim,
  localVariance, mean, stddev, naturalBaseline, VERDICTS,
} from '../src/game/audit/rings.js';

const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1);

test('generation is deterministic for a seed', () => {
  const a = generateCore({ seed: 42 });
  const b = generateCore({ seed: 42 });
  assert.deepEqual(a.edit, b.edit);
  assert.deepEqual(a.rings.map((r) => r.width), b.rings.map((r) => r.width));
});

test('different seeds place the edit somewhere else', () => {
  const spans = new Set(SEEDS.map((s) => generateCore({ seed: s }).edit.start));
  assert.ok(spans.size > 20, `edit start barely varies: ${spans.size} distinct`);
});

test('the edit never touches the margins, so it cannot be guessed from an end', () => {
  for (const seed of SEEDS) {
    const { rings, edit } = generateCore({ seed });
    assert.ok(edit.start >= 10, `edit starts at ${edit.start}`);
    assert.ok(edit.end <= rings.length - 10, `edit ends at ${edit.end}`);
  }
});

// The forensic premise: the tell is low variance, not contradiction.
test('every generated edit is measurably smoother than the surrounding century', () => {
  for (const seed of SEEDS) {
    const { rings, edit } = generateCore({ seed });
    const profile = varianceProfile(rings);
    const inside = mean(profile.slice(edit.start + 4, edit.end - 4));
    const outside = mean(profile.filter((_, i) => i < edit.start - 4 || i >= edit.end + 4));
    assert.ok(inside < outside * 0.5,
      `seed ${seed}: inside ${inside.toFixed(3)} vs outside ${outside.toFixed(3)}`);
  }
});

test('the reference detector certifies on every seed', () => {
  for (const seed of SEEDS) {
    const core = generateCore({ seed });
    const found = detectEditedSpan(core.rings);
    assert.ok(found, `seed ${seed}: nothing detected`);
    assert.equal(scoreClaim(core.edit, found).verdict, VERDICTS.CERTIFIED,
      `seed ${seed}: detector found ${found.start}-${found.end}, truth ${core.edit.start}-${core.edit.end}`);
  }
});

test('scoring is intersection over union, so bracketing everything fails', () => {
  const core = generateCore({ seed: 9 });
  const exact = scoreClaim(core.edit, core.edit);
  assert.equal(exact.iou, 1);
  assert.equal(exact.verdict, VERDICTS.CERTIFIED);

  const everything = scoreClaim(core.edit, { start: 0, end: core.rings.length });
  assert.equal(everything.recall, 1, 'a total claim does contain the edit');
  assert.equal(everything.verdict, VERDICTS.REJECTED, 'but it is not an audit');
});

test('a claim that misses entirely is rejected', () => {
  const core = generateCore({ seed: 5 });
  const away = core.edit.start > 40
    ? { start: 0, end: 10 }
    : { start: core.rings.length - 10, end: core.rings.length };
  assert.equal(scoreClaim(core.edit, away).verdict, VERDICTS.REJECTED);
});

test('statistics helpers behave', () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(stddev([5, 5, 5]), 0);
  assert.ok(stddev([1, 9]) > 3);
  assert.equal(naturalBaseline([1, 2, 3, 4, 5]), 3);
  const { rings } = generateCore({ seed: 1 });
  assert.ok(localVariance(rings, 0) >= 0);
  assert.ok(localVariance(rings, rings.length - 1) >= 0);
});
