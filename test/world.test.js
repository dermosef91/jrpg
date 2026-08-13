import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, MAP_IDS, NPC_LINES } from '../src/game/explore/maps.js';
import { OPENING, BEATS, BEATS_AGAIN, DESCEND_AGAIN } from '../src/game/story/prologue.js';
import { ENCOUNTERS } from '../src/game/data/foes.js';
import { toScreen, toGrid, TS, buildWalls } from '../src/game/explore/grid.js';
import { effectiveStats, EQUIPMENT, SLOTS } from '../src/game/data/equipment.js';
import { makeParty, DEFAULT_FORMATION } from '../src/game/data/party.js';
import { ROUTE_NODES, ROUTE_EDGES } from '../src/game/data/route.js';
import { SHARDS, STARTING_SHARDS } from '../src/game/data/shards.js';
import { planLayout } from '../src/engine/touch.js';

test('the grid projection round-trips through screen space', () => {
  for (const [x, y] of [[0, 0], [3, 7], [12, 4], [19, 15]]) {
    const s = toScreen(x, y);
    const g = toGrid(s.x, s.y);
    assert.equal(g.x, x, `x drifted: ${g.x} vs ${x}`);
    assert.equal(g.y, y, `y drifted: ${g.y} vs ${y}`);
  }
});

test('screen axes and grid axes agree, which is the point of top-down', () => {
  const origin = toScreen(4, 4);
  assert.equal(toScreen(5, 4).y, origin.y, 'walking east moved the party vertically');
  assert.equal(toScreen(4, 5).x, origin.x, 'walking south moved the party horizontally');
  assert.equal(toScreen(5, 4).x - origin.x, TS, 'one square east is not one tile wide');
  assert.equal(toScreen(4, 5).y - origin.y, TS, 'one square south is not one tile tall');
});

test('every corner of a tile maps back to that tile', () => {
  for (const [x, y] of [[0, 0], [6, 2], [11, 9]]) {
    const s = toScreen(x, y);
    for (const [ox, oy] of [[-TS / 2, -TS / 2], [TS / 2 - 1, -TS / 2],
      [-TS / 2, TS / 2 - 1], [TS / 2 - 1, TS / 2 - 1]]) {
      const g = toGrid(s.x + ox, s.y + oy);
      assert.deepEqual(g, { x, y }, `corner ${ox},${oy} of ${x},${y} fell into ${g.x},${g.y}`);
    }
  }
});

test('every walkable tile is reachable on foot from the spawn', () => {
  for (const id of MAP_IDS) {
    const map = buildMap(id);
    assert.ok(map.walkable(map.spawn.x, map.spawn.y), `${id} spawn is inside a wall`);
    const seen = new Set([`${map.spawn.x},${map.spawn.y}`]);
    const queue = [[map.spawn.x, map.spawn.y]];
    while (queue.length) {
      const [x, y] = queue.pop();
      const from = map.at(x, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        const to = map.at(nx, ny);
        if (seen.has(key) || !to?.walk) continue;
        if (Math.abs(to.z - from.z) > 1) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
    let walkable = 0;
    for (const row of map.cells) for (const c of row) if (c.walk) walkable++;
    assert.equal(seen.size, walkable, `${id}: ${walkable - seen.size} tiles are stranded`);
  }
});

test('every prop can be walked up to, and every NPC has lines', () => {
  for (const id of MAP_IDS) {
    const map = buildMap(id);
    for (const prop of map.props) {
      const adjacent = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dy]) => map.walkable(prop.x + dx, prop.y + dy));
      assert.ok(adjacent, `${id}: ${prop.kind} at ${prop.x},${prop.y} is unreachable`);
      if (prop.kind === 'npc') {
        const lines = NPC_LINES[`${id}:${prop.x},${prop.y}`];
        assert.ok(lines, `npc at ${id}:${prop.x},${prop.y} has no lines`);
        assert.ok(lines.before?.length && lines.after?.length,
          `npc at ${id}:${prop.x},${prop.y} needs both prologue states`);
      }
    }
  }
});

test('every NPC line block belongs to a real npc prop', () => {
  const placed = new Set();
  for (const id of MAP_IDS) {
    for (const prop of buildMap(id).props) {
      if (prop.kind === 'npc') placed.add(`${id}:${prop.x},${prop.y}`);
    }
  }
  for (const key of Object.keys(NPC_LINES)) {
    assert.ok(placed.has(key), `${key} has lines but nobody is standing there`);
  }
});

