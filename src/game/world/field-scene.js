import { Scene } from '../../engine/scene.js';
import { P } from '../../engine/palette.js';
import { DialogueScene } from '../ui/dialogue.js';
import { makeRng } from '../../engine/rng.js';

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
    this.banner = 2.2;
    this.t = 0;
  }

  enter() { this.banner = 2.2; }

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

    if (this.moving) {
      this.moveT = Math.max(0, this.moveT - dt);
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

  #arrive() {
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
        this.game.scenes.push(new DialogueScene(entity.beats));
        break;
      case 'exit':
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
    r.clear(this.map.void ?? P.void);
    const cam = this.#camera(r);
    r.save();
    r.translate(-Math.round(cam.x), -Math.round(cam.y));

    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const x1 = Math.min(this.map.w, x0 + Math.ceil(r.W / TILE) + 3);
    const y1 = Math.min(this.map.h, y0 + Math.ceil(r.H / TILE) + 3);

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const ch = this.tileAt(x, y);
        if (ch === ' ') continue;
        const def = this.def(ch);
        const sx = x * TILE;
        const sy = y * TILE;
        r.rect(sx, sy, TILE, TILE, def.color);
        if (def.grain) {
          r.grainFill(sx, sy, TILE, TILE, def.grainColor ?? P.barkLit,
            { spacing: 6, alpha: 0.5, angle: def.angle ?? -0.35 });
        }
        if (def.speck && ((x * 31 + y * 17) % 7 === 0)) {
          r.rect(sx + 10, sy + 12, 4, 3, def.speck);
        }
        if (def.edge) r.strokeRect(sx, sy, TILE, TILE, def.edge, 1);
      }
    }

    for (const e of this.map.entities) this.#drawEntity(r, e);
    this.#drawPlayer(r, cam);
    r.restore();

    this.#drawHud(r);
  }

  #drawEntity(r, e) {
    const x = e.x * TILE;
    const y = e.y * TILE;
    switch (e.kind) {
      case 'npc': {
        r.circle(x + 16, y + 18, 9, e.color ?? P.shadeLit);
        r.circle(x + 16, y + 18, 9, P.deep, { stroke: true, lw: 2 });
        r.circle(x + 16, y + 11, 5, e.color ?? P.shadeLit);
        r.text(e.name ?? '', x + 16, y - 4, { size: 9, color: P.paleDim, align: 'center' });
        break;
      }
      case 'sign':
        r.rect(x + 7, y + 8, 18, 14, P.wood);
        r.strokeRect(x + 7, y + 8, 18, 14, P.woodLit, 2);
        r.rect(x + 15, y + 22, 3, 8, P.wood);
        break;
      case 'exit': {
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
        r.save();
        r.alpha(0.35 + pulse * 0.4);
        r.rect(x + 4, y + 4, TILE - 8, TILE - 8, P.sunwood);
        r.restore();
        r.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8, P.sunwood, 2);
        r.text(e.label ?? '', x + 16, y - 4, { size: 9, color: P.sunwood, align: 'center' });
        break;
      }
      case 'action': {
        r.circle(x + 16, y + 16, 11, P.bark);
        r.circle(x + 16, y + 16, 11, P.sunwood, { stroke: true, lw: 2 });
        r.circle(x + 16, y + 16, 6, P.sunwood, { stroke: true, lw: 1 });
        r.circle(x + 16, y + 16, 2, P.sunwood);
        r.text(e.label ?? '', x + 16, y - 4, { size: 9, color: P.sunwood, align: 'center' });
        break;
      }
      default:
        break;
    }
  }

  #drawPlayer(r, cam) {
    const x = cam.px * TILE + 16;
    const y = cam.py * TILE + 16;
    // The party reads as one token: a small cross-section, same grammar as battle.
    r.circle(x, y, 11, P.bark);
    r.circle(x, y, 8, P.wood, { stroke: true, lw: 1.5 });
    r.circle(x, y, 4, P.woodLit, { stroke: true, lw: 1 });
    r.circle(x, y, 11, P.sunwood, { stroke: true, lw: 2 });
    const [dx, dy] = DIRS[this.facing];
    r.line(x + dx * 8, y + dy * 8, x + dx * 15, y + dy * 15, P.sunwood, 2.5);
  }

  #drawHud(r) {
    if (this.banner > 0) {
      const a = Math.min(1, this.banner / 0.6);
      r.save();
      r.alpha(a);
      const w = Math.max(r.measure(this.map.name, 18, 700),
        r.measure(this.map.subtitle ?? '', 11)) + 48;
      r.panel(r.W / 2 - w / 2, 26, w, 62, { accent: P.sunwood });
      r.text(this.map.name, r.W / 2, 54, { size: 18, color: P.pale, align: 'center', weight: 700 });
      if (this.map.subtitle) {
        r.text(this.map.subtitle, r.W / 2, 74, { size: 11, color: P.paleDim, align: 'center' });
      }
      r.restore();
    }
    r.text('arrows move   enter interact', 16, r.H - 14, { size: 11, color: P.wood });
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
