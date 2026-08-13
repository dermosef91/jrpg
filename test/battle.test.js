import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, foeUnit, heroUnit, isAlive, stat } from '../src/game/battle/battle.js';
import { makeParty } from '../src/game/data/party.js';
import { RESONANCE } from '../src/game/data/rites.js';

function arena({ foeIds = ['crawler'], partyIds = ['zahra', 'kofi', 'aya'] } = {}) {
  const roster = makeParty();
  const party = partyIds.map((id) => heroUnit(roster.find((c) => c.id === id)));
  const foes = foeIds.map((id, i) => foeUnit(id, ` ${i}`));
  return { battle: new Battle({ party, foes, seed: 11 }), party, foes };
}

test('turn order is by AGI and the queue previews it', () => {
  const { battle } = arena();
  const agis = battle.order.map((u) => stat(u, 'agi'));
  for (let i = 1; i < agis.length; i++) {
    assert.ok(agis[i] <= agis[i - 1], 'order is not sorted by AGI');
  }
  const queue = battle.upcoming(4);
  assert.equal(queue.length, 4);
  assert.equal(queue[0], battle.current, 'the queue must start with whoever is acting');
});

test('an attack takes HP off the target and nothing else', () => {
  const { battle, party, foes } = arena();
  const before = foes[0].hp;
  const events = battle.attack(party[0], foes[0]);
  assert.ok(foes[0].hp < before);
  assert.ok(events.some((e) => e.type === 'damage'));
  assert.equal(party[0].hp, party[0].maxHp, 'attacking must not cost the attacker HP');
});

// The central mechanic: opposition beats matching, by a lot.
test('striking the opposing affinity does far more than matching it', () => {
  const opposed = arena({ foeIds: ['crawler'] });   // HOLLOW foe
  const matched = arena({ foeIds: ['choir'] });     // EMBER foe
  const zahraA = opposed.party[0];
  const zahraB = matched.party[0];
  opposed.battle.useRite(zahraA, 'emberlash', opposed.foes[0]);
  matched.battle.useRite(zahraB, 'emberlash', matched.foes[0]);
  const dealtOpposed = opposed.foes[0].maxHp - opposed.foes[0].hp;
  const dealtMatched = matched.foes[0].maxHp - matched.foes[0].hp;
  assert.ok(dealtOpposed > dealtMatched * 2,
    `resonant ${dealtOpposed} should dwarf discordant ${dealtMatched}`);
});

test('rites cost EP and are refused when the ember runs out', () => {
  const { battle, party, foes } = arena();
  const zahra = party[0];
  const before = zahra.ep;
  battle.useRite(zahra, 'emberlash', foes[0]);
  assert.equal(zahra.ep, before - 8);
  zahra.ep = 0;
  const hp = foes[0].hp;
  const events = battle.useRite(zahra, 'emberlash', foes[0]);
  assert.ok(events.some((e) => e.type === 'message'), 'should refuse, not silently fire');
  assert.equal(foes[0].hp, hp, 'a refused rite must not deal damage');
});

test('a draining rite gives ember back', () => {
  const { battle, party, foes } = arena();
  const aya = party[2];
  aya.ep = 60;
  battle.useRite(aya, 'hollowing', foes[0]);
  const events = battle.useRite(aya, 'hollowing', foes[0]);
  assert.ok(events.some((e) => e.type === 'ep' && e.drain));
});

test('healing tops out at max and never revives the fallen', () => {
  const { battle, party } = arena();
  const kofi = party[1];
  kofi.hp = 10;
  battle.useRite(party[2], 'mendsong', kofi);
  assert.ok(kofi.hp > 10);
  assert.ok(kofi.hp <= kofi.maxHp);
  kofi.hp = 0;
  battle.useRite(party[2], 'mendsong', kofi);
  assert.equal(kofi.hp, 0, 'a rite that heals must not double as a revive');
});

test('guarding halves the next hit and returns ember', () => {
  const plain = arena();
  const guarded = arena();
  const targetA = plain.party[1];
  const targetB = guarded.party[1];
  targetB.ep = 0;
  const epBefore = targetB.ep;
  guarded.battle.guard(targetB);
  assert.ok(targetB.ep > epBefore, 'guarding should recover ember');
  plain.battle.attack(plain.foes[0], targetA);
  guarded.battle.attack(guarded.foes[0], targetB);
  const plainDealt = targetA.maxHp - targetA.hp;
  const guardedDealt = targetB.maxHp - targetB.hp;
  assert.ok(guardedDealt < plainDealt, `guard ${guardedDealt} should be under ${plainDealt}`);
});

test('buffs raise a stat and expire on schedule', () => {
  const { battle, party } = arena();
  const kofi = party[1];
  const before = stat(kofi, 'def');
  battle.useRite(kofi, 'ironbark', kofi);
  assert.ok(stat(kofi, 'def') > before);
  for (let i = 0; i < 3; i++) battle.endRound();
  assert.equal(stat(kofi, 'def'), before, 'the buff should have run out');
});

test('a battle ends when one side is gone, and victory pays out', () => {
  const { battle, party, foes } = arena();
  assert.equal(battle.outcome, null);
  foes[0].hp = 1;
  const events = battle.attack(party[0], foes[0]);
  assert.ok(events.some((e) => e.type === 'outcome'));
  assert.equal(battle.outcome, 'victory');
  const spoils = battle.spoils();
  assert.ok(spoils.exp > 0);
  assert.ok(Object.keys(spoils.shards).length > 0);
});

test('defeat is detected when the whole line falls', () => {
  const { battle, party, foes } = arena();
  for (const p of party) p.hp = 1;
  for (const p of party.slice(1)) p.hp = 0;
  const events = battle.attack(foes[0], party[0]);
  assert.ok(events.some((e) => e.type === 'outcome' && e.outcome === 'defeat'));
});

test('turn advance skips the fallen and wraps into a new round', () => {
  const { battle } = arena({ foeIds: ['crawler'] });
  const startRound = battle.round;
  const total = battle.order.length;
  battle.order[1].hp = 0;
  for (let i = 0; i < total; i++) battle.advance();
  assert.ok(battle.round > startRound, 'wrapping the order must end the round');
  assert.ok(isAlive(battle.current), 'a fallen unit must never get a turn');
});

test('a foe turn always resolves to something', () => {
  const { battle, foes } = arena();
  while (battle.current.side === 'party') battle.advance();
  const events = battle.takeFoeTurn();
  assert.ok(events.some((e) => e.type === 'act'));
});

test('rooted status bleeds each round', () => {
  const { battle, party, foes } = arena();
  battle.useRite(party[1], 'anchor', foes[0]);
  const hp = foes[0].hp;
  battle.endRound();
  assert.ok(foes[0].hp < hp, 'rooted should keep costing HP');
});
