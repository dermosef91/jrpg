import { P, RAMP, GRAIN_COLOR, alpha, mix } from '../../engine/palette.js';
import { makeRng } from '../../engine/rng.js';
import { isAlive, grainLocked } from './combatant.js';

// Every combatant is drawn as a cross-section of wood, which is not decoration:
// the fibre direction IS the Grain mechanic, so "across the grain" is drawn
// exactly perpendicular to the lines, and a hit visibly turns the fibre 45
// degrees. Damage rots the section inward from the rim, so a failing opponent
// looks failing before you read its numbers.

/** Per-combatant view state: tweens and effects the battle engine knows nothing about. */
export function makeView(combatant) {
  const rng = makeRng(hash(combatant.uid));
  const ringCount = 9 + Math.floor(rng.next() * 4);
  const rings = [];
  let acc = 0;
  for (let i = 0; i < ringCount; i++) {
    const w = 0.5 + rng.next() * 1.4;
    acc += w;
    rings.push({ at: acc, w, tone: rng.next() });
  }
  for (const ring of rings) ring.at /= acc;

  return {
    rings,
    rays: Array.from({ length: 9 + Math.floor(rng.next() * 7) }, () => ({
      angle: rng.next() * Math.PI * 2,
      from: 0.2 + rng.next() * 0.3,
      to: 0.65 + rng.next() * 0.35,
      weight: 0.5 + rng.next() * 1.2,
      alpha: 0.12 + rng.next() * 0.2,
    })),
    // Bark is an irregular rim rather than a clean circle.
    bark: Array.from({ length: 26 }, (_, i) => ({
      angle: (i / 26) * Math.PI * 2,
      out: 0.965 + rng.next() * 0.06,
    })),
    grainAngle: combatant.grain * (Math.PI / 4),
    targetAngle: combatant.grain * (Math.PI / 4),
    hpShown: combatant.hp,
    offsetX: 0,
    offsetY: 0,
    flash: 0,
    shake: 0,
    scale: 1,
    popups: [],
    revealT: combatant.revealed ? 1 : 0,
    seed: rng.next(),
  };
}

/** Advance view state. Call once per frame per combatant. */
export function updateView(view, combatant, dt) {
  const spin = 7.5;
  let delta = view.targetAngle - view.grainAngle;
  view.grainAngle += delta * Math.min(1, dt * spin);
  if (Math.abs(delta) < 0.002) view.grainAngle = view.targetAngle;

  view.hpShown += (combatant.hp - view.hpShown) * Math.min(1, dt * 6);
  view.offsetX *= Math.max(0, 1 - dt * 9);
  view.offsetY *= Math.max(0, 1 - dt * 9);
  view.flash = Math.max(0, view.flash - dt * 3.4);
  view.shake = Math.max(0, view.shake - dt * 4);
  view.scale += (1 - view.scale) * Math.min(1, dt * 10);
  view.revealT += ((combatant.revealed ? 1 : 0) - view.revealT) * Math.min(1, dt * 4);

  for (let i = view.popups.length - 1; i >= 0; i--) {
    const p = view.popups[i];
    p.age += dt;
    p.y -= dt * (34 - p.age * 16);
    p.x += p.drift * dt;
    if (p.age > p.life) view.popups.splice(i, 1);
  }
}

export function pushPopup(view, text, { color = P.pale, size = 18, life = 1.1 } = {}) {
  view.popups.push({
    text, color, size, life, age: 0,
    x: (Math.random() - 0.5) * 26, y: 0, drift: (Math.random() - 0.5) * 26,
  });
}

/** Point the fibre at a new Grain position; the view tweens the rest. */
export function setGrain(view, grain) {
  const target = grain * (Math.PI / 4);
  // Always turn the short way, so a wrap from Compacted to Rising reads as +45.
  let d = target - view.targetAngle;
  while (d > Math.PI / 2 + 0.01) d -= Math.PI;
  while (d < -Math.PI / 2 - 0.01) d += Math.PI;
  view.targetAngle += d;
}

