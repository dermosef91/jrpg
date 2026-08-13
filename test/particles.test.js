import test from 'node:test';
import assert from 'node:assert/strict';
import { Particles, PRESETS } from '../src/engine/particles.js';

test('every preset is fully specified', () => {
  for (const [name, spec] of Object.entries(PRESETS)) {
    for (const key of ['count', 'shape', 'color', 'life', 'speed', 'size']) {
      assert.ok(spec[key] !== undefined, `${name} is missing ${key}`);
    }
    assert.ok(['dot', 'chip', 'streak'].includes(spec.shape), `${name} has shape ${spec.shape}`);
    assert.ok(spec.life[0] > 0 && spec.life[1] >= spec.life[0], `${name} has a bad life range`);
  }
});

test('a burst emits its preset count at the requested point', () => {
  const fx = new Particles();
  fx.burst('splinter', 100, 50);
  assert.equal(fx.items.length, PRESETS.splinter.count);
  for (const p of fx.items) {
    assert.equal(p.x, 100);
    assert.equal(p.y, 50);
  }
});

test('an unknown preset fails loudly rather than emitting nothing', () => {
  const fx = new Particles();
  assert.throws(() => fx.burst('nope', 0, 0), /unknown particle preset/);
});

test('aimed bursts stay inside their cone', () => {
  const fx = new Particles();
  fx.burst('spark', 0, 0, { angle: 0, spread: 0.4, count: 40 });
  for (const p of fx.items) {
    const a = Math.atan2(p.vy, p.vx);
    assert.ok(Math.abs(a) <= 0.21, `particle escaped the cone at ${a}`);
  }
});

test('particles expire, and the system drains to empty', () => {
  const fx = new Particles();
  fx.burst('splinter', 0, 0);
  fx.ring(0, 0, { life: 0.3 });
  assert.ok(fx.count > 0);
  for (let i = 0; i < 200; i++) fx.update(1 / 60);
  assert.equal(fx.count, 0, 'nothing may leak past its lifetime');
});

test('the pool is bounded, so a stuck emitter cannot grow without limit', () => {
  const fx = new Particles();
  for (let i = 0; i < 400; i++) fx.burst('splinter', 0, 0);
  assert.ok(fx.items.length <= 900, `pool grew to ${fx.items.length}`);
});

test('gravity and drag actually move things', () => {
  const fx = new Particles();
  fx.burst('splinter', 0, 0, { count: 1, angle: 0, spread: 0 });
  const p = fx.items[0];
  const vx0 = p.vx;
  for (let i = 0; i < 10; i++) fx.update(1 / 60);
  assert.ok(p.x > 0, 'a particle aimed along +x should travel');
  assert.ok(p.vx < vx0, 'drag should bleed horizontal speed');
  assert.ok(p.vy > 0, 'gravity should pull splinters down');
});

test('clear empties both particles and rings', () => {
  const fx = new Particles();
  fx.burst('spark', 0, 0);
  fx.ring(0, 0, {});
  fx.clear();
  assert.equal(fx.count, 0);
});
