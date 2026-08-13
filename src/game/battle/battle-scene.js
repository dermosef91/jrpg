import { Scene } from '../../engine/scene.js';
import { P, RAMP, GRAIN_COLOR, alpha, mix } from '../../engine/palette.js';
import { Battle } from './battle.js';
import { getAction } from './actions.js';
import { isAlive, grainLocked } from './combatant.js';
import { GRAIN_NAMES, relation, RELATION, acrossFrom } from './grain.js';
import {
  makeView, updateView, drawGrafts, drawPopups, pushPopup, setGrain,
} from './cross-section.js';
import { drawCreature, drawPartyFigure } from './creatures.js';

const REL_LABEL = {
  [RELATION.ACROSS]: 'ACROSS — splits the fibre   ×1.75',
  [RELATION.OBLIQUE]: 'oblique   ×1.0',
  [RELATION.ALONG]: 'ALONG — absorbed as growth   ×0.25',
};
const REL_COLOR = {
  [RELATION.ACROSS]: RAMP.amber[4],
  [RELATION.OBLIQUE]: RAMP.pale[1],
  [RELATION.ALONG]: RAMP.scar[3],
};

const STAGE_Y = 172;
const PARTY_Y = 288;
const PANEL_Y = 374;

export class BattleScene extends Scene {
  grade = { bloom: 0.6, vignette: 0.95, grain: 0.05, warmth: 0.42 };

  constructor({ party, foes, title = 'Encounter', seed = 7, onEnd = null }) {
    super();
    this.battle = new Battle({ party, foes, seed });
    this.title = title;
    this.onEnd = onEnd;
    this.log = [];
    this.state = 'input';
    this.wait = 0;
    this.menu = 0;
    this.targetIndex = 0;
    this.grainChoice = 0;
    this.graftIndex = 0;
    this.pendingAction = null;
    this.t = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.shakeDir = { x: 1, y: 0 };
    this.flash = 0;
    this.flashColor = P.pale;
    this.views = new Map();
    for (const c of this.battle.all) this.views.set(c.uid, makeView(c));
  }

  enter() {
    this.game.audio.setAmbient('battle');
    this.#say(this.title, RAMP.amber[3]);
    this.#say('Read before you strike. Force along the fibre feeds it.', RAMP.pale[1]);
    this.#syncTurn();
  }

  exit() { this.game.particles.clear(); }

  get actor() { return this.battle.current; }
  get actionIds() { return this.actor?.actions ?? []; }
  get currentActionId() { return this.actionIds[this.menu]; }
  view(c) { return this.views.get(c.uid); }
  get audio() { return this.game.audio; }

