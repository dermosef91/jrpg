import { P, RAMP, mix, alpha } from '../../engine/palette.js';

// Party figures, drawn as pixel sprites rather than composed from shapes at
// runtime: each (character, pose, frame) is rasterised once into a small canvas
// and blitted after that.
//
// Proportions follow the concept art -- roughly five heads tall, heavy
// silhouette, cloth that reads as one bright mass against the black galleries,
// and ember jewellery as the only saturated accent on a person.

export const FIG_W = 26;
export const FIG_H = 38;

/**
 * @typedef {object} FigureSpec
 * @property {number} skin      index into RAMP.skin
 * @property {string} cloth     main garment colour
 * @property {string} clothDark shadow side of the garment
 * @property {string} trim      leather / harness
 * @property {string} hair      'afro' | 'locs' | 'wrap' | 'crop' | 'crown'
 * @property {string} weapon    'spear' | 'disc' | 'fists' | 'staff'
 */

/**
 * `facing` is what the top-down field needs: a character walking north should
 * show the back of their head, not their face. 'right' is the mirror of 'left'
 * rather than a second set of art.
 */
export function drawFigure(r, spec, x, y, { pose = 'idle', frame = 0, facing = 'down', t = 0 } = {}) {
  const draw = facing === 'right' ? 'left' : facing;
  const key = `fig:${spec.id}:${pose}:${frame}:${draw}`;
  let sprite = r.cached(key, FIG_W, FIG_H, (rr) => paint(rr, spec, pose, frame, draw));
  if (facing === 'right') sprite = r.mirrored(`${key}:R`, sprite);
  r.blit(sprite, Math.round(x - FIG_W / 2), Math.round(y - FIG_H));
}

/** Ground shadow under a figure. Drawn live so it can react to lunges. */
export function figureShadow(r, x, y, width = 9) {
  r.ellipse(x, y, width, Math.max(2, width * 0.32), alpha(P.void, 0.65));
}

function paint(r, spec, pose, frame, facing) {
  const skin = RAMP.skin[spec.skin ?? 4];
  const skinLit = RAMP.skin[Math.min(6, (spec.skin ?? 4) + 1)];
  const skinDark = RAMP.skin[Math.max(0, (spec.skin ?? 4) - 2)];
  const cloth = spec.cloth ?? P.stoneLit;
  const clothDark = spec.clothDark ?? mix(cloth, P.void, 0.45);
  const clothLit = mix(cloth, P.boneWhite, 0.3);
  const trim = spec.trim ?? P.bark;
  const accent = spec.accent ?? P.emberBright;

  // Which way the body is turned. The authored pose looks to its own left, so
  // that is the profile; front and back keep the shoulders square instead.
  const side = facing === 'left';
  const back = facing === 'up';

  // Pose offsets. `lean` shifts the upper body forward, `lift` raises the torso.
  const lunge = pose === 'attack' && side ? 3 : 0;
  const bob = pose === 'idle' ? (frame ? 1 : 0) : 0;
  const guard = pose === 'guard' ? 2 : 0;
  const down = pose === 'down';

  const cx = 13;
  const baseY = FIG_H - 1;
  const hipY = baseY - 13 + bob;
  const shoulderY = hipY - 12 - guard;
  const headY = shoulderY - 8;

  if (down) {
    // Felled: collapsed silhouette, no weapon.
    r.ellipse(cx, baseY - 3, 9, 4, clothDark);
    r.ellipse(cx - 4, baseY - 5, 5, 4, cloth);
    r.circle(cx + 6, baseY - 5, 3, skin);
    hairFor(r, spec, cx + 6, baseY - 8, accent, 1);
    return;
  }

  // --- legs ---
  const stride = pose === 'attack' ? 3 : 0;
  legs(r, cx, hipY, baseY, trim, mix(trim, P.void, 0.4), stride);

  // --- torso: a tapered tunic, bright side toward the ember light ---
  const shoulderW = 6;
  const hemW = 8;
  r.poly([
    [cx - shoulderW - lunge, shoulderY],
    [cx + shoulderW - lunge, shoulderY],
    [cx + hemW, hipY + 2],
    [cx - hemW, hipY + 2],
  ], cloth);
  r.poly([
    [cx - shoulderW - lunge, shoulderY],
    [cx - shoulderW + 2 - lunge, shoulderY],
    [cx - hemW + 3, hipY + 2],
    [cx - hemW, hipY + 2],
  ], clothLit);
  r.poly([
    [cx + shoulderW - 2 - lunge, shoulderY],
    [cx + shoulderW - lunge, shoulderY],
    [cx + hemW, hipY + 2],
    [cx + hemW - 3, hipY + 2],
  ], clothDark);

  // harness / belt
  r.hline(cx - hemW + 1, hipY - 1, hemW * 2 - 2, trim);
  r.hline(cx - hemW + 1, hipY, hemW * 2 - 2, mix(trim, P.void, 0.35));
  r.px(cx - 1, hipY - 1, accent);
  r.px(cx, hipY - 1, accent);

  // collar
  r.hline(cx - 4 - lunge, shoulderY, 8, mix(cloth, P.void, 0.25));

  // --- arms ---
  const armY = shoulderY + 1;
  // back arm
  r.rect(cx + 4 - lunge, armY, 3, 9, clothDark);
  r.rect(cx + 4 - lunge, armY + 9, 3, 2, skinDark);
  // front arm reaches toward the weapon
  const reach = pose === 'attack' ? 5 : 0;
  r.rect(cx - 7 - lunge, armY, 3, 8 - reach, cloth);
  r.rect(cx - 7 - lunge, armY + 8 - reach, 3, 3, skin);

  // --- head ---
  const hx = side ? cx - 1 - lunge : cx;
  r.rect(hx - 3, headY, 7, 8, skin);
  r.rect(hx - 3, headY, 2, 8, skinLit);          // lit edge, ember side
  r.rect(hx + 3, headY, 1, 8, skinDark);
  if (back) {
    // The back of a head is hair and neck. No face, which is the whole point.
    r.rect(hx - 3, headY, 7, 6, mix(spec.hairColor ?? P.void, P.bark, 0.15));
    r.rect(hx - 3, headY + 6, 7, 2, skinDark);
  } else if (side) {
    r.px(hx - 2, headY + 4, P.void);             // eye
    r.px(hx - 3, headY + 6, skinDark);           // jaw shadow
  } else {
    r.px(hx - 2, headY + 4, P.void);             // both eyes, square on
    r.px(hx + 2, headY + 4, P.void);
    r.hline(hx - 1, headY + 6, 3, skinDark);     // mouth line
  }
  r.rect(hx - 3, headY + 8, 7, 1, skinDark);     // neck shadow

  hairFor(r, spec, hx, headY, accent, 0, back);
  weaponFor(r, spec, cx, shoulderY, hipY, baseY, pose, accent, trim, facing);
}

