import { P, mix, alpha } from '../../engine/palette.js';
import { makeRng } from '../../engine/rng.js';

// The low gallery: a carved chamber deep inside the Emberroot. A sun-mandala of
// inlaid fire burns on the back wall behind a bone monolith, colossal roots
// press in from both sides, and the floor is one enormous ritual circle.
//
// Cached whole -- it never changes, and it is by far the most expensive thing
// on screen.

export const ARENA_H = 192;
export const FLOOR_Y = 132;

export function drawArena(r, { width = 480, t = 0, kind = 'low' } = {}) {
  if (kind === 'stair') return drawStair(r, width, t);
  const sprite = r.cached('arena:low', width, ARENA_H, (rr) => paintArena(rr, width));
  r.blit(sprite, 0, 0);
  // The one live element: the mandala breathing.
  const pulse = 0.55 + 0.45 * Math.sin(t * 0.9);
  r.glow(width / 2, 62, 40 + pulse * 8, P.ember, 0.16 + pulse * 0.1);
  r.glow(width / 2, 62, 14, P.emberHot, 0.35 + pulse * 0.25);
}

/** The Quiet Stair, seen side on. A fight that happens in the dark should not
 *  cut to a sunlit hall: the shaft is the same rock, the same dead seam, and
 *  the same one lamp the player has been walking behind. */
function drawStair(r, W, t) {
  const sprite = r.cached('arena:stair', W, ARENA_H, (rr) => paintStair(rr, W));
  r.blit(sprite, 0, 0);
  // Zahra's lamp gutters. Kept small and dense on purpose: a wide, weak glow
  // dithers down to a lattice of single pixels and reads as a fault.
  const flicker = 1 + Math.sin(t * 3.3) * 0.07 + Math.sin(t * 9.1) * 0.03;
  r.glow(LAMP_X, LAMP_Y, Math.round(13 * flicker), P.ember, 0.5);
  r.glow(LAMP_X, LAMP_Y, Math.round(5 * flicker), P.emberWhite, 0.85);
}

const LAMP_X = 296;
const LAMP_Y = FLOOR_Y + 14;

/** Light falls off from the one lamp on the landing. Everything painted into
 *  the shaft is mixed toward the void by this before it is drawn, so the
 *  gradient is in the colours themselves and never in a dither pattern. */
function lampLit(x, y) {
  const d = Math.hypot((x - LAMP_X) / 232, (y - LAMP_Y) / 168);
  return Math.max(0, Math.min(1, 1 - d)) ** 1.5;
}

