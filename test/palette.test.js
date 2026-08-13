import test from 'node:test';
import assert from 'node:assert/strict';
import { RAMP, P, GRAIN_COLOR, step, mix, alpha, FONT } from '../src/engine/palette.js';

const HEX = /^#[0-9a-f]{6}$/i;

test('every ramp stop is a valid hex colour', () => {
  for (const [name, stops] of Object.entries(RAMP)) {
    assert.ok(stops.length >= 4, `${name} is too short to shade with`);
    for (const c of stops) assert.match(c, HEX, `${name} has a bad stop: ${c}`);
  }
});

test('ramps run dark to light, so stepping up always brightens', () => {
  const luma = (c) => 0.2126 * parseInt(c.slice(1, 3), 16)
    + 0.7152 * parseInt(c.slice(3, 5), 16) + 0.0722 * parseInt(c.slice(5, 7), 16);
  for (const [name, stops] of Object.entries(RAMP)) {
    for (let i = 1; i < stops.length; i++) {
      assert.ok(luma(stops[i]) > luma(stops[i - 1]),
        `${name}[${i}] is not lighter than [${i - 1}]`);
    }
  }
});

test('every named pick resolves to a real colour', () => {
  for (const [name, value] of Object.entries(P)) assert.match(value, HEX, name);
});

test('the four Grain positions are visually distinct', () => {
  assert.equal(GRAIN_COLOR.length, 4);
  assert.equal(new Set(GRAIN_COLOR).size, 4);
  for (const c of GRAIN_COLOR) assert.match(c, HEX);
});

test('step clamps at both ends and interpolates between', () => {
  assert.equal(step('amber', -5), RAMP.amber[0]);
  assert.equal(step('amber', 99), RAMP.amber.at(-1));
  assert.equal(step('amber', 2), RAMP.amber[2]);
  const half = step('amber', 2.5);
  assert.match(half, HEX);
  assert.notEqual(half, RAMP.amber[2]);
  assert.notEqual(half, RAMP.amber[3]);
});

test('mix blends and clamps', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mix('#000000', '#ffffff', -3), '#000000');
  assert.equal(mix('#000000', '#ffffff', 9), '#ffffff');
});

test('alpha emits usable rgba', () => {
  assert.equal(alpha('#d99a3f', 0.4), 'rgba(217,154,63,0.4)');
});

test('there is a display face and a UI face, and they differ', () => {
  assert.ok(FONT.display.length > 0);
  assert.ok(FONT.ui.includes('monospace'));
  assert.notEqual(FONT.display, FONT.ui);
});
