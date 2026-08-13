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
  constructor({ spawn = null } = {}) {
    super();
    this.map = buildMap();
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
    this.motes = Array.from({ length: 26 }, () => ({
      x: Math.random() * 480, y: Math.random() * 270,
      vy: -(2 + Math.random() * 6), vx: (Math.random() - 0.5) * 3,
    }));
  }

  enter() {
    this.audio?.setMood('field');
    this.banner = 2.6;
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

  update(dt) {
    this.t += dt;
    this.banner = Math.max(0, this.banner - dt);
    for (const m of this.motes) {
      m.y += m.vy * dt;
      m.x += m.vx * dt;
      if (m.y < -2) { m.y = 272; m.x = Math.random() * 480; }
    }

    if (this.moving) {
      this.moveT = Math.max(0, this.moveT - dt);
      if (this.moveT === 0) this.#arrive();
      return;
    }

    if (this.input.pressed('menu')) { this.audio?.play('confirm'); this.game.openMenu(); return; }
    if (this.input.pressed('confirm')) { this.#interact(); return; }

    for (const [action, [dx, dy]] of Object.entries(DIRS)) {
      if (!this.input.held(action)) continue;
      this.facing = action;
      if (this.canEnter(this.px + dx, this.py + dy)) {
        this.fromX = this.px;
        this.fromY = this.py;
        this.px += dx;
        this.py += dy;
        this.moveT = MOVE_TIME;
      }
      return;
    }
  }

  #arrive() {
    this.audio?.play('step');
    this.steps += 1;
    const here = this.propAt(this.px, this.py);
    if (here?.kind === 'door') { this.#enterDoor(); return; }
    // Encounters only out on the open decks, never in the plaza itself.
    const cell = this.cell(this.px, this.py);
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
    if (target.kind === 'npc') {
      const entry = NPC_LINES[`${target.x},${target.y}`];
      if (!entry) return;
      this.audio?.play('confirm');
      this.game.scenes.push(new DialogueScene(
        entry.lines.map((text) => ({ speaker: entry.name, text })),
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
    this.game.scenes.push(new DialogueScene([{
      speaker: 'THE QUIET STAIR',
      text: 'The stair goes down past where the inlay still burns. Something is holding a note down there.',
    }], {
      onEnd: () => this.game.startBattle('warden'),
    }));
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
    const plaza = toScreen(9, 11, 0);
    r.glow(plaza.x - cam.x, plaza.y - cam.y, 96, P.emberDeep, 0.055);

    r.save();
    r.translate(-cam.x, -cam.y);
    this.#drawWorld(r, p);
    r.restore();

    for (const m of this.motes) r.px(Math.round(m.x), Math.round(m.y), P.emberDeep);
    drawHangingRoots(r, cam.x, cam.y, this.t);

    this.#drawHud(r);
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
    order.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z);

    for (const cell of order) {
      const s = toScreen(cell.x, cell.y, cell.z);
      const below = map.at(cell.x, cell.y + 1);
      const drop = !below || !below.walk || below.z < cell.z
        ? Math.max(4, (cell.z - (below?.z ?? -1)) * ZH)
        : 0;
      drawTile(r, s.x, s.y, { top: cell.top }, { inlay: cell.inlay, drop });
      if (cell.bridge) this.#bridgePlanks(r, s.x, s.y);
    }

    // the mosaic sits on the plaza, under everything that stands on it
    const centre = toScreen(9, 11.5, 0);
    drawPlazaMosaic(r, centre.x, centre.y, this.t);

    // then everything that stands up, sorted with the party token
    const standing = map.props.map((prop) => ({
      depth: prop.x + prop.y, kind: 'prop', prop,
    }));
    standing.push({ depth: p.gx + p.gy + 0.01, kind: 'player' });
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
      const prop = item.prop;
      const s = toScreen(prop.x, prop.y, prop.z);
      if (prop.kind === 'npc') {
        const spec = NPC_SPRITES[`${prop.x},${prop.y}`] ?? NPC_SPRITES.default;
        isoShadow(r, s.x, s.y + 2, 6);
        drawFigure(r, spec, s.x, s.y + 4, { frame: Math.floor(this.t * 1.2 + prop.x) % 2 });
      } else {
        drawProp(r, prop.kind, s.x, s.y + 4, {
          t: this.t, open: this.opened.has(`${prop.x},${prop.y}`),
        });
      }
    }
  }

  #bridgePlanks(r, sx, sy) {
    for (let i = -1; i <= 1; i++) {
      r.line(sx - TW / 2 + 4, sy + i * 3, sx + TW / 2 - 4, sy + i * 3, alpha(P.void, 0.4));
    }
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
