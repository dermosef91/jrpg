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

export function drawArena(r, { width = 480, t = 0 } = {}) {
  const sprite = r.cached('arena:low', width, ARENA_H, (rr) => paintArena(rr, width));
  r.blit(sprite, 0, 0);
  // The one live element: the mandala breathing.
  const pulse = 0.55 + 0.45 * Math.sin(t * 0.9);
  r.glow(width / 2, 62, 40 + pulse * 8, P.ember, 0.16 + pulse * 0.1);
  r.glow(width / 2, 62, 14, P.emberHot, 0.35 + pulse * 0.25);
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
