// Equipment, in the four slots the concept-art menu shows: WEAPON, ARMOR,
// ACCESSORY, TRINKET.

export const EQUIPMENT = {
  // --- weapons ---
  emberspear: { id: 'emberspear', name: 'EMBER SPEAR', slot: 'weapon', str: 14, agi: 3, affinity: 'EMBER',
    desc: 'Head forged around a live shard. Warm even in the deep galleries.' },
  gatepike: { id: 'gatepike', name: 'GATE PIKE', slot: 'weapon', str: 17, def: 4,
    desc: 'Longer than a person and heavier than it looks. Made to hold a doorway.' },
  cantordisc: { id: 'cantordisc', name: 'CANTOR DISC', slot: 'weapon', mag: 16, res: 4, affinity: 'BONE',
    desc: 'A reading ring. Rites drawn through it come out cleaner.' },
  knucklewraps: { id: 'knucklewraps', name: 'KNUCKLE WRAPS', slot: 'weapon', str: 12, agi: 6,
    desc: 'Ash-cloth, re-wound every morning. Teko will not use anything else.' },
  ashpike: { id: 'ashpike', name: 'ASHWOOD PIKE', slot: 'weapon', str: 19, agi: -2,
    desc: 'Cut from a root that burned and kept growing.' },
  quietedge: { id: 'quietedge', name: 'QUIET EDGE', slot: 'weapon', str: 15, mag: 8, affinity: 'HOLLOW',
    desc: 'Taken off a Warden. It does not like being carried.' },

  // --- armor ---
  baobabmail: { id: 'baobabmail', name: 'BAOBAB MAIL', slot: 'armor', def: 12, res: 6,
    desc: 'Bark plate over ash-cloth. Light, and it breathes.' },
  wardenplate: { id: 'wardenplate', name: 'WARDEN PLATE', slot: 'armor', def: 20, agi: -4,
    desc: 'Salvaged mask-stone, re-cut to fit a person.' },
  silkofash: { id: 'silkofash', name: 'SILK OF ASH', slot: 'armor', def: 6, res: 14, ep: 12,
    desc: 'Woven from the fibre that grows where the fire has already been.' },
  runnersvest: { id: 'runnersvest', name: "RUNNER'S VEST", slot: 'armor', def: 9, agi: 7,
    desc: 'Cut short so nothing catches on the inlay.' },

  // --- accessories ---
  wayfarerband: { id: 'wayfarerband', name: 'WAYFARER BAND', slot: 'accessory', agi: 6, lck: 4,
    desc: 'Given to anyone who walks in from outside and stays a year.' },
  stonecord: { id: 'stonecord', name: 'STONE CORD', slot: 'accessory', def: 8, hp: 40,
    desc: 'Knotted the way the gate crews knot it.' },
  listeningring: { id: 'listeningring', name: 'LISTENING RING', slot: 'accessory', mag: 8, ep: 16,
    desc: 'Hums when a rite is being sung nearby, whether or not you want it to.' },
  emberstud: { id: 'emberstud', name: 'EMBER STUD', slot: 'accessory', str: 6, lck: 6,
    desc: 'Everyone in the galleries wears one. Nobody agrees why.' },

  // --- trinkets ---
  rootseal: { id: 'rootseal', name: 'ROOT SEAL', slot: 'trinket', res: 7, hp: 24,
    desc: 'A seal pressed by a Warden that no longer exists.' },
  oathknot: { id: 'oathknot', name: 'OATH KNOT', slot: 'trinket', def: 6, res: 6,
    desc: 'You tie it once. Untying it means something.' },
  quietbell: { id: 'quietbell', name: 'QUIET BELL', slot: 'trinket', mag: 6, ep: 10,
    desc: 'Rings on the inhale, not the strike.' },
  luckshard: { id: 'luckshard', name: 'LUCK SHARD', slot: 'trinket', lck: 12,
    desc: 'A shard that failed to set. Worthless, and everyone wants one.' },
};

export const SLOTS = ['weapon', 'armor', 'accessory', 'trinket'];
export const SLOT_LABEL = { weapon: 'WEAPON', armor: 'ARMOR', accessory: 'ACCESSORY', trinket: 'TRINKET' };
export const SLOT_GLYPH = { weapon: 'sword', armor: 'shield', accessory: 'ring', trinket: 'shard' };

export function getEquipment(id) { return EQUIPMENT[id] ?? null; }

/** Base stats plus everything worn. */
export function effectiveStats(character) {
  const out = { ...character.stats };
  for (const slot of SLOTS) {
    const item = EQUIPMENT[character.equipment?.[slot]];
    if (!item) continue;
    for (const key of ['hp', 'ep', 'str', 'agi', 'def', 'mag', 'res', 'lck']) {
      if (item[key]) out[key] = (out[key] ?? 0) + item[key];
    }
  }
  for (const key of Object.keys(out)) out[key] = Math.max(1, out[key]);
  return out;
}

/** The affinity a character strikes with, weapon first. */
export function strikeAffinity(character) {
  const weapon = EQUIPMENT[character.equipment?.weapon];
  return weapon?.affinity ?? character.affinity;
}
