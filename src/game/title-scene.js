import { Scene } from '../engine/scene.js';
import { P, RAMP, alpha, mix } from '../engine/palette.js';
import { makeRng } from '../engine/rng.js';

/**
 * The title is the game's thesis as one image: a cross-section of a Strider,
 * the Ember burning at the pith, and one band of rings that is conspicuously
 * too even. A reading sweep passes over the section every few seconds and the
 * written span lights up as it crosses -- the whole plot, before a word of it.
 */
export class TitleScene extends Scene {
  grade = { bloom: 0.75, vignette: 0.9, grain: 0.06, warmth: 0.62 };

  constructor(onStart) {
    super();
    this.onStart = onStart;
    this.t = 0;
    this.sweep = -0.35;
    this.started = false;

    const rng = makeRng(0x5eed);
    this.rings = [];
    let radius = 7;
    for (let i = 0; i < 44; i++) {
      const edited = i >= 16 && i < 30;
      // Natural years wobble; the written span does not. Visible at a glance.
      const width = edited
        ? 5.6 + Math.sin(i * 0.5) * 0.18
        : 2.6 + rng.next() * 8.4 + Math.sin(i * 0.31) * 1.6;
      radius += width;
      this.rings.push({ radius, width, edited, seed: rng.next() });
    }
    // Normalise so the section reads as an object on the table, not as wallpaper.
    const OUTER = 212;
    const k = OUTER / radius;
    for (const ring of this.rings) {
      ring.radius *= k;
      ring.width *= k;
    }
    this.outer = OUTER;
    // Medullary rays: the radial checks that run out from the pith.
    this.rays = Array.from({ length: 34 }, () => ({
      angle: rng.next() * Math.PI * 2,
      from: 0.15 + rng.next() * 0.4,
      to: 0.6 + rng.next() * 0.45,
      weight: 0.6 + rng.next() * 1.6,
      alpha: 0.1 + rng.next() * 0.22,
    }));
  }

  enter() { this.game.audio.setAmbient('audit'); }

  update(dt) {
    this.t += dt;
    // The sweep rests off-frame, then crosses. Timed so it reads as deliberate.
    this.sweep += dt * 0.13;
    if (this.sweep > 1.5) this.sweep = -0.5;

    if (this.game.particles.count < 90 && Math.random() < 0.5) {
      this.game.particles.burst('mote',
        Math.random() * this.game.renderer.W,
        this.game.renderer.H * (0.4 + Math.random() * 0.7));
    }

    if (this.input.pressed('confirm') && !this.started) {
      this.started = true;
      this.game.audio.resume();
      this.game.audio.play('confirm');
      this.onStart();
    }
  }

  draw(r) {
    // Asymmetric: the section sits right, the type reads left against it.
    const cx = r.W * 0.70;
    const cy = r.H * 0.52;
    r.begin(RAMP.bark[0]);

    // Cold ground light so the section does not float in pure black.
    r.blend('lighter', () => {
      r.light(cx, cy, this.outer * 2.1, RAMP.shade[2], 0.5);
    }, 0.6);

    this.#drawSection(r, cx, cy);
    this.game.particles.draw(r);

    // One soft left-to-right scrim instead of horizontal plates: no hard edges
    // cutting the section, and the type side stays dark enough to read on.
    r.save();
    const scrim = r.ctx.createLinearGradient(0, 0, r.W * 0.78, 0);
    scrim.addColorStop(0, alpha(RAMP.bark[0], 0.94));
    scrim.addColorStop(0.42, alpha(RAMP.bark[0], 0.86));
    scrim.addColorStop(1, alpha(RAMP.bark[0], 0));
    r.ctx.fillStyle = scrim;
    r.ctx.fillRect(0, 0, r.W * 0.78, r.H);
    r.restore();

    this.#drawType(r);
  }

  #drawSection(r, cx, cy) {
    const sweepX = cx - this.outer + this.sweep * this.outer * 2;

    r.save();
    // Sapwood body, so the rings sit on a surface rather than on the void.
    r.circle(cx, cy, this.outer + 6, mix(RAMP.bark[1], RAMP.wood[0], 0.5));
    r.circle(cx, cy, this.outer + 6, RAMP.bark[3], { stroke: true, lw: 3 });

