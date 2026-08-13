import test from 'node:test';
import assert from 'node:assert/strict';
import { RAMP, P, AFFINITY, mix, alpha, step } from '../src/engine/palette.js';

const HEX = /^#[0-9a-f]{6}$/i;
const luma = (c) => 0.2126 * parseInt(c.slice(1, 3), 16)
  + 0.7152 * parseInt(c.slice(3, 5), 16) + 0.0722 * parseInt(c.slice(5, 7), 16);

test('every ramp stop is a valid hex colour', () => {
  for (const [name, stops] of Object.entries(RAMP)) {
    assert.ok(stops.length >= 4, `${name} is too short to shade with`);
    for (const c of stops) assert.match(c, HEX, `${name} has a bad stop: ${c}`);
  }
});

test('ramps run dark to light, so stepping up always brightens', () => {
  for (const [name, stops] of Object.entries(RAMP)) {
    for (let i = 1; i < stops.length; i++) {
      assert.ok(luma(stops[i]) > luma(stops[i - 1]), `${name}[${i}] is not lighter`);
    }
  }
});

test('the palette holds to black, ember and bone -- no stray hues', () => {
  // Every colour must be warm: red channel at least as high as blue.
  for (const [name, stops] of Object.entries(RAMP)) {
    for (const c of stops) {
      const r = parseInt(c.slice(1, 3), 16);
      const b = parseInt(c.slice(5, 7), 16);
      assert.ok(r >= b, `${name} stop ${c} is cool, which is off-model`);
    }
  }
});

test('named picks all resolve', () => {
  for (const [name, value] of Object.entries(P)) assert.match(value, HEX, name);
});

test('the four affinities are distinct and each has a glyph', () => {
  const ids = Object.keys(AFFINITY);
  assert.equal(ids.length, 4);
  const colors = new Set(ids.map((id) => AFFINITY[id].color));
  assert.equal(colors.size, 4, 'affinity colours must be distinguishable');
  for (const id of ids) assert.ok(AFFINITY[id].glyph, `${id} has no glyph`);
});

test('mix and alpha behave', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mix('#000000', '#ffffff', -2), '#000000');
  assert.equal(mix('#000000', '#ffffff', 5), '#ffffff');
  assert.equal(alpha('#d9682a', 0.5), 'rgba(217,104,42,0.5)');
  assert.equal(step('ember', -3), RAMP.ember[0]);
  assert.equal(step('ember', 99), RAMP.ember.at(-1));
});
