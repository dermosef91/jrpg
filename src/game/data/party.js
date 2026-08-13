import { P, RAMP } from '../../engine/palette.js';
import { effectiveStats } from './equipment.js';

// The four who walk the root galleries. Three stand in the formation at a time,
// which is why the menu has a FORMATION entry and the battle art shows three.

export const CHARACTERS = [
  {
    id: 'zahra', name: 'ZAHRA', cls: 'WANDERER', affinity: 'EMBER',
    level: 24, exp: 0,
    base: { hp: 198, ep: 64, str: 28, agi: 34, def: 22, mag: 26, res: 23, lck: 19 },
    rites: ['emberlash', 'scourline', 'quickstep'],
    figure: {
      id: 'zahra', skin: 4, cloth: '#d8c9ac', clothDark: '#7d7160', trim: '#3d2a22',
      hair: 'locs', hairColor: '#171010', weapon: 'spear', accent: P.emberBright,
    },
    portrait: { skin: 4, hair: 'locs', wrap: false, beads: true },
    note: 'Walked in from the outer galleries with no lineage and no papers.',
  },
  {
    id: 'kofi', name: 'KOFI', cls: 'WARDEN', affinity: 'ROOT',
    level: 22, exp: 0,
    base: { hp: 312, ep: 48, str: 31, agi: 18, def: 34, mag: 14, res: 28, lck: 12 },
    rites: ['ironbark', 'anchor'],
    figure: {
      id: 'kofi', skin: 2, cloth: '#bdae94', clothDark: '#5c5346', trim: '#221715',
      hair: 'crop', hairColor: '#0f0a09', weapon: 'spear', accent: P.emberLit,
    },
    portrait: { skin: 2, hair: 'crop', wrap: false, beads: false },
    note: 'Held the Sill Gate alone for a night and will not discuss it.',
  },
  {
    id: 'aya', name: 'AYA', cls: 'CANTOR', affinity: 'BONE',
    level: 21, exp: 0,
    base: { hp: 178, ep: 92, str: 15, agi: 24, def: 17, mag: 36, res: 31, lck: 22 },
    rites: ['mendsong', 'boneward', 'hollowing'],
    figure: {
      id: 'aya', skin: 3, cloth: '#eee0c4', clothDark: '#9d8f79', trim: '#3f382e',
      hair: 'wrap', hairColor: '#171010', weapon: 'disc', accent: P.emberHot,
    },
    portrait: { skin: 3, hair: 'wrap', wrap: true, beads: false },
    note: 'Reads the inlay the way other people read weather.',
  },
  {
    id: 'teko', name: 'TEKO', cls: 'STRIKER', affinity: 'HOLLOW',
    level: 21, exp: 0,
    base: { hp: 236, ep: 40, str: 33, agi: 29, def: 20, mag: 11, res: 15, lck: 26 },
    rites: ['sunderfist', 'secondwind'],
    figure: {
      id: 'teko', skin: 5, cloth: '#9d8f79', clothDark: '#3f382e', trim: '#2e1f1a',
      hair: 'afro', hairColor: '#0f0a09', weapon: 'fists', accent: P.emberBright,
    },
    portrait: { skin: 5, hair: 'afro', wrap: false, beads: true },
    note: 'Fights the way the galleries fall: all at once, then quiet.',
  },
];

/** Growth is flat per level and legible, so the menu numbers mean something. */
export function statsFor(c) {
  return { ...c.base };
}

export function makeParty() {
  return CHARACTERS.map((c) => {
    const character = {
      ...c,
      stats: statsFor(c),
      equipment: { ...DEFAULT_EQUIP[c.id] },
      guarding: false,
      down: false,
    };
    // Maxima have to include what is worn, or the menu and the battle disagree
    // about the same character's HP.
    const worn = effectiveStats(character);
    character.maxHp = worn.hp;
    character.maxEp = worn.ep;
    character.hp = worn.hp;
    character.ep = worn.ep;
    return character;
  });
}

/** Recompute maxima after a change of gear, keeping current HP/EP in range. */
export function refreshVitals(character) {
  const worn = effectiveStats(character);
  character.maxHp = worn.hp;
  character.maxEp = worn.ep;
  character.hp = Math.min(character.hp, character.maxHp);
  character.ep = Math.min(character.ep, character.maxEp);
  return character;
}

export const DEFAULT_EQUIP = {
  zahra: { weapon: 'emberspear', armor: 'baobabmail', accessory: 'wayfarerband', trinket: 'rootseal' },
  kofi: { weapon: 'gatepike', armor: 'wardenplate', accessory: 'stonecord', trinket: 'oathknot' },
  aya: { weapon: 'cantordisc', armor: 'silkofash', accessory: 'listeningring', trinket: 'quietbell' },
  teko: { weapon: 'knucklewraps', armor: 'runnersvest', accessory: 'emberstud', trinket: 'luckshard' },
};

/** Party members standing in the battle line, in order. */
export const DEFAULT_FORMATION = ['zahra', 'kofi', 'aya'];
