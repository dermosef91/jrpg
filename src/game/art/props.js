import { P, mix, alpha } from '../../engine/palette.js';
import { TW, TH } from '../explore/iso.js';

// Set dressing for the galleries: carved stone furniture with ember inlay, lit
// by its own light. Everything is drawn anchored to the centre-bottom of its
// tile so it sits correctly in the isometric stack.

export function drawProp(r, kind, sx, sy, { t = 0, open = false } = {}) {
  (PROPS[kind] ?? PROPS.rail)(r, sx, sy, t, open);
}

const PROPS = {
  /** A carved chest with an ember seam along the lid. */
  chest(r, x, y, t, open) {
    r.ellipse(x, y + 1, 8, 3, alpha(P.void, 0.5));
    const lidY = open ? y - 16 : y - 13;
    r.rect(x - 8, y - 10, 16, 10, P.bark);
    r.rect(x - 8, y - 10, 2, 10, P.barkLit);
    r.rect(x + 6, y - 10, 2, 10, P.root);
    r.hline(x - 8, y - 1, 16, P.void);
    // banding
    r.vline(x - 3, y - 10, 10, P.stoneShadow);
    r.vline(x + 2, y - 10, 10, P.stoneShadow);
    // lid
    r.rect(x - 9, lidY, 18, 4, open ? P.root : P.barkLit);
    r.hline(x - 9, lidY, 18, P.stoneDark);
    if (!open) {
      r.hline(x - 7, lidY + 2, 14, P.ember);
      r.px(x, lidY + 2, P.emberWhite);
      r.glow(x, lidY + 2, 12, P.emberDeep, 0.4);
    } else {
      r.rect(x - 6, y - 9, 12, 6, P.void);
      r.glow(x, y - 6, 14, P.emberDeep, 0.5);
    }
  },

  /** A standing lamp: stone pillar with a live shard in a cage. */
  lamp(r, x, y, t) {
    const flick = 0.85 + 0.15 * Math.sin(t * 6 + x * 0.3);
    r.ellipse(x, y + 1, 5, 2, alpha(P.void, 0.5));
    r.rect(x - 3, y - 18, 6, 18, P.stoneMid);
    r.rect(x - 3, y - 18, 2, 18, P.stoneLit);
    r.rect(x + 2, y - 18, 1, 18, P.stoneShadow);
    r.rect(x - 4, y - 20, 8, 2, P.stone);
    r.rect(x - 4, y - 1, 8, 2, P.stoneDark);
    // shard
    r.glow(x, y - 24, 22 * flick, P.ember, 0.45);
    r.poly([[x, y - 29], [x + 3, y - 24], [x, y - 19], [x - 3, y - 24]], P.emberHot);
    r.px(x, y - 24, P.emberWhite);
    for (let i = 0; i < 3; i++) r.hline(x - 5, y - 15 + i * 4, 10, alpha(P.ember, 0.3));
  },

  /** A planter of ember-leaved scrub. */
  planter(r, x, y, t) {
    r.ellipse(x, y + 1, 8, 3, alpha(P.void, 0.5));
    r.rect(x - 7, y - 7, 14, 7, P.stoneMid);
    r.rect(x - 7, y - 7, 14, 1, P.stoneLit);
    r.rect(x - 7, y - 1, 14, 1, P.stoneShadow);
    r.hline(x - 5, y - 4, 10, alpha(P.ember, 0.5));
    // foliage: sparse ember leaves on dark stems
    for (let i = 0; i < 7; i++) {
      const lean = Math.sin(t * 0.8 + i * 1.3) * 1.5;
      const bx = x - 5 + i * 1.8;
      const h = 6 + ((i * 5) % 7);
      r.line(bx, y - 7, bx + lean, y - 7 - h, P.root);
      r.px(Math.round(bx + lean), y - 8 - h, i % 2 ? P.ember : P.emberLit);
      if (i % 3 === 0) r.px(Math.round(bx + lean) + 1, y - 6 - h, P.emberDim);
    }
  },

  /** A rope rail at the edge of a drop. */
  rail(r, x, y, t) {
    r.rect(x - 9, y - 12, 2, 12, P.bark);
    r.rect(x + 7, y - 12, 2, 12, P.bark);
    r.px(x - 9, y - 13, P.emberDim);
    r.px(x + 7, y - 13, P.emberDim);
    for (const oy of [-10, -6]) {
      r.line(x - 8, y + oy, x + 8, y + oy + 1, P.stoneShadow);
    }
  },

  /** A lit doorway into a dome. */
  door(r, x, y, t) {
    r.rect(x - 11, y - 26, 22, 26, P.stoneMid);
    r.rect(x - 11, y - 26, 3, 26, P.stoneLit);
    r.rect(x + 8, y - 26, 3, 26, P.stoneShadow);
    for (let i = 0; i < 3; i++) r.hline(x - 11, y - 22 + i * 8, 22, P.stoneDark);
    // arch
    r.rect(x - 6, y - 20, 12, 20, P.black);
    r.circle(x, y - 20, 6, P.black);
    r.circle(x, y - 20, 6, P.ember, { fill: false });
    r.rect(x - 6, y - 20, 1, 20, P.ember);
    r.rect(x + 5, y - 20, 1, 20, P.ember);
    const pulse = 0.6 + 0.4 * Math.sin(t * 1.4);
    r.glow(x, y - 12, 18 * pulse, P.emberDeep, 0.5);
    r.hline(x - 4, y - 1, 9, P.emberLit);
  },
};

/** The great mosaic set into the plaza floor: a tree of ember lines. */
export function drawPlazaMosaic(r, sx, sy, t) {
  const pulse = 0.7 + 0.3 * Math.sin(t * 0.7);
  r.glow(sx, sy, 44, P.emberDeep, 0.18 * pulse);
  for (let i = 0; i < 3; i++) {
    ellipseRing(r, sx, sy, 40 - i * 12, 20 - i * 6, i === 0 ? P.ember : P.emberDeep);
  }
  // trunk and branches, drawn in the flattened iso plane
  r.line(sx, sy + 12, sx, sy - 6, P.emberLit);
  for (const [dx, dy] of [[-14, -2], [14, -2], [-9, -8], [9, -8], [0, -12]]) {
    r.line(sx, sy - 2, sx + dx, sy + dy, P.ember);
    r.px(sx + dx, sy + dy, P.emberBright);
  }
  for (const [dx, dy] of [[-7, 8], [7, 8], [0, 13]]) {
    r.line(sx, sy + 6, sx + dx, sy + dy, P.emberDeep);
  }
  r.px(sx, sy - 2, P.emberWhite);
}

function ellipseRing(r, cx, cy, rx, ry, color) {
  let prev = null;
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    if (prev) r.line(prev[0], prev[1], x, y, color);
    prev = [x, y];
  }
}

/** Hanging roots above the gallery, drawn over everything. */
export function drawHangingRoots(r, camX, camY, t) {
  const seed = 7919;
  for (let i = 0; i < 14; i++) {
    const h = ((i * seed) % 971) / 971;
    const x = Math.round(((i * 137) % 480));
    const drop = 12 + Math.floor(h * 46);
    const thick = 1 + (i % 3);
    for (let y = 0; y < drop; y++) {
      r.rect(x + Math.round(Math.sin(y * 0.16 + i) * 2), y, thick, 1, y > drop - 5 ? P.black : P.root);
    }
    if (i % 3 === 0) r.px(x + 1, drop, P.emberDeep);
  }
}
