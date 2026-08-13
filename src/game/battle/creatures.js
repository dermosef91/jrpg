import { RAMP, GRAIN_COLOR, alpha, mix } from '../../engine/palette.js';
import { isAlive, grainLocked } from './combatant.js';
import { drawFigure } from '../world/figure.js';

// Opponents are things, not diagrams. Nothing in the Braid is a monster: you
// fight runaway agriculture, structural failure, and people with paperwork, so
// each one is drawn as what it actually is.
//
// The Grain mechanic still has to be legible, so it is drawn as an auditor's
// overlay ON the creature -- fibre lines and a dial badge, the way the party
// would actually see it through a reading lens. Unread opponents get no overlay
// at all, which is the whole point of Read.

export function drawCreature(r, c, view, x, y, radius, { t = 0, selected = false } = {}) {
  const alive = isAlive(c);
  const sx = x + view.offsetX + (view.shake ? (Math.random() - 0.5) * view.shake * 9 : 0);
  const sy = y + view.offsetY + (view.shake ? (Math.random() - 0.5) * view.shake * 6 : 0);
  const R = radius * view.scale;
  const health = Math.max(0, Math.min(1, view.hpShown / Math.max(1, c.maxHp)));

  r.save();
  if (!alive) r.alpha(0.34);
  r.groundShadow(sx, sy + R * 0.95, R * 1.1, R * 0.26, 0.6);

  const body = BODIES[c.id] ?? BODIES.cankerbloom;
  body(r, { x: sx, y: sy, R, t, health, scars: c.scars, view });

  drawGrainOverlay(r, c, view, sx, sy, R, t);

  if (selected) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 5);
    r.save();
    r.blend('lighter', () => {
      r.ellipse(sx, sy + R * 0.95, R * 1.15, R * 0.3, alpha(RAMP.amber[4], 0.35 * pulse),
        { stroke: true, lw: 2 });
    });
    r.restore();
  }
  if (view.flash > 0) {
    r.save();
    r.blend('lighter', () => r.ellipse(sx, sy, R, R * 1.05, alpha(RAMP.pale[5], view.flash * 0.35)));
    r.restore();
  }
  r.restore();
  return { x: sx, y: sy, radius: R };
}

