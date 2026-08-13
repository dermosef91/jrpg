import { Scene } from '../../engine/scene.js';
import { P, mix, alpha } from '../../engine/palette.js';
import { makeRng } from '../../engine/rng.js';
import { buildMap, NPC_LINES } from './maps.js';
import { TW, TH, ZH, toScreen, drawTile, isoShadow } from './iso.js';
import { drawProp, drawPlazaMosaic, drawHangingRoots } from '../art/props.js';
import { drawFigure } from '../art/figures.js';
import { drawPortrait } from '../art/portrait.js';
import { panel, cornerTicks } from '../ui/frame.js';
import { DialogueScene } from '../ui/dialogue.js';

const MOVE_TIME = 0.16;
// Screen directions mapped into the isometric grid, so "up" walks away from the
// camera rather than along an axis nobody can see.
const DIRS = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};

export class ExploreScene extends Scene {
  constructor({ mapId = 'rootplaza', spawn = null } = {}) {
    super();
    this.mapId = mapId;
    this.map = buildMap(mapId);
    const start = spawn ?? this.map.spawn;
    this.px = start.x;
    this.py = start.y;
    this.fromX = start.x;
    this.fromY = start.y;
    this.facing = 'down';
    this.moveT = 0;
    this.t = 0;
    this.steps = 0;
    this.banner = 2.6;
    this.rng = makeRng(0x1057);
    this.opened = new Set();
    this.cam = { x: 0, y: 0 };
    this.scriptPath = null;
    this.trail = [];
    this.motes = Array.from({ length: 26 }, () => ({
      x: Math.random() * 480, y: Math.random() * 270,
      vy: -(2 + Math.random() * 6), vx: (Math.random() - 0.5) * 3,
    }));
  }

  enter() {
    this.audio?.setMood(this.map.ambient);
    this.banner = 2.6;
  }

  /** Drive the party along a path. Used by cutscenes. */
  scriptWalk(path) {
    this.scriptPath = path.map(([x, y]) => ({ x, y }));
  }

  get scriptedWalking() { return !!this.scriptPath?.length || this.moving; }

  /** Tick while a cutscene owns the input. Movement and animation only. */
  updateScripted(dt) {
    this.t += dt;
    this.banner = Math.max(0, this.banner - dt);
    this.#ambient(dt);
    if (this.moving) {
      this.moveT = Math.max(0, this.moveT - dt);
      if (this.moveT === 0) this.#land();
      return;
    }
    if (!this.scriptPath?.length) return;
    const next = this.scriptPath[0];
    const dx = Math.sign(next.x - this.px);
    const dy = Math.sign(next.y - this.py);
    if (dx === 0 && dy === 0) { this.scriptPath.shift(); return; }
    // Step one axis at a time so the walk reads as walking, not sliding.
    const step = dx !== 0 ? [dx, 0] : [0, dy];
    this.facing = dx !== 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (this.canEnter(this.px + step[0], this.py + step[1])) this.#begin(step[0], step[1]);
    else this.scriptPath.shift();
  }