export function drawCrossSection(r, c, view, x, y, radius, {
  selected = false, active = false, previewGrain = null, t = 0, compact = false,
} = {}) {
  const alive = isAlive(c);
  const known = view.revealT;
  const health = Math.max(0, Math.min(1, view.hpShown / Math.max(1, c.maxHp)));
  const sx = x + view.offsetX + (view.shake ? (Math.random() - 0.5) * view.shake * 9 : 0);
  const sy = y + view.offsetY + (view.shake ? (Math.random() - 0.5) * view.shake * 6 : 0);
  const R = radius * view.scale;

  r.save();
  if (!alive) r.alpha(0.34);

  r.groundShadow(sx, sy + R * 0.92, R * 1.05, R * 0.24, 0.55);

  // --- bark rim ---
  const barkPath = () => {
    r.ctx.beginPath();
    view.bark.forEach((b, i) => {
      const px = sx + Math.cos(b.angle) * R * b.out;
      const py = sy + Math.sin(b.angle) * R * b.out;
      if (i) r.ctx.lineTo(px, py); else r.ctx.moveTo(px, py);
    });
    r.ctx.closePath();
  };
  barkPath();
  r.ctx.fillStyle = RAMP.bark[1];
  r.ctx.fill();

  // --- body ---
  r.save();
  r.ctx.beginPath();
  r.ctx.arc(sx, sy, R * 0.93, 0, Math.PI * 2);
  r.ctx.clip();

  // Sapwood to heartwood, lit from upper-left.
  const body = r.ctx.createRadialGradient(
    sx - R * 0.3, sy - R * 0.35, R * 0.05, sx, sy, R,
  );
  const rotted = 1 - health;
  body.addColorStop(0, mix(RAMP.wood[5], RAMP.scar[2], rotted * 0.5));
  body.addColorStop(0.55, mix(RAMP.wood[3], RAMP.scar[1], rotted * 0.55));
  body.addColorStop(1, mix(RAMP.wood[1], RAMP.bark[2], 0.3 + rotted * 0.45));
  r.ctx.fillStyle = body;
  r.ctx.fillRect(sx - R, sy - R, R * 2, R * 2);

  // growth rings
  for (const ring of view.rings) {
    const rr = R * 0.93 * ring.at;
    r.circle(sx, sy, rr, alpha(mix(RAMP.wood[4], RAMP.amber[2], ring.tone * 0.55), 0.55),
      { stroke: true, lw: Math.max(0.8, ring.w * 0.9) });
    r.circle(sx, sy, rr + ring.w, alpha(RAMP.bark[0], 0.55), { stroke: true, lw: 1 });
  }

  if (!compact) {
    for (const ray of view.rays) {
      r.save();
      r.alpha(ray.alpha);
      r.line(
        sx + Math.cos(ray.angle) * R * ray.from, sy + Math.sin(ray.angle) * R * ray.from,
        sx + Math.cos(ray.angle) * R * ray.to, sy + Math.sin(ray.angle) * R * ray.to,
        RAMP.bark[0], ray.weight,
      );
      r.restore();
    }
  }

  // --- the fibre: the mechanic, drawn ---
  const angle = view.grainAngle;
  const gc = GRAIN_COLOR[c.grain];
  const spacing = compact ? 6 : 8.5;
  r.save();
  r.alpha(0.25 + known * 0.75);
  for (let o = -R; o <= R; o += spacing) {
    const dx = Math.cos(angle) * R * 1.2;
    const dy = Math.sin(angle) * R * 1.2;
    const nx = -Math.sin(angle) * o;
    const ny = Math.cos(angle) * o;
    // Fibres facing the key light pick up more of it.
    const lit = 0.35 + 0.65 * Math.max(0, Math.cos(angle - 0.7));
    r.line(sx + nx - dx, sy + ny - dy, sx + nx + dx, sy + ny + dy,
      alpha(known > 0.5 ? gc : RAMP.shade[2], 0.16 + lit * 0.3), known > 0.5 ? 1.7 : 1.2);
  }
  r.restore();

  // Necrosis creeping in from the rim as the section fails.
  if (rotted > 0.08) {
    const rot = r.ctx.createRadialGradient(sx, sy, R * (1 - rotted) * 0.85, sx, sy, R);
    rot.addColorStop(0, alpha(RAMP.scar[0], 0));
    rot.addColorStop(1, alpha(RAMP.scar[0], 0.55 * rotted + 0.2));
    r.ctx.fillStyle = rot;
    r.ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
  }

  // scars: torn wedges out of the section
  for (let i = 0; i < c.scars; i++) {
    const a = -0.7 + i * 0.85 + view.seed;
    const spread = 0.19;
    r.poly([
      [sx + Math.cos(a) * R * 0.06, sy + Math.sin(a) * R * 0.06],
      [sx + Math.cos(a - spread) * R, sy + Math.sin(a - spread) * R],
      [sx + Math.cos(a) * R * 0.86, sy + Math.sin(a) * R * 0.86],
      [sx + Math.cos(a + spread) * R, sy + Math.sin(a + spread) * R],
    ], RAMP.bark[0]);
    r.poly([
      [sx + Math.cos(a) * R * 0.06, sy + Math.sin(a) * R * 0.06],
      [sx + Math.cos(a - spread) * R, sy + Math.sin(a - spread) * R],
      [sx + Math.cos(a) * R * 0.86, sy + Math.sin(a) * R * 0.86],
    ], alpha(RAMP.scar[1], 0.85));
  }

  // Unread opponents stay in shadow -- still a readable object, but with no
  // fibre and no detail. Reading one resolves it, which is the mechanic's payoff.
  if (known < 0.98) {
    r.ctx.fillStyle = alpha(RAMP.shade[0], (1 - known) * 0.66);
    r.ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
  }
  r.restore();

  // --- rim light and bark edge ---
  barkPath();
  r.ctx.strokeStyle = selected ? RAMP.amber[4] : active ? RAMP.wood[4] : RAMP.bark[3];
  r.ctx.lineWidth = selected ? 3 : 2;
  r.ctx.stroke();
  r.save();
  r.blend('lighter', () => {
    r.arc(sx, sy, R * 0.95, Math.PI * 1.05, Math.PI * 1.75,
      alpha(RAMP.amber[4], 0.4 + (selected ? 0.3 : 0)), 2.4);
  });
  r.restore();

  if (known < 0.6 && !compact) {
    r.save();
    r.alpha((1 - known) * 0.5);
    r.text('?', sx, sy + R * 0.22, {
      size: R * 0.8, color: RAMP.shade[5], align: 'center', weight: 700, font: 'display',
    });
    r.restore();
  }

  if (view.flash > 0) {
    r.save();
    r.blend('lighter', () => {
      r.circle(sx, sy, R, alpha(RAMP.pale[5], view.flash * 0.5));
    });
    r.restore();
  }

  if (grainLocked(c) && known > 0.4) {
    // A locked fibre is shown as a clamp across the section.
    r.save();
    r.alpha(0.75);
    for (const s of [-1, 1]) {
      const a = angle + Math.PI / 2;
      r.line(
        sx + Math.cos(a) * R * s * 0.72 - Math.cos(angle) * R * 0.34,
        sy + Math.sin(a) * R * s * 0.72 - Math.sin(angle) * R * 0.34,
        sx + Math.cos(a) * R * s * 0.72 + Math.cos(angle) * R * 0.34,
        sy + Math.sin(a) * R * s * 0.72 + Math.sin(angle) * R * 0.34,
        RAMP.scar[3], 2.5, 'round',
      );
    }
    r.restore();
  }

  // --- targeting preview: where the force is about to come from ---
  if (previewGrain != null) {
    const pa = previewGrain * (Math.PI / 4) + Math.PI / 2;
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    r.save();
    r.blend('lighter', () => {
      for (const s of [-1, 1]) {
        const ox = Math.cos(pa) * s;
        const oy = Math.sin(pa) * s;
        r.line(sx + ox * (R + 10 + pulse * 5), sy + oy * (R + 10 + pulse * 5),
          sx + ox * (R + 30 + pulse * 8), sy + oy * (R + 30 + pulse * 8),
          RAMP.amber[4], 3, 'round');
        r.poly([
          [sx + ox * (R + 6), sy + oy * (R + 6)],
          [sx + ox * (R + 16) - oy * 5, sy + oy * (R + 16) + ox * 5],
          [sx + ox * (R + 16) + oy * 5, sy + oy * (R + 16) - ox * 5],
        ], alpha(RAMP.amber[5], 0.6 + pulse * 0.4));
      }
    });
    r.restore();
  }

  r.restore();
  return { x: sx, y: sy, radius: R };
}

