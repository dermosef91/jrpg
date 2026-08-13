// What lives in the galleries. None of it is evil; all of it is still doing the
// job it was carved for, long after the reason stopped applying.

export const FOES = {
  crawler: {
    id: 'crawler', name: 'MASK CRAWLER', art: 'crawler', affinity: 'HOLLOW',
    hp: 120, str: 20, agi: 30, def: 12, mag: 8, res: 10,
    exp: 42, shards: { cinder: 2, splinter: 1 },
    actions: [
      { id: 'rake', name: 'RAKE', power: 22, kind: 'attack' },
      { id: 'skitter', name: 'SKITTER', power: 14, kind: 'attack', hits: 2 },
    ],
    note: 'A gate-warden shrunk down to the part that still works.',
  },
  husk: {
    id: 'husk', name: 'HOLLOWED', art: 'husk', affinity: 'ROOT',
    hp: 168, str: 26, agi: 16, def: 20, mag: 10, res: 14,
    exp: 58, shards: { cinder: 2, lattice: 2 },
    actions: [
      { id: 'grasp', name: 'GRASP', power: 28, kind: 'attack' },
      { id: 'takeroot', name: 'TAKE ROOT', power: 0, kind: 'buff', buff: { def: 12, turns: 3 } },
    ],
    note: 'Somebody who stayed down here too long and kept walking.',
  },
  choir: {
    id: 'choir', name: 'MASK CHOIR', art: 'choir', affinity: 'EMBER',
    hp: 140, str: 12, agi: 26, def: 14, mag: 32, res: 26,
    exp: 74, shards: { sigil: 1, wedge: 1, cinder: 3 },
    actions: [
      { id: 'chord', name: 'CHORD', power: 30, kind: 'rite', affinity: 'EMBER' },
      { id: 'unsing', name: 'UNSING', power: 20, kind: 'rite', affinity: 'EMBER', all: true },
    ],
    note: 'Six shards of one mask, still holding the note they were cut on.',
  },
  warden: {
    id: 'warden', name: 'GALLERY WARDEN', art: 'warden', affinity: 'BONE',
    hp: 420, str: 34, agi: 20, def: 26, mag: 28, res: 24,
    exp: 260, shards: { core: 1, seal: 2, facet: 1, wedge: 2 },
    boss: true,
    actions: [
      { id: 'sentence', name: 'SENTENCE', power: 38, kind: 'attack' },
      { id: 'sealrite', name: 'SEAL', power: 30, kind: 'rite', affinity: 'BONE', all: true },
      { id: 'toll', name: 'TOLL', power: 46, kind: 'attack', pierce: true },
    ],
    note: 'It will read the writ before it acts. It always reads the writ.',
  },
};

export const ENCOUNTERS = [
  { id: 'crawlers', title: 'THREE CRAWLERS ON THE INLAY', foes: ['crawler', 'crawler', 'crawler'] },
  { id: 'hollowed', title: 'THE HOLLOWED, STILL WALKING', foes: ['husk', 'husk'] },
  { id: 'choirpair', title: 'A CHOIR, HOLDING ITS NOTE', foes: ['choir', 'crawler'] },
  { id: 'mixed', title: 'SOMETHING CAME UP THE STAIR', foes: ['husk', 'crawler', 'crawler'] },
  { id: 'warden', title: 'THE WARDEN OF THE LOW GALLERY', foes: ['warden'], boss: true },
];

export function getFoe(id) {
  const foe = FOES[id];
  if (!foe) throw new Error(`unknown foe: ${id}`);
  return foe;
}
