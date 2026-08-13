import { Scene } from '../../engine/scene.js';
import { P, mix, alpha, AFFINITY } from '../../engine/palette.js';
import { Battle, isAlive, stat } from './battle.js';
import { drawArena, FLOOR_Y } from '../art/arena.js';
import { drawFigure, figureShadow } from '../art/figures.js';
import { drawFoe, foeShadow, FOE_ART } from '../art/foes.js';
import { drawPortrait } from '../art/portrait.js';
import { panel, meter, cursor, glyph, cornerTicks } from '../ui/frame.js';
import { getRite } from '../data/rites.js';
import { getItem } from '../data/items.js';

const UI_Y = 194;
const CMD = [
  { id: 'attack', label: 'ATTACK' },
  { id: 'rite', label: 'RITE' },
  { id: 'item', label: 'ITEM' },
  { id: 'guard', label: 'GUARD' },
];

const FOE_SLOTS = [
  { x: 66, y: 182 }, { x: 122, y: 170 }, { x: 176, y: 186 }, { x: 34, y: 168 },
];
const HERO_SLOTS = [
  { x: 306, y: 186 }, { x: 354, y: 174 }, { x: 404, y: 188 },
];

const RES_COLOR = {
  resonant: P.emberWhite, flat: P.stoneLit, discordant: P.stoneShadow,
};

export class BattleScene extends Scene {
  constructor({ party, foes, title, seed = 7, onEnd = null, tutorial = null, backdrop = 'low' }) {
    super();
    this.battle = new Battle({ party, foes, title, seed });
    this.onEnd = onEnd;
    this.tutorial = tutorial;
    this.backdrop = backdrop;
    this.teachCard = null;
    this.taught = false;
    this.t = 0;
    this.state = 'command';
    this.wait = 0;
    this.hitstop = 0;
    this.cmd = 0;
    this.sub = 0;
    this.targetIndex = 0;
    this.pending = null;
    this.log = [];
    this.popups = [];
    this.flash = 0;
    this.view = new Map();
    for (const u of this.battle.all) {
      this.view.set(u.uid, { hp: u.hp, ep: u.ep, hurt: 0, offset: 0, pose: 'idle', shake: 0 });
    }
  }

  enter() {
    this.audio?.setMood('battle');
    this.#say(this.battle.title);
    this.#syncTurn();
  }

  exit() { this.audio?.setMood(null); }

  get actor() { return this.battle.current; }
  v(u) { return this.view.get(u.uid); }

