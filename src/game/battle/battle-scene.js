import { Scene } from '../../engine/scene.js';
import { P, GRAIN_COLOR } from '../../engine/palette.js';
import { Battle } from './battle.js';
import { getAction } from './actions.js';
import { isAlive, grainLocked } from './combatant.js';
import { GRAIN_NAMES, relation, RELATION, acrossFrom } from './grain.js';

const REL_LABEL = {
  [RELATION.ACROSS]: 'ACROSS — splits the fibre  x1.75',
  [RELATION.OBLIQUE]: 'oblique  x1.0',
  [RELATION.ALONG]: 'ALONG — absorbed as growth  x0.25',
};
const REL_COLOR = {
  [RELATION.ACROSS]: P.sunwood,
  [RELATION.OBLIQUE]: P.paleDim,
  [RELATION.ALONG]: P.scar,
};

export class BattleScene extends Scene {
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
    this.shake = 0;
    this.t = 0;
  }

  enter() {
    this.#say(this.title, P.sunwood);
    this.#say('Read before you strike. Force along the fibre feeds it.', P.paleDim);
    this.#syncTurn();
  }

  get actor() { return this.battle.current; }
  get actionIds() { return this.actor?.actions ?? []; }
  get currentActionId() { return this.actionIds[this.menu]; }

  #say(text, color = P.pale) {
    this.log.push({ text, color });
    if (this.log.length > 7) this.log.shift();
  }

  #syncTurn() {
    if (this.battle.over) {
      this.state = 'over';
      return;
    }
    this.menu = 0;
    this.targetIndex = 0;
    this.state = this.actor.side === 'party' ? 'input' : 'foeturn';
    if (this.state === 'foeturn') this.wait = 0.55;
  }

  // --- update ---------------------------------------------------------------

  update(dt) {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 4);
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }

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

  #updateInput() {
    const dir = this.input.dir();
    if (dir === 'up') this.menu = (this.menu - 1 + this.actionIds.length) % this.actionIds.length;
    if (dir === 'down') this.menu = (this.menu + 1) % this.actionIds.length;
    if (!this.input.pressed('confirm')) return;

    const actionId = this.currentActionId;
    const reason = this.battle.blockedReason(this.actor, actionId);
    if (reason) {
      this.#say(`Cannot: ${reason}.`, P.scar);
      return;
    }
    this.pendingAction = actionId;
    const action = getAction(actionId);

    if (action.effect?.harvest) {
      this.graftIndex = 0;
      this.state = 'graft';
    } else if (action.grain === 'choose') {
      this.grainChoice = 0;
      this.state = 'grain';
    } else {
      this.#toTargeting();
    }
  }

  #toTargeting() {
    this.targets = this.battle.targetsFor(this.actor, this.pendingAction);
    if (this.targets.length <= 1) {
      this.#commit(this.targets[0] ?? this.actor);
      return;
    }
    this.targetIndex = 0;
    this.state = 'target';
  }

  #updateGrain() {
    const dir = this.input.dir();
    if (dir === 'left' || dir === 'up') this.grainChoice = (this.grainChoice + 3) % 4;
    if (dir === 'right' || dir === 'down') this.grainChoice = (this.grainChoice + 1) % 4;
    if (this.input.pressed('cancel')) { this.state = 'input'; return; }
    if (this.input.pressed('confirm')) this.#toTargeting();
  }

  #updateGraft() {
    const refs = this.#myGrafts();
    const dir = this.input.dir();
    if (dir === 'up') this.graftIndex = (this.graftIndex - 1 + refs.length) % refs.length;
    if (dir === 'down') this.graftIndex = (this.graftIndex + 1) % refs.length;
    if (this.input.pressed('cancel')) { this.state = 'input'; return; }
    if (this.input.pressed('confirm')) this.#commit(null, refs[this.graftIndex]);
  }

  #myGrafts() {
    return this.battle.all.flatMap((host) => host.grafts
      .filter((g) => g.byUid === this.actor.uid)
      .map((graft) => ({ graft, host })));
  }

  #updateTarget() {
    const dir = this.input.dir();
    if (dir === 'up' || dir === 'left') {
      this.targetIndex = (this.targetIndex - 1 + this.targets.length) % this.targets.length;
    }
    if (dir === 'down' || dir === 'right') {
      this.targetIndex = (this.targetIndex + 1) % this.targets.length;
    }
    if (this.input.pressed('cancel')) { this.state = 'input'; return; }
    if (this.input.pressed('confirm')) this.#commit(this.targets[this.targetIndex]);
  }

  #commit(target, graftRef = null) {
    const events = this.battle.perform(this.actor, this.pendingAction, {
      target, grain: this.grainChoice, graftRef,
    });
    this.#drain(events);
    this.state = 'resolve';
    this.wait = 0.55;
  }

  #foeTurn() {
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
    this.game.scenes.pop(outcome);
    this.onEnd?.(outcome);
  }

  #drain(events) {
    for (const e of events) {
      const line = describe(e);
      if (line) this.#say(line.text, line.color);
      if (e.type === 'damage') this.shake = 1;
    }
  }

  // --- draw -----------------------------------------------------------------

  draw(r) {
    const b = this.battle;
    r.clear(P.deep);
    r.save();
    if (this.shake > 0) {
      r.translate(Math.sin(this.t * 60) * this.shake * 3, Math.cos(this.t * 71) * this.shake * 2);
    }

    // header
    r.rect(0, 0, r.W, 34, P.bark);
    r.grainFill(0, 0, r.W, 34, P.barkLit, { spacing: 11, alpha: 0.4 });
    r.line(0, 34, r.W, 34, P.wood, 2);
    r.text(`ROUND ${b.round}`, 16, 22, { size: 14, color: P.sunwood, weight: 700 });
    r.text(this.title, r.W / 2, 22, { size: 14, color: P.paleDim, align: 'center' });
    r.text(b.over ? b.outcome.toUpperCase() : `${this.actor.name}'s turn`,
      r.W - 16, 22, { size: 13, color: P.pale, align: 'right' });

    this.#drawFoes(r);
    this.#drawInspector(r);
    this.#drawParty(r);
    this.#drawMenu(r);
    this.#drawLog(r);
    r.restore();

    if (this.state === 'over') this.#drawOutcome(r);
  }

  #drawFoes(r) {
    const foes = this.battle.foes;
    const zoneW = 596;
    const step = zoneW / (foes.length + 1);
    foes.forEach((foe, i) => {
      const x = step * (i + 1);
      const y = 150;
      const selected = this.state === 'target' && this.targets?.[this.targetIndex] === foe;
      drawCrossSection(r, foe, x, y, 58, {
        selected, active: foe === this.actor, t: this.t,
        previewGrain: this.#previewGrain(foe),
      });
    });
  }

  /** The grain of the action the player is currently pointing at this target. */
  #previewGrain(target) {
    if (this.state !== 'target' || this.targets?.[this.targetIndex] !== target) return null;
    const action = getAction(this.pendingAction);
    if (action.effect?.damage == null) return null;
    return action.grain === 'choose' ? this.grainChoice : action.grain;
  }

  #drawInspector(r) {
    const x = 612;
    const y = 44;
    const w = r.W - x - 16;
    const h = 228;
    r.panel(x, y, w, h);

    const focus = this.state === 'target' ? this.targets?.[this.targetIndex]
      : this.state === 'graft' ? this.#myGrafts()[this.graftIndex]?.host
      : this.actor;
    if (!focus) return;

    r.text(focus.name.toUpperCase(), x + 14, y + 26, { size: 15, color: P.pale, weight: 700 });
    r.text(focus.role, x + 14, y + 44, { size: 11, color: P.paleDim });

    const known = focus.revealed;
    r.text('GRAIN', x + 14, y + 74, { size: 11, color: P.paleDim });
    if (known) {
      drawDial(r, x + 96, y + 108, 34, focus.grain, grainLocked(focus));
      r.text(GRAIN_NAMES[focus.grain], x + 140, y + 104,
        { size: 14, color: GRAIN_COLOR[focus.grain], weight: 700 });
      r.text(grainLocked(focus) ? 'locked by scar — cannot turn' : 'turns +1 on any hit',
        x + 140, y + 122, { size: 10, color: grainLocked(focus) ? P.scar : P.paleDim });
    } else {
      r.text('unread — Read to expose', x + 60, y + 104, { size: 12, color: P.shadeLit });
      r.text('striking blind risks feeding it', x + 60, y + 122, { size: 10, color: P.paleDim });
    }

    let ly = y + 158;
    r.text('GRAFTS', x + 14, ly, { size: 11, color: P.paleDim });
    ly += 18;
    if (!focus.grafts.length) {
      r.text('none', x + 24, ly, { size: 12, color: P.wood });
    } else {
      for (const g of focus.grafts) {
        const mine = g.bySide === 'party';
        const label = known ? `${g.name}  matures in ${g.maturity}` : `${g.name}  ?`;
        r.text(`${mine ? '+' : '-'} ${label}`, x + 24, ly,
          { size: 12, color: mine ? P.sap : P.ember });
        ly += 17;
      }
    }
    if (focus.scars > 0) {
      r.text(`SCARS  ${'/'.repeat(focus.scars)}  max HP ${focus.maxHp}`,
        x + 14, y + h - 16, { size: 11, color: P.scar });
    }
  }

  #drawParty(r) {
    const y = 282;
    r.line(0, y - 4, r.W, y - 4, P.bark, 2);
    this.battle.party.forEach((c, i) => {
      const x = 16 + i * 176;
      const active = c === this.actor;
      const targeted = this.state === 'target' && this.targets?.[this.targetIndex] === c;
      const w = 168;
      r.panel(x, y, w, 84, {
        fill: active ? P.barkLit : P.bark,
        border: targeted ? P.sunwood : active ? P.woodLit : P.wood,
      });
      drawCrossSection(r, c, x + 30, y + 42, 20, { compact: true, t: this.t });
      r.text(c.name, x + 60, y + 24, {
        size: 14, color: isAlive(c) ? P.pale : P.scar, weight: 700,
      });
      r.text(c.role, x + 60, y + 38, { size: 9, color: P.paleDim });
      drawBar(r, x + 60, y + 48, 94, 8, c.hp / c.maxHp, isAlive(c) ? P.sap : P.scar);
      r.text(`${c.hp}/${c.maxHp}`, x + 60, y + 70, { size: 10, color: P.paleDim });
      if (c.guarding) r.text('BEARING', x + 118, y + 70, { size: 9, color: P.sunwood });
      if (c.scars) r.text('/'.repeat(c.scars), x + 152 - c.scars * 5, y + 24, { size: 11, color: P.scar });
    });

    // shared sap pool
    const sx = 740;
    r.text('SAP', sx, y + 24, { size: 12, color: P.paleDim });
    for (let i = 0; i < this.battle.maxSap; i++) {
      const filled = i < this.battle.sap;
      r.circle(sx + 34 + (i % 6) * 18, y + 20 + Math.floor(i / 6) * 18, 6,
        filled ? P.sunwood : P.wood, { stroke: !filled, lw: 1.5 });
    }
    r.text(`${this.battle.sap}/${this.battle.maxSap}  shared`, sx, y + 70,
      { size: 10, color: P.paleDim });
  }

  #drawMenu(r) {
    const x = 16;
    const y = 372;
    const w = 420;
    r.panel(x, y, w, 156);

    if (this.state === 'grain') {
      r.text('SING ALONG WHICH FIBRE?', x + 14, y + 24, { size: 12, color: P.sunwood });
      GRAIN_NAMES.forEach((name, i) => {
        const sel = i === this.grainChoice;
        const gx = x + 22 + i * 100;
        drawDial(r, gx + 26, y + 74, 20, i, false);
        r.text(name, gx + 26, y + 112, {
          size: 11, color: sel ? P.pale : P.paleDim, align: 'center', weight: sel ? 700 : 400,
        });
        if (sel) r.strokeRect(gx - 8, y + 46, 68, 78, P.sunwood, 2);
      });
      return;
    }

    if (this.state === 'graft') {
      r.text('HARVEST WHICH GRAFT?', x + 14, y + 24, { size: 12, color: P.sunwood });
      this.#myGrafts().forEach((ref, i) => {
        const sel = i === this.graftIndex;
        r.text(`${sel ? '>' : ' '} ${ref.graft.name} on ${ref.host.name} — ${ref.graft.maturity} to go`,
          x + 18, y + 54 + i * 22, { size: 12, color: sel ? P.pale : P.paleDim });
      });
      return;
    }

    const actor = this.actor;
    if (!actor || this.battle.over) return;

    this.actionIds.forEach((id, i) => {
      const action = getAction(id);
      const sel = i === this.menu && this.state !== 'foeturn';
      const blocked = this.battle.blockedReason(actor, id);
      const color = blocked ? P.wood : sel ? P.pale : P.paleDim;
      const ly = y + 26 + i * 20;
      if (sel) r.rect(x + 8, ly - 13, w - 16, 19, P.barkLit);
      r.text(`${sel ? '>' : ' '} ${action.name}`, x + 14, ly, { size: 13, color, weight: sel ? 700 : 400 });
      if (action.sap > 0) {
        const short = action.sap > this.battle.sap;
        r.text(short ? `${action.sap} sap — burn` : `${action.sap} sap`, x + w - 20, ly,
          { size: 11, color: short ? P.ember : P.sunwood, align: 'right' });
      }
    });

    const hint = getAction(this.currentActionId ?? 'strike');
    const lines = r.wrap(hint.desc, w - 28, 11);
    lines.slice(0, 2).forEach((line, i) => {
      r.text(line, x + 14, y + 130 + i * 15, { size: 11, color: P.shadeLit });
    });
  }

  #drawLog(r) {
    const x = 448;
    const y = 372;
    const w = r.W - x - 16;
    r.panel(x, y, w, 156, { grain: false });

    // Targeting preview: the one place the game teaches Grain.
    if (this.state === 'target') {
      const target = this.targets[this.targetIndex];
      const g = this.#previewGrain(target);
      r.text(`TARGET  ${target.name}`, x + 14, y + 24, { size: 12, color: P.sunwood, weight: 700 });
      if (g == null) {
        r.text('no force applied', x + 14, y + 46, { size: 11, color: P.paleDim });
      } else if (!target.revealed) {
        r.text('grain unread — outcome unknown', x + 14, y + 46, { size: 12, color: P.shadeLit });
        r.text('Read first, or accept the risk.', x + 14, y + 64, { size: 11, color: P.paleDim });
      } else {
        const rel = relation(g, target.grain);
        r.text(REL_LABEL[rel], x + 14, y + 46, { size: 12, color: REL_COLOR[rel], weight: 700 });
        r.text(`this hit turns its fibre to ${GRAIN_NAMES[(target.grain + 1) % 4]}`,
          x + 14, y + 66, { size: 10, color: P.paleDim });
        r.text(`across would be ${GRAIN_NAMES[acrossFrom(target.grain)]}`,
          x + 14, y + 82, { size: 10, color: P.wood });
      }
      r.text('arrows: switch target    enter: commit    x: back',
        x + 14, y + 140, { size: 10, color: P.wood });
      return;
    }

    this.log.slice(-6).forEach((entry, i) => {
      r.text(entry.text, x + 14, y + 26 + i * 19, { size: 11, color: entry.color });
    });
  }

  #drawOutcome(r) {
    r.save();
    r.alpha(0.82);
    r.rect(0, 0, r.W, r.H, P.void);
    r.restore();
    const victory = this.battle.outcome === 'victory';
    r.text(victory ? 'NO LONGER STRUCTURALLY VIABLE' : 'THE CIRCUIT IS DOWN',
      r.W / 2, r.H / 2 - 14, {
        size: 22, color: victory ? P.sunwood : P.scar, align: 'center', weight: 700,
      });
    r.text(victory
      ? 'You did not kill it. You rendered it unable to continue — the same judgement\nyou would apply to a sick Strider.'
      : 'Pell will get everyone upright. It will cost the circuit a week it does not have.',
      r.W / 2, r.H / 2 + 20, { size: 12, color: P.paleDim, align: 'center' });
    r.text('enter — continue', r.W / 2, r.H / 2 + 74, { size: 12, color: P.pale, align: 'center' });
  }
}

