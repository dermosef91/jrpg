import { P, RAMP, mix, alpha } from '../../engine/palette.js';

// Foes are lit from the mandala behind them, so every body colour here is a step
// or two up from the gallery walls -- otherwise they read as floating masks.
const BODY = mix(P.bark, P.stoneShadow, 0.35);
const BODY_LIT = mix(P.barkLit, P.stoneDark, 0.4);
const BODY_DARK = P.root;
const RIM = mix(P.emberDeep, P.barkHi, 0.5);

// The things in the galleries. All of them share one design language from the
// concept art: a carved bone mask as the only bright shape, a body of dark
// segmented root-matter, and ember light leaking out of the joins.

export const FOE_ART = {
  warden: { w: 48, h: 78, draw: warden },
  crawler: { w: 42, h: 38, draw: crawler },
  husk: { w: 34, h: 52, draw: husk },
  choir: { w: 42, h: 56, draw: choir },
};

export function drawFoe(r, kind, x, y, { frame = 0, hurt = 0, dead = false } = {}) {
  const art = FOE_ART[kind] ?? FOE_ART.crawler;
  const key = `foe:${kind}:${frame}:${dead ? 1 : 0}`;
  const sprite = r.cached(key, art.w, art.h, (rr) => art.draw(rr, art.w, art.h, frame, dead));
  const px = Math.round(x - art.w / 2);
  const py = Math.round(y - art.h);
  r.blit(sprite, px, py);
  if (hurt > 0) {
    // A white-hot flash, dithered so it stays pixel art.
    r.save();
    r.alpha(Math.min(1, hurt));
    r.dither(px, py, art.w, art.h, P.boneWhite, hurt * 0.7);
    r.restore();
  }
}

export function foeShadow(r, x, y, width) {
  r.ellipse(x, y, width, Math.max(2, width * 0.3), alpha(P.void, 0.6));
}

/** The tall masked figure: a crowned bone mask over a segmented root body. */
function warden(r, w, h, frame, dead) {
  const cx = w >> 1;
  const sway = frame ? 1 : 0;
  if (dead) { collapsed(r, w, h, P.root, P.stoneMid); return; }

  // trailing root tendrils behind the body
  for (let i = 0; i < 5; i++) {
    const sx = cx - 14 + i * 7;
    let y = h - 4;
    let x = sx;
    for (let s = 0; s < 16; s++) {
      r.px(x, y, s % 3 === 0 ? BODY : BODY_DARK);
      y -= 2;
      x += ((i + s) % 3) - 1;
    }
  }

  // robed body
  r.poly([
    [cx - 4, 16], [cx + 4, 16], [cx + 11, h - 2], [cx - 11, h - 2],
  ], BODY);
  r.poly([
    [cx - 4, 16], [cx - 1, 16], [cx - 4, h - 2], [cx - 11, h - 2],
  ], BODY_LIT);
  // segment joins with ember leaking through
  for (let i = 0; i < 7; i++) {
    const yy = 22 + i * 6;
    const half = 5 + i;
    r.hline(cx - half, yy, half * 2, BODY_DARK);
    r.px(cx - 1, yy, P.emberDim);
    r.px(cx + 1, yy, i % 2 ? P.emberBright : P.emberDim);
  }
  // shoulder plates
  r.poly([[cx - 10, 18], [cx - 3, 15], [cx - 3, 22], [cx - 9, 24]], P.stoneDark);
  r.poly([[cx + 10, 18], [cx + 3, 15], [cx + 3, 22], [cx + 9, 24]], P.stoneShadow);

  // staff
  r.rect(cx + 13, 10 + sway, 2, h - 14, BODY_LIT);
  r.circle(cx + 14, 8 + sway, 4, P.emberDeep);
  r.circle(cx + 14, 8 + sway, 2, P.emberHot);
  r.px(cx + 14, 7 + sway, P.emberWhite);

  // rim light down the lit edge
  for (let yy = 18; yy < h - 4; yy += 2) {
    const half = 4 + Math.round((yy - 18) * 0.13);
    r.px(cx - half - 1, yy, RIM);
  }

  // mask: long, carved, crowned
  const my = 2 + sway;
  r.poly([
    [cx - 5, my + 2], [cx + 5, my + 2], [cx + 4, my + 14], [cx, my + 17], [cx - 4, my + 14],
  ], P.stoneLit);
  r.poly([
    [cx - 5, my + 2], [cx - 2, my + 2], [cx - 2, my + 15], [cx - 4, my + 14],
  ], P.boneWhite);
  // eye slits and the ember third eye
  r.rect(cx - 3, my + 6, 2, 1, P.void);
  r.rect(cx + 2, my + 6, 2, 1, P.void);
  r.px(cx, my + 9, P.emberHot);
  r.vline(cx, my + 10, 3, P.emberDim);
  // crown
  for (let i = 0; i < 5; i++) {
    const bx = cx - 6 + i * 3;
    r.vline(bx, my - 2 - (i === 2 ? 3 : i % 2 ? 0 : 1), 4, P.boneLit);
  }
  r.hline(cx - 6, my + 1, 13, P.stoneMid);
}

