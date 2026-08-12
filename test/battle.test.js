import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/battle/battle.js';
import { makeCombatant } from '../src/game/battle/combatant.js';
import { GRAIN, relation, RELATION } from '../src/game/battle/grain.js';

const hero = (over = {}) => makeCombatant({
  id: 'hero', name: 'Hero', side: 'party', maxHp: 100, speed: 20, revealed: true,
  grain: GRAIN.RISING, actions: ['strike', 'cleave', 'wedge', 'knitwood', 'excise', 'harvest', 'veer', 'read'],
  ...over,
});
const dummy = (over = {}) => makeCombatant({
  id: 'dummy', name: 'Dummy', side: 'foe', maxHp: 200, speed: 1,
  grain: GRAIN.LATERAL, actions: ['lash'], ...over,
});

/** A battle where the party always acts first and the foe is a punching bag. */
function arena(partyOver = {}, foeOver = {}) {
  const a = hero(partyOver);
  const b = dummy(foeOver);
  return { battle: new Battle({ party: [a], foes: [b], seed: 5 }), a, b };
}

test('the fastest combatant opens, and the party shares one Sap pool', () => {
  const { battle, a } = arena();
  assert.equal(battle.current, a);
  assert.equal(battle.sap, battle.maxSap);
});

test('actions draw from the shared pool', () => {
  const { battle, a, b } = arena();
  const before = battle.sap;
  battle.perform(a, 'read', { target: b });
  assert.equal(battle.sap, before - 2);
});

test('across-grain force hits far harder than along-grain force', () => {
  // Compacted force against a Lateral fibre is across it; against Compacted, along it.
  const across = arena({ grain: GRAIN.RISING }, { grain: GRAIN.LATERAL });
  const along = arena({ grain: GRAIN.RISING }, { grain: GRAIN.COMPACTED });
  across.battle.perform(across.a, 'cleave', { target: across.b });
  along.battle.perform(along.a, 'cleave', { target: along.b });

  const acrossDone = across.b.maxHp - across.b.hp;
  const alongDone = along.b.maxHp - along.b.hp;
  assert.ok(acrossDone > alongDone * 3, `across ${acrossDone} vs along ${alongDone}`);
});

test('force along the fibre is absorbed as growth by a hostile target', () => {
  const { battle, a, b } = arena({}, { grain: GRAIN.COMPACTED });
  b.hp = 100;
  const events = battle.perform(a, 'cleave', { target: b });
  const feed = events.find((e) => e.type === 'feed');
  assert.ok(feed, 'expected the target to absorb the force');
  assert.ok(feed.heal > 0);
});

test('any connecting hit turns the fibre, which destroys the weakness it exploited', () => {
  const { battle, a, b } = arena({}, { grain: GRAIN.LATERAL });
  const grainBefore = b.grain;
  const actionGrain = GRAIN.COMPACTED;   // cleave
  assert.equal(relation(actionGrain, grainBefore), RELATION.ACROSS);
  battle.perform(a, 'cleave', { target: b });
  assert.notEqual(b.grain, grainBefore);
  assert.notEqual(relation(actionGrain, b.grain), RELATION.ACROSS);
});

test('a scar locks the fibre so it can no longer be turned', () => {
  const { battle, a, b } = arena({}, { maxHp: 40 });
  const events = battle.perform(a, 'cleave', { target: b });
  assert.ok(events.some((e) => e.type === 'scar'), 'a large hit should scar');
  assert.equal(b.scars, 1);
  assert.ok(b.maxHp < b.baseMaxHp, 'a scar costs maximum capacity');

  const grainAfterScar = b.grain;
  const next = battle.perform(a, 'strike', { target: b });
  assert.ok(next.some((e) => e.type === 'grainLocked'));
  assert.equal(b.grain, grainAfterScar, 'a scarred fibre does not turn');
});

test('grafts do nothing until they mature', () => {
  const { battle, a, b } = arena();
  battle.perform(a, 'wedge', { target: b });          // maturity 1
  assert.equal(b.grafts.length, 1);
  const hpAfterPlacing = b.hp;
  assert.equal(hpAfterPlacing, b.maxHp, 'placing a graft deals no damage');

  const events = battle.endRound();
  assert.ok(events.some((e) => e.type === 'mature'));
  assert.equal(b.grafts.length, 0);
  assert.ok(b.hp < hpAfterPlacing, 'the matured graft finally lands');
});