// --- shared drawing helpers -------------------------------------------------

/** Every combatant is a cross-section of wood: rings, a fibre direction, and scars.
 *  Grain position maps to 45 degrees of rotation, so "across the grain" is drawn
 *  exactly perpendicular to the fibre. The mechanic is legible without a tooltip. */
export function drawCrossSection(r, c, x, y, radius, {
  selected = false, active = false, compact = false, t = 0, previewGrain = null,
} = {}) {
  const alive = isAlive(c);
  const known = c.revealed;
  const rings = compact ? 4 : 7;

  r.save();
  if (!alive) r.alpha(0.35);

  r.circle(x, y, radius, P.bark);
  for (let i = rings; i > 0; i--) {
    const rad = radius * (i / rings);
    r.circle(x, y, rad, i % 2 ? P.barkLit : P.wood, { stroke: true, lw: 1.2 });
  }

  // fibre
  const angle = (known ? c.grain : 0) * (Math.PI / 4);
  const gc = known ? GRAIN_COLOR[c.grain] : P.shade;
  r.save();
  r.ctx.beginPath();
  r.ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
  r.ctx.clip();
  for (let o = -radius; o <= radius; o += compact ? 7 : 9) {
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    const nx = -Math.sin(angle) * o;
    const ny = Math.cos(angle) * o;
    r.line(x + nx - dx, y + ny - dy, x + nx + dx, y + ny + dy, gc, known ? 1.6 : 1);
  }
  r.restore();

  // preview: the direction force is about to come from
  if (previewGrain != null) {
    const pa = previewGrain * (Math.PI / 4) + Math.PI / 2;
    const pulse = 0.55 + 0.45 * Math.sin(t * 6);
    r.save();
    r.alpha(pulse);
    for (const s of [-1, 1]) {
      r.line(
        x + Math.cos(pa) * (radius + 6) * s, y + Math.sin(pa) * (radius + 6) * s,
        x + Math.cos(pa) * (radius + 20) * s, y + Math.sin(pa) * (radius + 20) * s,
        P.sunwood, 2.5,
      );
    }
    r.restore();
  }

  // scars: wedges cut out of the rings
  for (let i = 0; i < c.scars; i++) {
    const a = -0.6 + i * 0.9;
    r.poly([
      [x, y],
      [x + Math.cos(a) * radius, y + Math.sin(a) * radius],
      [x + Math.cos(a + 0.22) * radius, y + Math.sin(a + 0.22) * radius],
    ], P.scar);
  }

  r.circle(x, y, radius, selected ? P.sunwood : active ? P.woodLit : P.wood,
    { stroke: true, lw: selected ? 3 : 2 });
  r.restore();

  if (compact) return;

  // grafts orbit the rim, numbered by rounds remaining
  c.grafts.forEach((g, i) => {
    const a = -Math.PI / 2 + i * 0.7;
    const gx = x + Math.cos(a) * (radius + 16);
    const gy = y + Math.sin(a) * (radius + 16);
    const mine = g.bySide === 'party';
    r.circle(gx, gy, 9, mine ? P.sap : P.ember);
    r.text(known ? String(g.maturity) : '?', gx, gy + 4,
      { size: 11, color: P.deep, align: 'center', weight: 700 });
  });

  r.text(c.name, x, y + radius + 30, {
    size: 13, color: alive ? P.pale : P.scar, align: 'center', weight: 700,
  });
  drawBar(r, x - radius, y + radius + 38, radius * 2, 7, c.hp / c.maxHp, alive ? P.ember : P.scar);
  r.text(`${c.hp}/${c.maxHp}`, x, y + radius + 60, { size: 10, color: P.paleDim, align: 'center' });
  if (c.intentVisible && c.intent) {
    r.text(`intends: ${getAction(c.intent).name}`, x, y + radius + 76,
      { size: 10, color: P.shadeLit, align: 'center' });
  }
}

