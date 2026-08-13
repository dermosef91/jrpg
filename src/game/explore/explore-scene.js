import { Scene } from '../../engine/scene.js';
import { P, mix, alpha } from '../../engine/palette.js';
import { makeRng } from '../../engine/rng.js';
import { buildMap, NPC_LINES } from './maps.js';
import { TS, toScreen, drawTile, drawWall, drawStepEdge, groundShadow, buildWalls } from './grid.js';
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
    // Seeded so the rest of the line is standing behind the leader the instant a
    // map loads, rather than popping into existence after nine steps of walking.
    this.trail = [];
    this.#seedTrail(start);
    this.motes = Array.from({ length: 26 }, () => ({
      x: Math.random() * 480, y: Math.random() * 270,
      vy: -(2 + Math.random() * 6), vx: (Math.random() - 0.5) * 3,
    }));
  }

  /** Lay a trail behind the spawn so the rest of the line is already strung out
   *  when a map loads, instead of standing inside the leader for nine steps. */
  #seedTrail(start) {
    let x = start.x;
    let y = start.y;
    for (let i = 0; i < 24; i++) {
      // Back up along whichever neighbour is walkable, preferring straight back.
      const back = [[0, -1], [-1, 0], [1, 0], [0, 1]]
        .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
        .find((c) => this.map.walkable(c.x, c.y)
          && !this.trail.some((t) => t.x === c.x && t.y === c.y));
      if (i % 2 === 0 && back) { x = back.x; y = back.y; }
      this.trail.push({ x, y, facing: 'down' });
    }
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
    return { ...toScreen(gx, gy), gx, gy };
  }

  draw(r) {
    r.begin(P.void);
    const p = this.#playerScreen();
    const cam = this.#camera(p, r);
    this.cam = cam;

    r.dither(0, 0, r.W, r.H, P.black, 0.5);
    if (!this.map.dark) {
      const plaza = toScreen(9, 11);
      r.wash(plaza.x - cam.x, plaza.y - cam.y, 150, 110, P.emberDeep, 0.30);
    }

    r.save();
    r.translate(-cam.x, -cam.y);
    this.#drawWorld(r, p, cam);
    r.restore();

    if (this.map.dark) this.#drawDarkness(r, p, cam);
    for (const m of this.motes) r.px(Math.round(m.x), Math.round(m.y), P.emberDeep);
    drawHangingRoots(r, cam.x, cam.y, this.t);

    this.#drawHud(r);
  }

  /** Always centred on the party. Clamping to the map edge is the usual thing
   *  to do, but these galleries are lit islands in a black gallery -- the void
   *  past the edge is the setting, not an error -- and clamping strands the
   *  party at the top of the frame the moment they stand on the first row. */
  #camera(p, r) {
    return { x: Math.round(p.x - r.W / 2), y: Math.round(p.y - r.H / 2) };
  }

  #walls() {
    this.#wallCache ??= buildWalls(this.map);
    return this.#wallCache;
  }

  /** Only the part of the map the camera can actually see. At 24px a tile the
   *  full map is a few hundred squares and most of them are off screen. */
  #visible(cam, r, pad = 2) {
    return {
      x0: Math.max(0, Math.floor(cam.x / TS) - pad),
      x1: Math.min(this.map.w - 1, Math.floor((cam.x + r.W) / TS) + pad),
      y0: Math.max(0, Math.floor(cam.y / TS) - pad),
      y1: Math.min(this.map.h - 1, Math.floor((cam.y + r.H) / TS) + pad),
    };
  }

  #drawWorld(r, p, cam) {
    const { map } = this;
    const view = this.#visible(cam, r);

    // --- the floor, and the lips between tiles at different heights ---
    for (let y = view.y0; y <= view.y1; y++) {
      for (let x = view.x0; x <= view.x1; x++) {
        const cell = map.cells[y][x];
        if (!cell.walk) continue;
        const s = toScreen(x, y);
        const dim = this.#lampDim(cell, p);
        if (dim >= 1) continue;
        drawTile(r, s.x, s.y, { top: cell.top, dead: cell.dead },
          { inlay: cell.inlay, dim, seed: (x * 5 + y * 3) % 16 });
        if (cell.bridge) this.#bridgePlanks(r, s.x, s.y);
        for (const [side, dx, dy] of [['north', 0, -1], ['west', -1, 0], ['east', 1, 0]]) {
          const n = map.at(x + dx, y + dy);
          if (n?.walk && n.z > cell.z) drawStepEdge(r, s.x, s.y, side, n.z - cell.z, dim);
        }
      }
    }

    if (!map.dark) {
      const centre = toScreen(9, 11);
      drawPlazaMosaic(r, centre.x, centre.y, this.t);
    }

    // --- everything with height, painted top of the screen downward so that
    // what is nearer the camera covers what is behind it ---
    const standing = [];
    for (const wall of this.#walls()) {
      if (wall.x < view.x0 || wall.x > view.x1 || wall.y < view.y0 || wall.y > view.y1) continue;
      standing.push({ depth: wall.y * TS, kind: 'wall', wall });
    }
    for (const prop of map.props) {
      if (prop.kind === 'trigger') continue;
      standing.push({ depth: prop.y * TS + TS / 2 + 1, kind: 'prop', prop });
    }
    standing.push({ depth: p.y, kind: 'player' });

    // The rest of the line walks a few steps back along the leader's trail.
    // Two squares apart, not three: square tiles are twice the screen height of
    // the old isometric ones, and at three the back of the line walks out of the
    // lamp and looks like a party member who has gone missing.
    this.game.activeParty.slice(1).forEach((who, i) => {
      const at = this.trail[(i + 1) * 2];
      if (!at) return;
      const s = toScreen(at.x, at.y);
      standing.push({ depth: s.y, kind: 'follower', who, at, i });
    });
    standing.sort((a, b) => a.depth - b.depth);

    for (const item of standing) {
      if (item.kind === 'wall') {
        const s = toScreen(item.wall.x, item.wall.y);
        drawWall(r, s.x, s.y, {
          dim: this.#lampDim(item.wall, p), face: item.wall.face,
          seed: item.wall.seed, cap: item.wall.cap,
        });
        continue;
      }
      if (item.kind === 'player') {
        groundShadow(r, p.x, p.y + 5, 7);
        drawFigure(r, this.game.activeParty[0].figure, p.x, p.y + 8, {
          facing: this.facing,
          pose: 'idle',
          frame: this.moving ? Math.floor(this.t * 8) % 2 : Math.floor(this.t * 1.6) % 2,
        });
        continue;
      }
      if (item.kind === 'follower') {
        const s = toScreen(item.at.x, item.at.y);
        groundShadow(r, s.x, s.y + 5, 6);
        drawFigure(r, item.who.figure, s.x, s.y + 8, {
          facing: item.at.facing ?? 'down',
          frame: this.moving ? Math.floor(this.t * 8 + item.i) % 2
            : Math.floor(this.t * 1.4 + item.i) % 2,
        });
        continue;
      }
      const prop = item.prop;
      const s = toScreen(prop.x, prop.y);
      if (prop.kind === 'npc') {
        const spec = NPC_SPRITES[`${prop.x},${prop.y}`] ?? NPC_SPRITES.default;
        groundShadow(r, s.x, s.y + 5, 7);
        drawFigure(r, spec, s.x, s.y + 8, {
          facing: 'down', frame: Math.floor(this.t * 1.2 + prop.x) % 2,
        });
      } else {
        // The mask is the only thing on this stair worth walking toward, and it
        // is a pale object on pale stone in the dark. Mark it.
        if (prop.kind === 'mask' && this.game.objective === 'THE MASK') {
          const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.4);
          r.ellipse(s.x, s.y + 4, 12 + pulse * 2, 7 + pulse,
            alpha(P.emberDeep, 0.20 + pulse * 0.12));
          r.glow(s.x, s.y, 8, P.ember, 0.30 + pulse * 0.16);
        }
        drawProp(r, prop.kind, s.x, s.y + 9, {
          t: this.t, open: this.opened.has(`${prop.x},${prop.y}`),
        });
      }
    }
  }

  /** How far a tile has fallen out of Zahra's lamp, 0 lit to 1 gone. Measured
   *  in grid squares, which top down are square on screen too. */
  #lampDim(cell, p) {
    if (!this.map.dark) return 0;
    const d = Math.hypot(cell.x - p.gx, cell.y - p.gy);
    // Finishes a little inside the mask, so the stone is already black by the
    // time the mask closes and the pool has no visible circular edge.
    return Math.max(0, Math.min(1, (d - 1.5) / 2.5));
  }

  #wallCache = null;

  #bridgePlanks(r, sx, sy) {
    for (let i = -2; i <= 2; i++) {
      r.hline(sx - TS / 2 + 2, Math.round(sy + i * 5), TS - 4, alpha(P.void, 0.4));
    }
  }

  /** On the Quiet Stair, Zahra's lamp is the only light there is. A cached
   *  radial dither is punched into a black screen and follows her. */
  #drawDarkness(r, p, cam) {
    const D = 300;
    // The stone has already shaded itself out by grid distance. All this mask
    // has to do is take the props, the party line and the hanging roots with it,
    // and close the last of it to black before the frame edge does.
    const mask = r.cached('darkmask', D, D, (rr) => {
      const c = D / 2;
      for (let y = 0; y < D; y++) {
        for (let x = 0; x < D; x++) {
          const d = Math.hypot(x - c, y - c) / c;
          if (d < 0.44) continue;
          rr.dither(x, y, 1, 1, P.void, Math.min(1, (d - 0.44) / 0.34));
        }
      }
    });
    const mx = Math.round(p.x - cam.x - D / 2);
    const my = Math.round(p.y - cam.y - D / 2);
    r.blit(mask, mx, my);
    // Outside the lamp there is nothing to see, so there is nothing drawn.
    r.rect(0, 0, r.W, Math.max(0, my), P.void);
    r.rect(0, my + D, r.W, r.H - (my + D), P.void);
    r.rect(0, my, Math.max(0, mx), D, P.void);
    r.rect(mx + D, my, r.W - (mx + D), D, P.void);
    // The flame itself. Kept small and dense: a wide, weak glow dithers down to
    // a visible lattice of single pixels, which reads as a bug and not as light.
    const flicker = 1 + Math.sin(this.t * 3.1) * 0.06 + Math.sin(this.t * 8.3) * 0.03;
    r.glow(p.x - cam.x + 1, p.y - cam.y - 4, Math.round(11 * flicker), P.ember, 0.55);
    r.glow(p.x - cam.x + 1, p.y - cam.y - 5, Math.round(4 * flicker), P.emberWhite, 0.9);
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