/** Low, many-legged construct with a mask for a face. */
function crawler(r, w, h, frame, dead) {
  const cx = w >> 1;
  const base = h - 1;
  if (dead) { collapsed(r, w, h, P.root, P.stoneMid); return; }
  const lift = frame ? 1 : 0;

  // legs: spindly, jointed, planted wide
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const spread = 9 + i * 6;
      const kneeY = base - 15 - (i === 1 ? lift * 2 : 0);
      r.line(cx + side * 4, base - 18, cx + side * spread, kneeY, BODY_LIT);
      r.line(cx + side * spread, kneeY, cx + side * (spread + 3), base, BODY);
      r.rect(cx + side * spread - 1, kneeY - 1, 2, 2, BODY_LIT);
    }
  }

  // carapace
  r.ellipse(cx, base - 22 - lift, 12, 9, BODY);
  r.ellipse(cx - 3, base - 25 - lift, 6, 4, BODY_LIT);
  for (let i = -1; i <= 1; i++) r.rect(cx + i * 5 - 1, base - 27 - lift, 2, 2, P.emberDim);

  for (let i = 0; i < 6; i++) r.px(cx - 11 + i, base - 26 - lift + Math.round(i * 0.6), RIM);

  // mask face, slung under the carapace
  const my = base - 20 - lift;
  r.poly([[cx - 6, my], [cx + 6, my], [cx + 5, my + 11], [cx, my + 13], [cx - 5, my + 11]], P.stoneLit);
  r.poly([[cx - 6, my], [cx - 2, my], [cx - 2, my + 12], [cx - 5, my + 11]], P.boneWhite);
  r.hline(cx - 6, my, 13, P.boneWhite);
  r.rect(cx - 4, my + 4, 3, 2, P.void);
  r.rect(cx + 2, my + 4, 3, 2, P.void);
  r.px(cx, my + 8, P.emberHot);
  r.vline(cx, my + 9, 2, P.emberDim);
}

/** A stooped, hollowed-out person. Smaller, faster, sadder. */
function husk(r, w, h, frame, dead) {
  const cx = w >> 1;
  const base = h - 1;
  if (dead) { collapsed(r, w, h, P.rootLit, P.stoneMid); return; }
  const bob = frame ? 1 : 0;

  r.rect(cx - 5, base - 12, 3, 12, BODY);
  r.rect(cx + 2, base - 12, 3, 12, BODY_LIT);
  // hunched torso
  r.poly([
    [cx - 6, base - 26 + bob], [cx + 6, base - 26 + bob],
    [cx + 7, base - 11], [cx - 7, base - 11],
  ], BODY);
  r.poly([
    [cx - 6, base - 26 + bob], [cx - 3, base - 26 + bob], [cx - 4, base - 11], [cx - 7, base - 11],
  ], BODY_LIT);
  for (let i = 0; i < 3; i++) r.hline(cx - 6, base - 22 + i * 4, 13, BODY_DARK);
  // long arms
  r.line(cx - 6, base - 24 + bob, cx - 9, base - 8, BODY_LIT);
  r.line(cx + 6, base - 24 + bob, cx + 9, base - 8, BODY);
  // mask
  const my = base - 34 + bob;
  r.poly([[cx - 4, my], [cx + 4, my], [cx + 3, my + 8], [cx - 3, my + 8]], P.stoneMid);
  r.hline(cx - 4, my, 9, P.stoneLit);
  r.rect(cx - 2, my + 3, 1, 2, P.void);
  r.rect(cx + 2, my + 3, 1, 2, P.void);
  r.px(cx, my + 6, P.emberDim);
}

/** A ring of hovering mask-shards that sing. */
function choir(r, w, h, frame, dead) {
  const cx = w >> 1;
  const cy = Math.round(h * 0.45);
  if (dead) { collapsed(r, w, h, P.root, P.stoneMid); return; }
  const spin = frame ? 0.4 : 0;

  r.circle(cx, cy, 13, alpha(P.emberDeep, 0.5), { fill: false });
  for (let i = 0; i < 6; i++) {
    const a = spin + (i / 6) * Math.PI * 2;
    const mx = Math.round(cx + Math.cos(a) * 12);
    const my = Math.round(cy + Math.sin(a) * 10);
    r.poly([[mx - 2, my - 3], [mx + 2, my - 3], [mx + 2, my + 2], [mx, my + 4], [mx - 2, my + 2]],
      i % 2 ? P.stoneLit : P.boneLit);
    r.px(mx - 1, my - 1, P.void);
    r.px(mx + 1, my - 1, P.void);
  }
  r.circle(cx, cy, 5, P.emberDeep);
  r.circle(cx, cy, 3, P.emberBright);
  r.px(cx, cy, P.emberWhite);
  // tether roots down to the floor
  for (const side of [-1, 1]) {
    r.line(cx + side * 3, cy + 5, cx + side * 8, h - 1, BODY);
  }
}

function collapsed(r, w, h, body, mask) {
  const cx = w >> 1;
  r.ellipse(cx, h - 4, Math.round(w * 0.34), 4, body);
  r.ellipse(cx - 4, h - 6, Math.round(w * 0.18), 3, mix(body, P.bark, 0.5));
  r.poly([[cx + 4, h - 9], [cx + 9, h - 9], [cx + 8, h - 4], [cx + 5, h - 4]], mask);
}
