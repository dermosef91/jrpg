import { GRAIN } from './grain.js';

// Actions are plain data. The battle engine interprets them, so every kit is
// declarative and testable without touching rendering.
//
//   sap      cost from the shared pool (docs 07 section 2)
//   grain    force direction, or 'choose' for the Cant-singer's flexibility
//   effect   applied immediately
//   graft    placed with a maturity timer, applied when it matures (section 3)

export const ACTIONS = {
  // --- shared ---------------------------------------------------------------
  strike: {
    id: 'strike', name: 'Strike', sap: 0, target: 'foe', grain: GRAIN.LATERAL,
    effect: { damage: 14 },
    desc: 'Plain force. Costs no Sap. Rotates the target one step like anything else.',
  },

  // --- Wend, Cant-singer ----------------------------------------------------
  read: {
    id: 'read', name: 'Read', sap: 2, target: 'any', grain: null,
    effect: { reveal: true },
    desc: 'Expose Grain, every graft timer, and every Scar for the rest of the encounter.',
  },
  cant: {
    id: 'cant', name: 'Cant', sap: 2, target: 'foe', grain: 'choose',
    effect: { damage: 11 },
    desc: 'Weak force, sung along any fibre you name. The only action with a free Grain.',
  },
  quicken: {
    id: 'quicken', name: 'Quicken', sap: 3, target: 'any', grain: null,
    effect: { shiftMaturity: -1 },
    desc: "Rewrite a graft's timer. Allied grafts mature a turn sooner; hostile ones later.",
  },

  // --- Pell, Graft-medic ----------------------------------------------------
  knitwood: {
    id: 'knitwood', name: 'Splice: Knitwood', sap: 3, target: 'ally', grain: null,
    graft: {
      name: 'Knitwood', maturity: 2,
      mature: { heal: 44 },
      harvest: { heal: 15 },
    },
    desc: 'Restorative graft. Matures in 2 rounds for 44, or harvest early for 15.',
  },
  excise: {
    id: 'excise', name: 'Excise', sap: 2, target: 'any', grain: null,
    effect: { excise: true },
    desc: 'Cut an immature graft out of a target. The investment is lost entirely.',
  },
  staunch: {
    id: 'staunch', name: 'Staunch', sap: 2, target: 'ally', grain: null,
    effect: { heal: 18 },
    desc: 'Immediate, unglamorous field medicine. No timer, no leverage.',
  },

  // --- Tarn, Coring ---------------------------------------------------------
  cleave: {
    id: 'cleave', name: 'Cleave', sap: 0, target: 'foe', grain: GRAIN.COMPACTED,
    effect: { damage: 21 },
    desc: 'Heartwood quarrying, applied to a problem. Heavy compacted force.',
  },
  wedge: {
    id: 'wedge', name: 'Splice: Wedge', sap: 4, target: 'foe', grain: GRAIN.COMPACTED,
    graft: {
      name: 'Wedge', maturity: 1,
      mature: { damage: 34, scar: true },
      harvest: { damage: 12 },
    },
    desc: 'Fast graft. Matures next round for heavy force and a guaranteed Scar.',
  },
  bear: {
    id: 'bear', name: 'Bear', sap: 2, target: 'self', grain: null,
    effect: { guard: true },
    desc: 'Take the round on your own frame. Redirects force from allies, and Scars you.',
  },

  // --- Kite, Windreader -----------------------------------------------------
  veer: {
    id: 'veer', name: 'Veer', sap: 2, target: 'any', grain: null,
    effect: { rotate: 1, noDamage: true },
    desc: 'Turn a fibre without striking it. Sets up the next character. Scarred grain resists.',
  },
  forecast: {
    id: 'forecast', name: 'Forecast', sap: 1, target: 'foe', grain: null,
    effect: { forecast: true },
    desc: "Read the weather off an opponent: shows what it intends next round.",
  },
  shear: {
    id: 'shear', name: 'Shear', sap: 1, target: 'foe', grain: GRAIN.TWISTED,
    effect: { damage: 16 },
    desc: 'Twisting force, cheap and reliable.',
  },

  harvest: {
    id: 'harvest', name: 'Harvest', sap: 0, target: 'any', grain: null,
    effect: { harvest: true },
    desc: 'Cash out one of your own immature grafts now, for a reduced effect.',
  },

  // --- hostile kits ---------------------------------------------------------
  lash: {
    id: 'lash', name: 'Lash', sap: 0, target: 'foe', grain: GRAIN.RISING,
    effect: { damage: 15 }, desc: 'Rising force.',
  },
  bloom: {
    id: 'bloom', name: 'Bloom', sap: 0, target: 'self', grain: null,
    graft: { name: 'Bloom', maturity: 2, mature: { heal: 30 }, harvest: { heal: 8 } },
    desc: 'Feral growth. The Cankerbloom grafts itself and waits.',
  },
  writ: {
    id: 'writ', name: 'Serve Writ', sap: 0, target: 'foe', grain: null,
    effect: { excise: true }, desc: 'Cuts a graft out on a paperwork technicality.',
  },
  seize: {
    id: 'seize', name: 'Seize', sap: 0, target: 'foe', grain: GRAIN.LATERAL,
    effect: { damage: 17 }, desc: 'Lateral force, applied with a clipboard.',
  },
  spread: {
    id: 'spread', name: 'Spread', sap: 0, target: 'foe', grain: GRAIN.TWISTED,
    effect: { damage: 12, scar: true }, desc: 'Rot travels. Leaves a Scar on contact.',
  },
  settle: {
    id: 'settle', name: 'Settle', sap: 0, target: 'self', grain: null,
    effect: { rotate: 2, noDamage: true }, desc: 'Turns its own fibre away from the last hit.',
  },
};

export function getAction(id) {
  const action = ACTIONS[id];
  if (!action) throw new Error(`unknown action: ${id}`);
  return action;
}