const BODIES = {
  /** A Splicer graft that kept growing after the Splicer stopped paying attention. */
  cankerbloom(r, { x, y, R, t, health, scars }) {
    const sway = Math.sin(t * 1.2) * 0.06;
    // roots gripping the ground
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.15 + i * 0.14);
      r.line(x, y + R * 0.5, x + Math.cos(a) * R * 1.15, y + R * 0.9,
        mix(RAMP.wood[1], RAMP.bark[1], 0.4), 3 - i * 0.2, 'round');
    }
    // shoots
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.34 + sway;
      const len = R * (0.9 + (i % 3) * 0.22);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len;
      r.line(x, y - R * 0.1, ex, ey, mix(RAMP.sap[2], RAMP.wood[1], 0.35), 3.4, 'round');
      r.ellipse(ex, ey, 7, 4.5, mix(RAMP.sap[3], RAMP.bark[1], 0.3), { rotation: a });
      r.ellipse(ex - 2, ey - 1.5, 3.5, 2.2, mix(RAMP.sap[4], RAMP.pale[2], 0.15), { rotation: a });
    }
    // the swollen graft mass
    const massC = mix(RAMP.sap[2], RAMP.scar[1], 1 - health);
    r.ellipse(x, y + R * 0.12, R * 0.86, R * 0.74, massC);
    r.ellipse(x - R * 0.22, y - R * 0.06, R * 0.44, R * 0.36,
      mix(massC, RAMP.pale[3], 0.22));
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + 0.4;
      r.ellipse(x + Math.cos(a) * R * 0.5, y + R * 0.12 + Math.sin(a) * R * 0.42,
        R * 0.24, R * 0.2, mix(massC, RAMP.bark[1], 0.3));
    }
    r.ellipse(x, y + R * 0.12, R * 0.86, R * 0.74, alpha(RAMP.bark[0], 0.55),
      { stroke: true, lw: 2 });
    // the bright wound at the centre, where the graft was made
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.6);
    r.light(x, y + R * 0.1, R * 1.1 * pulse, RAMP.amber[3], 0.3 * health + 0.1);
    r.ellipse(x, y + R * 0.1, R * 0.2, R * 0.15, RAMP.amber[4]);
    for (let i = 0; i < scars; i++) {
      r.line(x - R * 0.5 + i * 9, y - R * 0.3, x - R * 0.2 + i * 9, y + R * 0.5,
        alpha(RAMP.scar[2], 0.85), 3);
    }
  },

  /** A person, doing their job, on behalf of a council that is correct. */
  bailiff(r, { x, y, R, t, health, scars }) {
    const scale = R / 26;
    // staff of office
    r.line(x + R * 0.62, y - R * 0.9, x + R * 0.5, y + R * 0.95, RAMP.wood[1], 3.2 * scale, 'round');
    r.circle(x + R * 0.63, y - R * 0.95, 4.5 * scale, RAMP.amber[3]);
    r.light(x + R * 0.63, y - R * 0.95, 30 * scale, RAMP.amber[3], 0.4);

    drawFigure(r, x, y + R * 0.95, {
      facing: 'down',
      walk: Math.sin(t * 1.1) * 0.18,
      coat: mix(RAMP.ember[1], RAMP.bark[2], 0.35 * (1 - health)),
      skin: 2,
      hat: true,
      scale: scale * 1.9,
    });
    // the writ
    r.rect(x - R * 0.66, y + R * 0.05, 13 * scale, 16 * scale, RAMP.pale[4]);
    r.strokeRect(x - R * 0.66, y + R * 0.05, 13 * scale, 16 * scale, RAMP.bark[1], 1);
    for (let i = 0; i < 4; i++) {
      r.line(x - R * 0.6, y + R * 0.12 + i * 3.4 * scale,
        x - R * 0.66 + 10 * scale, y + R * 0.12 + i * 3.4 * scale,
        alpha(RAMP.bark[1], 0.6), 1);
    }
    for (let i = 0; i < scars; i++) {
      r.line(x - R * 0.3 + i * 8, y - R * 0.4, x - R * 0.1 + i * 8, y + R * 0.2,
        alpha(RAMP.scar[3], 0.8), 2.5);
    }
  },

  /** Not alive, exactly. The Strider is failing and this is what that looks like. */
  heartrot(r, { x, y, R, t, health, scars }) {
    // exposed heartwood around a cavity
    r.ellipse(x, y, R * 1.02, R * 0.95, mix(RAMP.wood[1], RAMP.bark[1], 0.35));
    r.ellipse(x, y, R * 1.02, R * 0.95, RAMP.bark[0], { stroke: true, lw: 3 });
    for (let i = 1; i <= 3; i++) {
      r.ellipse(x, y, R * (1.02 - i * 0.13), R * (0.95 - i * 0.12),
        alpha(RAMP.wood[3], 0.35), { stroke: true, lw: 1.2 });
    }
    // the cavity
    const rot = 1 - health;
    r.ellipse(x + R * 0.05, y + R * 0.05, R * (0.32 + rot * 0.4), R * (0.3 + rot * 0.38),
      RAMP.bark[0]);
    r.ellipse(x + R * 0.05, y + R * 0.05, R * (0.32 + rot * 0.4), R * (0.3 + rot * 0.38),
      alpha(RAMP.scar[1], 0.7), { stroke: true, lw: 2 });
    // bracket fungi shelving out of the face
    // Brackets shelve out all round the rim, smaller and duller than the wood
    // so they read as growth on it rather than as highlights in it.
    for (let i = 0; i < 8; i++) {
      const a = i * (Math.PI * 2 / 8) + 0.35;
      const bx = x + Math.cos(a) * R * 0.86;
      const by = y + Math.sin(a) * R * 0.8;
      const w = R * (0.2 + (i % 3) * 0.05);
      r.ellipse(bx, by, w, w * 0.34, mix(RAMP.wood[2], RAMP.pale[0], 0.35), { rotation: a * 0.25 });
      r.ellipse(bx, by - w * 0.1, w * 0.78, w * 0.2,
        mix(RAMP.wood[4], RAMP.pale[1], 0.25), { rotation: a * 0.25 });
      r.ellipse(bx, by, w, w * 0.34, alpha(RAMP.bark[0], 0.5), { stroke: true, lw: 1, rotation: a * 0.25 });
    }
    // mycelium creeping outward, breathing
    const breath = 0.85 + 0.15 * Math.sin(t * 1.4);
    for (let i = 0; i < 11; i++) {
      const a = i * 0.57 + t * 0.04;
      const len = R * (0.95 + ((i * 37) % 10) / 22) * breath;
      r.line(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.46,
        x + Math.cos(a) * len, y + Math.sin(a) * len,
        alpha(mix(RAMP.pale[0], RAMP.sap[1], 0.4), 0.35), 1.1);
    }
    r.light(x + R * 0.05, y + R * 0.05, R * 0.9, RAMP.scar[1], 0.22 + rot * 0.2);
    for (let i = 0; i < scars; i++) {
      const a = -0.6 + i * 0.8;
      r.line(x + Math.cos(a) * R * 0.2, y + Math.sin(a) * R * 0.2,
        x + Math.cos(a) * R, y + Math.sin(a) * R, alpha(RAMP.scar[2], 0.85), 3.5);
    }
  },
};