export function drawDial(r, x, y, radius, grain, locked) {
  r.circle(x, y, radius, P.deep);
  r.circle(x, y, radius, locked ? P.scar : P.wood, { stroke: true, lw: 2 });
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 4);
    const on = i === grain;
    r.line(
      x - Math.cos(a) * radius * 0.85, y - Math.sin(a) * radius * 0.85,
      x + Math.cos(a) * radius * 0.85, y + Math.sin(a) * radius * 0.85,
      on ? GRAIN_COLOR[i] : P.bark, on ? 3 : 1,
    );
  }
}

export function drawBar(r, x, y, w, h, ratio, color) {
  r.rect(x, y, w, h, P.void);
  r.rect(x, y, Math.max(0, Math.min(1, ratio)) * w, h, color);
  r.strokeRect(x, y, w, h, P.wood, 1);
}

function describe(e) {
  switch (e.type) {
    case 'act': return { text: `${e.who.name}: ${e.action.name}`, color: P.pale };
    case 'damage': {
      const tag = e.relation === RELATION.ACROSS ? '  ACROSS'
        : e.relation === RELATION.ALONG ? '  along — absorbed' : '';
      return { text: `  ${e.who.name} takes ${e.amount}${tag}`, color: REL_COLOR[e.relation] ?? P.pale };
    }
    case 'heal': return e.amount > 0
      ? { text: `  ${e.who.name} knits ${e.amount}`, color: P.sap } : null;
    case 'feed': return {
      text: e.sap ? `  force absorbed — party gains ${e.sap} Sap`
                  : `  ${e.who.name} absorbs the force and grows ${e.heal}`,
      color: e.sap ? P.sunwood : P.scar,
    };
    case 'scar': return { text: `  ${e.who.name} scars — fibre locked`, color: P.scar };
    case 'grainLocked': return { text: `  ${e.who.name}'s grain will not turn`, color: P.scar };
    case 'graft': return { text: `  ${e.graft.name} placed on ${e.host.name} (${e.graft.maturity})`, color: P.sap };
    case 'overgraft': return { text: `  ${e.host.name} is over-grafted — the stack slows`, color: P.ember };
    case 'mature': return { text: `${e.graft.name} matures on ${e.host.name}`, color: P.sunwood };
    case 'harvest': return { text: `  ${e.graft.name} harvested early`, color: P.paleDim };
    case 'excise': return { text: `  ${e.graft.name} excised from ${e.host.name}`, color: P.ember };
    case 'retime': return {
      text: `  ${e.graft.name} rewritten — ${e.dir < 0 ? 'sooner' : 'later'}`, color: P.shadeLit,
    };
    case 'reveal': return { text: `  ${e.who.name} read — grain exposed`, color: P.shadeLit };
    case 'forecast': return {
      text: `  forecast: ${e.who.name} intends ${e.action ? getAction(e.action).name : 'nothing'}`,
      color: P.shadeLit,
    };
    case 'guard': return { text: `  ${e.who.name} bears the round`, color: P.sunwood };
    case 'redirect': return { text: `  ${e.to.name} takes it instead of ${e.from.name}`, color: P.sunwood };
    case 'burn': return { text: `  heartwood burned — ${e.amount} HP for Sap`, color: P.scar };
    case 'down': return { text: `${e.who.name} is no longer viable`, color: P.scar };
    case 'revive': return { text: `${e.who.name} is back up`, color: P.sap };
    case 'round': return { text: `— round ${e.round} —`, color: P.wood };
    case 'message': return { text: `  ${e.text}`, color: P.paleDim };
    default: return null;
  }
}
