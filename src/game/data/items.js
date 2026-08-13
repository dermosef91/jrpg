export const ITEMS = {
  emberdraught: { id: 'emberdraught', name: 'EMBER DRAUGHT', heal: 90, target: 'ally',
    desc: 'Bitter, and it works. Restores 90 HP.' },
  ashtea: { id: 'ashtea', name: 'ASH TEA', ep: 40, target: 'ally',
    desc: 'Restores 40 EP. Tastes exactly like it sounds.' },
  masksalt: { id: 'maskslat', name: 'MASK SALT', revive: 0.5, target: 'ally',
    desc: 'Brings a fallen ally back at half. Nobody enjoys the smell.' },
  rootbread: { id: 'rootbread', name: 'ROOT BREAD', heal: 40, ep: 12, target: 'allAllies',
    desc: 'Shared out. Restores 40 HP and 12 EP to the whole line.' },
};

export function getItem(id) { return ITEMS[id] ?? null; }

export const STARTING_INVENTORY = [
  { id: 'emberdraught', count: 6 },
  { id: 'ashtea', count: 4 },
  { id: 'maskslat', count: 2 },
  { id: 'rootbread', count: 3 },
];
