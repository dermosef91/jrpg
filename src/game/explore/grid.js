import { P, mix, alpha } from '../../engine/palette.js';

// Top-down projection. Square tiles, screen axes and grid axes the same, and a
// camera that just follows the party.
//
// Elevation does not move anything up the screen the way it did in isometric --
// there is nowhere for it to go. It survives as the walk rule (one storey of
// climb) and as a drawn lip between tiles of different height, which is enough
// to read a staircase from above without pretending to a third dimension.

export const TS = 24;
/** How far a wall hangs down into the tile in front of it. */
export const WALL_FACE = 11;

/** Centre of a grid square, in world pixels. */
export function toScreen(x, y) {
  return { x: x * TS + TS / 2, y: y * TS + TS / 2 };
}

/** World pixels back to the grid square containing them. */
export function toGrid(sx, sy) {
  return { x: Math.floor(sx / TS), y: Math.floor(sy / TS) };
}

/**
 * One floor tile. Light comes from the top-left, so the north and west edges
 * catch it and the south and east edges fall away.
 *
 * `dim` is how far the tile has fallen out of the lamp, 0 lit to 1 gone. The
 * stone is shaded toward the void by it rather than having black laid over it,
 * which is what makes a lit pool read as light on rock.
 */
export function drawTile(r, sx, sy, def, { inlay = 0, dim = 0, seed = 0 } = {}) {
  const x = Math.round(sx - TS / 2);
  const y = Math.round(sy - TS / 2);
  const base = mix(def.top ?? P.stone, P.void, dim * 0.88);
  const lit = mix(base, P.boneWhite, 0.16 * (1 - dim));
  const dark = mix(base, P.void, 0.34);

  r.rect(x, y, TS, TS, base);
  // The flag's own bevel. Two pixels of it, so the grid reads as cut stone
  // rather than as a wireframe laid over a flat colour.
  r.hline(x, y, TS, lit);
  r.vline(x, y, TS, lit);
  r.hline(x, y + TS - 1, TS, dark);
  r.vline(x + TS - 1, y, TS, dark);

  // A little quarry variation, indexed off the tile so it never crawls.
  if (dim < 0.8) {
    const grit = mix(base, P.void, 0.14);
    const n = seed % 4;
    for (let i = 0; i <= n; i++) {
      const gx = x + 4 + ((seed * 7 + i * 11) % (TS - 8));
      const gy = y + 4 + ((seed * 13 + i * 5) % (TS - 8));
      r.rect(gx, gy, 2, 1, grit);
    }
  }

  if (inlay && dim < 0.94) drawInlay(r, sx, sy, inlay, def.dead, dim);
}

/** Ember channels cut into the stone. Patterns are indexed, not random, so a
 *  run of inlay reads as continuous when tiles sit next to each other. */
export function drawInlay(r, sx, sy, kind, dead = false, dim = 0) {
  // A dead channel is still a channel: cut into the stone, and empty. Drawn
  // near-black so "the seam is out" is something the player sees before anyone
  // says it out loud.
  const c = mix(dead ? mix(P.stoneShadow, P.void, 0.55) : P.ember, P.void, dim * 0.88);
  const hot = mix(dead ? P.void : P.emberBright, P.void, dim * 0.88);
  const half = TS / 2;
  const x = Math.round(sx);
  const y = Math.round(sy);
  const channel = (x0, y0, w, h) => {
    r.rect(x0, y0, w, h, c);
    // the cut edge, one pixel of it, on the light side
    if (h === 2) r.hline(x0, y0, w, mix(c, P.void, 0.45));
    else r.vline(x0, y0, h, mix(c, P.void, 0.45));
  };

  switch (kind) {
    case 1: // straight, west to east
      channel(x - half, y - 1, TS, 2);
      break;
    case 2: // straight, north to south
      channel(x - 1, y - half, 2, TS);
      break;
    case 3: // cross node
      channel(x - half, y - 1, TS, 2);
      channel(x - 1, y - half, 2, TS);
      r.circle(x, y, 4, c, { fill: false });
      r.circle(x, y, 2, hot);
      break;
    case 4: // corner, west into south
      channel(x - half, y - 1, half + 1, 2);
      channel(x - 1, y, 2, half);
      break;
    case 5: // ring
      r.circle(x, y, 7, c, { fill: false });
      r.circle(x, y, 6, mix(c, P.void, 0.4), { fill: false });
      r.circle(x, y, 2, hot);
      break;
    default:
      break;
  }
  if (kind === 1 || kind === 2 || kind === 4) {
    if (!dead) r.px(x, y, hot);
  }
}

/**
 * The lip between two tiles at different heights. Drawn on the low tile's edge
 * so a flight of steps reads as a flight of steps from directly above.
 */