function paintStair(r, W) {
  const rng = makeRng(0x51a12);
  r.rect(0, 0, W, ARENA_H, P.void);

  // --- the shaft the stair was cut down --------------------------------------
  // Courses of dressed rock, uneven, climbing out of the lamp and into nothing.
  const courses = [];
  for (let y = -6, i = 0; y < FLOOR_Y; i++) {
    const h = 11 + (i % 3) * 4;
    courses.push({ y, h, offset: (i * 17) % 54 });
    y += h;
  }
  for (const course of courses) {
    for (let y = Math.max(0, course.y); y < Math.min(FLOOR_Y, course.y + course.h); y++) {
      const face = (y - course.y) / course.h;
      for (let x = 0; x < W; x += 2) {
        const lit = lampLit(x + 1, y);
        if (lit <= 0.02) continue;
        // top of each block catches the light, the underside does not
        const tone = face < 0.16 ? P.stoneMid : face > 0.82 ? P.stoneShadow : P.stoneDark;
        r.rect(x, y, 2, 1, mix(P.void, tone, lit * 0.82));
      }
    }
    // the joint under each course, and the vertical joints along it
    for (let x = 0; x < W; x += 2) {
      const lit = lampLit(x, course.y + course.h - 1);
      if (lit <= 0.02) continue;
      r.rect(x, course.y + course.h - 1, 2, 1, mix(P.void, P.black, lit * 0.7));
    }
    for (let x = course.offset - 54; x < W; x += 54) {
      const lit = lampLit(x, course.y + course.h / 2);
      if (lit <= 0.02) continue;
      r.vline(x, Math.max(0, course.y), Math.min(FLOOR_Y - course.y, course.h) - 1,
        mix(P.void, P.black, lit * 0.6));
    }
  }

  // --- the dead seam ---------------------------------------------------------
  // Still cut into the wall, still running the whole height, and out.
  for (const sx of [LAMP_X - 168, LAMP_X - 82, LAMP_X + 96]) {
    for (let y = 0; y < FLOOR_Y; y++) {
      const lit = lampLit(sx, y);
      if (lit <= 0.02) continue;
      r.px(sx, y, mix(P.void, P.black, lit * 0.95));
      r.px(sx + 1, y, mix(P.void, P.stoneShadow, lit * 0.7));
    }
  }
  // the empty sockets where shards used to sit in the seam
  for (let i = 0; i < 6; i++) {
    const sx = LAMP_X - 82;
    const sy = 14 + i * 22;
    const lit = lampLit(sx, sy);
    if (lit <= 0.03) continue;
    r.circle(sx, sy, 3, mix(P.void, P.black, lit), { fill: true });
    r.circle(sx, sy, 3, mix(P.void, P.stoneShadow, lit * 0.8), { fill: false });
  }

  // --- roots through the joints, and the dark closing in ---------------------
  rootMass(r, rng, -36, 0, 78, ARENA_H, 1);
  rootMass(r, rng, W - 42, 0, 78, ARENA_H, -1);
  overheadRoots(r, rng, W);

  stairFloor(r, W);
}

/** The landing the fight happens on. Flagged stone, lit only where the lamp
 *  puts light on it, with the rest of the stair dropping away below frame. */
function stairFloor(r, W) {
  const fy = FLOOR_Y;
  r.rect(0, fy, W, ARENA_H - fy, P.void);
  for (let y = fy; y < ARENA_H; y++) {
    for (let x = 0; x < W; x += 2) {
      const lit = lampLit(x + 1, y);
      if (lit <= 0.02) continue;
      r.rect(x, y, 2, 1, mix(P.void, P.stoneDark, lit * 0.75));
    }
  }
  // the lip where the wall meets the floor
  for (let x = 0; x < W; x += 2) {
    const lit = lampLit(x, fy);
    if (lit <= 0.02) continue;
    r.rect(x, fy, 2, 1, mix(P.void, P.stoneLit, lit * 0.8));
    r.rect(x, fy + 1, 2, 1, mix(P.void, P.black, lit * 0.6));
  }
  // Flags, drawn in perspective: the joints splay as they come toward the
  // camera, which is what tells the eye this is a floor and not a back wall.
  for (let i = -7; i <= 7; i++) {
    for (let y = fy + 3; y < ARENA_H; y++) {
      const d = (y - fy) / (ARENA_H - fy);
      const x = Math.round(LAMP_X + i * 34 * (0.5 + d * 1.5));
      if (x < 0 || x >= W) continue;
      const lit = lampLit(x, y);
      if (lit <= 0.04) continue;
      r.px(x, y, mix(P.void, P.black, lit * 0.55));
    }
  }
  for (let i = 1; i <= 3; i++) {
    const y = fy + 8 + i * 17;
    for (let x = 0; x < W; x += 2) {
      const lit = lampLit(x, y);
      if (lit <= 0.04) continue;
      r.rect(x, y, 2, 1, mix(P.void, P.black, lit * 0.5));
    }
  }
  // The stair carries on down past the bottom of the frame.
  for (let y = ARENA_H - 9; y < ARENA_H; y++) {
    const k = (y - (ARENA_H - 9)) / 9;
    r.hline(0, y, W, alpha(P.void, 0.35 + k * 0.6));
  }
}

