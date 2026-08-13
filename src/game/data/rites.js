// Rites: the magic of the galleries. Each borrows ember through an inscribed
// pattern, which is why they cost EP and carry an affinity.
//
// Affinities oppose in two pairs -- EMBER <-> HOLLOW and ROOT <-> BONE. Striking
// a target with the affinity that opposes it resonates, for a large bonus. There
// is no third state and no resistance table to memorise.

export const OPPOSED = Object.freeze({
  EMBER: 'HOLLOW', HOLLOW: 'EMBER', ROOT: 'BONE', BONE: 'ROOT',
});

export const RESONANCE = 1.8;
export const DISCORD = 0.55;

/** How an attack of `attacking` affinity lands on a `target` affinity. */
export function resonance(attacking, target) {
  if (!attacking || !target) return { mult: 1, kind: 'flat' };
  if (OPPOSED[attacking] === target) return { mult: RESONANCE, kind: 'resonant' };
  if (attacking === target) return { mult: DISCORD, kind: 'discordant' };
  return { mult: 1, kind: 'flat' };
}

export const RITES = {
  emberlash: {
    id: 'emberlash', name: 'EMBERLASH', affinity: 'EMBER', ep: 8, target: 'foe',
    power: 34, stat: 'mag',
    desc: 'A whip of borrowed fire. Cheap, fast, and it never stops being useful.',
  },
  scourline: {
    id: 'scourline', name: 'SCOURLINE', affinity: 'EMBER', ep: 18, target: 'allFoes',
    power: 26, stat: 'mag',
    desc: 'Draws a burning line along the inlay. Catches everything standing on it.',
  },
  quickstep: {
    id: 'quickstep', name: 'QUICKSTEP', affinity: 'EMBER', ep: 10, target: 'ally',
    buff: { agi: 12, turns: 3 },
    desc: 'Lends the ember in the floor to a runner. Three rounds of borrowed speed.',
  },
  ironbark: {
    id: 'ironbark', name: 'IRONBARK', affinity: 'ROOT', ep: 12, target: 'ally',
    buff: { def: 14, turns: 3 },
    desc: 'Hardens skin to heartwood. It aches for a day afterwards.',
  },
  anchor: {
    id: 'anchor', name: 'ANCHOR', affinity: 'ROOT', ep: 14, target: 'foe',
    power: 28, stat: 'str', status: 'rooted',
    desc: 'Drives a root through the floor and through whatever is standing on it.',
  },
  mendsong: {
    id: 'mendsong', name: 'MENDSONG', affinity: 'BONE', ep: 14, target: 'ally',
    heal: 72,
    desc: 'The oldest rite anyone still sings. Closes what is open.',
  },
  boneward: {
    id: 'boneward', name: 'BONEWARD', affinity: 'BONE', ep: 20, target: 'allAllies',
    buff: { res: 12, turns: 3 },
    desc: 'A mask laid over the whole line. Rites slide off it.',
  },
  hollowing: {
    id: 'hollowing', name: 'HOLLOWING', affinity: 'HOLLOW', ep: 16, target: 'foe',
    power: 38, stat: 'mag', drain: 0.3,
    desc: 'Takes the ember back out of a thing, and gives a third of it to you.',
  },
  sunderfist: {
    id: 'sunderfist', name: 'SUNDERFIST', affinity: 'HOLLOW', ep: 12, target: 'foe',
    power: 44, stat: 'str', pierce: true,
    desc: 'Ignores plate, mask and ward. Costs Teko a knuckle most times.',
  },
  secondwind: {
    id: 'secondwind', name: 'SECOND WIND', affinity: 'HOLLOW', ep: 10, target: 'self',
    heal: 40, buff: { agi: 8, turns: 2 },
    desc: 'Burns what is left in the lungs. Nobody recommends it.',
  },
};

export function getRite(id) {
  const rite = RITES[id];
  if (!rite) throw new Error(`unknown rite: ${id}`);
  return rite;
}
