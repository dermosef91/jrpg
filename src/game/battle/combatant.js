import { GRAIN } from './grain.js';

let nextUid = 1;

/** A combatant is a structure with a fibre direction, not a bag of elemental
 *  resistances. Scars lock the fibre, which is the whole late-fight tactic. */
export function makeCombatant({
  id, name, role = '', side, maxHp, speed = 10, power = 1,
  grain = GRAIN.RISING, actions = [], note = '', revealed = false,
}) {
  return {
    uid: `c${nextUid++}`,
    id, name, role, side,
    maxHp, baseMaxHp: maxHp, hp: maxHp,
    speed, power, grain, actions, note,
    grafts: [],
    scars: 0,
    revealed,            // party members are always revealed; foes must be Read
    guarding: false,
    intent: null,        // pre-rolled next action, shown only after Forecast
    intentVisible: false,
  };
}

export const isAlive = (c) => c.hp > 0;
/** A scarred fibre cannot turn. Chain across-grain hits once you have locked it. */
export const grainLocked = (c) => c.scars > 0;
export const isParty = (c) => c.side === 'party';