function paintArena(r, W) {
  const cx = W >> 1;
  const rng = makeRng(0x5eed17);

  r.rect(0, 0, W, ARENA_H, P.void);

  // --- back wall, faintly lit from the mandala ---
  for (let y = 0; y < FLOOR_Y; y++) {
    const d = 1 - Math.abs(y - 62) / 120;
    if (d > 0) r.dither(0, y, W, 1, P.black, d * 0.55);
  }

  sunMandala(r, cx, 62);
  monolith(r, cx - 9, 24, 18, 108, true);
  monolith(r, cx - 104, 40, 15, 92, false);
  monolith(r, cx + 90, 36, 15, 96, false);
  monolith(r, cx - 146, 50, 12, 82, false);
  monolith(r, cx + 135, 54, 12, 78, false);

  // --- root masses down both edges, and arching overhead ---
  rootMass(r, rng, -10, 0, 96, ARENA_H, 1);
  rootMass(r, rng, W - 86, 0, 96, ARENA_H, -1);
  overheadRoots(r, rng, W);

  floor(r, W, cx);
}

/** The sun that is left: a heavy ring, wedge spokes, and a white core. */
function sunMandala(r, cx, cy) {
  r.glow(cx, cy, 58, P.emberDeep, 0.45);
  // wedge spokes -- solid triangles, so it reads as carved rather than hairy
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const wide = 0.055;
    r.poly([
      [cx + Math.cos(a) * 24, cy + Math.sin(a) * 24],
      [cx + Math.cos(a - wide) * 50, cy + Math.sin(a - wide) * 50],
      [cx + Math.cos(a + wide) * 50, cy + Math.sin(a + wide) * 50],
    ], i % 3 === 0 ? P.ember : P.emberDeep);
  }
  ring(r, cx, cy, 52, P.emberDim, 2);
  ring(r, cx, cy, 46, P.emberDeep, 1);
  ring(r, cx, cy, 22, P.emberLit, 2);
  ring(r, cx, cy, 18, P.emberDeep, 1);
  // outer tick band
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const len = i % 3 === 0 ? 4 : 2;
    r.line(cx + Math.cos(a) * 56, cy + Math.sin(a) * 56,
      cx + Math.cos(a) * (56 + len), cy + Math.sin(a) * (56 + len),
      i % 3 === 0 ? P.ember : P.emberDeep);
  }
  r.circle(cx, cy, 11, P.emberHot);
  r.circle(cx, cy, 6, P.emberWhite);
}

function ring(r, cx, cy, radius, color, weight = 1) {
  for (let w = 0; w < weight; w++) r.circle(cx, cy, radius - w, color, { fill: false });
}

/** A carved bone slab. Wide enough to read as architecture, with a single
 *  ember channel and a glyph cut into the face. */
function monolith(r, x, y, w, h, tall) {
  // chamfered cap
  r.rect(x + 2, y - 5, w - 4, 3, P.stoneMid);
  r.rect(x, y - 2, w, 3, P.stoneLit);
  // body, lit from the mandala side
  r.rect(x, y, w, h, P.stone);
  r.rect(x, y, 3, h, P.boneLit);
  r.rect(x + w - 3, y, 3, h, P.stoneDark);
  // cut courses
  for (let i = 14; i < h - 6; i += 22) {
    r.hline(x, y + i, w, P.stoneDark);
    r.hline(x, y + i + 1, w, P.stoneShadow);
  }
  // ember channel and glyph
  const ix = x + (w >> 1);
  r.vline(ix, y + 6, h - 14, P.emberDeep);
  r.vline(ix - 1, y + 6, h - 14, alpha(P.ember, 0.35));
  if (tall) {
    r.circle(ix, y + 22, 5, P.ember, { fill: false });
    r.circle(ix, y + 22, 2, P.emberHot);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      r.px(Math.round(ix + Math.cos(a) * 7), Math.round(y + 22 + Math.sin(a) * 7), P.emberBright);
    }
  } else {
    r.rect(ix - 3, y + 18, 7, 2, P.ember);
    r.rect(ix - 2, y + 26, 5, 2, P.emberDeep);
  }
  // footing
  r.rect(x - 2, y + h, w + 4, 4, P.stoneMid);
  r.rect(x - 2, y + h, w + 4, 1, P.stoneLit);
  r.rect(x - 3, y + h + 4, w + 6, 2, P.stoneShadow);
}

