import { getAction } from './actions.js';
import { isAlive, grainLocked } from './combatant.js';
import { relation, multiplier, feedsTarget, rotate, RELATION } from './grain.js';
import { makeRng } from '../../engine/rng.js';

const SCAR_DAMAGE_FRACTION = 0.22;  // a hit this large relative to max HP scars
const SCAR_MAXHP_PENALTY = 0.08;    // each scar costs this much of base max HP
const BURN_HP_PER_SAP = 6;          // Burn Heartwood exchange rate
const FEED_SAP = 2;                 // along-grain force absorbed by a party target
const FEED_HEAL = 9;                // ...or by a hostile one

/** The Grafting battle engine. Pure with respect to rendering: every method
 *  returns a list of events for the scene layer to animate and log. */
export class Battle {
  constructor({ party, foes, seed = 1, maxSap = 12, sapRegen = 2 }) {
    this.party = party;
    this.foes = foes;
    this.rng = makeRng(seed);
    this.maxSap = maxSap;
    this.sap = maxSap;
    this.sapRegen = sapRegen;
    this.round = 1;
    this.outcome = null;

    // Stable order: fastest first, ties broken by original position.
    this.order = [...party, ...foes]
      .map((c, i) => ({ c, i }))
      .sort((a, b) => b.c.speed - a.c.speed || a.i - b.i)
      .map(({ c }) => c);
    this.turnIndex = 0;
    this.#rollIntents();
    if (!isAlive(this.current)) this.advance();
  }

  get all() { return [...this.party, ...this.foes]; }
  get current() { return this.order[this.turnIndex]; }
  get over() { return this.outcome !== null; }

  byUid(uid) { return this.all.find((c) => c.uid === uid) ?? null; }

  // --- queries --------------------------------------------------------------

  /** Valid targets for an action, given who is acting. */
  targetsFor(actor, actionId) {
    const action = getAction(actionId);
    const living = this.all.filter(isAlive);
    switch (action.target) {
      case 'self': return [actor];
      case 'foe': return living.filter((c) => c.side !== actor.side);
      case 'ally': return this.all.filter((c) => c.side === actor.side);
      case 'any': return this.all.filter((c) => isAlive(c) || c.side === actor.side);
      default: return living;
    }
  }

  affordable(actionId) { return this.sap >= getAction(actionId).sap; }

  /** Sap short? A character may pay in HP instead, and take a Scar for it. */
  burnCost(actionId) {
    const short = Math.max(0, getAction(actionId).sap - this.sap);
    return short * BURN_HP_PER_SAP;
  }

  /** Why an action cannot be taken right now, or null if it can. */
  blockedReason(actor, actionId) {
    const action = getAction(actionId);
    if (action.effect?.harvest && !this.#graftsPlacedBy(actor).length) {
      return 'no graft of yours is maturing';
    }
    if (action.sap > this.sap && this.burnCost(actionId) >= actor.hp) {
      return 'not enough Sap, and burning heartwood would fell you';
    }
    return null;
  }

