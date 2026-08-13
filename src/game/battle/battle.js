import { getRite, resonance } from '../data/rites.js';
import { getFoe } from '../data/foes.js';
import { getItem } from '../data/items.js';
import { effectiveStats, strikeAffinity, getEquipment } from '../data/equipment.js';
import { makeRng } from '../../engine/rng.js';

// The battle engine. Pure with respect to rendering: every method returns a list
// of events that the scene animates, logs and plays sound for.
//
// Turn order is by AGI and visible in the queue, so a player can plan around it.
// Damage is deliberately legible: power x stat, minus a defence share, times the
// resonance multiplier. No hidden variance beyond a small jitter.

let uid = 1;

export function makeCombatant(spec) {
  return { uid: `c${uid++}`, ...spec };
}

export function foeUnit(id, suffix = '') {
  const spec = getFoe(id);
  return makeCombatant({
    id: spec.id, name: spec.name + suffix, side: 'foe', art: spec.art,
    affinity: spec.affinity, boss: !!spec.boss, note: spec.note,
    maxHp: spec.hp, hp: spec.hp, maxEp: 0, ep: 0,
    stats: { str: spec.str, agi: spec.agi, def: spec.def, mag: spec.mag, res: spec.res, lck: 8 },
    actions: spec.actions, exp: spec.exp, shards: spec.shards,
    buffs: [], guarding: false, status: null,
  });
}

export function heroUnit(character) {
  const stats = effectiveStats(character);
  return makeCombatant({
    id: character.id, name: character.name, side: 'party', ref: character,
    cls: character.cls, affinity: character.affinity, figure: character.figure,
    maxHp: stats.hp, hp: Math.min(character.hp ?? stats.hp, stats.hp),
    maxEp: stats.ep, ep: Math.min(character.ep ?? stats.ep, stats.ep),
    stats, rites: character.rites, buffs: [], guarding: false, status: null,
  });
}

export const isAlive = (u) => u.hp > 0;

/** Stat after buffs. */
export function stat(unit, key) {
  let value = unit.stats[key] ?? 0;
  for (const b of unit.buffs) if (b[key]) value += b[key];
  return Math.max(1, value);
}

export class Battle {
  constructor({ party, foes, seed = 1, title = 'ENCOUNTER' }) {
    this.party = party;
    this.foes = foes;
    this.title = title;
    this.rng = makeRng(seed);
    this.round = 1;
    this.outcome = null;
    this.turnIndex = 0;
    this.rebuildOrder();
  }

  get all() { return [...this.party, ...this.foes]; }
  get current() { return this.order[this.turnIndex] ?? null; }
  get over() { return this.outcome !== null; }

  rebuildOrder() {
    this.order = this.all
      .map((u, i) => ({ u, i }))
      .sort((a, b) => stat(b.u, 'agi') - stat(a.u, 'agi') || a.i - b.i)
      .map(({ u }) => u);
  }

  /** The next `count` units to act, for the on-screen turn queue. */
  upcoming(count = 6) {
    const out = [];
    let i = this.turnIndex;
    let guard = 0;
    while (out.length < count && guard++ < 64) {
      const unit = this.order[i % this.order.length];
      if (isAlive(unit)) out.push(unit);
      i++;
    }
    return out;
  }

  targetsFor(actor, spec) {
    const living = this.all.filter(isAlive);
    switch (spec) {
      case 'self': return [actor];
      case 'ally': return actor.side === 'party' ? this.party : this.foes;
      case 'allAllies': return (actor.side === 'party' ? this.party : this.foes).filter(isAlive);
      case 'allFoes': return living.filter((u) => u.side !== actor.side);
      case 'foe':
      default: return living.filter((u) => u.side !== actor.side);
    }
  }

  // --- actions -------------------------------------------------------------