/** A bundle of colossal roots pressing in from one side. */
function rootMass(r, rng, x, y, w, h, dir) {
  for (let i = 0; i < 9; i++) {
    const thick = 6 + Math.floor(rng.next() * 12);
    let px = x + (dir > 0 ? i * 9 : w - i * 9);
    let py = y - 10;
    const shade = i % 3 === 0 ? P.rootLit : i % 3 === 1 ? P.root : P.black;
    while (py < h + 8) {
      const wob = Math.sin(py * 0.06 + i * 1.7) * 5;
      r.rect(px + wob, py, thick, 3, shade);
      // lit edge on the mandala-facing side
      r.vline(px + wob + (dir > 0 ? thick - 1 : 0), py, 3, mix(shade, P.bark, 0.6));
      py += 3;
      px += dir * (rng.next() < 0.4 ? 1 : 0);
    }
  }
  // a few ember-lit fissures in the root wall
  for (let i = 0; i < 5; i++) {
    const fx = x + 10 + Math.floor(rng.next() * (w - 20));
    const fy = 20 + Math.floor(rng.next() * (h - 60));
    const len = 8 + Math.floor(rng.next() * 18);
    for (let s = 0; s < len; s++) {
      r.px(fx + Math.round(Math.sin(s * 0.5) * 2), fy + s, s % 3 ? P.emberDeep : P.emberDim);
    }
  }
}

function overheadRoots(r, rng, W) {
  for (let i = 0; i < 7; i++) {
    const sx = Math.floor(rng.next() * W);
    const drop = 10 + Math.floor(rng.next() * 34);
    const thick = 2 + Math.floor(rng.next() * 4);
    for (let y = 0; y < drop; y++) {
      r.rect(sx + Math.round(Math.sin(y * 0.2 + i) * 2), y, thick, 1,
        y > drop - 6 ? P.black : P.root);
    }
    if (rng.next() < 0.5) r.px(sx + 1, drop, P.emberDeep);
  }
}

/** The ritual circle: one enormous inlay seen in perspective. Kept sparse --
 *  three rings, eight spokes, four cardinal glyphs. Any more and it turns to
 *  noise at this resolution. */
function floor(r, W, cx) {
  const fy = FLOOR_Y;
  r.rect(0, fy, W, ARENA_H - fy, P.black);
  for (let y = fy; y < ARENA_H; y++) {
    const d = (y - fy) / (ARENA_H - fy);
    r.dither(0, y, W, 1, P.root, 0.2 + d * 0.4);
  }
  r.hline(0, fy, W, P.rootLit);
  r.hline(0, fy + 1, W, alpha(P.void, 0.6));

  // Two rings and eight short ticks. Spokes running all the way to the centre
  // turn to spaghetti once figures stand on them, so they stop at the inner ring.
  const ccy = fy + 48;
  ellipseRing(r, cx, ccy, 188, 37, P.emberDeep);
  ellipseRing(r, cx, ccy, 184, 36, P.ember);
  ellipseRing(r, cx, ccy, 132, 26, P.emberDeep);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    r.line(cx + c * 132, ccy + sn * 26, cx + c * 184, ccy + sn * 36,
      i % 4 === 0 ? P.ember : P.emberDeep);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const gx = Math.round(cx + Math.cos(a) * 158);
    const gy = Math.round(ccy + Math.sin(a) * 31);
    r.poly([[gx, gy - 3], [gx + 4, gy], [gx, gy + 3], [gx - 4, gy]], P.ember);
    r.px(gx, gy, P.emberHot);
  }
  r.glow(cx, ccy, 46, P.emberDeep, 0.16);
}

function ellipseRing(r, cx, cy, rx, ry, color) {
  let prev = null;
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    if (prev) r.line(prev[0], prev[1], x, y, color);
    prev = [x, y];
  }
}
