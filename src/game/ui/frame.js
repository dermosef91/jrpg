import { P, mix, alpha } from '../../engine/palette.js';

// UI chrome, straight off the concept art: near-black plates, a bone hairline,
// an ember inner rule, and hard corner brackets. Nothing is rounded and nothing
// is soft -- every edge lands on the pixel grid.

/** A plain plate: dark fill, bone border, ember corner ticks. */
export function panel(r, x, y, w, h, {
  fill = P.black, border = P.stoneDark, accent = P.ember, inner = true, ticks = true,
} = {}) {
  r.rect(x, y, w, h, fill);
  r.frame(x, y, w, h, border, 1);
  if (inner) {
    r.frame(x + 2, y + 2, w - 4, h - 4, alpha(accent, 0.28), 1);
  }
  if (ticks) cornerTicks(r, x, y, w, h, accent, 4);
}

/** Hard L brackets at each corner. */
export function cornerTicks(r, x, y, w, h, color, len = 4) {
  r.hline(x, y, len, color);
  r.vline(x, y, len, color);
  r.hline(x + w - len, y, len, color);
  r.vline(x + w - 1, y, len, color);
  r.hline(x, y + h - 1, len, color);
  r.vline(x, y + h - len, len, color);
  r.hline(x + w - len, y + h - 1, len, color);
  r.vline(x + w - 1, y + h - len, len, color);
}

/** The heavy screen border: ember rule, tracery, and root ornaments at the
 *  corners. Cached, because it is identical every frame. */
export function ornateBorder(r, x, y, w, h, { color = P.ember, dim = P.emberDeep } = {}) {
  const sprite = r.cached(`ornate:${w}x${h}:${color}`, w, h, (rr) => {
    rr.frame(0, 0, w, h, color, 1);
    rr.frame(2, 2, w - 4, h - 4, dim, 1);
    // tracery: short ticks along the rules, like inlaid circuitry
    for (let i = 10; i < w - 10; i += 12) {
      rr.vline(i, 0, 3, dim);
      rr.vline(i + 4, 0, 2, color);
      rr.vline(i, h - 3, 3, dim);
      rr.vline(i + 4, h - 2, 2, color);
    }
    for (let i = 10; i < h - 10; i += 12) {
      rr.hline(0, i, 3, dim);
      rr.hline(0, i + 4, 2, color);
      rr.hline(w - 3, i, 3, dim);
      rr.hline(w - 2, i + 4, 2, color);
    }
    for (const [cx, cy, sx, sy] of [
      [0, 0, 1, 1], [w - 1, 0, -1, 1], [0, h - 1, 1, -1], [w - 1, h - 1, -1, -1],
    ]) {
      rootOrnament(rr, cx, cy, sx, sy, color, dim);
    }
  });
  r.blit(sprite, x, y);
}

/** A small branching root motif, mirrored into each corner. */
function rootOrnament(r, x, y, sx, sy, color, dim) {
  const put = (dx, dy, c) => r.px(x + dx * sx, y + dy * sy, c);
  const trunk = [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8]];
  for (const [dx, dy] of trunk) put(dx, dy, color);
  for (const [dx, dy] of [[5, 3], [6, 2], [7, 2], [3, 5], [2, 6], [2, 7]]) put(dx, dy, dim);
  for (const [dx, dy] of [[8, 5], [9, 4], [5, 8], [4, 9], [10, 10], [11, 9], [9, 11]]) put(dx, dy, dim);
  put(6, 6, P.emberHot);
}

/** A segmented meter, as drawn on the battle HUD. */
export function meter(r, x, y, w, h, ratio, {
  color = P.ember, back = P.ink0, border = P.stoneShadow, segments = true,
} = {}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  r.rect(x, y, w, h, back);
  const fill = Math.round((w - 2) * clamped);
  if (fill > 0) {
    r.rect(x + 1, y + 1, fill, h - 2, color);
    r.hline(x + 1, y + 1, fill, mix(color, P.boneWhite, 0.35));
  }
  r.frame(x, y, w, h, border, 1);
  if (segments) {
    for (let i = x + 5; i < x + w - 2; i += 5) r.vline(i, y + 1, h - 2, alpha(P.void, 0.55));
  }
}