  #say(text, color = P.pale) {
    this.log.push({ text, color, age: 0 });
    if (this.log.length > 7) this.log.shift();
  }

  #syncTurn() {
    if (this.battle.over) { this.state = 'over'; return; }
    this.menu = 0;
    this.targetIndex = 0;
    this.state = this.actor.side === 'party' ? 'input' : 'foeturn';
    if (this.state === 'foeturn') this.wait = 0.5;
  }

  // --- layout ---------------------------------------------------------------

  /** Where a combatant is drawn. Shared by rendering and by VFX spawn points. */
  slot(c) {
    const foes = this.battle.foes;
    const i = foes.indexOf(c);
    if (i >= 0) {
      const step = 600 / (foes.length + 1);
      const stagger = foes.length > 1 ? (i % 2 ? 16 : -10) : 0;
      return { x: step * (i + 1) + 8, y: STAGE_Y + stagger, radius: foes.length > 2 ? 44 : 52 };
    }
    const p = this.battle.party.indexOf(c);
    return { x: 44 + p * 176, y: PARTY_Y + 40, radius: 22 };
  }

  // --- update ---------------------------------------------------------------

  update(dt) {
    this.t += dt;
    for (const c of this.battle.all) updateView(this.view(c), c, dt);
    for (const line of this.log) line.age += dt;
    this.shake = Math.max(0, this.shake - dt * 3.6);
    this.flash = Math.max(0, this.flash - dt * 4.2);

    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    if (this.wait > 0) { this.wait -= dt; return; }

    switch (this.state) {
      case 'input': this.#updateInput(); break;
      case 'target': this.#updateTarget(); break;
      case 'grain': this.#updateGrain(); break;
      case 'graft': this.#updateGraft(); break;
      case 'resolve': this.#advance(); break;
      case 'foeturn': this.#foeTurn(); break;
      case 'over': this.#updateOver(); break;
    }
  }

  #move(delta, length) {
    this.audio.play('cursor');
    return (delta + length) % length;
  }

  #updateInput() {
    const dir = this.input.dir();
    if (dir === 'up') this.menu = this.#move(this.menu - 1, this.actionIds.length);
    if (dir === 'down') this.menu = this.#move(this.menu + 1, this.actionIds.length);
    if (!this.input.pressed('confirm')) return;

    const actionId = this.currentActionId;
    const reason = this.battle.blockedReason(this.actor, actionId);
    if (reason) {
      this.audio.play('denied');
      this.#say(`Cannot: ${reason}.`, RAMP.scar[3]);
      return;
    }
    this.audio.play('confirm');
    this.pendingAction = actionId;
    const action = getAction(actionId);
    if (action.effect?.harvest) { this.graftIndex = 0; this.state = 'graft'; }
    else if (action.grain === 'choose') { this.grainChoice = 0; this.state = 'grain'; }
    else this.#toTargeting();
  }

  #toTargeting() {
    this.targets = this.battle.targetsFor(this.actor, this.pendingAction);
    if (this.targets.length <= 1) { this.#commit(this.targets[0] ?? this.actor); return; }
    this.targetIndex = 0;
    this.state = 'target';
  }

  #updateGrain() {
    const dir = this.input.dir();
    if (dir === 'left' || dir === 'up') this.grainChoice = this.#move(this.grainChoice - 1, 4);
    if (dir === 'right' || dir === 'down') this.grainChoice = this.#move(this.grainChoice + 1, 4);
    if (this.input.pressed('cancel')) { this.audio.play('cancel'); this.state = 'input'; return; }
    if (this.input.pressed('confirm')) { this.audio.play('confirm'); this.#toTargeting(); }
  }

  #updateGraft() {
    const refs = this.#myGrafts();
    const dir = this.input.dir();
    if (dir === 'up') this.graftIndex = this.#move(this.graftIndex - 1, refs.length);
    if (dir === 'down') this.graftIndex = this.#move(this.graftIndex + 1, refs.length);
    if (this.input.pressed('cancel')) { this.audio.play('cancel'); this.state = 'input'; return; }
    if (this.input.pressed('confirm')) this.#commit(null, refs[this.graftIndex]);
  }

  #myGrafts() {
    return this.battle.all.flatMap((host) => host.grafts
      .filter((g) => g.byUid === this.actor.uid).map((graft) => ({ graft, host })));
  }

  #updateTarget() {
    const dir = this.input.dir();
    if (dir === 'up' || dir === 'left') this.targetIndex = this.#move(this.targetIndex - 1, this.targets.length);
    if (dir === 'down' || dir === 'right') this.targetIndex = this.#move(this.targetIndex + 1, this.targets.length);
    if (this.input.pressed('cancel')) { this.audio.play('cancel'); this.state = 'input'; return; }
    if (this.input.pressed('confirm')) this.#commit(this.targets[this.targetIndex]);
  }

  #commit(target, graftRef = null) {
    this.audio.play('confirm');
    const actor = this.actor;
    const events = this.battle.perform(actor, this.pendingAction, {
      target, grain: this.grainChoice, graftRef,
    });
    this.#lunge(actor, target);
    this.#drain(events);
    this.state = 'resolve';
    this.wait = 0.6;
  }

  #foeTurn() {
    const actor = this.actor;
    const events = this.battle.takeFoeTurn();
    const hit = events.find((e) => e.type === 'damage' || e.type === 'graft');
    this.#lunge(actor, hit?.who ?? hit?.host ?? null);
    this.#drain(events);
    this.state = 'resolve';
    this.wait = 0.65;
  }

  /** A short shove toward the target: reads as intent without an animation rig. */
  #lunge(actor, target) {
    if (!actor || !target || actor === target) return;
    const a = this.slot(actor);
    const b = this.slot(target);
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const view = this.view(actor);
    view.offsetX = ((b.x - a.x) / d) * 18;
    view.offsetY = ((b.y - a.y) / d) * 18;
    view.scale = 1.08;
  }

  #advance() {
    this.#drain(this.battle.advance());
    this.#syncTurn();
  }

  #updateOver() {
    if (!this.input.pressed('confirm') && !this.input.pressed('cancel')) return;
    const outcome = this.battle.outcome;
    this.game.scenes.pop(outcome);
    this.onEnd?.(outcome);
  }

  // --- events to spectacle --------------------------------------------------

  #drain(events) {
    for (const e of events) {
      const line = describe(e);
      if (line) this.#say(line.text, line.color);
      this.#vfx(e);
    }
  }

  #vfx(e) {
    const fx = this.game.particles;
    const who = e.who ?? e.host;
    const at = who ? this.slot(who) : null;
    const view = who ? this.view(who) : null;

    switch (e.type) {
      case 'act':
        if (e.action.effect?.reveal) this.audio.play('read');
        break;

      case 'damage': {
        const rel = e.relation ?? RELATION.OBLIQUE;
        const dir = Math.random() * Math.PI * 2;
        this.audio.play('strike', { relation: rel, power: rel === RELATION.ACROSS ? 1.1 : 0.9 });
        if (rel === RELATION.ACROSS) {
          fx.burst('spark', at.x, at.y, { angle: dir, spread: 1.5, speedScale: 1.2 });
          fx.burst('splinter', at.x, at.y, { angle: dir, spread: 2.2 });
          fx.ring(at.x, at.y, { radius: at.radius * 2.1, color: RAMP.amber[4], life: 0.42, width: 4 });
          this.hitstop = 0.085;
          this.#shake(0.95, dir);
          this.flash = 0.35;
          this.flashColor = RAMP.amber[3];
        } else if (rel === RELATION.ALONG) {
          fx.burst('glance', at.x, at.y, { angle: dir, spread: 1.1 });
          this.#shake(0.25, dir);
        } else {
          fx.burst('splinter', at.x, at.y, { angle: dir, spread: 2.4, count: 9 });
          this.hitstop = 0.04;
          this.#shake(0.5, dir);
        }
        view.flash = 1;
        view.shake = 1;
        view.scale = 0.9;
        pushPopup(view, `-${e.amount}`, {
          color: REL_COLOR[rel] ?? P.pale,
          size: rel === RELATION.ACROSS ? 26 : 19,
        });
        break;
      }

      case 'feed':
        this.audio.play('absorb');
        fx.burst('sap', at.x, at.y, { count: 10, speedScale: 0.7 });
        fx.ring(at.x, at.y, { radius: at.radius * 1.6, color: RAMP.sap[4], life: 0.5, width: 2 });
        pushPopup(view, e.sap ? `+${e.sap} sap` : `+${e.heal}`, { color: RAMP.sap[4], size: 15 });
        break;

      case 'heal':
        if (e.amount <= 0) break;
        this.audio.play('heal');
        fx.burst('sap', at.x, at.y - at.radius * 0.4, { count: 12, angle: -Math.PI / 2, spread: 1.6 });
        pushPopup(view, `+${e.amount}`, { color: RAMP.sap[4] });
        break;

      case 'scar':
        this.audio.play('scar');
        fx.burst('rip', at.x, at.y, { speedScale: 1.1 });
        fx.ring(at.x, at.y, { radius: at.radius * 1.8, color: RAMP.scar[3], life: 0.5, width: 3 });
        pushPopup(view, 'SCAR', { color: RAMP.scar[4], size: 15 });
        this.#shake(0.7, Math.random() * Math.PI * 2);
        break;

      case 'rotate':
        setGrain(view, e.grain);
        this.audio.play('rotate');
        break;

      case 'grainLocked':
        pushPopup(view, 'locked', { color: RAMP.scar[3], size: 13 });
        break;

      case 'graft':
        this.audio.play('graft');
        fx.burst('sap', at.x, at.y, { count: 9, speedScale: 0.6 });
        break;

      case 'mature':
        this.audio.play('mature');
        fx.ring(at.x, at.y, { radius: at.radius * 2.6, color: RAMP.amber[4], life: 0.7, width: 3 });
        fx.burst('sunwood', at.x, at.y, { count: 16 });
        this.flash = 0.22;
        this.flashColor = RAMP.amber[4];
        break;

      case 'harvest':
        this.audio.play('harvest');
        fx.burst('sap', at.x, at.y, { count: 6, speedScale: 0.5 });
        break;

      case 'excise':
        this.audio.play('excise');
        fx.burst('spark', at.x, at.y, { count: 10, color: RAMP.ember[4] });
        break;

      case 'burn':
        this.audio.play('burn');
        fx.burst('sunwood', at.x, at.y, { count: 14, color: RAMP.ember[4] });
        pushPopup(view, `burn ${e.amount}`, { color: RAMP.ember[4], size: 14 });
        break;

      case 'guard':
        fx.ring(at.x, at.y, { radius: at.radius * 2, color: RAMP.amber[3], life: 0.6, width: 2 });
        break;

      case 'down':
        this.audio.play('down');
        fx.burst('splinter', at.x, at.y, { count: 26, speedScale: 1.3 });
        fx.burst('rip', at.x, at.y, { count: 16 });
        this.#shake(1.1, Math.random() * Math.PI * 2);
        this.hitstop = 0.12;
        break;

      case 'revive':
        this.audio.play('mature');
        fx.ring(at.x, at.y, { radius: at.radius * 2.2, color: RAMP.sap[4], life: 0.6, width: 3 });
        break;

      case 'sap':
        if (e.amount < 0) this.game.particles.burst('sunwood', 806, PARTY_Y + 26, { count: 5, speedScale: 0.6 });
        break;

      case 'outcome':
        this.audio.play(e.outcome === 'victory' ? 'victory' : 'defeat');
        this.audio.setAmbient(null);
        break;

      default: break;
    }
  }

  #shake(amount, angle) {
    this.shake = Math.max(this.shake, amount);
    this.shakeDir = { x: Math.cos(angle), y: Math.sin(angle) };
  }

  // --- draw -----------------------------------------------------------------

  draw(r) {
    const b = this.battle;
    r.begin(RAMP.bark[0]);
    this.#drawStage(r);

    r.save();
    if (this.shake > 0) {
      const s = this.shake ** 2 * 13;
      r.translate(this.shakeDir.x * Math.sin(this.t * 74) * s, this.shakeDir.y * Math.cos(this.t * 61) * s);
    }
    this.#drawFoes(r);
    this.game.particles.draw(r);
    r.restore();

    this.#drawHeader(r, b);
    this.#drawInspector(r);
    this.#drawParty(r);
    this.#drawMenu(r);
    this.#drawLog(r);

    if (this.flash > 0) {
      r.save();
      r.blend('lighter', () => r.rect(0, 0, r.W, r.H, alpha(this.flashColor, this.flash * 0.3)));
      r.restore();
    }
    if (this.state === 'over') this.#drawOutcome(r);
  }

  /** The stage: a lit ground plane under a dark canopy. Sells depth for free. */
  #drawStage(r) {
    const horizon = 108;
    r.vgrad(0, 0, r.W, horizon, RAMP.bark[0], mix(RAMP.shade[1], RAMP.bark[1], 0.5));
    r.vgrad(0, horizon, r.W, PARTY_Y - horizon, mix(RAMP.shade[1], RAMP.bark[2], 0.6), RAMP.bark[1]);

    // Key light falling from above-left, the way the low Ember would.
    r.light(300, 40, 460, RAMP.amber[2], 0.2);
    r.light(660, 90, 380, RAMP.amber[1], 0.14);

    // Ground plane with a drifting grain, so the floor reads as a Trace.
    r.save();
    r.clipRect(0, horizon, r.W, PARTY_Y - horizon);
    r.grainFill(-60, horizon, r.W + 120, PARTY_Y - horizon, RAMP.wood[1],
      { spacing: 22, alpha: 0.22, angle: -0.06, lw: 1.4, jitter: 3 });
    r.restore();
    r.line(0, horizon, r.W, horizon, alpha(RAMP.bark[0], 0.7), 2);
  }

  #drawHeader(r, b) {
    r.save();
    r.vgrad(0, 0, r.W, 38, alpha(RAMP.bark[0], 0.94), alpha(RAMP.bark[0], 0.6));
    r.line(0, 38, r.W, 38, alpha(RAMP.wood[1], 0.7), 1.5);
    r.text(`ROUND ${b.round}`, 18, 25, { size: 12, color: RAMP.amber[3], weight: 700, tracking: 2 });
    r.text(this.title, r.W / 2, 25, {
      size: 15, color: RAMP.pale[4], align: 'center', font: 'display', tracking: 1,
    });
    r.text(b.over ? b.outcome.toUpperCase() : `${this.actor.name.toUpperCase()}`,
      r.W - 18, 25, { size: 12, color: RAMP.pale[2], align: 'right', tracking: 2 });
    r.restore();
  }

  #drawFoes(r) {
    for (const foe of this.battle.foes) {
      const at = this.slot(foe);
      const view = this.view(foe);
      const selected = this.state === 'target' && this.targets?.[this.targetIndex] === foe;
      r.light(at.x, at.y + at.radius * 0.7, at.radius * 2.6, RAMP.amber[1], 0.16);
      const drawn = drawCreature(r, foe, view, at.x, at.y, at.radius, {
        selected, t: this.t,
      });
      this.#drawAimGuide(r, foe, drawn);
      drawGrafts(r, foe, view, drawn.x, drawn.y, drawn.radius, this.t);

      const nameY = at.y + at.radius + 26;
      r.text(foe.name, at.x, nameY, {
        size: 13, color: isAlive(foe) ? RAMP.pale[4] : RAMP.scar[3],
        align: 'center', weight: 700, shadow: alpha(RAMP.bark[0], 0.9),
      });
      r.bar(at.x - at.radius, nameY + 8, at.radius * 2, 7,
        view.hpShown / foe.maxHp, isAlive(foe) ? RAMP.ember[3] : RAMP.scar[2], { glow: true });
      if (foe.intentVisible && foe.intent) {
        r.text(`intends ${getAction(foe.intent).name}`, at.x, nameY + 28,
          { size: 10, color: RAMP.shade[5], align: 'center' });
      }
      drawPopups(r, view, at.x, at.y - at.radius * 0.5);
    }
  }

  /** Where the pending force will come from, drawn onto the target it will hit. */
  #drawAimGuide(r, foe, drawn) {
    const g = this.#previewGrain(foe);
    if (g == null) return;
    const pa = g * (Math.PI / 4) + Math.PI / 2;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 7);
    r.save();
    r.blend('lighter', () => {
      for (const s of [-1, 1]) {
        const ox = Math.cos(pa) * s;
        const oy = Math.sin(pa) * s;
        const R = drawn.radius;
        r.line(drawn.x + ox * (R + 12 + pulse * 6), drawn.y + oy * (R + 12 + pulse * 6),
          drawn.x + ox * (R + 34 + pulse * 9), drawn.y + oy * (R + 34 + pulse * 9),
          RAMP.amber[4], 3, 'round');
        r.poly([
          [drawn.x + ox * (R + 6), drawn.y + oy * (R + 6)],
          [drawn.x + ox * (R + 18) - oy * 6, drawn.y + oy * (R + 18) + ox * 6],
          [drawn.x + ox * (R + 18) + oy * 6, drawn.y + oy * (R + 18) - ox * 6],
        ], alpha(RAMP.amber[5], 0.6 + pulse * 0.4));
      }
    });
    r.restore();
  }

  #previewGrain(target) {
    if (this.state !== 'target' || this.targets?.[this.targetIndex] !== target) return null;
    const action = getAction(this.pendingAction);
    if (action.effect?.damage == null) return null;
    return action.grain === 'choose' ? this.grainChoice : action.grain;
  }

  #drawInspector(r) {
    const x = 628;
    const y = 46;
    const w = r.W - x - 16;
    const h = 226;
    r.panel(x, y, w, h, { accent: RAMP.wood[2] });

    const focus = this.state === 'target' ? this.targets?.[this.targetIndex]
      : this.state === 'graft' ? this.#myGrafts()[this.graftIndex]?.host
      : this.actor;
    if (!focus) return;
    const view = this.view(focus);

    r.text(focus.name.toUpperCase(), x + 16, y + 28, {
      size: 16, color: RAMP.pale[5], weight: 700, font: 'display', tracking: 1.5,
    });
    r.text(focus.role, x + 16, y + 46, { size: 10, color: RAMP.pale[1], tracking: 0.5 });
    r.line(x + 16, y + 56, x + w - 16, y + 56, alpha(RAMP.wood[1], 0.6), 1);

    const known = focus.revealed;
    r.text('GRAIN', x + 16, y + 78, { size: 9, color: RAMP.pale[0], tracking: 2 });
    if (known) {
      drawDial(r, x + 60, y + 110, 30, focus.grain, grainLocked(focus), view.grainAngle);
      r.text(GRAIN_NAMES[focus.grain], x + 106, y + 106, {
        size: 15, color: GRAIN_COLOR[focus.grain], weight: 700, font: 'display',
      });
      r.text(grainLocked(focus) ? 'scarred — cannot turn' : 'turns +1 on any hit',
        x + 106, y + 124, { size: 10, color: grainLocked(focus) ? RAMP.scar[3] : RAMP.pale[1] });
    } else {
      drawDial(r, x + 60, y + 110, 30, -1, false, view.grainAngle);
      r.text('unread', x + 106, y + 106, { size: 14, color: RAMP.shade[5], font: 'display' });
      r.text('striking blind may feed it', x + 106, y + 124, { size: 10, color: RAMP.pale[0] });
    }

    let ly = y + 158;
    r.text('GRAFTS', x + 16, ly, { size: 9, color: RAMP.pale[0], tracking: 2 });
    ly += 17;
    if (!focus.grafts.length) {
      r.text('none', x + 26, ly, { size: 11, color: RAMP.wood[1] });
    } else {
      for (const g of focus.grafts.slice(0, 3)) {
        const mine = g.bySide === 'party';
        r.circle(x + 22, ly - 4, 3.5, mine ? RAMP.sap[4] : RAMP.ember[4]);
        r.text(known ? `${g.name} — ${g.maturity}` : `${g.name} — ?`, x + 32, ly,
          { size: 11, color: mine ? RAMP.sap[4] : RAMP.ember[4] });
        ly += 16;
      }
    }
    if (focus.scars > 0) {
      r.text(`SCARS ${'▰'.repeat(focus.scars)}   max ${focus.maxHp}`,
        x + 16, y + h - 14, { size: 10, color: RAMP.scar[3], tracking: 1 });
    }
  }

  #drawParty(r) {
    const y = PARTY_Y;
    this.battle.party.forEach((c, i) => {
      const x = 14 + i * 176;
      const w = 168;
      const active = c === this.actor;
      const targeted = this.state === 'target' && this.targets?.[this.targetIndex] === c;
      const view = this.view(c);
      r.panel(x, y, w, 78, {
        fill: active ? mix(RAMP.bark[3], RAMP.amber[0], 0.25) : null,
        border: targeted ? RAMP.amber[4] : active ? RAMP.wood[3] : RAMP.wood[1],
        accent: targeted ? RAMP.amber[4] : null,
      });
      if (active) r.light(x + w / 2, y + 39, 120, RAMP.amber[3], 0.16);

      const at = this.slot(c);
      drawPartyFigure(r, c, view, at.x, at.y + 24, { active, t: this.t });
      r.text(c.name, x + 60, y + 24, {
        size: 14, color: isAlive(c) ? RAMP.pale[5] : RAMP.scar[3], weight: 700, font: 'display',
      });
      r.text(c.role, x + 60, y + 38, { size: 8.5, color: RAMP.pale[1], tracking: 0.4 });
      r.bar(x + 60, y + 46, 94, 7, view.hpShown / c.maxHp, isAlive(c) ? RAMP.sap[3] : RAMP.scar[2]);
      r.text(`${c.hp}/${c.maxHp}`, x + 60, y + 66, { size: 9.5, color: RAMP.pale[1] });
      if (c.guarding) r.text('BEARING', x + 114, y + 66, { size: 8.5, color: RAMP.amber[4] });
      if (c.scars) r.text('▰'.repeat(c.scars), x + w - 12, y + 24,
        { size: 9, color: RAMP.scar[3], align: 'right' });
      drawPopups(r, view, at.x, at.y - 24);
    });

    // Shared Sap: sunwood crystals, lit when charged.
    const sx = 730;
    r.text('SAP', sx, y + 22, { size: 9, color: RAMP.pale[0], tracking: 2 });
    for (let i = 0; i < this.battle.maxSap; i++) {
      const cx = sx + 32 + (i % 6) * 19;
      const cy = y + 18 + Math.floor(i / 6) * 19;
      const filled = i < this.battle.sap;
      if (filled) r.light(cx, cy, 15, RAMP.amber[4], 0.5);
      r.poly([[cx, cy - 6], [cx + 5, cy], [cx, cy + 6], [cx - 5, cy]],
        filled ? RAMP.amber[4] : RAMP.bark[3]);
      r.poly([[cx, cy - 6], [cx + 5, cy], [cx, cy + 6], [cx - 5, cy]],
        filled ? RAMP.amber[5] : RAMP.wood[0], { stroke: true, lw: 1 });
    }
    r.text(`${this.battle.sap}/${this.battle.maxSap} shared`, sx, y + 66,
      { size: 9.5, color: RAMP.pale[1] });
  }

  #drawMenu(r) {
    const x = 14;
    const y = PANEL_Y;
    const w = 424;
    r.panel(x, y, w, 152, { accent: RAMP.wood[2] });

    if (this.state === 'grain') {
      r.text('SING ALONG WHICH FIBRE?', x + 16, y + 26,
        { size: 11, color: RAMP.amber[3], tracking: 1.5 });
      GRAIN_NAMES.forEach((name, i) => {
        const sel = i === this.grainChoice;
        const gx = x + 26 + i * 100;
        if (sel) {
          r.light(gx + 26, y + 76, 60, GRAIN_COLOR[i], 0.4);
          r.roundRect(gx - 8, y + 44, 70, 82, 4, alpha(RAMP.amber[4], 0.12));
          r.roundRect(gx - 8, y + 44, 70, 82, 4, RAMP.amber[4], { stroke: true, lw: 2 });
        }
        drawDial(r, gx + 26, y + 78, 22, i, false, i * (Math.PI / 4));
        r.text(name, gx + 26, y + 118, {
          size: 10, color: sel ? RAMP.pale[5] : RAMP.pale[1], align: 'center', weight: sel ? 700 : 400,
        });
      });
      return;
    }

    if (this.state === 'graft') {
      r.text('HARVEST WHICH GRAFT?', x + 16, y + 26,
        { size: 11, color: RAMP.amber[3], tracking: 1.5 });
      this.#myGrafts().forEach((ref, i) => {
        const sel = i === this.graftIndex;
        if (sel) r.roundRect(x + 10, y + 40 + i * 22, w - 20, 21, 3, alpha(RAMP.amber[4], 0.13));
        r.text(`${ref.graft.name} on ${ref.host.name} — ${ref.graft.maturity} to go`,
          x + 22, y + 55 + i * 22, { size: 12, color: sel ? RAMP.pale[5] : RAMP.pale[1] });
      });
      return;
    }

    const actor = this.actor;
    if (!actor || this.battle.over) return;

    this.actionIds.forEach((id, i) => {
      const action = getAction(id);
      const sel = i === this.menu && this.state !== 'foeturn';
      const blocked = this.battle.blockedReason(actor, id);
      const color = blocked ? RAMP.wood[0] : sel ? RAMP.pale[5] : RAMP.pale[2];
      const ly = y + 28 + i * 21;
      if (sel) {
        r.roundRect(x + 9, ly - 15, w - 18, 20, 3, alpha(RAMP.amber[4], 0.14));
        r.line(x + 9, ly - 15, x + 9, ly + 5, RAMP.amber[4], 2);
      }
      r.text(action.name, x + 22, ly, { size: 13, color, weight: sel ? 700 : 400 });
      if (action.grain != null && action.grain !== 'choose') {
        r.circle(x + w - 74, ly - 4, 3.5, GRAIN_COLOR[action.grain]);
      }
      if (action.sap > 0) {
        const short = action.sap > this.battle.sap;
        r.text(short ? `${action.sap} burn` : `${action.sap} sap`, x + w - 22, ly,
          { size: 10.5, color: short ? RAMP.ember[3] : RAMP.amber[3], align: 'right' });
      }
    });

    const hint = getAction(this.currentActionId ?? 'strike');
    r.line(x + 16, y + 122, x + w - 16, y + 122, alpha(RAMP.wood[1], 0.5), 1);
    r.wrap(hint.desc, w - 34, 10.5).slice(0, 2).forEach((line, i) => {
      r.text(line, x + 17, y + 136 + i * 13, { size: 10.5, color: RAMP.shade[5] });
    });
  }

  #drawLog(r) {
    const x = 450;
    const y = PANEL_Y;
    const w = r.W - x - 16;
    r.panel(x, y, w, 152, { grain: false, accent: RAMP.wood[2] });

    if (this.state === 'target') {
      const target = this.targets[this.targetIndex];
      const g = this.#previewGrain(target);
      r.text(`TARGET   ${target.name.toUpperCase()}`, x + 16, y + 28, {
        size: 12, color: RAMP.amber[3], weight: 700, tracking: 1.5,
      });
      if (g == null) {
        r.text('no force applied', x + 16, y + 54, { size: 11, color: RAMP.pale[1] });
      } else if (!target.revealed) {
        r.text('grain unread — outcome unknown', x + 16, y + 54, { size: 12, color: RAMP.shade[5] });
        r.text('Read first, or accept the risk.', x + 16, y + 74, { size: 10.5, color: RAMP.pale[1] });
      } else {
        const rel = relation(g, target.grain);
        r.text(REL_LABEL[rel], x + 16, y + 56, {
          size: 12.5, color: REL_COLOR[rel], weight: 700, font: 'display',
        });
        r.text(`this hit turns its fibre to ${GRAIN_NAMES[(target.grain + 1) % 4]}`,
          x + 16, y + 80, { size: 10, color: RAMP.pale[1] });
        r.text(`across would be ${GRAIN_NAMES[acrossFrom(target.grain)]}`,
          x + 16, y + 97, { size: 10, color: RAMP.wood[2] });
      }
      r.text('arrows switch · enter commit · x back', x + 16, y + 138,
        { size: 9.5, color: RAMP.wood[1] });
      return;
    }

    this.log.slice(-6).forEach((entry, i) => {
      r.save();
      r.alpha(Math.min(1, 0.45 + i * 0.11));
      r.text(entry.text, x + 16, y + 28 + i * 19, { size: 11, color: entry.color });
      r.restore();
    });
  }

  #drawOutcome(r) {
    const victory = this.battle.outcome === 'victory';
    r.save();
    r.alpha(0.86);
    r.rect(0, 0, r.W, r.H, RAMP.bark[0]);
    r.restore();
    r.light(r.W / 2, r.H / 2 - 20, 420, victory ? RAMP.amber[3] : RAMP.scar[2], 0.28);

    r.text(victory ? 'NO LONGER STRUCTURALLY VIABLE' : 'THE CIRCUIT IS DOWN', r.W / 2, r.H / 2 - 24, {
      size: 27, color: victory ? RAMP.amber[4] : RAMP.scar[4],
      align: 'center', weight: 700, font: 'display', tracking: 2,
    });
    r.line(r.W / 2 - 220, r.H / 2 - 6, r.W / 2 + 220, r.H / 2 - 6, alpha(RAMP.wood[2], 0.7), 1);
    const body = victory
      ? 'You did not kill it. You rendered it unable to continue — the same judgement\nyou would apply to a sick Strider.'
      : 'Pell will get everyone upright. It will cost the circuit a week it does not have.';
    r.wrap(body, 640, 12).forEach((line, i) => {
      r.text(line, r.W / 2, r.H / 2 + 22 + i * 19, { size: 12, color: RAMP.pale[1], align: 'center' });
    });
    r.save();
    r.alpha(0.5 + 0.5 * Math.sin(this.t * 3));
    r.text('ENTER', r.W / 2, r.H / 2 + 94,
      { size: 13, color: RAMP.pale[4], align: 'center', tracking: 3, weight: 700 });
    r.restore();
  }
}