function legs(r, cx, hipY, baseY, trim, dark, stride) {
  const h = baseY - hipY;
  r.rect(cx - 5 - stride, hipY, 4, h, dark);
  r.rect(cx + 1 + Math.floor(stride / 2), hipY, 4, h, trim);
  // wraps
  for (let i = 2; i < h - 2; i += 3) {
    r.hline(cx - 5 - stride, hipY + i, 4, alpha(P.boneLit, 0.5));
    r.hline(cx + 1 + Math.floor(stride / 2), hipY + i, 4, alpha(P.boneLit, 0.35));
  }
  // feet
  r.rect(cx - 6 - stride, baseY - 1, 5, 2, P.bark);
  r.rect(cx + 1 + Math.floor(stride / 2), baseY - 1, 5, 2, P.bark);
}

function hairFor(r, spec, hx, headY, accent, small, back = false) {
  const hair = spec.hairColor ?? P.void;
  const sheen = mix(hair, P.barkLit, 0.5);
  switch (spec.hair) {
    case 'afro':
      r.ellipse(hx, headY - 1, 6, 5, hair);
      r.ellipse(hx - 2, headY - 2, 3, 2, sheen);
      r.rect(hx - 4, headY + 1, 1, 3, hair);
      break;
    case 'locs':
      r.ellipse(hx, headY - 1, 5, 4, hair);
      for (let i = 0; i < 5; i++) {
        const lx = hx - 4 + i * 2;
        const len = 7 + ((i * 3) % 5);
        r.rect(lx, headY + 1, 1, len, hair);
        if (i % 2 === 0) r.px(lx, headY + 2 + (i % 3), accent);
      }
      r.px(hx + 4, headY, accent);
      break;
    case 'wrap':
      r.rect(hx - 4, headY - 3, 9, 5, P.stoneLit);
      r.rect(hx - 4, headY - 3, 9, 1, P.boneWhite);
      r.rect(hx - 4, headY + 1, 9, 1, P.stoneMid);
      r.rect(hx + 4, headY - 1, 2, 7, P.stoneLit);
      r.px(hx - 4, headY - 1, accent);
      break;
    case 'crown':
      r.rect(hx - 4, headY - 2, 9, 3, P.boneLit);
      for (let i = 0; i < 4; i++) r.vline(hx - 3 + i * 2, headY - 5, 3, P.boneWhite);
      r.px(hx, headY - 4, accent);
      break;
    default:
      r.ellipse(hx, headY, 5, 3, hair);
      break;
  }
  if (!small && !back) {
    // ember earring, the one saturated accent everyone wears
    r.px(hx + 3, headY + 5, accent);
  }
}

