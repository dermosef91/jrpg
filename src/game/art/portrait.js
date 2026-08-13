import { P, RAMP, mix, alpha } from '../../engine/palette.js';

// Head-and-shoulders portraits, drawn to a fixed cell and cached. Small enough
// for the battle HUD, sharp enough for the menu at double size.

export const PORTRAIT_W = 18;
export const PORTRAIT_H = 18;

export function drawPortrait(r, spec, x, y, { scale = 1, frameColor = P.stoneDark } = {}) {
  const key = `port:${spec.id ?? spec.hair}:${spec.skin}:${scale}`;
  const w = PORTRAIT_W * scale;
  const h = PORTRAIT_H * scale;
  const sprite = r.cached(key, w, h, (rr) => {
    rr.save();
    if (scale !== 1) rr.ctx.scale(scale, scale);
    paint(rr, spec);
    rr.restore();
  });
  r.blit(sprite, x, y);
  if (frameColor) r.frame(x, y, w, h, frameColor, 1);
}

function paint(r, spec) {
  const skin = RAMP.skin[spec.skin ?? 4];
  const lit = RAMP.skin[Math.min(6, (spec.skin ?? 4) + 2)];
  const dark = RAMP.skin[Math.max(0, (spec.skin ?? 4) - 2)];
  const hairColor = spec.hairColor ?? P.black;
  const accent = spec.accent ?? P.emberBright;

  // ground: the black of the gallery behind them
  r.rect(0, 0, PORTRAIT_W, PORTRAIT_H, P.void);
  r.dither(0, 0, PORTRAIT_W, PORTRAIT_H, P.black, 0.6);

  // shoulders
  r.poly([[1, PORTRAIT_H], [4, 13], [13, 13], [16, PORTRAIT_H]], spec.cloth ?? P.stoneMid);
  r.poly([[1, PORTRAIT_H], [4, 13], [7, 13], [5, PORTRAIT_H]], mix(spec.cloth ?? P.stoneMid, P.boneWhite, 0.3));

  // face
  r.rect(5, 3, 8, 11, skin);
  r.rect(5, 3, 3, 11, lit);
  r.rect(12, 3, 1, 11, dark);
  r.rect(6, 13, 6, 1, dark);
  // features
  r.px(7, 8, P.void);
  r.px(11, 8, P.void);
  r.hline(8, 11, 2, dark);
  r.px(9, 9, dark);

  // hair
  switch (spec.hair) {
    case 'locs':
      r.ellipse(9, 3, 6, 3, hairColor);
      for (let i = 0; i < 6; i++) {
        const lx = 3 + i * 2;
        r.rect(lx, 4, 1, 5 + ((i * 3) % 5), hairColor);
        if (spec.beads && i % 2 === 0) r.px(lx, 7 + (i % 3), accent);
      }
      break;
    case 'afro':
      r.ellipse(9, 2, 7, 4, hairColor);
      r.ellipse(6, 1, 3, 2, mix(hairColor, P.bark, 0.55));
      r.rect(3, 3, 1, 4, hairColor);
      r.rect(14, 3, 1, 4, hairColor);
      break;
    case 'wrap':
      r.rect(3, 0, 12, 4, P.stoneLit);
      r.rect(3, 0, 12, 1, P.boneWhite);
      r.rect(3, 4, 12, 1, P.stoneMid);
      r.rect(13, 3, 3, 8, P.stoneLit);
      r.px(3, 2, accent);
      break;
    case 'crop':
    default:
      r.ellipse(9, 3, 5, 2, hairColor);
      r.rect(4, 3, 10, 2, hairColor);
      break;
  }
  // ember earring — everyone in the galleries wears one
  r.px(13, 10, accent);
  // rim light from the mandala side
  r.vline(4, 4, 9, alpha(P.emberDim, 0.5));
}