test('harvesting early cashes out for less than maturing', () => {
  const matured = arena();
  matured.a.hp = 10;
  matured.battle.perform(matured.a, 'knitwood', { target: matured.a });
  matured.battle.endRound();
  matured.battle.endRound();
  const fullHeal = matured.a.hp - 10;

  const early = arena();
  early.a.hp = 10;
  early.battle.perform(early.a, 'knitwood', { target: early.a });
  const ref = { graft: early.a.grafts[0], host: early.a };
  early.battle.perform(early.a, 'harvest', { target: early.a, graftRef: ref });
  const partialHeal = early.a.hp - 10;

  assert.ok(partialHeal > 0, 'harvesting pays something');
  assert.ok(partialHeal < fullHeal, `harvest ${partialHeal} should be under mature ${fullHeal}`);
  assert.equal(early.a.grafts.length, 0, 'harvesting consumes the graft');
});

test('excise destroys an opponent graft outright', () => {
  const { battle, a, b } = arena();
  b.grafts.push({
    uid: 'g1', name: 'Bloom', maturity: 3, mature: { heal: 30 }, harvest: { heal: 5 },
    byUid: b.uid, bySide: 'foe',
  });
  const events = battle.perform(a, 'excise', { target: b });
  assert.ok(events.some((e) => e.type === 'excise'));
  assert.equal(b.grafts.length, 0);
});

test('excise cannot cut out your own side’s work', () => {
  const { battle, a } = arena();
  battle.perform(a, 'knitwood', { target: a });
  const events = battle.perform(a, 'excise', { target: a });
  assert.ok(events.some((e) => e.type === 'message'));
  assert.equal(a.grafts.length, 1);
});

test('over-grafting one host slows the whole stack', () => {
  const { battle, a, b } = arena();
  battle.perform(a, 'wedge', { target: b });
  battle.perform(a, 'wedge', { target: b });
  const events = battle.perform(a, 'wedge', { target: b });
  assert.ok(events.some((e) => e.type === 'overgraft'));
  assert.equal(b.grafts.at(-1).maturity, 2, 'the third graft takes an extra round');
});

test('veer turns a fibre without striking it', () => {
  const { battle, a, b } = arena();
  const before = b.grain;
  const events = battle.perform(a, 'veer', { target: b });
  assert.equal(b.hp, b.maxHp, 'veer deals no damage');
  assert.ok(events.some((e) => e.type === 'rotate'));
  assert.notEqual(b.grain, before);
});

test('burning heartwood buys Sap with HP and leaves a scar', () => {
  const { battle, a, b } = arena();
  battle.sap = 0;
  const events = battle.perform(a, 'knitwood', { target: b });
  assert.ok(events.some((e) => e.type === 'burn'));
  assert.ok(a.hp < a.maxHp);
  assert.equal(a.scars, 1);
});

test('an action with no legal input is reported rather than silently eaten', () => {
  const { battle, a } = arena();
  assert.ok(battle.blockedReason(a, 'harvest'), 'harvest needs a graft of your own');
  battle.perform(a, 'knitwood', { target: a });
  assert.equal(battle.blockedReason(a, 'harvest'), null);
});

test('the encounter ends when a side is no longer viable', () => {
  const { battle, a, b } = arena({}, { maxHp: 12 });
  assert.equal(battle.outcome, null);
  const events = battle.perform(a, 'cleave', { target: b });
  assert.ok(events.some((e) => e.type === 'outcome'));
  assert.equal(battle.outcome, 'victory');
});

test('turn order skips the fallen and wraps into a new round', () => {
  const party = [hero({ id: 'p1', name: 'P1', speed: 30 }), hero({ id: 'p2', name: 'P2', speed: 5 })];
  const foes = [dummy({ speed: 20 })];
  const battle = new Battle({ party, foes, seed: 3 });
  assert.equal(battle.current.name, 'P1');
  party[1].hp = 0;                       // P2 is down and must be skipped
  battle.advance();
  assert.equal(battle.current, foes[0]);
  battle.advance();
  assert.equal(battle.round, 2, 'wrapping the order ends the round');
  assert.equal(battle.current.name, 'P1');
});

test('Sap regenerates between rounds but never past the cap', () => {
  const { battle } = arena();
  battle.sap = 1;
  battle.endRound();
  assert.equal(battle.sap, 1 + battle.sapRegen);
  battle.sap = battle.maxSap;
  battle.endRound();
  assert.equal(battle.sap, battle.maxSap);
});

test('a forecast reports the action the foe actually takes', () => {
  const { battle, a, b } = arena();
  battle.perform(a, 'read', { target: b });
  const intent = b.intent;
  battle.advance();
  assert.equal(battle.current, b);
  const events = battle.takeFoeTurn();
  const act = events.find((e) => e.type === 'act');
  assert.equal(act.action.id, intent, 'the pre-rolled intent is what gets used');
});