    for (const ring of this.rings) {
      // Distance of this ring from the reading sweep, in ring-radius units.
      const nearness = Math.max(0, 1 - Math.abs(cx - sweepX) / 150);
      const lit = ring.edited ? nearness : nearness * 0.25;
      const base = ring.edited
        ? mix(RAMP.wood[3], RAMP.amber[2], 0.3 + lit * 0.55)
        : mix(RAMP.wood[0], RAMP.wood[2], 0.25 + ring.seed * 0.5);
      r.circle(cx, cy, ring.radius, base, { stroke: true, lw: Math.max(1.2, ring.width * 0.55) });
      // The dark latewood line that closes each year.
      r.circle(cx, cy, ring.radius + ring.width * 0.42, alpha(RAMP.bark[0], 0.85),
        { stroke: true, lw: 1.1 });
    }

    r.save();
    r.ctx.beginPath();
    r.ctx.arc(cx, cy, this.outer, 0, Math.PI * 2);
    r.ctx.clip();
    for (const ray of this.rays) {
      r.save();
      r.alpha(ray.alpha);
      r.line(
        cx + Math.cos(ray.angle) * this.outer * ray.from,
        cy + Math.sin(ray.angle) * this.outer * ray.from,
        cx + Math.cos(ray.angle) * this.outer * ray.to,
        cy + Math.sin(ray.angle) * this.outer * ray.to,
        RAMP.bark[0], ray.weight,
      );
      r.restore();
    }
    r.restore();

    // The reading sweep itself: a soft amber bar crossing the section.
    if (this.sweep > -0.2 && this.sweep < 1.2) {
      r.save();
      r.ctx.beginPath();
      r.ctx.arc(cx, cy, this.outer, 0, Math.PI * 2);
      r.ctx.clip();
      r.blend('lighter', () => {
        const g = r.ctx.createLinearGradient(sweepX - 70, 0, sweepX + 70, 0);
        g.addColorStop(0, alpha(RAMP.amber[3], 0));
        g.addColorStop(0.5, alpha(RAMP.amber[4], 0.34));
        g.addColorStop(1, alpha(RAMP.amber[3], 0));
        r.ctx.fillStyle = g;
        r.ctx.fillRect(sweepX - 70, cy - this.outer, 140, this.outer * 2);
        r.line(sweepX, cy - this.outer, sweepX, cy + this.outer, alpha(RAMP.amber[5], 0.55), 1.5);
      });
      r.restore();
    }

    // The Ember at the pith. Everything else in the frame is lit by this.
    const pulse = 0.82 + 0.18 * Math.sin(this.t * 0.85) + 0.04 * Math.sin(this.t * 3.7);
    r.light(cx, cy, 150 * pulse, RAMP.ember[3], 0.4);
    r.light(cx, cy, 54 * pulse, RAMP.amber[4], 0.55);
    r.circle(cx, cy, 6 * pulse, RAMP.amber[5]);
    r.circle(cx, cy, 3 * pulse, '#fff6e2');
    r.restore();
  }

  #drawType(r) {
    const x = 74;

    r.text('AN AUDIT', x, 138, {
      size: 11, color: RAMP.amber[3], tracking: 5.5, weight: 700,
    });
    r.line(x, 150, x + 208, 150, alpha(RAMP.amber[2], 0.5), 1);

    r.text('SECOND', x - 4, 214, {
      size: 68, font: 'display', weight: 700, color: RAMP.pale[5], tracking: 2,
    });
    r.text('HARVEST', x - 4, 282, {
      size: 68, font: 'display', weight: 700, color: RAMP.pale[4], tracking: 2,
    });

    r.line(x, 312, x + 300, 312, alpha(RAMP.wood[2], 0.8), 1);
    r.text('the sun is in a dim phase', x, 336, { size: 12, color: RAMP.amber[3], tracking: 1 });
    r.text('nobody caused it', x, 356, { size: 12, color: RAMP.pale[1], tracking: 1 });
    r.text('nobody can fix it', x, 376, { size: 12, color: RAMP.pale[1], tracking: 1 });

    r.text('You read the memory in the growth rings of cities', x, 414,
      { size: 11.5, color: RAMP.pale[0] });
    r.text('that walk, and certify it against what was filed.', x, 432,
      { size: 11.5, color: RAMP.pale[0] });

    const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * 2.6));
    r.save();
    r.alpha(blink);
    r.text('PRESS ENTER', x, 478, {
      size: 15, color: RAMP.amber[4], weight: 700, tracking: 4,
    });
    r.restore();
    r.text('arrows · enter · x back · e sample · m sound', x, 504,
      { size: 10, color: RAMP.pale[0], tracking: 0.6 });
  }
}