/** The Grain dial. `angle` lets it tween with the section it describes. */
export function drawDial(r, x, y, radius, grain, locked, angle = null) {
  r.circle(x, y, radius, alpha(RAMP.bark[0], 0.85));
  r.circle(x, y, radius, locked ? RAMP.scar[2] : RAMP.wood[1], { stroke: true, lw: 2 });
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 4);
    const on = i === grain;
    if (on) continue;
    r.line(x - Math.cos(a) * radius * 0.8, y - Math.sin(a) * radius * 0.8,
      x + Math.cos(a) * radius * 0.8, y + Math.sin(a) * radius * 0.8,
      alpha(RAMP.bark[4], 0.8), 1);
  }
  if (grain >= 0) {
    const a = angle ?? grain * (Math.PI / 4);
    r.save();
    r.blend('lighter', () => {
      r.line(x - Math.cos(a) * radius * 0.86, y - Math.sin(a) * radius * 0.86,
        x + Math.cos(a) * radius * 0.86, y + Math.sin(a) * radius * 0.86,
        GRAIN_COLOR[grain], 3.5, 'round');
    });
    r.restore();
  } else {
    r.text('?', x, y + 5, { size: 15, color: RAMP.shade[4], align: 'center', weight: 700 });
  }
  if (locked) {
    r.circle(x, y, radius * 0.35, RAMP.scar[3], { stroke: true, lw: 2 });
  }
}