/** Selection cursor: the solid triangle used in every menu in the art. */
export function cursor(r, x, y, color = P.emberBright, size = 4) {
  for (let i = 0; i < size; i++) {
    const span = size - i;
    r.vline(x + i, y + i - Math.floor(size / 2) + 1, Math.max(1, span * 2 - 1), color);
  }
}

/** Horizontal tab strip: selected tab is a filled bone plate with dark type. */
export function tabs(r, x, y, w, labels, selected, { height = 14 } = {}) {
  const slot = Math.floor(w / labels.length);
  labels.forEach((label, i) => {
    const tx = x + i * slot;
    const active = i === selected;
    if (active) {
      r.rect(tx, y, slot - 2, height, P.boneLit);
      r.frame(tx, y, slot - 2, height, P.emberBright, 1);
      r.text(label, tx + slot / 2 - 1, y + 4, {
        color: P.black, align: 'center', tracking: 1,
      });
    } else {
      r.frame(tx, y, slot - 2, height, alpha(P.ember, 0.4), 1);
      r.text(label, tx + slot / 2 - 1, y + 4, {
        color: P.emberLit, align: 'center', tracking: 1,
      });
    }
  });
}

/** A boxed heading rule, used above lists. */
export function heading(r, x, y, w, label, { color = P.emberLit } = {}) {
  r.text(label, x, y, { color, tracking: 1 });
  const tw = r.measure(label, { tracking: 1 });
  r.hline(x + tw + 4, y + 3, Math.max(0, w - tw - 4), alpha(color, 0.35));
}

/** Small affinity/stat glyphs. Drawn, not stored — 8x8 each. */
export function glyph(r, kind, x, y, color) {
  const put = (dx, dy) => r.px(x + dx, y + dy, color);
  const pts = GLYPHS[kind] ?? GLYPHS.dot;
  for (const [dx, dy] of pts) put(dx, dy);
}

const GLYPHS = {
  dot: [[3, 3], [4, 3], [3, 4], [4, 4]],
  flame: [[3, 0], [4, 1], [4, 2], [3, 1], [2, 3], [5, 3], [2, 4], [5, 4], [3, 5], [4, 5],
    [3, 2], [3, 3], [4, 3], [3, 4], [4, 4], [4, 0]],
  root: [[3, 0], [3, 1], [3, 2], [3, 3], [2, 4], [4, 4], [1, 5], [5, 5], [0, 6], [6, 6],
    [3, 4], [2, 2], [4, 2]],
  bone: [[1, 1], [2, 1], [1, 2], [2, 2], [3, 3], [4, 4], [5, 5], [6, 5], [5, 6], [6, 6], [2, 3], [3, 2]],
  hollow: [[2, 1], [3, 1], [4, 1], [1, 2], [5, 2], [1, 3], [5, 3], [1, 4], [5, 4], [2, 5], [3, 5], [4, 5]],
  sword: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [1, 4], [5, 4], [2, 5], [3, 5], [4, 5], [3, 6]],
  shield: [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [5, 1], [1, 2], [5, 2], [2, 3], [4, 3], [3, 4]],
  ring: [[2, 0], [3, 0], [1, 1], [4, 1], [1, 2], [4, 2], [2, 3], [3, 3]],
  shard: [[3, 0], [2, 1], [4, 1], [1, 2], [5, 2], [1, 3], [5, 3], [2, 4], [4, 4], [3, 5], [3, 2], [3, 3]],
  star: [[3, 0], [3, 1], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [3, 4], [3, 5], [3, 6],
    [1, 1], [5, 1], [1, 5], [5, 5]],
  save: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 1], [5, 1], [0, 2], [5, 2],
    [0, 3], [5, 3], [0, 4], [5, 4], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],
    [2, 1], [3, 1], [2, 3], [3, 3], [2, 4], [3, 4]],
  people: [[1, 1], [2, 1], [1, 2], [2, 2], [4, 1], [5, 1], [4, 2], [5, 2],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [0, 5], [2, 5], [3, 5], [5, 5]],
  pulse: [[0, 3], [1, 3], [2, 2], [3, 4], [4, 1], [5, 3], [6, 3]],
  branch: [[3, 6], [3, 5], [3, 4], [2, 3], [4, 3], [1, 2], [5, 2], [0, 1], [6, 1], [3, 3]],
};

export const GLYPH_KINDS = Object.keys(GLYPHS);