  attack(actor, target) {
    const events = [];
    const affinity = actor.side === 'party' && actor.ref ? strikeAffinity(actor.ref) : actor.affinity;
    const weapon = actor.ref ? getEquipment(actor.ref.equipment?.weapon) : null;
    events.push({ type: 'act', actor, label: weapon ? weapon.name : 'STRIKE', kind: 'attack' });
    this.#land(actor, target, {
      power: 26, statKey: 'str', affinity, events,
    });
    this.#checkOutcome(events);
    return events;
  }

  useRite(actor, riteId, target) {
    const rite = getRite(riteId);
    const events = [];
    if (actor.ep < rite.ep) {
      events.push({ type: 'message', text: 'NOT ENOUGH EMBER' });
      return events;
    }
    actor.ep -= rite.ep;
    events.push({ type: 'act', actor, label: rite.name, kind: 'rite', affinity: rite.affinity });
    events.push({ type: 'ep', unit: actor, amount: -rite.ep });

    const targets = rite.target === 'allFoes' || rite.target === 'allAllies'
      ? this.targetsFor(actor, rite.target)
      : [target ?? actor];

    for (const t of targets) {
      if (rite.heal) this.#heal(t, rite.heal + stat(actor, 'mag'), events);
      if (rite.buff) this.#applyBuff(t, rite.buff, events);
      if (rite.power) {
        const dealt = this.#land(actor, t, {
          power: rite.power, statKey: rite.stat ?? 'mag', affinity: rite.affinity,
          pierce: rite.pierce, events,
        });
        if (rite.drain && dealt > 0) {
          const back = Math.round(dealt * rite.drain);
          actor.ep = Math.min(actor.maxEp, actor.ep + back);
          events.push({ type: 'ep', unit: actor, amount: back, drain: true });
        }
      }
      if (rite.status) {
        t.status = rite.status;
        events.push({ type: 'status', unit: t, status: rite.status });
      }
    }
    this.#checkOutcome(events);
    return events;
  }

  useItem(actor, itemId, target) {
    const item = getItem(itemId);
    const events = [];
    if (!item) return events;
    events.push({ type: 'act', actor, label: item.name, kind: 'item' });
    const targets = item.target === 'allAllies' ? this.targetsFor(actor, 'allAllies') : [target ?? actor];
    for (const t of targets) {
      if (item.revive && !isAlive(t)) {
        t.hp = Math.max(1, Math.round(t.maxHp * item.revive));
        events.push({ type: 'revive', unit: t });
      } else if (item.heal && isAlive(t)) {
        this.#heal(t, item.heal, events);
      }
      if (item.ep && isAlive(t)) {
        const before = t.ep;
        t.ep = Math.min(t.maxEp, t.ep + item.ep);
        events.push({ type: 'ep', unit: t, amount: t.ep - before });
      }
    }
    this.#checkOutcome(events);
    return events;
  }

  guard(actor) {
    actor.guarding = true;
    const back = Math.round(actor.maxEp * 0.15);
    actor.ep = Math.min(actor.maxEp, actor.ep + back);
    return [
      { type: 'act', actor, label: 'GUARD', kind: 'guard' },
      { type: 'guard', unit: actor },
      ...(back > 0 ? [{ type: 'ep', unit: actor, amount: back }] : []),
    ];
  }

  /** Foe AI: pick a usable action, favour whoever is closest to falling. */
  takeFoeTurn() {
    const foe = this.current;
    const events = [];
    if (!foe || foe.side !== 'foe' || !foe.actions?.length) return events;
    const action = this.rng.pick(foe.actions);
    events.push({ type: 'act', actor: foe, label: action.name, kind: action.kind, affinity: action.affinity });

    if (action.kind === 'buff') {
      this.#applyBuff(foe, action.buff, events);
      this.#checkOutcome(events);
      return events;
    }

    const pool = this.party.filter(isAlive);
    if (!pool.length) { this.#checkOutcome(events); return events; }
    const targets = action.all
      ? pool
      : [pool.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]];

    for (const t of targets) {
      const hits = action.hits ?? 1;
      for (let i = 0; i < hits; i++) {
        this.#land(foe, t, {
          power: action.power,
          statKey: action.kind === 'rite' ? 'mag' : 'str',
          affinity: action.affinity ?? foe.affinity,
          pierce: action.pierce, events,
        });
      }
    }
    this.#checkOutcome(events);
    return events;
  }

  // --- resolution ----------------------------------------------------------

  #land(actor, target, { power, statKey, affinity, pierce = false, events }) {
    if (!isAlive(target)) return 0;
    const offence = stat(actor, statKey);
    const defKey = statKey === 'mag' ? 'res' : 'def';
    const defence = pierce ? 0 : stat(target, defKey);
    const res = resonance(affinity, target.affinity);

    // Defence mitigates as a ratio rather than a flat subtraction. Subtracting
    // let a stacked-DEF character clamp every incoming hit to 1, which made
    // guarding, resonance and buffs all meaningless against them.
    const raw = power * (0.6 + offence / 40);
    const mitigation = 100 / (100 + defence * 1.6);
    const jitter = this.rng.range(0.94, 1.06);
    let amount = Math.max(1, Math.round(raw * mitigation * res.mult * jitter));
    if (target.guarding) amount = Math.max(1, Math.round(amount * 0.5));

    target.hp = Math.max(0, target.hp - amount);
    events.push({
      type: 'damage', unit: target, amount, resonance: res.kind,
      affinity, guarded: target.guarding,
    });
    if (target.hp === 0) events.push({ type: 'down', unit: target });
    return amount;
  }

  #heal(target, amount, events) {
    if (!isAlive(target)) return;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    events.push({ type: 'heal', unit: target, amount: target.hp - before });
  }

  #applyBuff(target, buff, events) {
    const applied = { ...buff, turns: buff.turns ?? 3 };
    target.buffs.push(applied);
    events.push({ type: 'buff', unit: target, buff: applied });
  }

  // --- flow ----------------------------------------------------------------

  advance() {
    const events = [];
    if (this.over) return events;
    for (let guard = 0; guard <= this.order.length * 2; guard++) {
      this.turnIndex += 1;
      if (this.turnIndex >= this.order.length) {
        this.turnIndex = 0;
        events.push(...this.endRound());
        if (this.over) return events;
      }
      if (isAlive(this.current)) return events;
    }
    return events;
  }

  endRound() {
    const events = [];
    for (const u of this.all) {
      u.guarding = false;
      for (let i = u.buffs.length - 1; i >= 0; i--) {
        u.buffs[i].turns -= 1;
        if (u.buffs[i].turns <= 0) {
          events.push({ type: 'buffEnd', unit: u, buff: u.buffs[i] });
          u.buffs.splice(i, 1);
        }
      }
      if (u.status === 'rooted' && isAlive(u)) {
        const bleed = Math.max(1, Math.round(u.maxHp * 0.04));
        u.hp = Math.max(0, u.hp - bleed);
        events.push({ type: 'damage', unit: u, amount: bleed, resonance: 'flat', status: true });
        if (u.hp === 0) events.push({ type: 'down', unit: u });
      }
    }
    this.round += 1;
    events.push({ type: 'round', round: this.round });
    this.#checkOutcome(events);
    return events;
  }

  #checkOutcome(events) {
    if (this.outcome) return;
    if (!this.foes.some(isAlive)) {
      this.outcome = 'victory';
      events.push({ type: 'outcome', outcome: 'victory', spoils: this.spoils() });
    } else if (!this.party.some(isAlive)) {
      this.outcome = 'defeat';
      events.push({ type: 'outcome', outcome: 'defeat' });
    }
  }

  spoils() {
    const shards = {};
    let exp = 0;
    for (const foe of this.foes) {
      exp += foe.exp ?? 0;
      for (const [id, n] of Object.entries(foe.shards ?? {})) {
        shards[id] = (shards[id] ?? 0) + n;
      }
    }
    return { exp, shards };
  }
}
