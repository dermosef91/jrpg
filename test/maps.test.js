import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/game/world/maps.js';

const walkable = (map, x, y) => {
  const ch = map.tiles[y]?.[x];
  if (ch === undefined) return false;
  return !(map.legend[ch]?.solid ?? true);
};

/** Every tile reachable on foot from the map's default spawn. */
function reachable(map) {
  const seen = new Set([`${map.spawn.x},${map.spawn.y}`]);
  const queue = [[map.spawn.x, map.spawn.y]];
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const key = `${x + dx},${y + dy}`;
      if (seen.has(key) || !walkable(map, x + dx, y + dy)) continue;
      seen.add(key);
      queue.push([x + dx, y + dy]);
    }
  }
  return seen;
}

test('every map is rectangular and non-empty', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    assert.ok(map.h > 0, `${id} has no rows`);
    for (const row of map.tiles) assert.equal(row.length, map.w, `${id} has a ragged row`);
  }
});

test('every tile character has a legend entry', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    for (const row of map.tiles) {
      for (const ch of row) {
        assert.ok(map.legend[ch], `${id} uses '${ch}' with no legend entry`);
      }
    }
  }
});

test('you can stand where you spawn', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    assert.ok(walkable(map, map.spawn.x, map.spawn.y),
      `${id} spawns inside a solid tile`);
  }
});

test('every exit leads to a real map and lands somewhere you can stand', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    for (const exit of map.entities.filter((e) => e.kind === 'exit')) {
      const dest = MAPS[exit.to];
      assert.ok(dest, `${id} exits to unknown map '${exit.to}'`);
      assert.ok(walkable(dest, exit.spawn.x, exit.spawn.y),
        `${id} -> ${exit.to} lands in a solid tile at ${exit.spawn.x},${exit.spawn.y}`);
    }
  }
});

test('every entity can actually be walked up to', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    const seen = reachable(map);
    for (const e of map.entities) {
      const adjacent = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]
        .some(([dx, dy]) => seen.has(`${e.x + dx},${e.y + dy}`));
      assert.ok(adjacent,
        `${id}: ${e.kind} ${e.label ?? e.name ?? ''} at ${e.x},${e.y} is unreachable`);
    }
  }
});

test('the town tiers form a loop back to the ground', () => {
  const links = new Map(Object.entries(MAPS).map(([id, map]) => [
    id, map.entities.filter((e) => e.kind === 'exit').map((e) => e.to),
  ]));
  assert.ok(links.get('braid').includes('cordwain_mid'));
  assert.ok(links.get('cordwain_mid').includes('braid'));
  for (const tier of ['cordwain_root', 'cordwain_crown']) {
    assert.ok(links.get('cordwain_mid').includes(tier), `Mid does not reach ${tier}`);
    assert.ok(links.get(tier).includes('cordwain_mid'), `${tier} does not return to Mid`);
  }
});

test('every dialogue beat has text to show', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    for (const e of map.entities.filter((x) => x.beats)) {
      assert.ok(e.beats.length > 0, `${id}: ${e.name ?? e.kind} has no beats`);
      for (const beat of e.beats) {
        assert.equal(typeof beat.text, 'string');
        assert.ok(beat.text.trim().length > 0, `${id}: empty beat`);
      }
    }
  }
});