/** Grafts orbit the rim on tethers, counting down. */
export function drawGrafts(r, c, view, x, y, radius, t) {
  c.grafts.forEach((g, i) => {
    const a = -Math.PI / 2 + i * 0.62 + Math.sin(t * 0.7 + i) * 0.05;
    const dist = radius + 20;
    const gx = x + Math.cos(a) * dist;
    const gy = y + Math.sin(a) * dist;
    const mine = g.bySide === 'party';
    const color = mine ? P.sapHi : P.emberHi;
    r.line(x + Math.cos(a) * radius, y + Math.sin(a) * radius, gx, gy,
      alpha(color, 0.35), 1);
    const pulse = 0.75 + 0.25 * Math.sin(t * 4 + i);
    r.light(gx, gy, 22 * pulse, color, 0.5);
    r.circle(gx, gy, 10, RAMP.bark[1]);
    r.circle(gx, gy, 10, color, { stroke: true, lw: 2 });
    r.text(view.revealT > 0.5 ? String(g.maturity) : '?', gx, gy + 4,
      { size: 11, color, align: 'center', weight: 700 });
  });
}

export function drawPopups(r, view, x, y) {
  for (const p of view.popups) {
    const t = p.age / p.life;
    r.save();
    r.alpha(t < 0.15 ? t / 0.15 : (1 - t) ** 0.6);
    const scale = t < 0.12 ? 1.35 - t * 2 : 1;
    r.text(p.text, x + p.x, y + p.y, {
      size: p.size * scale, color: p.color, align: 'center', weight: 700,
      shadow: alpha(RAMP.bark[0], 0.9),
    });
    r.restore();
  }
}

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
