import { P, alpha } from './palette.js';

// A small pooled particle system. Everything the game throws around -- splinters
// off a cleave, sap from a maturing graft, motes hanging in lamplight, ash over
// the Sump -- is one of these with different presets.

const MAX = 900;

const PRESETS = {
  /** Wood torn across the fibre. Chips that tumble and fall. */
  splinter: {
    count: 14, shape: 'chip', color: P.woodHi, life: [0.4, 0.9],
    speed: [90, 260], size: [2, 5], gravity: 620, drag: 1.6, spin: 14,
  },
  /** Force along the grain: it slides off and dissipates rather than biting. */
  glance: {
    count: 8, shape: 'streak', color: P.shadeLit, life: [0.25, 0.5],
    speed: [40, 120], size: [4, 9], gravity: 60, drag: 3.2, spin: 0,
  },
  /** The bright crack of an across-grain hit. */
  spark: {
    count: 18, shape: 'streak', color: P.ignite, life: [0.25, 0.6],
    speed: [180, 480], size: [5, 14], gravity: 340, drag: 2.4, spin: 0, glow: true,
  },
  /** A graft taking. Slow, heavy, green. */
  sap: {
    count: 12, shape: 'dot', color: P.sapHi, life: [0.6, 1.2],
    speed: [30, 130], size: [2, 4.5], gravity: 300, drag: 1.1, spin: 0, glow: true,
  },
  /** Scarring: dark dust and torn fibre. */
  rip: {
    count: 20, shape: 'chip', color: P.scar, life: [0.5, 1.1],
    speed: [60, 240], size: [2, 6], gravity: 480, drag: 1.5, spin: 20,
  },
  /** Sunwood being spent. */
  sunwood: {
    count: 10, shape: 'dot', color: P.sunwoodHi, life: [0.5, 1.0],
    speed: [20, 90], size: [1.5, 3.5], gravity: -40, drag: 1.4, spin: 0, glow: true,
  },
  /** Ambient: dust hanging in the light. Drifts up, never lands. */
  mote: {
    count: 1, shape: 'dot', color: P.sunwoodDim, life: [5, 11],
    speed: [3, 12], size: [0.7, 1.5], gravity: -5, drag: 0.15, spin: 0, glow: true,
  },
  /** Ambient: what a dying canopy sheds. */
  ash: {
    count: 1, shape: 'chip', color: P.paleDim, life: [5, 11],
    speed: [6, 22], size: [1.5, 3], gravity: 9, drag: 0.3, spin: 1.4,
  },
  footfall: {
    count: 4, shape: 'dot', color: P.wood, life: [0.25, 0.5],
    speed: [10, 45], size: [1, 2.5], gravity: -20, drag: 2.4, spin: 0,
  },
};

export class Particles {
  constructor() {
    this.items = [];
    this.rings = [];
  }

  get count() { return this.items.length + this.rings.length; }

  /** Emit a preset burst, optionally aimed along `angle` within `spread`. */
  burst(preset, x, y, {
    count = null, angle = null, spread = Math.PI * 2, color = null,
    speedScale = 1, sizeScale = 1, life = 1,
  } = {}) {
    const spec = PRESETS[preset];
    if (!spec) throw new Error(`unknown particle preset: ${preset}`);
    const n = count ?? spec.count;
    for (let i = 0; i < n; i++) {
      if (this.items.length >= MAX) break;
      const dir = angle == null
        ? Math.random() * Math.PI * 2
        : angle + (Math.random() - 0.5) * spread;
      const speed = rand(spec.speed) * speedScale;
      this.items.push({
        x, y,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        life: rand(spec.life) * life,
        age: 0,
        size: rand(spec.size) * sizeScale,
        color: color ?? spec.color,
        shape: spec.shape,
        gravity: spec.gravity,
        drag: spec.drag,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * spec.spin,
        glow: !!spec.glow,
      });
    }
  }

  /** An expanding shockwave ring. Used for impacts and maturing grafts. */
  ring(x, y, { radius = 60, width = 3, color = P.sunwood, life = 0.4, from = 4 } = {}) {
    this.rings.push({ x, y, radius, width, color, life, age: 0, from });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.items.splice(i, 1);
        continue;
      }
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age >= r.life) this.rings.splice(i, 1);
    }
  }

  draw(r) {
    for (const ring of this.rings) {
      const t = ring.age / ring.life;
      const radius = ring.from + (ring.radius - ring.from) * (1 - (1 - t) ** 2);
      r.save();
      r.alpha((1 - t) ** 1.5);
      r.blend('lighter', () => {
        r.circle(ring.x, ring.y, radius, ring.color,
          { stroke: true, lw: ring.width * (1 - t * 0.7) });
      });
      r.restore();
    }

    for (const p of this.items) {
      const t = p.age / p.life;
      const fade = 1 - t * t;
      r.save();
      r.alpha(fade);
      const paint = () => {
        if (p.shape === 'chip') {
          r.save();
          r.translate(p.x, p.y);
          r.rotate(p.rot);
          r.rect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9, p.color);
          r.restore();
        } else if (p.shape === 'streak') {
          const len = Math.min(p.size * 2.2, 26);
          const speed = Math.hypot(p.vx, p.vy) || 1;
          r.line(p.x, p.y, p.x - (p.vx / speed) * len, p.y - (p.vy / speed) * len,
            p.color, Math.max(1, p.size * 0.28), 'round');
        } else {
          r.circle(p.x, p.y, p.size * (1 - t * 0.4), p.color);
        }
      };
      if (p.glow) r.blend('lighter', paint);
      else paint();
      r.restore();
    }
  }

  clear() {
    this.items.length = 0;
    this.rings.length = 0;
  }
}

const rand = ([lo, hi]) => lo + Math.random() * (hi - lo);

export { PRESETS };