  #begin(dx, dy) {
    this.fromX = this.px;
    this.fromY = this.py;
    this.px += dx;
    this.py += dy;
    this.moveT = MOVE_TIME;
  }

  /** Record where the leader has been, so the rest of the line can follow it. */
  #land() {
    this.trail.unshift({ x: this.px, y: this.py, facing: this.facing });
    if (this.trail.length > 24) this.trail.pop();
    this.#arrive();
  }

  get moving() { return this.moveT > 0; }
  cell(x, y) { return this.map.at(x, y); }

  canEnter(x, y) {
    const from = this.cell(this.px, this.py);
    const to = this.cell(x, y);
    if (!to || !to.walk) return false;
    // One storey of climb, unless one side is a stair.
    const climb = Math.abs(to.z - from.z);
    if (climb === 0) return true;
    if (climb === 1 && (to.stair || from.stair)) return true;
    return climb <= 1;
  }

  propAt(x, y) { return this.map.props.find((p) => p.x === x && p.y === y) ?? null; }

  #ambient(dt) {
    for (const m of this.motes) {
      m.y += m.vy * dt;
      m.x += m.vx * dt;
      if (m.y < -2) { m.y = 272; m.x = Math.random() * 480; }
    }
  }

  update(dt) {
    this.t += dt;
    this.banner = Math.max(0, this.banner - dt);
    this.#ambient(dt);

    if (this.moving) {
      this.moveT = Math.max(0, this.moveT - dt);
      if (this.moveT === 0) this.#land();
      return;
    }

    if (this.input.pressed('menu')) { this.audio?.play('confirm'); this.game.openMenu(); return; }
    if (this.input.pressed('confirm')) { this.#interact(); return; }

    for (const [action, [dx, dy]] of Object.entries(DIRS)) {
      if (!this.input.held(action)) continue;
      this.facing = action;
      if (this.canEnter(this.px + dx, this.py + dy)) this.#begin(dx, dy);
      return;
    }
  }

  #arrive() {
    this.audio?.play('step');
    this.steps += 1;
    const here = this.propAt(this.px, this.py);
    if (here?.kind === 'trigger' && !this.game.firedTriggers.has(here.id)) {
      this.game.firedTriggers.add(here.id);
      if (this.game.fireTrigger(here.id)) return;
    }
    if (here?.kind === 'door') { this.#enterDoor(); return; }
    // Encounters only out on the open decks, never in the plaza itself.
    const cell = this.cell(this.px, this.py);
    if (this.game.encountersOff) return;
    if (cell && cell.ch === 's' && this.steps > 8 && this.rng.chance(0.055)) {
      this.steps = 0;
      this.audio?.play('crit');
      this.game.startBattle();
    }
  }

  #interact() {
    const [dx, dy] = DIRS[this.facing];
    const target = this.propAt(this.px + dx, this.py + dy) ?? this.propAt(this.px, this.py);
    if (!target) return;
    if (target.kind === 'chest') {
      const key = `${target.x},${target.y}`;
      if (this.opened.has(key)) {
        this.game.scenes.push(new DialogueScene([{ text: 'Emptied already. Somebody was here first, and it was you.' }]));
        return;
      }
      this.opened.add(key);
      this.audio?.play('open');
      const haul = { cinder: 3, sigil: 1 };
      this.game.awardSpoils({ shards: haul });
      this.game.scenes.push(new DialogueScene([{
        speaker: 'FOUND',
        text: 'Three cinder and a sigil, wrapped in ash-cloth and still warm.',
      }]));
      return;
    }
    if (target.kind === 'mask') {
      this.game.scenes.push(new DialogueScene([{
        speaker: 'THE MASK',
        text: 'Cracked clean through, face up, four days in the dark. The bell is beside it and the bell did not ring.',
      }]));
      return;
    }
    if (target.kind === 'npc') {
      const entry = NPC_LINES[`${this.mapId}:${target.x},${target.y}`];
      if (!entry) return;
      this.audio?.play('confirm');
      const reporting = this.game.flags.has('sawTheMask') && entry.after;
      const lines = reporting ? entry.after : entry.before;
      this.game.scenes.push(new DialogueScene(
        lines.map((text) => ({ speaker: entry.name, text })),
        {
          onEnd: () => {
            // Only the Gate Hand counts as having reported it. Telling the
            // shard factor is gossip, not a report.
            if (!reporting || !entry.report || this.game.flags.has('reported')) return;
            this.game.flags.add('reported');
            this.game.setObjective('GO BACK DOWN THE STAIR');
            this.audio?.play('open');
          },
        },
      ));
      return;
    }
    if (target.kind === 'lamp') {
      this.game.rest();
      this.audio?.play('revive');
      this.game.scenes.push(new DialogueScene([{
        speaker: 'THE LAMP',
        text: 'You sit a while in the light of a live shard. The line is whole again.',
      }]));
      return;
    }
    if (target.kind === 'door') this.#enterDoor();
  }

  #enterDoor() {
    this.audio?.play('open');
    this.game.descend();
  }

  // --- draw ----------------------------------------------------------------

  #playerScreen() {
    const ease = this.moving ? 1 - this.moveT / MOVE_TIME : 1;
    const gx = this.fromX + (this.px - this.fromX) * ease;
    const gy = this.fromY + (this.py - this.fromY) * ease;
    const cell = this.cell(this.px, this.py) ?? { z: 0 };
    const fromCell = this.cell(this.fromX, this.fromY) ?? cell;
    const gz = fromCell.z + (cell.z - fromCell.z) * ease;
    return { ...toScreen(gx, gy, gz), gx, gy, gz };
  }

  draw(r) {
    r.begin(P.void);
    const p = this.#playerScreen();
    const cam = { x: Math.round(p.x - r.W / 2), y: Math.round(p.y - r.H / 2 - 10) };
    this.cam = cam;

    // the black of the gallery, with a faint warm wash where the plaza burns
    r.dither(0, 0, r.W, r.H, P.black, 0.5);
    if (!this.map.dark) {
      const plaza = toScreen(9, 11, 0);
      r.wash(plaza.x - cam.x, plaza.y - cam.y, 150, 78, P.emberDeep, 0.30);
    }

    r.save();
    r.translate(-cam.x, -cam.y);
    this.#drawWorld(r, p);
    r.restore();

    if (this.map.dark) this.#drawDarkness(r, p, cam);
    for (const m of this.motes) r.px(Math.round(m.x), Math.round(m.y), P.emberDeep);
    drawHangingRoots(r, cam.x, cam.y, this.t);

    this.#drawHud(r);
  }

  /** The rock a cut passage was cut through. The far side rises above head
   *  height; the near side is kept to a kerb, because a full block there would
   *  stand between the camera and the steps the player is walking down. */
  #walls() {
    if (this.#wallCache) return this.#wallCache;
    const { map } = this;
    const out = [];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.cells[y][x].walk) continue;
        const far = [[1, 0], [0, 1], [1, 1]]
          .map(([dx, dy]) => map.at(x + dx, y + dy))
          .filter((n) => n?.walk);
        const near = [[-1, 0], [0, -1], [-1, -1]]
          .map(([dx, dy]) => map.at(x + dx, y + dy))
          .filter((n) => n?.walk);
        const touching = far.length ? far : near;
        if (!touching.length) continue;
        const floor = Math.max(...touching.map((n) => n.z));
        out.push({
          x, y, wall: true, tall: far.length > 0,
          z: far.length ? floor + 2 : floor,
          seed: (x * 7 + y * 13) % 5,
        });
      }
    }
    this.#wallCache = out;
    return out;
  }

  #drawWorld(r, p) {
    const { map } = this;
    // Ground first, painted back to front so the isometric stack resolves.
    const order = [];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const cell = map.cells[y][x];
        if (!cell.walk) continue;
        order.push(cell);
      }
    }
    if (map.dark) order.push(...this.#walls());
    order.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z);

    for (const cell of order) {
      if (cell.wall) {
        const dim = this.#lampDim(cell, p);
        if (dim >= 0.98) continue;
        const s = toScreen(cell.x, cell.y, cell.z - (cell.seed % 2) * 0.2);
        drawTile(r, s.x, s.y, { top: cell.tall ? P.stoneDark : P.stoneShadow },
          { drop: cell.tall ? 30 + cell.seed * 3 : 9, dim, lit: cell.tall ? 0.5 : 0.3 });
        continue;
      }
      const s = toScreen(cell.x, cell.y, cell.z);
      const below = map.at(cell.x, cell.y + 1);
      const drop = !below || !below.walk || below.z < cell.z
        ? Math.max(4, (cell.z - (below?.z ?? -1)) * ZH)
        : 0;
      drawTile(r, s.x, s.y, { top: cell.top, dead: cell.dead },
        { inlay: cell.inlay, drop, dim: this.#lampDim(cell, p) });
      if (cell.bridge) this.#bridgePlanks(r, s.x, s.y);
    }

    // the mosaic sits on the plaza, under everything that stands on it
    if (!map.dark) {
      const centre = toScreen(9, 11.5, 0);
      drawPlazaMosaic(r, centre.x, centre.y, this.t);
    }

    // then everything that stands up, sorted with the party token
    const standing = map.props
      .filter((prop) => prop.kind !== 'trigger')
      .map((prop) => ({ depth: prop.x + prop.y, kind: 'prop', prop }));
    standing.push({ depth: p.gx + p.gy + 0.01, kind: 'player' });

    // The rest of the line walks a few steps back along the leader's trail.
    const line = this.game.activeParty.slice(1);
    line.forEach((who, i) => {
      const at = this.trail[(i + 1) * 3];
      if (!at) return;
      standing.push({ depth: at.x + at.y, kind: 'follower', who, at, i });
    });
    standing.sort((a, b) => a.depth - b.depth);

    for (const item of standing) {
      if (item.kind === 'player') {
        isoShadow(r, p.x, p.y + 2, 6);
        drawFigure(r, this.game.activeParty[0].figure, p.x, p.y + 4, {
          pose: this.moving ? 'attack' : 'idle',
          frame: this.moving ? Math.floor(this.t * 8) % 2 : Math.floor(this.t * 1.6) % 2,
        });
        continue;
      }
      if (item.kind === 'follower') {
        const s = toScreen(item.at.x, item.at.y, this.cell(item.at.x, item.at.y)?.z ?? 0);
        isoShadow(r, s.x, s.y + 2, 5);
        drawFigure(r, item.who.figure, s.x, s.y + 4, {
          frame: this.moving ? Math.floor(this.t * 8 + item.i) % 2 : Math.floor(this.t * 1.4 + item.i) % 2,
        });
        continue;
      }
      const prop = item.prop;
      const s = toScreen(prop.x, prop.y, prop.z);
      if (prop.kind === 'npc') {
        const spec = NPC_SPRITES[`${prop.x},${prop.y}`] ?? NPC_SPRITES.default;
        isoShadow(r, s.x, s.y + 2, 6);
        drawFigure(r, spec, s.x, s.y + 4, { frame: Math.floor(this.t * 1.2 + prop.x) % 2 });
      } else {
        // The mask is the only thing on this stair worth walking toward, and
        // it is a pale object on pale stone in the dark. Mark it.
        if (prop.kind === 'mask' && this.game.objective === 'THE MASK') {
          const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.4);
          r.ellipse(s.x, s.y + 3, 12 + pulse * 2, 6 + pulse,
            alpha(P.emberDeep, 0.20 + pulse * 0.12));
          r.glow(s.x, s.y - 2, 8, P.ember, 0.30 + pulse * 0.16);
        }
        drawProp(r, prop.kind, s.x, s.y + 4, {
          t: this.t, open: this.opened.has(`${prop.x},${prop.y}`),
        });
      }
    }
  }

  /** How far a tile has fallen out of Zahra's lamp, 0 lit to 1 gone. Grid
   *  distance is the right measure here: both axes project to the same screen
   *  length, so a circle in grid space is a circle on screen. */
  #lampDim(cell, p) {
    if (!this.map.dark) return 0;
    const d = Math.hypot(cell.x - p.gx, cell.y - p.gy);
    return Math.max(0, Math.min(1, (d - 1.5) / 3.6));
  }

  #wallCache = null;

  #bridgePlanks(r, sx, sy) {
    for (let i = -1; i <= 1; i++) {
      r.line(sx - TW / 2 + 4, sy + i * 3, sx + TW / 2 - 4, sy + i * 3, alpha(P.void, 0.4));
    }
  }

  /** On the Quiet Stair, Zahra's lamp is the only light there is. A cached
   *  radial dither is punched into a black screen and follows her. */
  #drawDarkness(r, p, cam) {
    const W = 236;
    const H = 156;
    // The stone has already shaded itself out by grid distance. All this mask
    // has to do is take the props, the party line and the hanging roots with it,
    // and close the last of it to black before the frame edge does.
    const mask = r.cached('darkmask', W, H, (rr) => {
      const cx = W / 2;
      const cy = H / 2;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.hypot((x - cx) / cx, (y - cy) / cy);
          if (d < 0.5) continue;
          rr.dither(x, y, 1, 1, P.void, Math.min(1, (d - 0.5) / 0.34));
        }
      }
    });
    const mx = Math.round(p.x - cam.x - W / 2);
    const my = Math.round(p.y - cam.y - H / 2 - 8);
    r.blit(mask, mx, my);
    // Outside the lamp there is nothing to see, so there is nothing drawn.
    r.rect(0, 0, r.W, Math.max(0, my), P.void);
    r.rect(0, my + H, r.W, r.H - (my + H), P.void);
    r.rect(0, my, Math.max(0, mx), H, P.void);
    r.rect(mx + W, my, r.W - (mx + W), H, P.void);
    // The flame itself. Kept small and dense: a wide, weak glow dithers down to
    // a visible lattice of single pixels, which reads as a bug and not as light.
    const flicker = 1 + Math.sin(this.t * 3.1) * 0.06 + Math.sin(this.t * 8.3) * 0.03;
    r.glow(p.x - cam.x + 1, p.y - cam.y - 9, Math.round(11 * flicker), P.ember, 0.55);
    r.glow(p.x - cam.x + 1, p.y - cam.y - 10, Math.round(4 * flicker), P.emberWhite, 0.9);
  }

  #drawHud(r) {
    // party pips, top left, as in the concept art
    const lead = this.game.activeParty[0];
    panel(r, 4, 4, 92, 26, { fill: alpha(P.void, 0.9), inner: false });
    drawPortrait(r, lead.figure, 7, 8, { frameColor: P.stoneDark });
    const pips = 7;
    const ratio = lead.hp / lead.maxHp;
    for (let i = 0; i < pips; i++) {
      const on = i < Math.ceil(ratio * pips);
      const px = 28 + i * 9;
      r.circle(px, 13, 3, on ? P.ember : P.root);
      r.circle(px, 13, 3, on ? P.emberBright : P.stoneShadow, { fill: false });
    }
    r.text(lead.name, 28, 20, { color: P.stoneMid });
    r.text(`EP ${lead.ep}`, 66, 20, { color: P.emberDim });

    if (this.game.objective) {
      const label = this.game.objective;
      const w = r.measure(label, { tracking: 1 }) + 16;
      r.rect(4, 34, w, 12, alpha(P.void, 0.9));
      r.frame(4, 34, w, 12, alpha(P.ember, 0.6), 1);
      r.rect(6, 38, 3, 3, P.emberHot);
      r.text(label, 13, 37, { color: P.emberLit, tracking: 1 });
    }

    if (this.map.dark) return;

    // minimap, bottom right
    const mw = 62;
    const mh = 50;
    const mx = r.W - mw - 5;
    const my = r.H - mh - 5;
    panel(r, mx, my, mw, mh, { fill: alpha(P.void, 0.9), inner: false });
    const sx = (mw - 8) / this.map.w;
    const sy = (mh - 8) / this.map.h;
    for (let y = 0; y < this.map.h; y++) {
      for (let x = 0; x < this.map.w; x++) {
        const cell = this.map.cells[y][x];
        if (!cell.walk) continue;
        r.rect(mx + 4 + x * sx, my + 4 + y * sy, Math.ceil(sx), Math.ceil(sy),
          cell.ch === 'p' ? P.stoneDark : P.rootLit);
      }
    }
    for (const prop of this.map.props) {
      if (prop.kind === 'rail') continue;
      r.px(mx + 4 + prop.x * sx, my + 4 + prop.y * sy, P.emberDeep);
    }
    if (Math.sin(this.t * 6) > -0.2) {
      r.rect(mx + 4 + this.px * sx, my + 4 + this.py * sy, 2, 2, P.emberWhite);
    }

    if (this.banner > 0) {
      const a = Math.min(1, this.banner / 0.6);
      r.save();
      r.alpha(a);
      const label = this.map.name;
      const w = Math.max(r.measure(label, { tracking: 3 }), r.measure(this.map.subtitle)) + 32;
      const bx = (r.W - w) >> 1;
      panel(r, bx, 40, w, 26, { fill: alpha(P.void, 0.92) });
      r.text(label, r.W / 2, 46, { color: P.boneWhite, align: 'center', tracking: 3 });
      r.text(this.map.subtitle, r.W / 2, 56, { color: P.emberDim, align: 'center' });
      r.restore();
    }

    r.text('C  MENU', 6, r.H - 12, { color: P.stoneShadow });
  }
}

const NPC_SPRITES = {
  '8,7': {
    id: 'gatehand', skin: 2, cloth: '#9d8f79', clothDark: '#3f382e', trim: '#221715',
    hair: 'wrap', hairColor: '#171010', weapon: 'staff', accent: P.emberLit,
  },
  '10,7': {
    id: 'factor', skin: 5, cloth: '#bdae94', clothDark: '#5c5346', trim: '#2e1f1a',
    hair: 'afro', hairColor: '#0f0a09', weapon: null, accent: P.emberBright,
  },
  default: {
    id: 'holder', skin: 3, cloth: '#7d7160', clothDark: '#3f382e', trim: '#221715',
    hair: 'crop', hairColor: '#0f0a09', weapon: null, accent: P.emberDim,
  },
};