export function drawStepEdge(r, sx, sy, side, drop, dim = 0) {
  const x = Math.round(sx - TS / 2);
  const y = Math.round(sy - TS / 2);
  const depth = Math.max(3, Math.min(7, 3 + drop * 2));
  const face = mix(P.bark, P.void, 0.2 + dim * 0.7);
  // Bone, not white: a terrace can run twenty squares, and a full-strength
  // highlight along all of it reads as a wire stretched across the floor.
  const lip = mix(P.stoneLit, P.void, 0.3 + dim * 0.65);
  const shade = alpha(P.void, 0.45 * (1 - dim));
  if (side === 'north') {
    r.rect(x, y, TS, depth, face);
    r.hline(x, y, TS, lip);
    r.rect(x, y + depth, TS, 2, alpha(P.void, 0.34 * (1 - dim)));
  } else if (side === 'west') {
    r.rect(x, y, depth, TS, face);
    r.vline(x, y, TS, lip);
    r.rect(x + depth, y, 2, TS, shade);
  } else if (side === 'east') {
    r.rect(x + TS - depth, y, depth, TS, face);
    r.vline(x + TS - 1, y, TS, lip);
    r.rect(x + TS - depth - 2, y, 2, TS, shade);
  } else {
    r.rect(x, y + TS - depth, TS, depth, face);
    r.hline(x, y + TS - 1, TS, lip);
  }
}

/**
 * A block of the rock the galleries were cut out of. `face` is how far it hangs
 * into the tile in front; pass 0 when the tile in front is also wall, so a run
 * of rock reads as one mass instead of a row of separate teeth.
 */
export function drawWall(r, sx, sy, { dim = 0, face = WALL_FACE, seed = 0, cap = true } = {}) {
  const x = Math.round(sx - TS / 2);
  const y = Math.round(sy - TS / 2);
  // Rock is near-black. The floor of these galleries is bone-pale, and the one
  // thing the player must never have to think about is which of the two they
  // can walk on -- so the two do not share a value range.
  const top = mix(P.root, P.void, dim * 0.75);
  const capColor = mix(P.barkHi, P.void, 0.35 + dim * 0.6);
  const wall = mix(P.black, P.void, dim * 0.6);
  const wallLit = mix(P.bark, P.void, 0.25 + dim * 0.65);

  r.rect(x, y, TS, TS, top);
  // A lit chamfer along the top of the mass -- but only where the mass actually
  // ends. Drawn on every square, it stripes a solid block of rock into rows.
  if (cap) {
    r.hline(x, y, TS, capColor);
    r.hline(x, y + 1, TS, mix(top, P.barkHi, 0.35 * (1 - dim)));
  }
  const off = (seed % 2) * 8;
  for (const bx of [6 + off, 17 - off]) {
    r.vline(x + bx, y + 2, TS - 2, mix(top, P.void, 0.5));
  }
  r.rect(x + 3 + (seed % 5), y + 8 + (seed % 4), 3, 2, mix(top, P.barkHi, 0.18 * (1 - dim)));

  if (face > 0) {
    r.rect(x, y + TS, TS, face, wall);
    r.hline(x, y + TS, TS, wallLit);
    for (const bx of [6 + off, 17 - off]) {
      r.vline(x + bx, y + TS + 1, face - 2, mix(wall, P.barkHi, 0.16 * (1 - dim)));
    }
    // The contact shadow where the rock meets the floor. This is what actually
    // sells the mass as standing on the ground in front of it.
    r.hline(x, y + TS + face - 1, TS, P.void);
    r.rect(x, y + TS + face, TS, 3, alpha(P.void, 0.42 * (1 - dim)));
  }
}

/** A drop shadow cast onto whatever tile is under an actor. */
export function groundShadow(r, sx, sy, w = 7) {
  r.ellipse(sx, sy, w, Math.max(2, Math.round(w * 0.4)), alpha(P.void, 0.55));
}


/**
 * Work out where the rock is. Every void square touching a walkable one is a
 * block of the stone the gallery was cut out of; a square with floor in front
 * of it also gets a face hanging down into that floor, and one with open air
 * above it gets a lit top edge.
 *
 * Pure, and separate from the scene, because "is every hole in the floor
 * actually filled with rock" is exactly the kind of thing worth asserting.
 */
export function buildWalls(map) {
  const out = [];
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      if (map.at(x, y)?.walk) continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
        .some(([dx, dy]) => map.at(x + dx, y + dy)?.walk);
      if (!touches) continue;
      const above = map.at(x, y - 1);
      out.push({
        x, y, wall: true, seed: (x * 7 + y * 13) % 6,
        face: map.at(x, y + 1)?.walk ? WALL_FACE : 0,
        cap: !above || !!above.walk,
      });
    }
  }
  return out;
}
