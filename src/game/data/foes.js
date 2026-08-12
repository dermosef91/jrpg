import { makeCombatant } from '../battle/combatant.js';
import { GRAIN } from '../battle/grain.js';

// Nothing here is a monster. Encounters in the Braid are structural failures,
// runaway agriculture, and people with paperwork.

const FOES = {
  cankerbloom: {
    name: 'Cankerbloom', role: 'feral graft',
    maxHp: 74, speed: 9, power: 1.0, grain: GRAIN.LATERAL,
    actions: ['lash', 'bloom', 'settle'],
    note: 'A Splicer graft that kept going after the Splicer stopped paying attention.',
  },
  bailiff: {
    name: "Reeve's Bailiff", role: 'Anneal writ-server',
    maxHp: 92, speed: 11, power: 1.0, grain: GRAIN.RISING,
    actions: ['seize', 'writ', 'settle'],
    note: 'Serving an eviction on behalf of a council that is, on the numbers, correct.',
  },
  heartrot: {
    name: 'Heartrot', role: 'structural failure',
    maxHp: 138, speed: 5, power: 1.05, grain: GRAIN.TWISTED,
    actions: ['spread', 'lash', 'settle'],
    note: 'Not alive, exactly. The Strider is failing and this is what that looks like.',
  },
};

export function makeFoe(key, suffix = '') {
  const spec = FOES[key];
  if (!spec) throw new Error(`unknown foe: ${key}`);
  return makeCombatant({ ...spec, id: key, name: spec.name + suffix, side: 'foe' });
}

/** Encounter tables per region. Kept small and hand-authored. */
export const ENCOUNTERS = [
  { title: 'Feral growth in the understory', foes: ['cankerbloom'] },
  { title: 'A bloom, doubled', foes: ['cankerbloom', 'cankerbloom'] },
  { title: 'Served, on the Trace', foes: ['bailiff'] },
  { title: 'Rot in the root-crown', foes: ['heartrot'] },
  { title: 'Bailiff, with a bloom for company', foes: ['bailiff', 'cankerbloom'] },
];

export function rollEncounter(rng) {
  const spec = rng.pick(ENCOUNTERS);
  const counts = new Map();
  const foes = spec.foes.map((key) => {
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    const dupes = spec.foes.filter((k) => k === key).length;
    return makeFoe(key, dupes > 1 ? ` ${'ABCD'[n - 1]}` : '');
  });
  return { title: spec.title, foes };
}