function weaponFor(r, spec, cx, shoulderY, hipY, baseY, pose, accent, trim, facing = 'left') {
  // Square on to the camera there is no room to swing anything across the body,
  // so everything is carried upright at the side instead.
  if (facing === 'down' || facing === 'up') {
    return carried(r, spec, cx, shoulderY, baseY, accent, trim, facing === 'up');
  }
  const attacking = pose === 'attack';
  switch (spec.weapon) {
    case 'spear': {
      // Held low and forward; on attack it drives out level.
      const tipX = attacking ? cx - 22 : cx - 12;
      const tipY = attacking ? shoulderY + 4 : baseY - 20;
      const buttX = attacking ? cx + 6 : cx - 2;
      const buttY = attacking ? shoulderY + 7 : baseY + 1;
      r.line(buttX, buttY, tipX, tipY, mix(trim, P.barkHi, 0.5));
      r.line(buttX, buttY + 1, tipX, tipY + 1, alpha(P.void, 0.5));
      // ember head
      r.poly([
        [tipX, tipY], [tipX + 4, tipY - 2], [tipX + 5, tipY + 1], [tipX + 3, tipY + 3],
      ], P.emberBright);
      r.px(tipX + 3, tipY, P.emberWhite);
      break;
    }
    case 'disc': {
      // A ringed casting disc that hovers at the off hand.
      const dx = attacking ? cx - 14 : cx - 9;
      const dy = shoulderY + (attacking ? 1 : 4);
      r.circle(dx, dy, 5, P.emberDeep, { fill: false });
      r.circle(dx, dy, 3, P.emberBright, { fill: false });
      r.px(dx, dy, P.emberWhite);
      for (const [ox, oy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) r.px(dx + ox, dy + oy, accent);
      break;
    }
    case 'fists': {
      const fx = attacking ? cx - 12 : cx - 8;
      const fy = shoulderY + (attacking ? 3 : 9);
      r.rect(fx - 1, fy, 4, 4, P.boneLit);
      r.hline(fx - 1, fy + 1, 4, P.stoneMid);
      r.hline(fx - 1, fy + 3, 4, P.stoneMid);
      if (attacking) r.circle(fx, fy + 1, 5, alpha(P.emberBright, 0.5), { fill: false });
      break;
    }
    case 'staff': {
      const sx = cx - 8;
      r.rect(sx, shoulderY - 6, 2, baseY - shoulderY + 7, mix(trim, P.barkHi, 0.4));
      r.circle(sx + 1, shoulderY - 8, 3, P.emberDeep);
      r.circle(sx + 1, shoulderY - 8, 2, P.emberBright);
      r.px(sx + 1, shoulderY - 9, P.emberWhite);
      break;
    }
    default: break;
  }
}


/** Weapons as carried when a figure is square on to the camera. */
function carried(r, spec, cx, shoulderY, baseY, accent, trim, back) {
  const sx = back ? cx - 9 : cx + 8;
  switch (spec.weapon) {
    case 'spear':
      r.rect(sx, shoulderY - 7, 2, baseY - shoulderY + 8, mix(trim, P.barkHi, 0.5));
      r.poly([
        [sx + 1, shoulderY - 13], [sx + 3, shoulderY - 8],
        [sx + 1, shoulderY - 6], [sx - 1, shoulderY - 8],
      ], P.emberBright);
      r.px(sx + 1, shoulderY - 9, P.emberWhite);
      break;
    case 'staff':
      r.rect(sx, shoulderY - 6, 2, baseY - shoulderY + 7, mix(trim, P.barkHi, 0.4));
      r.circle(sx + 1, shoulderY - 8, 3, P.emberDeep);
      r.circle(sx + 1, shoulderY - 8, 2, P.emberBright);
      break;
    case 'disc':
      r.circle(sx + 1, shoulderY + 6, 4, P.emberDeep, { fill: false });
      r.circle(sx + 1, shoulderY + 6, 2, P.emberBright, { fill: false });
      r.px(sx + 1, shoulderY + 6, P.emberWhite);
      break;
    case 'fists':
      r.rect(sx - 1, shoulderY + 8, 4, 4, P.boneLit);
      r.hline(sx - 1, shoulderY + 9, 4, P.stoneMid);
      break;
    default: break;
  }
}
