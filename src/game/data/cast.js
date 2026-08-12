import { makeCombatant } from '../battle/combatant.js';
import { GRAIN } from '../battle/grain.js';

// Names follow the convention in docs/worldbuilding/06-cast.md:
// [Given] [Bole]-of-the-[cohort ordinal]. A name states where you are from
// and which Ember conditions you remember.

export function makeParty() {
  return [
    makeCombatant({
      id: 'wend', name: 'Wend', role: 'Cant-singer', side: 'party', revealed: true,
      maxHp: 88, speed: 12, power: 1.0, grain: GRAIN.RISING,
      actions: ['cant', 'read', 'quicken', 'harvest', 'strike'],
      note: 'Cordwain-of-the-Eleventh. Inherited maintenance duty over passages\n'
          + 'she was taught as a girl and never questioned.',
    }),
    makeCombatant({
      id: 'pell', name: 'Pell', role: 'Graft-medic', side: 'party', revealed: true,
      maxHp: 96, speed: 10, power: 0.9, grain: GRAIN.LATERAL,
      actions: ['knitwood', 'staunch', 'excise', 'harvest', 'strike'],
      note: 'Anneal-of-the-Tenth. Agrees with Verity more often than anyone,\n'
          + 'and likes her least.',
    }),
    makeCombatant({
      id: 'tarn', name: 'Tarn', role: 'Coring', side: 'party', revealed: true,
      maxHp: 124, speed: 7, power: 1.15, grain: GRAIN.COMPACTED,
      actions: ['cleave', 'wedge', 'bear', 'harvest', 'strike'],
      note: 'Sill-of-the-Tenth. Left a Bole that has scheduled its own death.\n'
          + 'Has never resolved whether his family were right.',
    }),
    makeCombatant({
      id: 'kite', name: 'Kite', role: 'Windreader', side: 'party', revealed: true,
      maxHp: 82, speed: 14, power: 0.95, grain: GRAIN.TWISTED,
      actions: ['shear', 'veer', 'forecast', 'harvest', 'strike'],
      note: 'Marrow-of-the-Twelfth. Youngest cohort. Has never seen a fertile\n'
          + 'Ember cycle and legislates accordingly.',
    }),
  ];
}
