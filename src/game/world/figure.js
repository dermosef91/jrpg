import { RAMP, alpha, mix } from '../../engine/palette.js';

// People, drawn as people. A token on a grid reads as a diagram; a figure with
// shoulders, a coat and a walk reads as somebody standing in a place. Everyone
// in the Boles wears layered work clothes against the cold of a dim Ember, so
// the silhouette is coat-shaped: narrow at the head, wide at the hem.

const SKIN = ['#c39a72', '#a87a54', '#8a5f3e', '#6d4630', '#e0bb93'];

/**
 * @param {number} x,y      ground point the figure stands on
 * @param {string} facing   'up' | 'down' | 'left' | 'right'
 * @param {number} walk     walk cycle phase in radians (0 = standing)
 */
export function drawFigure(r, x, y, {
  facing = 'down', walk = 0, coat = RAMP.wood[3], scale = 1,
  skin = 0, hat = false, pack = false, lantern = false,
} = {}) {
  const s = scale;
  const stride = Math.sin(walk) * 2.6 * s;
  const bounce = Math.abs(Math.cos(walk)) * 1.1 * s;
  const side = facing === 'left' || facing === 'right';
  const flip = facing === 'left' ? -1 : 1;
  const back = facing === 'up';

  const coatDark = mix(coat, RAMP.bark[0], 0.45);
  const coatLit = mix(coat, RAMP.pale[3], 0.22);
  const tone = SKIN[skin % SKIN.length];

  r.groundShadow(x, y, 8 * s, 3.2 * s, 0.55);

  const hipY = y - 9 * s - bounce;
  const headY = y - 21 * s - bounce;

  // legs
  for (const [i, dir] of [[0, 1], [1, -1]].entries()) {
    const off = side ? dir * stride : dir * stride * 0.6;
    r.rect(x - 3.1 * s + (side ? off : i * 3.2 * s - 1.6 * s),
      hipY, 2.6 * s, 9 * s + (side ? 0 : -Math.abs(off) * 0.3),
      i ? mix(coatDark, RAMP.bark[0], 0.3) : coatDark);
  }
  // boots
  for (const [i, dir] of [[0, 1], [1, -1]].entries()) {
    const off = side ? dir * stride : dir * stride * 0.6;
    r.rect(x - 3.4 * s + (side ? off : i * 3.2 * s - 1.6 * s),
      y - 1.6 * s, 3.2 * s, 2 * s, RAMP.bark[1]);
  }

  // coat: a trapezoid, wider at the hem
  const shoulderW = (side ? 4.4 : 6.2) * s;
  const hemW = (side ? 5.4 : 7.6) * s;
  const shoulderY = headY + 5.4 * s;
  r.poly([
    [x - shoulderW, shoulderY], [x + shoulderW, shoulderY],
    [x + hemW, hipY + 2 * s], [x - hemW, hipY + 2 * s],
  ], coat);
  // lit edge on the key-light side, shadowed on the other
  r.poly([
    [x - shoulderW, shoulderY], [x - shoulderW + 2.2 * s, shoulderY],
    [x - hemW + 2.4 * s, hipY + 2 * s], [x - hemW, hipY + 2 * s],
  ], coatLit);
  r.poly([
    [x + shoulderW - 1.8 * s, shoulderY], [x + shoulderW, shoulderY],
    [x + hemW, hipY + 2 * s], [x + hemW - 2 * s, hipY + 2 * s],
  ], coatDark);
  if (!side && !back) {
    // front closure
    r.line(x, shoulderY + 1 * s, x, hipY + 1.6 * s, alpha(RAMP.bark[0], 0.5), 1.2 * s);
  }

  if (pack) {
    r.rect(x - 4.6 * s * flip - (side ? 3 * s * flip : 0), shoulderY + 1.4 * s,
      5 * s, 6 * s, mix(RAMP.wood[1], RAMP.bark[1], 0.4));
  }

  // arms
  const armSwing = side ? Math.sin(walk + Math.PI) * 2.2 * s : 0;
  r.rect(x - shoulderW - 0.4 * s + (side ? armSwing : 0), shoulderY + 1 * s,
    2.4 * s, 7.5 * s, coatDark);
  r.rect(x + shoulderW - 2 * s - (side ? armSwing : 0), shoulderY + 1 * s,
    2.4 * s, 7.5 * s, mix(coat, RAMP.bark[0], 0.25));

  // head
  const headR = 4.1 * s;
  r.circle(x, headY, headR, back ? mix(tone, RAMP.bark[1], 0.5) : tone);
  if (!back) {
    // cheek light, and a dark jaw line so the face has a direction
    r.circle(x - 1.2 * s * (side ? flip : 1), headY - 0.8 * s, 2.1 * s,
      mix(tone, RAMP.pale[5], 0.3));
    r.arc(x, headY + 0.6 * s, headR * 0.92, 0.25, Math.PI - 0.25,
      alpha(RAMP.bark[0], 0.35), 1.1 * s);
  }
  // hair / hood
  r.arc(x, headY, headR + 0.4 * s, back ? 0 : Math.PI, back ? Math.PI * 2 : Math.PI * 2,
    mix(coat, RAMP.bark[0], 0.55), 2.6 * s);
  if (hat) {
    r.rect(x - headR - 1.8 * s, headY - headR - 0.6 * s, (headR + 1.8 * s) * 2, 1.8 * s,
      mix(coat, RAMP.bark[0], 0.6));
    r.rect(x - headR + 0.6 * s, headY - headR - 3.4 * s, headR * 2 - 1.2 * s, 3.2 * s,
      mix(coat, RAMP.bark[0], 0.4));
  }

  // collar
  r.line(x - 3 * s, shoulderY + 0.4 * s, x + 3 * s, shoulderY + 0.4 * s,
    mix(coat, RAMP.pale[2], 0.3), 1.6 * s);

  if (lantern) {
    const lx = x + 7.5 * s * (side ? flip : 1);
    const ly = shoulderY + 7 * s;
    r.line(x + (side ? 4 * s * flip : 5 * s), shoulderY + 2 * s, lx, ly - 2 * s,
      RAMP.bark[2], 1);
    r.light(lx, ly, 44 * s, RAMP.amber[3], 0.45);
    r.rect(lx - 2 * s, ly - 2.4 * s, 4 * s, 4.8 * s, RAMP.amber[4]);
    r.strokeRect(lx - 2 * s, ly - 2.4 * s, 4 * s, 4.8 * s, RAMP.bark[1], 1);
  }
}

/** Depth-sorting key: figures sort by the ground they stand on. */
export const figureFoot = (y) => y;
