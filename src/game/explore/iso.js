import { P, mix, alpha } from '../../engine/palette.js';

// Isometric projection. Tiles are 24x12 diamonds and one storey of elevation is
// 10px, which keeps stairs readable at 480x270 without the map becoming a maze
// of ambiguous heights.

export const TW = 24;
export const TH = 12;
export const ZH = 10;

export function toScreen(x, y, z = 0) {
  return {
    x: (x - y) * (TW / 2),
    y: (x + y) * (TH / 2) - z * ZH,
  };
}

/** Screen back to grid, for placing things by eye. */
export function toGrid(sx, sy) {
  const x = (sy / (TH / 2) + sx / (TW / 2)) / 2;
  const y = (sy / (TH / 2) - sx / (TW / 2)) / 2;
  return { x, y };
}

/** The four faces of one tile: top diamond, and the two visible side walls. */
export function tileDiamond(sx, sy) {
  return [
    [sx, sy - TH / 2],
    [sx + TW / 2, sy],
    [sx, sy + TH / 2],
    [sx - TW / 2, sy],
  ];
}

/**
 * Paint one floor tile: a bone diamond with a darker rim, side walls dropping
 * to the void, and optional ember inlay across the face.
 */
export function drawTile(r, sx, sy, def, { inlay = 0, lit = 1, drop = 3, dim = 0 } = {}) {
  // `dim` is how far this tile has fallen out of the lamp. Shading the stone
  // itself, rather than only laying black over it, is what makes a lit pool
  // read as light falling on rock instead of a hole cut in a picture.
  const base = dim > 0 ? mix(def.top ?? P.stone, P.void, dim * 0.88) : (def.top ?? P.stone);
  const top = base;
  const topLit = mix(top, P.boneWhite, 0.22 * lit * (1 - dim));
  const topDark = mix(top, P.void, 0.3);

  // side walls first, so the top edge covers their seam
  if (drop > 0) {
    const left = mix(top, P.void, 0.55);
    const right = mix(top, P.void, 0.72);
    r.poly([
      [sx - TW / 2, sy], [sx, sy + TH / 2],
      [sx, sy + TH / 2 + drop], [sx - TW / 2, sy + drop],
    ], left);
    r.poly([
      [sx, sy + TH / 2], [sx + TW / 2, sy],
      [sx + TW / 2, sy + drop], [sx, sy + TH / 2 + drop],
    ], right);
  }

  r.poly(tileDiamond(sx, sy), top);
  // lit north-west facet, the way the concept art lights its stone
  r.poly([
    [sx, sy - TH / 2], [sx + TW / 2, sy], [sx, sy], [sx - TW / 2, sy],
  ], topLit);
  // rim
  r.line(sx - TW / 2, sy, sx, sy - TH / 2, mix(topLit, P.boneWhite, 0.4 * (1 - dim)));
  r.line(sx, sy - TH / 2, sx + TW / 2, sy, mix(topLit, P.boneWhite, 0.2 * (1 - dim)));
  r.line(sx + TW / 2, sy, sx, sy + TH / 2, topDark);
  r.line(sx, sy + TH / 2, sx - TW / 2, sy, topDark);

  if (inlay && dim < 0.92) drawInlay(r, sx, sy, inlay, def.dead, dim);
}

/** Ember channels cut into the stone. Patterns are indexed, not random, so a
 *  path of inlay reads as continuous when tiles sit next to each other. */
export function drawInlay(r, sx, sy, kind, dead = false, dim = 0) {
  // Dead seam: the channel is still cut, but nothing is running through it.
  // A dead channel is still a channel: cut into the stone, and empty. Drawn
  // near-black so "the seam is out" is something the player sees before anyone
  // says it out loud.
  const c = mix(dead ? mix(P.stoneShadow, P.void, 0.55) : P.ember, P.void, dim * 0.88);
  const hot = mix(dead ? P.void : P.emberBright, P.void, dim * 0.88);
  switch (kind) {
    case 1: // straight, north-east to south-west
      r.line(sx - TW / 2 + 2, sy, sx + TW / 2 - 2, sy, c);
      r.px(sx, sy, hot);
      break;
    case 2: // straight, north-west to south-east
      r.line(sx, sy - TH / 2 + 1, sx, sy + TH / 2 - 1, c);
      r.px(sx, sy, hot);
      break;
    case 3: // cross node
      r.line(sx - TW / 2 + 3, sy, sx + TW / 2 - 3, sy, c);
      r.line(sx, sy - TH / 2 + 1, sx, sy + TH / 2 - 1, c);
      r.circle(sx, sy, 2, hot, { fill: false });
      break;
    case 4: // corner arc
      r.line(sx - TW / 2 + 3, sy, sx, sy, c);
      r.line(sx, sy, sx, sy + TH / 2 - 1, c);
      r.px(sx, sy, hot);
      break;
    case 5: // ring
      r.circle(sx, sy, 4, c, { fill: false });
      r.px(sx, sy, hot);
      break;
    default:
      break;
  }
}

/** A drop shadow cast onto whatever tile is under an actor. */
export function isoShadow(r, sx, sy, w = 6) {
  r.ellipse(sx, sy, w, Math.max(2, w * 0.45), alpha(P.void, 0.55));
}