/** The auditor's reading overlay: fibre direction, drawn on the thing itself. */
function drawGrainOverlay(r, c, view, x, y, R, t) {
  const known = view.revealT;
  if (known < 0.02) {
    // Unread: a lens outline and nothing inside it.
    r.save();
    r.alpha(0.5 + 0.2 * Math.sin(t * 2));
    r.ellipse(x, y, R * 1.14, R * 1.08, alpha(RAMP.shade[4], 0.6), { stroke: true, lw: 1.5 });
    r.text('?', x + R * 0.95, y - R * 0.85, {
      size: 16, color: RAMP.shade[5], align: 'center', weight: 700, font: 'display',
    });
    r.restore();
    return;
  }

  const angle = view.grainAngle;
  const gc = GRAIN_COLOR[c.grain];
  r.save();
  r.alpha(known * 0.55);
  r.ctx.beginPath();
  r.ctx.ellipse(x, y, R * 1.02, R * 0.96, 0, 0, Math.PI * 2);
  r.ctx.clip();
  r.blend('lighter', () => {
    for (let o = -R * 1.2; o <= R * 1.2; o += 9) {
      const dx = Math.cos(angle) * R * 1.4;
      const dy = Math.sin(angle) * R * 1.4;
      const nx = -Math.sin(angle) * o;
      const ny = Math.cos(angle) * o;
      r.line(x + nx - dx, y + ny - dy, x + nx + dx, y + ny + dy, alpha(gc, 0.5), 1.5);
    }
  });
  r.restore();

  r.save();
  r.alpha(known);
  r.ellipse(x, y, R * 1.02, R * 0.96, alpha(gc, 0.45), { stroke: true, lw: 1.4 });
  if (grainLocked(c)) {
    for (const s of [-1, 1]) {
      const a = angle + Math.PI / 2;
      r.line(x + Math.cos(a) * R * s * 0.8 - Math.cos(angle) * R * 0.36,
        y + Math.sin(a) * R * s * 0.8 - Math.sin(angle) * R * 0.36,
        x + Math.cos(a) * R * s * 0.8 + Math.cos(angle) * R * 0.36,
        y + Math.sin(a) * R * s * 0.8 + Math.sin(angle) * R * 0.36,
        RAMP.scar[3], 2.5, 'round');
    }
  }
  r.restore();
}

/** Party members in battle are people too, not tokens. */
export function drawPartyFigure(r, c, view, x, y, { active = false, t = 0 } = {}) {
  const alive = isAlive(c);
  r.save();
  if (!alive) r.alpha(0.4);
  drawFigure(r, x + view.offsetX, y + view.offsetY, {
    facing: 'up',
    walk: alive ? Math.sin(t * 1.3 + x) * 0.14 : 0,
    coat: PARTY_COAT[c.id] ?? RAMP.wood[3],
    skin: PARTY_SKIN[c.id] ?? 0,
    scale: 1.06,
    pack: c.id === 'tarn',
    hat: c.id === 'kite',
    lantern: c.id === 'wend',
  });
  if (active) r.light(x, y - 14, 54, RAMP.amber[3], 0.3);
  if (view.flash > 0) {
    r.save();
    r.blend('lighter', () => r.ellipse(x, y - 16, 12, 18, alpha(RAMP.scar[4], view.flash * 0.4)));
    r.restore();
  }
  r.restore();
}

const PARTY_COAT = {
  wend: RAMP.amber[2], pell: RAMP.shade[3], tarn: RAMP.wood[2], kite: RAMP.sap[2],
};
const PARTY_SKIN = { wend: 3, pell: 1, tarn: 0, kite: 4 };