  #say(text, color = P.stoneLit) {
    this.log.push({ text, color, age: 0 });
    if (this.log.length > 3) this.log.shift();
  }

  #syncTurn() {
    if (this.battle.over) { this.state = 'over'; this.wait = 0.5; return; }
    this.cmd = 0;
    this.sub = 0;
    this.targetIndex = 0;
    if (this.actor.side === 'party') {
      this.state = 'command';
    } else {
      this.state = 'foeturn';
      this.wait = 0.45;
    }
  }

  slotFor(unit) {
    const fi = this.battle.foes.indexOf(unit);
    if (fi >= 0) return FOE_SLOTS[fi % FOE_SLOTS.length];
    const pi = this.battle.party.indexOf(unit);
    return HERO_SLOTS[pi % HERO_SLOTS.length];
  }

  // --- update --------------------------------------------------------------

  update(dt) {
    this.t += dt;
    for (const u of this.battle.all) {
      const v = this.v(u);
      v.hp += (u.hp - v.hp) * Math.min(1, dt * 7);
      v.ep += (u.ep - v.ep) * Math.min(1, dt * 7);
      v.hurt = Math.max(0, v.hurt - dt * 3.5);
      v.shake = Math.max(0, v.shake - dt * 4);
      v.offset *= Math.max(0, 1 - dt * 8);
      if (v.pose === 'attack' && v.offset < 0.6) v.pose = 'idle';
      if (!isAlive(u)) v.pose = 'down';
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.age += dt;
      p.y -= dt * 20;
      if (p.age > p.life) this.popups.splice(i, 1);
    }
    for (const l of this.log) l.age += dt;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.game.renderer.shakeX *= 0.85;
    this.game.renderer.shakeY *= 0.85;

    // A teaching card holds the whole battle until it is dismissed.
    if (this.teachCard) {
      if (this.input.pressed('confirm') || this.input.pressed('cancel')) {
        this.audio?.play('confirm');
        this.teachCard = null;
      }
      return;
    }
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    if (this.wait > 0) { this.wait -= dt; return; }

    switch (this.state) {
      case 'command': this.#updateCommand(dt); break;
      case 'rite': this.#updateRite(dt); break;
      case 'item': this.#updateItem(dt); break;
      case 'target': this.#updateTarget(dt); break;
      case 'resolve': this.#advance(); break;
      case 'foeturn': this.#foeTurn(); break;
      case 'over': this.#updateOver(); break;
    }
  }

  #tick() { this.audio?.play('cursor'); }

  #updateCommand(dt) {
    const dir = this.input.dir(dt);
    if (dir === 'up') { this.cmd = (this.cmd + CMD.length - 1) % CMD.length; this.#tick(); }
    if (dir === 'down') { this.cmd = (this.cmd + 1) % CMD.length; this.#tick(); }
    if (!this.input.pressed('confirm')) return;

    const id = CMD[this.cmd].id;
    this.audio?.play('confirm');
    if (id === 'guard') { this.#commit(() => this.battle.guard(this.actor)); return; }
    if (id === 'attack') { this.pending = { kind: 'attack' }; this.#toTarget('foe'); return; }
    if (id === 'rite') {
      if (!this.actor.rites?.length) { this.audio?.play('deny'); return; }
      this.sub = 0;
      this.state = 'rite';
      return;
    }
    if (id === 'item') {
      if (!this.game.inventory.length) { this.audio?.play('deny'); return; }
      this.sub = 0;
      this.state = 'item';
    }
  }

  #updateRite(dt) {
    const list = this.actor.rites;
    const dir = this.input.dir(dt);
    if (dir === 'up') { this.sub = (this.sub + list.length - 1) % list.length; this.#tick(); }
    if (dir === 'down') { this.sub = (this.sub + 1) % list.length; this.#tick(); }
    if (this.input.pressed('cancel')) { this.audio?.play('cancel'); this.state = 'command'; return; }
    if (!this.input.pressed('confirm')) return;
    const rite = getRite(list[this.sub]);
    if (this.actor.ep < rite.ep) { this.audio?.play('deny'); this.#say('NOT ENOUGH EMBER', P.wound); return; }
    this.audio?.play('confirm');
    this.pending = { kind: 'rite', riteId: rite.id };
    if (rite.target === 'allFoes' || rite.target === 'allAllies' || rite.target === 'self') {
      this.#commit(() => this.battle.useRite(this.actor, rite.id, this.actor));
    } else {
      this.#toTarget(rite.target);
    }
  }

  #updateItem(dt) {
    const list = this.game.inventory;
    const dir = this.input.dir(dt);
    if (dir === 'up') { this.sub = (this.sub + list.length - 1) % list.length; this.#tick(); }
    if (dir === 'down') { this.sub = (this.sub + 1) % list.length; this.#tick(); }
    if (this.input.pressed('cancel')) { this.audio?.play('cancel'); this.state = 'command'; return; }
    if (!this.input.pressed('confirm')) return;
    const entry = list[this.sub];
    if (!entry || entry.count <= 0) { this.audio?.play('deny'); return; }
    this.audio?.play('confirm');
    const item = getItem(entry.id);
    this.pending = { kind: 'item', itemId: entry.id };
    if (item.target === 'allAllies') this.#commit(() => this.#spendItem(entry, this.actor));
    else this.#toTarget('ally');
  }

  #spendItem(entry, target) {
    entry.count -= 1;
    const events = this.battle.useItem(this.actor, entry.id, target);
    if (entry.count <= 0) {
      const i = this.game.inventory.indexOf(entry);
      if (i >= 0) this.game.inventory.splice(i, 1);
    }
    return events;
  }

  #toTarget(spec) {
    this.targets = this.battle.targetsFor(this.actor, spec)
      .filter((u) => isAlive(u) || this.pending.kind === 'item');
    if (!this.targets.length) { this.state = 'command'; return; }
    this.targetIndex = 0;
    this.state = 'target';
  }

  #updateTarget(dt) {
    const dir = this.input.dir(dt);
    if (dir === 'up' || dir === 'left') {
      this.targetIndex = (this.targetIndex + this.targets.length - 1) % this.targets.length;
      this.#tick();
    }
    if (dir === 'down' || dir === 'right') {
      this.targetIndex = (this.targetIndex + 1) % this.targets.length;
      this.#tick();
    }
    if (this.input.pressed('cancel')) {
      this.audio?.play('cancel');
      this.state = this.pending.kind === 'attack' ? 'command'
        : this.pending.kind === 'rite' ? 'rite' : 'item';
      return;
    }
    if (!this.input.pressed('confirm')) return;
    const target = this.targets[this.targetIndex];
    this.audio?.play('confirm');
    const p = this.pending;
    if (p.kind === 'attack') this.#commit(() => this.battle.attack(this.actor, target));
    else if (p.kind === 'rite') this.#commit(() => this.battle.useRite(this.actor, p.riteId, target));
    else {
      const entry = this.game.inventory[this.sub];
      this.#commit(() => this.#spendItem(entry, target));
    }
  }

  #commit(fn) {
    const actor = this.actor;
    const v = this.v(actor);
    v.pose = 'attack';
    v.offset = actor.side === 'party' ? -10 : 10;
    this.#drain(fn());
    this.state = 'resolve';
    this.wait = 0.55;
  }

  #foeTurn() {
    const v = this.v(this.actor);
    v.pose = 'attack';
    v.offset = 10;
    this.#drain(this.battle.takeFoeTurn());
    this.state = 'resolve';
    this.wait = 0.6;
  }

  #advance() {
    this.#drain(this.battle.advance());
    this.#syncTurn();
  }

  #updateOver() {
    if (!this.input.pressed('confirm') && !this.input.pressed('cancel')) return;
    const outcome = this.battle.outcome;
    if (outcome === 'victory') this.game.awardSpoils(this.battle.spoils());
    this.game.syncPartyFromBattle(this.battle.party);
    this.game.scenes.pop(outcome);
    this.onEnd?.(outcome);
  }

  // --- events to spectacle -------------------------------------------------

  #drain(events) {
    for (const e of events) {
      switch (e.type) {
        case 'act':
          this.#say(`${e.actor.name}  ${e.label}`, e.kind === 'rite' ? P.emberBright : P.stoneLit);
          this.audio?.play(e.kind === 'rite' ? 'rite' : e.kind === 'guard' ? 'guard' : 'swing');
          break;
        case 'damage': {
          const v = this.v(e.unit);
          v.hurt = 1;
          v.shake = 1;
          v.offset = e.unit.side === 'party' ? 6 : -6;
          const color = RES_COLOR[e.resonance] ?? P.stoneLit;
          this.#popup(e.unit, `${e.amount}`, color, e.resonance === 'resonant' ? 2 : 1);
          this.audio?.play(e.resonance === 'resonant' ? 'crit' : 'hit');
          // The first resonant hit of the tutorial is where the rule is taught,
          // right after the player has felt it rather than before.
          if (e.resonance === 'resonant' && this.tutorial?.card && !this.taught) {
            this.taught = true;
            this.teachCard = this.tutorial.card;
          }
          if (e.resonance === 'resonant') {
            this.#popup(e.unit, 'RESONANT', P.emberWhite, 0, 16);
            this.hitstop = 0.09;
            this.flash = 0.5;
            this.#shake(2.5);
          } else {
            this.hitstop = 0.035;
            this.#shake(1.1);
          }
          break;
        }
        case 'heal':
          if (e.amount > 0) {
            this.#popup(e.unit, `+${e.amount}`, P.stoneLit);
            this.audio?.play('heal');
          }
          break;
        case 'ep':
          if (e.amount > 0) this.#popup(e.unit, `+${e.amount} EP`, P.emberLit, 0, 12);
          break;
        case 'buff':
          this.#popup(e.unit, 'WARDED', P.emberBright, 0, 12);
          this.audio?.play('buff');
          break;
        case 'status':
          this.#popup(e.unit, 'ROOTED', P.barkHi, 0, 12);
          break;
        case 'guard':
          this.#popup(e.unit, 'GUARD', P.stoneLit, 0, 12);
          break;
        case 'revive':
          this.#popup(e.unit, 'UP', P.emberWhite);
          this.audio?.play('revive');
          break;
        case 'down':
          this.#say(`${e.unit.name} FALLS`, P.wound);
          this.audio?.play('down');
          this.#shake(3);
          this.hitstop = 0.1;
          break;
        case 'round':
          this.#say(`ROUND ${e.round}`, P.stoneShadow);
          break;
        case 'message':
          this.#say(e.text, P.wound);
          break;
        case 'outcome':
          this.audio?.play(e.outcome === 'victory' ? 'victory' : 'defeat');
          break;
        default: break;
      }
    }
  }

  #popup(unit, text, color, big = 0, life = 0) {
    const slot = this.slotFor(unit);
    this.popups.push({
      text, color, big, x: slot.x, y: slot.y - 30 - (life ? 10 : 0),
      age: 0, life: life ? 0.8 : 1.0,
    });
  }

  #shake(amount) {
    const r = this.game.renderer;
    r.shakeX = (Math.random() - 0.5) * amount;
    r.shakeY = (Math.random() - 0.5) * amount;
  }

  // --- draw ----------------------------------------------------------------

  draw(r) {
    r.begin(P.void);
    drawArena(r, { t: this.t, kind: this.backdrop });
    this.#drawUnits(r);
    if (this.flash > 0) r.dither(0, 0, r.W, FLOOR_Y + 60, P.emberWhite, this.flash * 0.35);
    this.#drawPopups(r);
    this.#drawTopBar(r);
    this.#drawCommandPanel(r);
    this.#drawPartyPanel(r);
    if (this.tutorial?.hint && !this.battle.over) this.#drawHint(r);
    if (this.state === 'over') this.#drawOutcome(r);
    if (this.teachCard) this.#drawTeach(r, this.teachCard);
  }

  #drawHint(r) {
    const label = this.tutorial.hint;
    const w = r.measure(label, { tracking: 1 }) + 16;
    const x = (r.W - w) >> 1;
    const blink = Math.sin(this.t * 4) > -0.4;
    // Kept up under the title rather than over the line: a prompt sitting on top
    // of the fight is the first thing a player learns to stop reading.
    const y = 22;
    r.rect(x, y, w, 12, alpha(P.void, 0.92));
    r.frame(x, y, w, 12, blink ? P.emberBright : P.emberDeep, 1);
    r.text(label, r.W / 2, y + 3, {
      color: blink ? P.boneWhite : P.emberLit, align: 'center', tracking: 1,
    });
  }

  #drawTeach(r, card) {
    // A flat wash, not a dithered one: a 4x4 Bayer scrim at two thirds coverage
    // turns every pixel behind the card into static.
    r.rect(0, 0, r.W, r.H, alpha(P.void, 0.84));
    const w = 300;
    const lines = r.wrap(card.body, w - 28);
    const h = 34 + lines.length * 10;
    const x = (r.W - w) >> 1;
    const y = (r.H - h) >> 1;
    panel(r, x, y, w, h, { fill: P.black, accent: P.emberBright });
    r.rect(x + 1, y + 1, w - 2, 12, alpha(P.ember, 0.2));
    r.text(card.title, x + w / 2, y + 4, { color: P.emberHot, align: 'center', tracking: 2 });
    lines.forEach((line, i) => {
      r.text(line, x + 14, y + 20 + i * 10, { color: P.stoneLit });
    });
    if (Math.sin(this.t * 5) > -0.3) {
      r.text('ENTER', x + w / 2, y + h - 10, { color: P.boneWhite, align: 'center', tracking: 2 });
    }
  }

  #drawUnits(r) {
    const drawables = [];
    for (const foe of this.battle.foes) {
      const slot = this.slotFor(foe);
      const v = this.v(foe);
      drawables.push({
        y: slot.y,
        draw: () => {
          const art = FOE_ART[foe.art] ?? FOE_ART.crawler;
          const jx = v.shake ? (Math.random() - 0.5) * v.shake * 3 : 0;
          foeShadow(r, slot.x, slot.y, Math.round(art.w * 0.32));
          drawFoe(r, foe.art, slot.x + v.offset + jx, slot.y, {
            frame: Math.floor(this.t * 2.2) % 2, hurt: v.hurt, dead: !isAlive(foe),
          });
          this.#targetMarker(r, foe, slot, art.h);
        },
      });
    }
    for (const hero of this.battle.party) {
      const slot = this.slotFor(hero);
      const v = this.v(hero);
      drawables.push({
        y: slot.y,
        draw: () => {
          const jx = v.shake ? (Math.random() - 0.5) * v.shake * 3 : 0;
          figureShadow(r, slot.x, slot.y, 8);
          drawFigure(r, hero.figure, slot.x + v.offset + jx, slot.y, {
            pose: v.pose, frame: Math.floor(this.t * 2.4) % 2, t: this.t,
          });
          if (hero === this.actor && this.state !== 'over') {
            const bob = Math.round(Math.sin(this.t * 5) * 1);
            cursor(r, slot.x - 3, slot.y - 46 + bob, P.emberBright, 4);
          }
          this.#targetMarker(r, hero, slot, 38);
        },
      });
    }
    drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
  }

  #targetMarker(r, unit, slot, height) {
    if (this.state !== 'target' || this.targets?.[this.targetIndex] !== unit) return;
    const pulse = Math.sin(this.t * 8) > 0 ? 1 : 0;
    const y = slot.y - height - 6 + pulse;
    r.line(slot.x - 5, y, slot.x, y + 4, P.emberWhite);
    r.line(slot.x + 5, y, slot.x, y + 4, P.emberWhite);
    r.frame(slot.x - 12, slot.y - height - 2, 24, height + 4, alpha(P.emberBright, 0.5), 1);
  }

  #drawPopups(r) {
    for (const p of this.popups) {
      const fade = 1 - (p.age / p.life) ** 2;
      if (fade <= 0) continue;
      r.save();
      r.alpha(fade);
      const label = p.big ? p.text : p.text;
      r.text(label, p.x, p.y, {
        color: p.color, align: 'center', shadow: P.void, tracking: p.big ? 1 : 0,
      });
      r.restore();
    }
  }

  #drawTopBar(r) {
    r.dither(0, 0, r.W, 14, P.void, 0.85);
    r.hline(0, 14, r.W, alpha(P.ember, 0.4));
    const maxTitle = Math.floor((r.W - 150) / 7);
    r.text(this.battle.title.slice(0, maxTitle), 6, 4, { color: P.emberLit, tracking: 1 });

    // turn queue, right-aligned
    const queue = this.battle.upcoming(6);
    let x = r.W - 6;
    for (let i = queue.length - 1; i >= 0; i--) {
      const u = queue[i];
      const w = 7;
      x -= w + 2;
      const active = i === 0;
      r.rect(x, 3, w, 8, active ? P.emberBright : u.side === 'party' ? P.stoneDark : P.rootLit);
      r.frame(x, 3, w, 8, active ? P.emberWhite : P.black, 1);
      r.text(u.name[0], x + 3, 3, { color: active ? P.void : P.boneLit, align: 'center' });
    }
    r.text('NEXT', x - 24, 4, { color: P.stoneShadow });
  }

  #drawCommandPanel(r) {
    const x = 4;
    const y = UI_Y;
    const w = 92;
    const h = 72;
    panel(r, x, y, w, h, { fill: P.void });

    if (this.state === 'rite') { this.#drawRiteList(r, x, y, w, h); return; }
    if (this.state === 'item') { this.#drawItemList(r, x, y, w, h); return; }

    CMD.forEach((c, i) => {
      const cy = y + 10 + i * 14;
      const sel = i === this.cmd && (this.state === 'command' || this.state === 'target');
      if (sel) {
        r.rect(x + 4, cy - 2, w - 8, 12, alpha(P.ember, 0.22));
        cursor(r, x + 6, cy + 4, P.emberBright, 4);
      }
      r.text(c.label, x + 14, cy, {
        color: sel ? P.boneWhite : P.stoneMid, tracking: 1,
      });
    });
  }

  #drawRiteList(r, x, y, w, h) {
    r.text('RITE', x + 6, y + 4, { color: P.emberLit, tracking: 1 });
    r.hline(x + 4, y + 12, w - 8, alpha(P.ember, 0.4));
    const list = this.actor.rites;
    const start = Math.max(0, Math.min(this.sub - 2, list.length - 4));
    list.slice(start, start + 4).forEach((id, i) => {
      const rite = getRite(id);
      const idx = start + i;
      const cy = y + 16 + i * 12;
      const sel = idx === this.sub;
      const afford = this.actor.ep >= rite.ep;
      if (sel) {
        r.rect(x + 4, cy - 2, w - 8, 11, alpha(P.ember, 0.22));
        cursor(r, x + 5, cy + 3, P.emberBright, 3);
      }
      r.text(rite.name.slice(0, 10), x + 11, cy, {
        color: !afford ? P.stoneShadow : sel ? P.boneWhite : P.stoneMid,
      });
      r.text(`${rite.ep}`, x + w - 6, cy, {
        color: afford ? P.emberLit : P.wound, align: 'right',
      });
    });
  }

  #drawItemList(r, x, y, w, h) {
    r.text('ITEM', x + 6, y + 4, { color: P.emberLit, tracking: 1 });
    r.hline(x + 4, y + 12, w - 8, alpha(P.ember, 0.4));
    const list = this.game.inventory;
    const start = Math.max(0, Math.min(this.sub - 2, list.length - 4));
    list.slice(start, start + 4).forEach((entry, i) => {
      const idx = start + i;
      const cy = y + 16 + i * 12;
      const sel = idx === this.sub;
      const item = getItem(entry.id);
      if (sel) {
        r.rect(x + 4, cy - 2, w - 8, 11, alpha(P.ember, 0.22));
        cursor(r, x + 5, cy + 3, P.emberBright, 3);
      }
      r.text((item?.name ?? entry.id).slice(0, 10), x + 11, cy, {
        color: sel ? P.boneWhite : P.stoneMid,
      });
      r.text(`${entry.count}`, x + w - 6, cy, { color: P.emberLit, align: 'right' });
    });
  }

  #drawPartyPanel(r) {
    const x = 100;
    const y = UI_Y;
    const w = r.W - x - 4;
    const h = 72;
    panel(r, x, y, w, h, { fill: P.void });

    this.battle.party.forEach((hero, i) => {
      const ry = y + 4 + i * 19;
      const active = hero === this.actor;
      const v = this.v(hero);
      if (active) {
        r.rect(x + 3, ry - 1, w - 6, 18, alpha(P.ember, 0.16));
        cornerTicks(r, x + 3, ry - 1, w - 6, 18, P.ember, 3);
      }
      drawPortrait(r, hero.figure, x + 6, ry, { frameColor: active ? P.emberBright : P.stoneShadow });
      const nameColor = !isAlive(hero) ? P.wound : active ? P.boneWhite : P.stoneLit;
      r.text(hero.name, x + 28, ry + 1, { color: nameColor, tracking: 1 });

      r.text('HP', x + 28, ry + 10, { color: P.stoneShadow });
      meter(r, x + 42, ry + 9, 78, 7, v.hp / hero.maxHp, {
        color: hpColor(v.hp / hero.maxHp),
      });
      r.text(`${Math.max(0, Math.round(v.hp))}/${hero.maxHp}`, x + 126, ry + 10, { color: P.stoneMid });

      r.text('EP', x + 186, ry + 10, { color: P.stoneShadow });
      meter(r, x + 200, ry + 9, 48, 7, v.ep / Math.max(1, hero.maxEp), {
        color: P.emberDim, segments: false,
      });
      r.text(`${Math.round(v.ep)}`, x + 254, ry + 10, { color: P.emberLit });

      const aff = AFFINITY[hero.affinity];
      glyph(r, aff.glyph, x + w - 16, ry + 6, aff.color);
      if (hero.guarding) r.text('GRD', x + w - 42, ry + 1, { color: P.emberLit });
      if (hero.buffs.length) r.text('+', x + w - 26, ry + 1, { color: P.emberBright });
    });

    // running log along the very bottom, on its own rule
    r.hline(x + 4, y + h - 13, w - 8, alpha(P.ember, 0.3));
    const line = this.log.at(-1);
    if (line) r.text(line.text, x + 6, y + h - 10, { color: line.color });
  }

  #drawOutcome(r) {
    const victory = this.battle.outcome === 'victory';
    r.dither(0, 0, r.W, r.H, P.void, 0.82);
    const cx = r.W >> 1;
    panel(r, cx - 110, 78, 220, victory ? 96 : 62, { fill: P.black, accent: P.emberBright });
    r.text(victory ? 'THE GALLERY IS QUIET' : 'THE LINE IS BROKEN', cx, 90, {
      color: victory ? P.emberHot : P.wound, align: 'center', tracking: 2,
    });
    r.hline(cx - 92, 100, 184, alpha(P.ember, 0.4));

    if (victory) {
      const spoils = this.battle.spoils();
      r.text(`EXPERIENCE  ${spoils.exp}`, cx, 108, { color: P.stoneLit, align: 'center' });
      r.text('SHARDS RECOVERED', cx, 122, { color: P.stoneShadow, align: 'center' });
      const entries = Object.entries(spoils.shards);
      entries.forEach(([id, n], i) => {
        const sx = cx - (entries.length * 34) / 2 + i * 34 + 8;
        glyph(r, 'shard', sx, 132, P.emberBright);
        r.text(`${n}`, sx + 10, 133, { color: P.boneLit });
        r.text(id.slice(0, 6).toUpperCase(), sx, 143, { color: P.stoneShadow });
      });
    } else {
      r.text('THE MASKS RESUME THEIR WORK', cx, 110, { color: P.stoneMid, align: 'center' });
    }
    const blink = Math.sin(this.t * 4) > -0.3;
    if (blink) {
      r.text('ENTER', cx, victory ? 158 : 124, { color: P.boneWhite, align: 'center', tracking: 2 });
    }
  }
}

function hpColor(ratio) {
  if (ratio > 0.5) return P.ember;
  if (ratio > 0.25) return P.emberLit;
  return P.wound;
}