  #graftsPlacedBy(actor) {
    return this.all.flatMap((c) => c.grafts.filter((g) => g.byUid === actor.uid)
      .map((g) => ({ graft: g, host: c })));
  }

  // --- acting ---------------------------------------------------------------

  /**
   * @param {object} opts.target   combatant
   * @param {number} opts.grain    chosen grain, for actions with grain: 'choose'
   * @param {object} opts.graftRef {graft, host} when harvesting
   */
  perform(actor, actionId, { target = null, grain = null, graftRef = null } = {}) {
    const action = getAction(actionId);
    const events = [];
    if (this.over || !isAlive(actor)) return events;

    // --- pay ---
    if (action.sap > this.sap) {
      const burn = this.burnCost(actionId);
      this.sap = 0;
      actor.hp = Math.max(1, actor.hp - burn);
      this.#scar(actor, events, 'burned heartwood');
      events.push({ type: 'burn', who: actor, amount: burn });
    } else {
      this.sap -= action.sap;
    }
    if (action.sap > 0) events.push({ type: 'sap', amount: -action.sap });

    const grainUsed = action.grain === 'choose' ? (grain ?? 0) : action.grain;
    events.push({ type: 'act', who: actor, action, target, grain: grainUsed });

    if (action.graft) this.#placeGraft(actor, target ?? actor, action, events);
    if (action.effect) this.#applyEffect(actor, target, action, grainUsed, graftRef, events);

    this.#checkOutcome(events);
    return events;
  }

  #placeGraft(actor, host, action, events) {
    const graft = {
      uid: `g${Math.floor(this.rng.next() * 1e9)}`,
      name: action.graft.name,
      maturity: action.graft.maturity,
      mature: action.graft.mature,
      harvest: action.graft.harvest,
      byUid: actor.uid,
      bySide: actor.side,
    };
    host.grafts.push(graft);
    // Over-grafting is how Marrow got sick: each extra graft on one host adds a
    // round of unreliability to the whole stack.
    if (host.grafts.length > 2) {
      graft.maturity += 1;
      events.push({ type: 'overgraft', host });
    }
    events.push({ type: 'graft', host, graft });
  }

  #applyEffect(actor, target, action, grainUsed, graftRef, events) {
    const fx = action.effect;
    const t = target ?? actor;

    if (fx.reveal) {
      t.revealed = true;
      events.push({ type: 'reveal', who: t });
    }
    if (fx.forecast) {
      t.intentVisible = true;
      events.push({ type: 'forecast', who: t, action: t.intent });
    }
    if (fx.guard) {
      actor.guarding = true;
      this.#scar(actor, events, 'bore the round');
      events.push({ type: 'guard', who: actor });
    }
    if (fx.excise) {
      const victim = t.grafts.findLast((g) => g.bySide !== actor.side);
      if (victim) {
        t.grafts.splice(t.grafts.indexOf(victim), 1);
        events.push({ type: 'excise', host: t, graft: victim });
      } else {
        events.push({ type: 'message', text: `${t.name} has nothing to excise.` });
      }
    }
    if (fx.harvest) {
      const ref = graftRef ?? this.#graftsPlacedBy(actor)[0];
      if (ref) {
        const { graft, host } = ref;
        host.grafts.splice(host.grafts.indexOf(graft), 1);
        events.push({ type: 'harvest', host, graft });
        this.#resolvePayload(actor, host, graft.harvest, events, { source: graft.name });
      }
    }
    if (fx.shiftMaturity) {
      // Allied grafts mature sooner; hostile ones are pushed further out.
      const dir = t.side === actor.side ? -1 : 1;
      const graft = t.grafts.at(-1);
      if (graft) {
        graft.maturity = Math.max(1, graft.maturity + dir);
        events.push({ type: 'retime', host: t, graft, dir });
      } else {
        events.push({ type: 'message', text: `${t.name} carries no graft to rewrite.` });
      }
    }
    if (fx.rotate && fx.noDamage) {
      this.#rotate(t, fx.rotate, events);
    }
    if (fx.damage != null) this.#strike(actor, t, action, grainUsed, events);
    if (fx.heal != null) this.#resolvePayload(actor, t, { heal: fx.heal }, events, { source: action.name });
  }

  #strike(actor, target, action, grainUsed, events) {
    const fx = action.effect;
    const rel = relation(grainUsed, target.grain);
    const mult = multiplier(grainUsed, target.grain);
    const jitter = this.rng.range(0.92, 1.08);
    let amount = Math.max(1, Math.round(fx.damage * actor.power * mult * jitter));

    // Force along the fibre is absorbed as growth rather than damage.
    if (feedsTarget(grainUsed, target.grain)) {
      if (target.side === 'party') {
        this.sap = Math.min(this.maxSap, this.sap + FEED_SAP);
        events.push({ type: 'feed', who: target, sap: FEED_SAP });
      } else {
        target.hp = Math.min(target.maxHp, target.hp + FEED_HEAL);
        events.push({ type: 'feed', who: target, heal: FEED_HEAL });
      }
    }

    const redirected = this.#guardFor(actor, target);
    const victim = redirected ?? target;
    if (redirected) {
      amount = Math.round(amount * 0.7);
      events.push({ type: 'redirect', from: target, to: redirected });
    }

    victim.hp = Math.max(0, victim.hp - amount);
    events.push({ type: 'damage', who: victim, amount, relation: rel, grain: grainUsed });

    if (fx.scar || amount >= victim.maxHp * SCAR_DAMAGE_FRACTION) {
      this.#scar(victim, events, 'struck deep');
    }
    // Any connecting force turns the fibre -- which is what destroys the weakness.
    this.#rotate(target, 1, events);
    if (victim.hp === 0) events.push({ type: 'down', who: victim });
  }

  #guardFor(actor, target) {
    if (target.side === actor.side) return null;
    const guard = this.all.find(
      (c) => c.guarding && c.side === target.side && c !== target && isAlive(c),
    );
    return guard ?? null;
  }

  #resolvePayload(actor, target, payload, events, { source = '' } = {}) {
    if (payload.heal != null) {
      const before = target.hp;
      const wasDown = before === 0;
      target.hp = Math.min(target.maxHp, target.hp + payload.heal);
      events.push({ type: 'heal', who: target, amount: target.hp - before, source });
      if (wasDown && target.hp > 0) events.push({ type: 'revive', who: target });
    }
    if (payload.damage != null) {
      const amount = Math.max(1, Math.round(payload.damage * (actor?.power ?? 1)));
      target.hp = Math.max(0, target.hp - amount);
      events.push({ type: 'damage', who: target, amount, relation: RELATION.OBLIQUE, source });
      if (payload.scar) this.#scar(target, events, source);
      if (target.hp === 0) events.push({ type: 'down', who: target });
    }
  }

  #scar(target, events, reason = '') {
    target.scars += 1;
    target.maxHp = Math.max(
      1, Math.round(target.baseMaxHp * (1 - SCAR_MAXHP_PENALTY * target.scars)),
    );
    target.hp = Math.min(target.hp, target.maxHp);
    events.push({ type: 'scar', who: target, scars: target.scars, reason });
  }

  #rotate(target, steps, events) {
    if (grainLocked(target)) {
      events.push({ type: 'grainLocked', who: target });
      return;
    }
    target.grain = rotate(target.grain, steps);
    events.push({ type: 'rotate', who: target, grain: target.grain, steps });
  }

  // --- turn / round flow ----------------------------------------------------

  /** Advance to the next living combatant, ending the round when the order wraps. */
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
    for (const c of this.all) {
      c.guarding = false;
      for (const graft of [...c.grafts]) {
        graft.maturity -= 1;
        if (graft.maturity > 0) continue;
        c.grafts.splice(c.grafts.indexOf(graft), 1);
        events.push({ type: 'mature', host: c, graft });
        const placer = this.byUid(graft.byUid);
        this.#resolvePayload(placer, c, graft.mature, events, { source: graft.name });
      }
    }
    const before = this.sap;
    this.sap = Math.min(this.maxSap, this.sap + this.sapRegen);
    if (this.sap !== before) events.push({ type: 'sap', amount: this.sap - before });

    this.round += 1;
    this.#rollIntents();
    events.push({ type: 'round', round: this.round });
    this.#checkOutcome(events);
    return events;
  }

  #rollIntents() {
    for (const foe of this.foes) {
      if (isAlive(foe)) foe.intent = this.#chooseIntent(foe);
    }
  }

  #chooseIntent(foe) {
    const usable = foe.actions.filter((id) => {
      const action = getAction(id);
      if (action.effect?.excise) {
        return this.party.some((p) => p.grafts.some((g) => g.bySide === 'party'));
      }
      if (action.graft) return foe.grafts.length < 2;
      return true;
    });
    return this.rng.pick(usable.length ? usable : ['strike']);
  }

  /** Foe turn: use the pre-rolled intent so Forecast is honest about it. */
  takeFoeTurn() {
    const foe = this.current;
    const actionId = foe.intent ?? this.#chooseIntent(foe);
    const action = getAction(actionId);
    const pool = this.targetsFor(foe, actionId).filter((c) => isAlive(c) || action.target === 'ally');
    // Prefer whoever is closest to falling; this reads as competent, not cruel.
    const target = action.target === 'self' || action.target === 'ally'
      ? foe
      : pool.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    foe.intentVisible = false;
    return this.perform(foe, actionId, { target: target ?? foe, grain: action.grain ?? 0 });
  }

  #checkOutcome(events) {
    if (this.outcome) return;
    if (!this.foes.some(isAlive)) {
      this.outcome = 'victory';
      events.push({ type: 'outcome', outcome: 'victory' });
    } else if (!this.party.some(isAlive)) {
      this.outcome = 'defeat';
      events.push({ type: 'outcome', outcome: 'defeat' });
    }
  }
}