function describe(e) {
  switch (e.type) {
    case 'act': return { text: `${e.who.name}: ${e.action.name}`, color: RAMP.pale[4] };
    case 'damage': {
      const tag = e.relation === RELATION.ACROSS ? '   ACROSS'
        : e.relation === RELATION.ALONG ? '   along — absorbed' : '';
      return { text: `  ${e.who.name} takes ${e.amount}${tag}`, color: REL_COLOR[e.relation] ?? P.pale };
    }
    case 'heal': return e.amount > 0 ? { text: `  ${e.who.name} knits ${e.amount}`, color: RAMP.sap[4] } : null;
    case 'feed': return {
      text: e.sap ? `  absorbed — party gains ${e.sap} Sap` : `  ${e.who.name} absorbs it and grows ${e.heal}`,
      color: e.sap ? RAMP.amber[3] : RAMP.scar[3],
    };
    case 'scar': return { text: `  ${e.who.name} scars — fibre locked`, color: RAMP.scar[3] };
    case 'grainLocked': return { text: `  ${e.who.name}'s grain will not turn`, color: RAMP.scar[3] };
    case 'graft': return { text: `  ${e.graft.name} placed on ${e.host.name} (${e.graft.maturity})`, color: RAMP.sap[4] };
    case 'overgraft': return { text: `  ${e.host.name} is over-grafted — the stack slows`, color: RAMP.ember[3] };
    case 'mature': return { text: `${e.graft.name} matures on ${e.host.name}`, color: RAMP.amber[4] };
    case 'harvest': return { text: `  ${e.graft.name} harvested early`, color: RAMP.pale[1] };
    case 'excise': return { text: `  ${e.graft.name} excised from ${e.host.name}`, color: RAMP.ember[3] };
    case 'retime': return { text: `  ${e.graft.name} rewritten — ${e.dir < 0 ? 'sooner' : 'later'}`, color: RAMP.shade[5] };
    case 'reveal': return { text: `  ${e.who.name} read — grain exposed`, color: RAMP.shade[5] };
    case 'forecast': return {
      text: `  forecast: ${e.who.name} intends ${e.action ? getAction(e.action).name : 'nothing'}`,
      color: RAMP.shade[5],
    };
    case 'guard': return { text: `  ${e.who.name} bears the round`, color: RAMP.amber[3] };
    case 'redirect': return { text: `  ${e.to.name} takes it instead of ${e.from.name}`, color: RAMP.amber[3] };
    case 'burn': return { text: `  heartwood burned — ${e.amount} HP for Sap`, color: RAMP.scar[3] };
    case 'down': return { text: `${e.who.name} is no longer viable`, color: RAMP.scar[3] };
    case 'revive': return { text: `${e.who.name} is back up`, color: RAMP.sap[4] };
    case 'round': return { text: `— round ${e.round} —`, color: RAMP.wood[1] };
    case 'message': return { text: `  ${e.text}`, color: RAMP.pale[1] };
    default: return null;
  }
}