test('equipment adds to base stats and never zeroes one out', () => {
  const party = makeParty();
  for (const c of party) {
    const base = c.stats;
    const worn = effectiveStats(c);
    for (const key of Object.keys(base)) {
      assert.ok(worn[key] >= 1, `${c.name} ${key} fell to ${worn[key]}`);
    }
    assert.ok(worn.str >= base.str, `${c.name} lost STR by equipping`);
  }
});

test('every default loadout references real gear in the right slot', () => {
  for (const c of makeParty()) {
    for (const slot of SLOTS) {
      const id = c.equipment[slot];
      assert.ok(id, `${c.name} has an empty ${slot}`);
      const item = EQUIPMENT[id];
      assert.ok(item, `${c.name} wears unknown ${id}`);
      assert.equal(item.slot, slot, `${id} is a ${item.slot}, worn as ${slot}`);
    }
  }
});

test('the starting formation is legal', () => {
  const ids = new Set(makeParty().map((c) => c.id));
  assert.equal(DEFAULT_FORMATION.length, 3, 'the battle art shows three in the line');
  for (const id of DEFAULT_FORMATION) assert.ok(ids.has(id), `${id} is not in the party`);
  assert.equal(new Set(DEFAULT_FORMATION).size, 3, 'no duplicates in the line');
});

test('the world route is a connected graph with no dangling edges', () => {
  const ids = new Set(ROUTE_NODES.map((n) => n.id));
  for (const [a, b] of ROUTE_EDGES) {
    assert.ok(ids.has(a) && ids.has(b), `edge ${a}-${b} points at nothing`);
  }
  const seen = new Set([ROUTE_NODES[0].id]);
  const queue = [ROUTE_NODES[0].id];
  while (queue.length) {
    const at = queue.pop();
    for (const [a, b] of ROUTE_EDGES) {
      const other = a === at ? b : b === at ? a : null;
      if (other && !seen.has(other)) { seen.add(other); queue.push(other); }
    }
  }
  assert.equal(seen.size, ROUTE_NODES.length, 'some holds cannot be walked to');
  assert.equal(ROUTE_NODES.filter((n) => n.here).length, 1, 'the party is in exactly one place');
});

test('every shard the party starts with is a real shard', () => {
  const ids = new Set(SHARDS.map((s) => s.id));
  for (const id of Object.keys(STARTING_SHARDS)) assert.ok(ids.has(id), `unknown shard ${id}`);
  assert.equal(SHARDS.length, 10, 'the menu art lays out ten shard slots');
  for (const shard of SHARDS) {
    assert.ok(shard.short && shard.short.length <= 4,
      `${shard.id} needs a short label that fits an inventory cell`);
  }
});

test('touch controls reserve space rather than covering the game', () => {
  const phone = planLayout({ width: 844, height: 390 }, 44);
  assert.equal(phone.mode, 'side');
  assert.equal(phone.insets.left, phone.insets.right, 'gutters must stay symmetric');

  const tablet = planLayout({ width: 1024, height: 768 }, 52);
  assert.ok(['band', 'side'].includes(tablet.mode));

  // A cramped phone must still reserve rather than park a thumb on the command
  // menu, even though doing so costs integer scaling.
  const small = planLayout({ width: 667, height: 375 }, 38);
  assert.notEqual(small.mode, 'overlay');

  for (const vp of [{ width: 320, height: 240 }, { width: 1920, height: 1080 }]) {
    const plan = planLayout(vp, 44);
    assert.ok(plan.scale > 0, `${vp.width}x${vp.height} produced no stage`);
    assert.ok(['side', 'band', 'overlay'].includes(plan.mode));
  }
});

test('the chosen touch layout always maximises the remaining stage', () => {
  for (const vp of [
    { width: 844, height: 390 }, { width: 1024, height: 768 },
    { width: 667, height: 375 }, { width: 1180, height: 820 },
  ]) {
    const key = 44;
    const plan = planLayout(vp, key);
    if (plan.mode === 'overlay') continue;
    const need = key * 3 + 24;
    const side = Math.min((vp.width - need * 2) / 480, vp.height / 270);
    const band = Math.min(vp.width / 480, (vp.height - need) / 270);
    assert.ok(plan.scale >= Math.max(side, band) - 1e-9,
      `${vp.width}x${vp.height} picked ${plan.mode} at ${plan.scale.toFixed(3)}`);
  }
});

test('the prologue only sends the party to maps that exist', () => {
  const maps = new Set(MAP_IDS);
  const scripts = [OPENING, DESCEND_AGAIN,
    ...Object.values(BEATS), ...Object.values(BEATS_AGAIN)];
  for (const script of scripts) {
    for (const step of script) {
      if (!step.goTo) continue;
      assert.ok(maps.has(step.goTo.map), `prologue walks into unknown map ${step.goTo.map}`);
    }
  }
});

