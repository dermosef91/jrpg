import test from 'node:test';
import assert from 'node:assert/strict';
import { RITES, OPPOSED, resonance, RESONANCE, DISCORD, getRite } from '../src/game/data/rites.js';
import { AFFINITY } from '../src/engine/palette.js';

test('opposition is a perfect pairing with no fixed points', () => {
  const ids = Object.keys(AFFINITY);
  for (const id of ids) {
    const other = OPPOSED[id];
    assert.ok(other, `${id} has no opposite`);
    assert.notEqual(other, id, `${id} opposes itself`);
    assert.equal(OPPOSED[other], id, `${id}/${other} is not symmetric`);
  }
});

test('striking the opposing affinity resonates, matching it is dull', () => {
  assert.equal(resonance('EMBER', 'HOLLOW').mult, RESONANCE);
  assert.equal(resonance('EMBER', 'HOLLOW').kind, 'resonant');
  assert.equal(resonance('EMBER', 'EMBER').mult, DISCORD);
  assert.equal(resonance('EMBER', 'ROOT').mult, 1);
  assert.equal(resonance(null, 'ROOT').mult, 1);
});

test('resonance is worth more than three times a discordant hit', () => {
  assert.ok(RESONANCE / DISCORD > 3, 'the choice has to actually matter');
});

test('every rite is well formed and does something', () => {
  for (const [id, rite] of Object.entries(RITES)) {
    assert.equal(rite.id, id, `${id} has a mismatched id`);
    assert.ok(rite.name.length, `${id} has no name`);
    assert.ok(rite.ep > 0, `${id} is free, which breaks EP as a resource`);
    assert.ok(AFFINITY[rite.affinity], `${id} has an unknown affinity`);
    assert.ok(rite.desc?.length > 20, `${id} needs a real description`);
    assert.ok(rite.power || rite.heal || rite.buff, `${id} has no effect`);
  }
});

test('getRite fails loudly on an unknown id', () => {
  assert.throws(() => getRite('nope'), /unknown rite/);
});
