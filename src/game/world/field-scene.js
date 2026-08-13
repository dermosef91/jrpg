import { Scene } from '../../engine/scene.js';
import { P, RAMP, alpha, mix } from '../../engine/palette.js';
import { DialogueScene } from '../ui/dialogue.js';
import { makeRng } from '../../engine/rng.js';
import { drawFigure } from './figure.js';

/** Deterministic per-tile variation, so no two boards look identically stamped. */
function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const TILE = 32;
const MOVE_TIME = 0.13;

const DIRS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};

/** One scene drives both the overworld and the vertical town: they differ only
 *  in map data. Traces are walkable furrows, which makes the road network and
 *  the archaeology the same terrain. */
export class FieldScene extends Scene {
  constructor(map, { spawn = null, onEncounter = null } = {}) {
    super();
    this.map = map;
    this.onEncounter = onEncounter;
    const start = spawn ?? map.spawn;
    this.px = start.x;
    this.py = start.y;
    this.facing = start.facing ?? 'down';
    this.moveT = 0;
    this.from = { x: this.px, y: this.py };
    this.steps = 0;
    this.rng = makeRng(map.id.length * 977 + 13);
    this.banner = 2.6;
    this.t = 0;
    this.bob = 0;
    this.grade = map.grade ?? { bloom: 0.5, vignette: 0.9, grain: 0.05, warmth: 0.55 };
    // Tiles that emit light, collected once rather than scanned every frame.
    this.lamps = [];
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        if (this.def(this.tileAt(tx, ty)).emits) this.lamps.push({ x: tx, y: ty });
      }
    }
  }

  enter() {
    this.banner = 2.6;
    this.game.audio.setAmbient(this.map.ambient ?? 'field');
  }

  exit() { this.game.particles.clear(); }

  tileAt(x, y) {
    const row = this.map.tiles[y];
    return row?.[x] ?? ' ';
  }

  def(ch) { return this.map.legend[ch] ?? { solid: true, color: P.void }; }

  entityAt(x, y) {
    return this.map.entities.find((e) => e.x === x && e.y === y) ?? null;
  }

  walkable(x, y) {
    if (this.def(this.tileAt(x, y)).solid) return false;
    const e = this.entityAt(x, y);
    return !(e && e.solid);
  }

  get moving() { return this.moveT > 0; }

  update(dt) {
    this.t += dt;
    this.banner = Math.max(0, this.banner - dt);
    this.#ambientParticles();

    if (this.moving) {
      this.moveT = Math.max(0, this.moveT - dt);
      this.bob += dt * 13;
      if (this.moveT === 0) this.#arrive();
      return;
    }

    if (this.input.pressed('confirm')) {
      const [dx, dy] = DIRS[this.facing];
      const target = this.entityAt(this.px + dx, this.py + dy) ?? this.entityAt(this.px, this.py);
      if (target) this.#interact(target);
      return;
    }

    for (const [action, [dx, dy]] of Object.entries(DIRS)) {
      if (!this.input.held(action)) continue;
      this.facing = action;
      if (this.walkable(this.px + dx, this.py + dy)) {
        this.from = { x: this.px, y: this.py };
        this.px += dx;
        this.py += dy;
        this.moveT = MOVE_TIME;
      }
      return;
    }
  }

  /** Motes in the light, or ash where the canopy is failing. */
  #ambientParticles() {
    const fx = this.game.particles;
    if (fx.count > 52) return;
    const kind = this.map.motes ?? 'mote';
    if (Math.random() > (this.map.moteRate ?? 0.12)) return;
    const r = this.game.renderer;
    fx.burst(kind, Math.random() * r.W, r.H * (0.15 + Math.random() * 0.9));
  }

  #arrive() {
    this.game.audio.play('step', { pitch: 0.9 + Math.random() * 0.25 });
    const cam = this.lastCam;
    if (cam) {
      this.game.particles.burst('footfall',
        (this.px - cam.px) * TILE + cam.screenX, (this.py - cam.py) * TILE + cam.screenY + 12,
        { count: 3 });
    }
    const here = this.entityAt(this.px, this.py);
    if (here && here.trigger === 'step') {
      this.#interact(here);
      return;
    }
    if (!this.map.encounterRate) return;
    this.steps += 1;
    // A short grace period after arriving stops a fight the instant you enter a map.
    if (this.steps > 6 && this.rng.next() < this.map.encounterRate) {
      this.steps = 0;
      this.onEncounter?.(this);
    }
  }

  #interact(entity) {
    switch (entity.kind) {
      case 'npc':
      case 'sign':
        this.game.audio.play('confirm');
        this.game.scenes.push(new DialogueScene(entity.beats));
        break;
      case 'exit':
        this.game.audio.play('door');
        this.game.goTo(entity.to, entity.spawn);
        break;
      case 'action':
        entity.run(this.game, this);
        break;
      default:
        break;
    }
  }

  // --- draw -----------------------------------------------------------------

  #camera(r) {
    const ease = this.moving ? 1 - this.moveT / MOVE_TIME : 1;
    const x = this.from.x + (this.px - this.from.x) * ease;
    const y = this.from.y + (this.py - this.from.y) * ease;
    // Follow the player, but centre any map smaller than the viewport instead of
    // pinning it to the top-left corner.
    const axis = (pos, span, view) => {
      const slack = span - view;
      return slack <= 0 ? slack / 2 : clamp(pos - view / 2, 0, slack);
    };
    return {
      x: axis(x * TILE + TILE / 2, this.map.w * TILE, r.W),
      y: axis(y * TILE + TILE / 2, this.map.h * TILE, r.H),
      px: x, py: y,
    };
  }

  draw(r) {
    const cam = this.#camera(r);
    this.lastCam = { px: cam.px, py: cam.py, screenX: r.W / 2, screenY: r.H / 2 };
    r.begin(this.map.void ?? RAMP.bark[0]);

    r.save();
    r.translate(-Math.round(cam.x), -Math.round(cam.y));

    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 2);
    const x1 = Math.min(this.map.w, x0 + Math.ceil(r.W / TILE) + 3);
    const y1 = Math.min(this.map.h, y0 + Math.ceil(r.H / TILE) + 4);

    // Ground first, then everything standing on it, row by row from back to
    // front so walls, props and people occlude each other correctly.
    this.#drawGround(r, x0, y0, x1, y1);
    this.#drawOcclusion(r, x0, y0, x1, y1);

    const playerRow = Math.round(cam.py);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) this.#drawBlock(r, x, y);
      for (const e of this.map.entities) if (e.y === y) this.#drawEntity(r, e);
      if (y === playerRow) this.#drawPlayer(r, cam);
    }

    this.#drawCanopy(r, x0, y0, x1, y1);
    r.restore();

    this.game.particles.draw(r);
    this.#drawHud(r);
  }

  #drawGround(r, x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const ch = this.tileAt(x, y);
        if (ch === ' ') continue;
        const def = this.def(ch);
        const sx = x * TILE;
        const sy = y * TILE;
        const n = tileHash(x, y);

        // Ground under a solid block still gets painted, so blocks sit on floor
        // rather than floating over the void.
        const base = def.solid ? (def.floor ?? this.map.floor ?? '.') : ch;
        const bdef = def.solid ? this.def(base) : def;
        r.rect(sx, sy, TILE, TILE, bdef.shade
          ? mix(bdef.color, bdef.shade, 0.12 + n * 0.3)
          : bdef.color);

        if (bdef.bank) {
          const openAbove = !this.def(this.tileAt(x, y - 1)).wave;
          if (openAbove) r.rect(sx, sy, TILE, 3, alpha(RAMP.wood[0], 0.55));
        }
        if (bdef.wave) {
          for (let i = 0; i < 2; i++) {
            const off = Math.sin(this.t * (0.9 + i * 0.4) + x * 0.7 + y * 1.3 + i) * 6;
            r.rect(sx, sy + 8 + i * 12 + off, TILE, 2, alpha(RAMP.shade[4], 0.16 + i * 0.06));
          }
        }
        if (bdef.grain) {
          r.grainFill(sx, sy, TILE, TILE, bdef.grainColor ?? RAMP.bark[4],
            { spacing: bdef.spacing ?? 6, alpha: 0.42, angle: bdef.angle ?? -0.35, jitter: 0.6 });
        }
        if (bdef.planks) {
          r.line(sx, sy + (n > 0.5 ? 0 : TILE / 2), sx + TILE, sy + (n > 0.5 ? 0 : TILE / 2),
            alpha(RAMP.bark[0], 0.4), 1);
          r.line(sx + Math.round(n * (TILE - 6)) + 3, sy,
            sx + Math.round(n * (TILE - 6)) + 3, sy + TILE, alpha(RAMP.bark[0], 0.28), 1);
        }
        if (bdef.tuft && n > 0.62) this.#tuft(r, sx, sy, n, bdef);
        if (bdef.speck && n > 0.88) {
          r.rect(sx + 4 + n * (TILE - 12), sy + 6 + tileHash(y, x) * (TILE - 14), 3, 2,
            alpha(bdef.speck, 0.8));
        }
      }
    }
  }

  /** Scrub, grass and weed. Cheap, and it stops ground reading as paint. */
  #tuft(r, sx, sy, n, def) {
    const color = def.speck ?? RAMP.sap[2];
    const count = 2 + Math.floor(n * 3);
    for (let i = 0; i < count; i++) {
      const h = tileHash(sx + i * 7, sy - i * 3);
      const px = sx + 4 + h * (TILE - 8);
      const py = sy + 8 + tileHash(sy + i, sx - i) * (TILE - 12);
      const len = 3 + h * 4;
      const lean = (h - 0.5) * 3 + Math.sin(this.t * 1.1 + px * 0.1) * 0.8;
      r.line(px, py, px + lean, py - len, alpha(color, 0.75), 1.2);
    }
  }

  /** A solid tile as a block with height: a top face and a lit front face. */
  #drawBlock(r, x, y) {
    const ch = this.tileAt(x, y);
    const def = this.def(ch);
    if (!def.solid || !def.height) return;
    const sx = x * TILE;
    const sy = y * TILE;
    const h = def.height;
    const n = tileHash(x, y);
    const top = mix(def.color, def.shade ?? def.color, 0.1 + n * 0.35);

    if (def.trunk) { this.#drawTrunk(r, x, y, sx, sy, h, top, n); return; }

    // front face, brighter at the top where the light lands
    r.vgrad(sx, sy + TILE - h, TILE, h,
      mix(top, RAMP.pale[2], 0.16), mix(top, RAMP.bark[0], 0.45));
    if (def.grain) {
      r.grainFill(sx, sy + TILE - h, TILE, h, def.grainColor ?? RAMP.bark[4],
        { spacing: def.spacing ?? 5, alpha: 0.4, angle: 1.5, jitter: 0.8 });
    }
    if (def.planks) {
      for (let py = sy + TILE - h + 6; py < sy + TILE; py += 8) {
        r.line(sx, py, sx + TILE, py, alpha(RAMP.bark[0], 0.3), 1);
      }
    }
    // Top face. It faces a sky that barely has a sun in it, so it reads cooler
    // and darker than the lamplit floor -- which is what gives the deck relief.
    r.rect(sx, sy - h, TILE, TILE, mix(top, RAMP.shade[1], 0.3));
    if (def.grain) {
      r.grainFill(sx, sy - h, TILE, TILE, def.grainColor ?? RAMP.bark[4],
        { spacing: (def.spacing ?? 5) + 2, alpha: 0.3, angle: def.angle ?? -0.3 });
    }
    // edges
    r.line(sx, sy - h, sx + TILE, sy - h, alpha(RAMP.pale[2], 0.22), 1);
    r.line(sx, sy + TILE - h, sx + TILE, sy + TILE - h, alpha(RAMP.bark[0], 0.55), 1.5);
    if (!this.def(this.tileAt(x - 1, y)).solid) {
      r.line(sx + 0.5, sy - h, sx + 0.5, sy + TILE, alpha(RAMP.bark[0], 0.5), 1);
    }
    if (!this.def(this.tileAt(x + 1, y)).solid) {
      r.line(sx + TILE - 0.5, sy - h, sx + TILE - 0.5, sy + TILE, alpha(RAMP.bark[0], 0.5), 1);
    }

    if (def.lamp) {
      const lx = sx + TILE / 2;
      const ly = sy - h + TILE / 2;
      const flicker = 0.85 + 0.15 * Math.sin(this.t * 5.3 + x * 2.1 + y);
      r.rect(lx - 1.5, ly - 12, 3, 12, RAMP.bark[2]);
      r.light(lx, ly - 14, 118 * flicker, RAMP.amber[3], 0.4);
      r.rect(lx - 4, ly - 20, 8, 9, RAMP.amber[4]);
      r.strokeRect(lx - 4, ly - 20, 8, 9, RAMP.bark[1], 1.4);
      r.rect(lx - 5.5, ly - 22, 11, 2.5, RAMP.bark[2]);
    }
  }

  /** A trunk is a cylinder, not a slab: shade it round, ridge the bark, and cap
   *  it with the underside of a canopy rather than a flat lid. */
  #drawTrunk(r, x, y, sx, sy, h, top, n) {
    const solidLeft = this.def(this.tileAt(x - 1, y)).trunk;
    const solidRight = this.def(this.tileAt(x + 1, y)).trunk;
    const top0 = sy + TILE - h;

    r.hgrad(sx, top0, TILE, h + 0,
      solidLeft ? mix(top, RAMP.pale[1], 0.1) : mix(top, RAMP.bark[0], 0.55),
      mix(top, RAMP.pale[2], 0.22),
      solidRight ? mix(top, RAMP.pale[1], 0.05) : mix(top, RAMP.bark[0], 0.45));

    // bark ridges
    for (let i = 0; i < 7; i++) {
      const h2 = tileHash(x * 11 + i, y * 7);
      const px = sx + 2 + h2 * (TILE - 4);
      r.line(px, top0 + h2 * 6, px + (h2 - 0.5) * 2, sy + TILE,
        alpha(RAMP.bark[0], 0.28 + h2 * 0.3), 1 + h2 * 1.6);
    }
    r.line(sx, sy + TILE, sx + TILE, sy + TILE, alpha(RAMP.bark[0], 0.6), 2);

    // Canopy only at the crown of a trunk cluster, so a wide trunk gets one
    // continuous mass of foliage instead of a grid of identical bushes.
    if (!this.def(this.tileAt(x, y - 1)).trunk) {
      const capH = 15;
      r.ellipse(sx + TILE / 2, top0 + 2, TILE * 0.66, capH * 0.8,
        mix(RAMP.sap[1], RAMP.bark[1], 0.5));
      r.ellipse(sx + TILE / 2 - 5, top0 - 1, TILE * 0.34, capH * 0.45,
        mix(RAMP.sap[2], RAMP.bark[2], 0.42));
      r.ellipse(sx + TILE / 2 + 7, top0 + 4, TILE * 0.26, capH * 0.34,
        mix(RAMP.sap[1], RAMP.bark[0], 0.5));
    }
    if (!solidLeft) r.line(sx + 1, top0, sx + 1, sy + TILE, alpha(RAMP.bark[0], 0.5), 1.5);
    if (!solidRight) r.line(sx + TILE - 1, top0, sx + TILE - 1, sy + TILE, alpha(RAMP.bark[0], 0.5), 1.5);
  }

  /** Overhead foliage: dappled shade that drifts, drawn over everything. */
  #drawCanopy(r, x0, y0, x1, y1) {
    if (!this.map.canopy) return;
    // Sparse, so it reads as leaf shadow moving over the ground rather than as
    // a lid on the map.
    r.save();
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const n = tileHash(x * 3, y * 5);
        if (n < 0.9) continue;
        const drift = Math.sin(this.t * 0.3 + x * 0.4 + y * 0.2) * 6;
        r.ellipse(x * TILE + 16 + drift, y * TILE + 16, 26 + n * 14, 15 + n * 8,
          alpha(RAMP.bark[0], 0.22));
      }
    }
    r.restore();
  }

  #drawOcclusion(r, x0, y0, x1, y1) {
    const solid = (x, y) => this.def(this.tileAt(x, y)).solid;
    const depth = 10;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (solid(x, y)) continue;
        const sx = x * TILE;
        const sy = y * TILE;
        const shade = (gx0, gy0, gx1, gy1, rx, ry, rw, rh) => {
          const g = r.ctx.createLinearGradient(gx0, gy0, gx1, gy1);
          g.addColorStop(0, alpha(RAMP.bark[0], 0.6));
          g.addColorStop(1, alpha(RAMP.bark[0], 0));
          r.ctx.fillStyle = g;
          r.ctx.fillRect(rx, ry, rw, rh);
        };
        if (solid(x, y - 1)) shade(sx, sy, sx, sy + depth, sx, sy, TILE, depth);
        if (solid(x, y + 1)) shade(sx, sy + TILE, sx, sy + TILE - depth, sx, sy + TILE - depth, TILE, depth);
        if (solid(x - 1, y)) shade(sx, sy, sx + depth, sy, sx, sy, depth, TILE);
        if (solid(x + 1, y)) shade(sx + TILE, sy, sx + TILE - depth, sy, sx + TILE - depth, sy, depth, TILE);
      }
    }
  }

  #drawEntity(r, e) {
    const x = e.x * TILE + 16;
    const y = e.y * TILE + 26;

    switch (e.kind) {
      case 'npc':
        drawFigure(r, x, y, {
          facing: e.facing ?? 'down',
          walk: e.idle === false ? 0 : Math.sin(this.t * 0.8 + e.x) * 0.25,
          coat: e.color ?? RAMP.wood[3],
          skin: (e.x + e.y) % 5,
          hat: e.hat ?? false,
          pack: e.pack ?? false,
          lantern: e.lantern ?? false,
        });
        if (e.name) {
          r.text(e.name, x, y - 34, {
            size: 9.5, color: RAMP.pale[2], align: 'center', shadow: alpha(RAMP.bark[0], 0.9),
          });
        }
        break;

      case 'sign': {
        r.groundShadow(x, y, 9, 3, 0.5);
        r.rect(x - 1.5, y - 20, 3, 20, RAMP.wood[0]);
        r.rect(x - 12, y - 34, 24, 16, RAMP.wood[2]);
        r.grainFill(x - 12, y - 34, 24, 16, RAMP.wood[4], { spacing: 4, alpha: 0.5, angle: 0.1 });
        r.line(x - 12, y - 34, x + 12, y - 34, alpha(RAMP.pale[2], 0.3), 1.5);
        r.strokeRect(x - 12, y - 34, 24, 16, RAMP.wood[0], 1.5);
        for (let i = 0; i < 3; i++) {
          r.line(x - 8, y - 30 + i * 4, x + (i === 2 ? 3 : 8), y - 30 + i * 4,
            alpha(RAMP.bark[0], 0.45), 1);
        }
        break;
      }

      case 'prop':
        this.#drawProp(r, e, x, y);
        break;

      case 'exit': {
        // A stairwell: a dark opening with treads and light spilling out.
        const sx = e.x * TILE;
        const sy = e.y * TILE;
        r.rect(sx + 3, sy + 4, TILE - 6, TILE - 8, RAMP.bark[0]);
        for (let i = 0; i < 4; i++) {
          const t = i / 4;
          r.rect(sx + 4 + t * 5, sy + 6 + i * 5, TILE - 8 - t * 10, 3,
            mix(RAMP.wood[2], RAMP.bark[1], t));
        }
        r.strokeRect(sx + 3, sy + 4, TILE - 6, TILE - 8, RAMP.wood[1], 2);
        const pulse = 0.6 + 0.4 * Math.sin(this.t * 2.2);
        r.light(x, y - 8, 40 * pulse, RAMP.amber[3], 0.3);
        if (e.label) {
          r.text(e.label, x, sy - 6, {
            size: 9.5, color: RAMP.amber[3], align: 'center', shadow: alpha(RAMP.bark[0], 0.9),
          });
        }
        break;
      }

      case 'action': {
        // The audit bench: a trestle table with a core sample laid out on it.
        r.groundShadow(x, y + 2, 15, 5, 0.55);
        r.rect(x - 15, y - 14, 30, 5, RAMP.wood[2]);
        r.grainFill(x - 15, y - 14, 30, 5, RAMP.wood[4], { spacing: 3, alpha: 0.5, angle: 0.1 });
        r.rect(x - 13, y - 9, 3, 9, RAMP.wood[0]);
        r.rect(x + 10, y - 9, 3, 9, RAMP.wood[0]);
        r.rect(x - 11, y - 17, 22, 3, mix(RAMP.wood[4], RAMP.pale[2], 0.2));
        for (let i = 0; i < 7; i++) {
          r.line(x - 10 + i * 3, y - 17, x - 10 + i * 3, y - 14, alpha(RAMP.bark[0], 0.5), 1);
        }
        const pulse = 0.7 + 0.3 * Math.sin(this.t * 2.1);
        r.light(x, y - 18, 52 * pulse, RAMP.amber[3], 0.32);
        if (e.label) {
          r.text(e.label, x, y - 30, {
            size: 9.5, color: RAMP.amber[3], align: 'center', shadow: alpha(RAMP.bark[0], 0.9),
          });
        }
        break;
      }

      default: break;
    }
  }

  #drawProp(r, e, x, y) {
    const n = tileHash(e.x, e.y);
    switch (e.prop) {
      case 'crate':
        r.groundShadow(x, y + 1, 12, 4, 0.5);
        r.rect(x - 11, y - 20, 22, 20, RAMP.wood[2]);
        r.vgrad(x - 11, y - 20, 22, 20, mix(RAMP.wood[4], RAMP.pale[2], 0.15), RAMP.wood[1]);
        r.strokeRect(x - 11, y - 20, 22, 20, RAMP.bark[1], 1.5);
        r.line(x - 11, y - 10, x + 11, y - 10, alpha(RAMP.bark[0], 0.5), 1.5);
        r.line(x - 11, y - 20, x + 11, y, alpha(RAMP.bark[0], 0.3), 1);
        break;
      case 'barrel':
        r.groundShadow(x, y + 1, 10, 4, 0.5);
        r.ellipse(x, y - 22, 9, 3.5, mix(RAMP.wood[4], RAMP.pale[2], 0.2));
        r.rect(x - 9, y - 22, 18, 22, RAMP.wood[1]);
        r.vgrad(x - 9, y - 22, 18, 22, RAMP.wood[3], RAMP.wood[0]);
        for (const hy of [y - 18, y - 11, y - 4]) {
          r.line(x - 9, hy, x + 9, hy, alpha(RAMP.bark[0], 0.6), 2);
        }
        r.strokeRect(x - 9, y - 22, 18, 22, RAMP.bark[1], 1.2);
        break;
      case 'sack':
        r.groundShadow(x, y + 1, 11, 4, 0.5);
        r.poly([
          [x - 9, y], [x + 9, y], [x + 6, y - 15], [x, y - 19], [x - 6, y - 15],
        ], mix(RAMP.wood[3], RAMP.pale[1], 0.25));
        r.poly([
          [x - 9, y], [x - 2, y], [x - 2, y - 16], [x - 6, y - 15],
        ], mix(RAMP.wood[2], RAMP.bark[1], 0.2));
        r.line(x - 4, y - 17, x + 4, y - 17, alpha(RAMP.bark[0], 0.6), 2);
        break;
      case 'planter':
        r.groundShadow(x, y + 1, 12, 4, 0.5);
        r.rect(x - 11, y - 10, 22, 10, RAMP.wood[1]);
        r.strokeRect(x - 11, y - 10, 22, 10, RAMP.bark[1], 1.2);
        for (let i = 0; i < 5; i++) {
          const h = tileHash(e.x + i, e.y - i);
          const lean = (h - 0.5) * 8 + Math.sin(this.t * 0.9 + i) * 1.5;
          r.line(x - 7 + i * 3.5, y - 10, x - 7 + i * 3.5 + lean, y - 22 - h * 8,
            alpha(RAMP.sap[i % 2 ? 3 : 2], 0.85), 1.6);
        }
        break;
      case 'rail':
        r.rect(x - 16, y - 22, 2.5, 22, RAMP.wood[1]);
        r.rect(x + 13, y - 22, 2.5, 22, RAMP.wood[1]);
        r.rect(x - 16, y - 22, 32, 3, RAMP.wood[2]);
        r.rect(x - 16, y - 13, 32, 2, RAMP.wood[1]);
        break;
      case 'post': {
        const flicker = 0.85 + 0.15 * Math.sin(this.t * 5 + e.x);
        r.groundShadow(x, y + 1, 6, 2.5, 0.5);
        r.rect(x - 2, y - 34, 4, 34, RAMP.wood[0]);
        r.line(x, y - 34, x + 7, y - 34, RAMP.wood[1], 2);
        r.light(x + 7, y - 28, 130 * flicker, RAMP.amber[3], 0.42);
        r.rect(x + 4, y - 32, 7, 9, RAMP.amber[4]);
        r.strokeRect(x + 4, y - 32, 7, 9, RAMP.bark[1], 1.3);
        r.rect(x + 3, y - 34, 9, 2.5, RAMP.bark[2]);
        break;
      }
      default:
        r.circle(x, y - 8, 6 + n * 2, RAMP.wood[2]);
        break;
    }
  }

  #drawPlayer(r, cam) {
    const x = cam.px * TILE + 16;
    const y = cam.py * TILE + 26;
    drawFigure(r, x, y, {
      facing: this.facing,
      walk: this.moving ? this.bob : 0,
      coat: RAMP.amber[1],
      skin: 1,
      pack: true,
      lantern: true,
    });
  }

  #drawHud(r) {
    if (this.banner > 0) {
      const a = Math.min(1, this.banner / 0.7);
      const slide = (1 - Math.min(1, (2.6 - this.banner) / 0.4)) * -22;
      r.save();
      r.alpha(a);
      r.translate(0, slide);
      const title = this.map.name;
      const sub = this.map.subtitle ?? '';
      const w = Math.max(r.measure(title, 22, 700, 'display'), r.measure(sub, 11)) + 64;
      const x = r.W / 2 - w / 2;
      r.panel(x, 24, w, 68, { accent: RAMP.amber[3] });
      r.light(r.W / 2, 58, w * 0.6, RAMP.amber[2], 0.18);
      r.text(title, r.W / 2, 55, {
        size: 22, color: RAMP.pale[5], align: 'center', weight: 700, font: 'display', tracking: 1.5,
      });
      r.line(x + 24, 64, x + w - 24, 64, alpha(RAMP.wood[2], 0.7), 1);
      if (sub) r.text(sub, r.W / 2, 80, { size: 10.5, color: RAMP.pale[1], align: 'center' });
      r.restore();
    }

    r.save();
    r.alpha(0.55);
    r.text('arrows move   ·   enter interact   ·   m sound', 18, r.H - 16,
      { size: 10, color: RAMP.pale[0], tracking: 0.6 });
    r.restore();
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
