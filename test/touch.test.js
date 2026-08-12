import test from 'node:test';
import assert from 'node:assert/strict';
import { planLayout } from '../src/engine/touch.js';

// planLayout is pure: viewport + key size in, placement + reserved insets out.
// The rule it encodes is that on-screen controls must never sit on top of the
// game, because the battle menu and audit readout live in the screen corners.

const stageScale = (viewport, insets) => Math.min(
  (viewport.width - (insets.left ?? 0) - (insets.right ?? 0)) / 960,
  (viewport.height - (insets.top ?? 0) - (insets.bottom ?? 0)) / 540,
);

test('a wide phone reserves side gutters, keeping full stage height', () => {
  const viewport = { width: 844, height: 390 };
  const plan = planLayout(viewport, 38);
  assert.equal(plan.mode, 'side');
  assert.equal(plan.insets.left, plan.insets.right, 'gutters stay symmetric so the stage centres');
  assert.ok(plan.insets.left >= 38 * 3, 'a gutter must fit the full width of the d-pad');
  assert.equal(plan.insets.bottom ?? 0, 0);
});

test('a boxy tablet reserves a bottom band instead, which leaves a bigger stage', () => {
  const viewport = { width: 1024, height: 768 };
  const plan = planLayout(viewport, 58);
  assert.equal(plan.mode, 'band');
  assert.ok(plan.insets.bottom >= 58 * 3, 'the band must fit the height of the d-pad');
  const side = planLayout({ ...viewport }, 58);
  assert.ok(stageScale(viewport, plan.insets) >= stageScale(viewport, { left: 58 * 3, right: 58 * 3 }),
    'the chosen mode is the one that leaves more stage');
  assert.equal(side.mode, 'band');
});

test('the chosen mode always maximises the remaining stage', () => {
  const cases = [
    { width: 844, height: 390 }, { width: 1024, height: 768 },
    { width: 667, height: 375 }, { width: 1180, height: 820 },
    { width: 1440, height: 900 }, { width: 540, height: 320 },
  ];
  for (const viewport of cases) {
    const key = 44;
    const plan = planLayout(viewport, key);
    const sideInsets = { left: key * 3 + 28, right: key * 3 + 28 };
    const bandInsets = { bottom: key * 3 + 28 };
    const best = Math.max(stageScale(viewport, sideInsets), stageScale(viewport, bandInsets));
    if (plan.mode === 'overlay') {
      assert.ok(stageScale(viewport, {}) > best, `${viewport.width}x${viewport.height}`);
    } else {
      assert.ok(plan.scale >= best - 1e-9,
        `${viewport.width}x${viewport.height} chose ${plan.mode} at ${plan.scale.toFixed(3)}, best ${best.toFixed(3)}`);
    }
  }
});

test('reserved space never squeezes the stage out of existence', () => {
  for (const width of [320, 480, 667, 844, 1024, 1440]) {
    for (const height of [280, 375, 540, 768, 900]) {
      const plan = planLayout({ width, height }, 44);
      assert.ok(plan.scale > 0, `${width}x${height} produced a zero stage`);
      assert.ok(['side', 'band', 'overlay'].includes(plan.mode));
    }
  }
});

test('a screen too small to reserve anything falls back to a translucent overlay', () => {
  const plan = planLayout({ width: 380, height: 300 }, 44);
  assert.equal(plan.mode, 'overlay');
  assert.deepEqual(plan.insets, {});
});

test('overlay is never chosen when reserving space is affordable', () => {
  for (const viewport of [{ width: 844, height: 390 }, { width: 1024, height: 768 }]) {
    assert.notEqual(planLayout(viewport, 44).mode, 'overlay');
  }
});