test('every story beat is hung on a trigger that is actually placed', () => {
  const triggers = new Set();
  for (const id of MAP_IDS) {
    for (const prop of buildMap(id).props) {
      if (prop.kind === 'trigger') triggers.add(prop.id);
    }
  }
  for (const key of Object.keys(BEATS)) {
    assert.ok(triggers.has(key), `beat ${key} has no trigger tile to fire it`);
  }
  for (const id of triggers) {
    assert.ok(BEATS[id], `trigger ${id} sits on the floor doing nothing`);
  }
  for (const key of Object.keys(BEATS_AGAIN)) {
    assert.ok(triggers.has(key), `second-visit beat ${key} has no trigger tile`);
    assert.ok(BEATS[key], `${key} only exists on a second visit, which cannot happen`);
  }
});

test('the descent hands the player triggers in the order the beats are written', () => {
  const stair = buildMap('quietstair');
  const triggers = stair.props.filter((p) => p.kind === 'trigger');
  const byDepth = [...triggers].sort((a, b) => a.y - b.y || a.x - b.x);
  const numbers = byDepth.map((p) => Number(p.id.split(':')[1]));
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b),
    'beats fire out of order as the party walks down');
});

test('every battle the prologue starts is a real encounter', () => {
  const ids = new Set(ENCOUNTERS.map((e) => e.id));
  for (const script of [OPENING, DESCEND_AGAIN,
    ...Object.values(BEATS), ...Object.values(BEATS_AGAIN)]) {
    for (const step of script) {
      if (!step.battle) continue;
      assert.ok(ids.has(step.battle.encounter), `unknown encounter ${step.battle.encounter}`);
      const enc = ENCOUNTERS.find((e) => e.id === step.battle.encounter);
      assert.ok(enc.scripted || enc.boss,
        `${enc.id} is fired by the story but can also turn up at random`);
    }
  }
});

test('the scripted opening never leaves the player without a fade back in', () => {
  for (const [name, script] of [['OPENING', OPENING],
    ...Object.entries(BEATS), ...Object.entries(BEATS_AGAIN)]) {
    let dark = false;
    for (const step of script) {
      if (step.fade === 'out') dark = true;
      if (step.fade === 'in') dark = false;
    }
    assert.equal(dark, false, `${name} ends with the screen still black`);
  }
});

test('the rock a gallery was cut out of surrounds every walkable square', () => {
  // Top down, a void square beside the floor is drawn as a block of rock. Miss
  // one and the floor has a hole straight through to the black, which reads as
  // a rendering fault rather than as a cliff.
  for (const id of MAP_IDS) {
    const map = buildMap(id);
    const rock = new Set(buildWalls(map).map((w) => `${w.x},${w.y}`));
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (!map.walkable(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (map.walkable(nx, ny)) continue;
          if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
          assert.ok(rock.has(`${nx},${ny}`),
            `${id}: gap beside ${x},${y} -- ${nx},${ny} is neither floor nor rock`);
        }
      }
    }
  }
});

test('rock only wears a face where there is floor for it to stand on', () => {
  for (const id of MAP_IDS) {
    const map = buildMap(id);
    for (const w of buildWalls(map)) {
      const front = map.at(w.x, w.y + 1);
      assert.equal(w.face > 0, !!front?.walk,
        `${id}: rock at ${w.x},${w.y} has the wrong face for what is in front of it`);
      const above = map.at(w.x, w.y - 1);
      assert.equal(w.cap, !above || !!above.walk,
        `${id}: rock at ${w.x},${w.y} is lit on a top edge buried in more rock`);
    }
  }
});

test('a map is small enough that walking it does not need a scrolling epic', () => {
  // 24px squares against a 480x270 frame: 20 across and 11 down are on screen at
  // once. A map far bigger than that stops being a place and becomes a corridor.
  for (const id of MAP_IDS) {
    const map = buildMap(id);
    assert.ok(map.w * TS <= 480 * 3, `${id} is ${map.w} squares wide`);
    assert.ok(map.h * TS <= 270 * 6, `${id} is ${map.h} squares tall`);
  }
});

test('elevation only ever changes by one storey between neighbours', () => {
  // The climb rule allows one storey. A two-storey jump between adjacent walkable
  // squares would be a step the party can see and cannot take.
  for (const id of MAP_IDS) {
    const map = buildMap(id);
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const cell = map.at(x, y);
        if (!cell.walk) continue;
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const n = map.at(x + dx, y + dy);
          if (!n?.walk) continue;
          assert.ok(Math.abs(n.z - cell.z) <= 1,
            `${id}: ${x},${y} at z${cell.z} abuts ${x + dx},${y + dy} at z${n.z}`);
        }
      }
    }
  }
});
