// Shards: crystallised ember. Currency, crafting stock, and the reason anybody
// goes down into the galleries at all. Ten kinds, as laid out in the menu art.

// `short` is what fits under a 34px inventory cell; truncating the full name
// mid-word reads as a bug rather than as an abbreviation.
export const SHARDS = [
  { id: 'cinder', name: 'CINDER', short: 'CIND', glyph: 'shard', color: '#f8a24e', tier: 1 },
  { id: 'lattice', name: 'LATTICE', short: 'LATT', glyph: 'branch', color: '#ea8038', tier: 1 },
  { id: 'splinter', name: 'SPLINTER', short: 'SPLT', glyph: 'root', color: '#d9682a', tier: 1 },
  { id: 'sigil', name: 'SIGIL', short: 'SIGL', glyph: 'ring', color: '#c9541f', tier: 2 },
  { id: 'wedge', name: 'WEDGE', short: 'WEDG', glyph: 'flame', color: '#f8a24e', tier: 2 },
  { id: 'rod', name: 'ROD', short: 'ROD', glyph: 'pulse', color: '#b04517', tier: 2 },
  { id: 'seal', name: 'SEAL', short: 'SEAL', glyph: 'save', color: '#ea8038', tier: 3 },
  { id: 'facet', name: 'FACET', short: 'FCET', glyph: 'bone', color: '#d8c9ac', tier: 3 },
  { id: 'core', name: 'CORE', short: 'CORE', glyph: 'hollow', color: '#eee0c4', tier: 4 },
  { id: 'crown', name: 'CROWN', short: 'CRWN', glyph: 'star', color: '#ffc880', tier: 5 },
];

export const STARTING_SHARDS = {
  cinder: 12, lattice: 8, splinter: 6, sigil: 5, wedge: 4,
  rod: 3, seal: 2, facet: 1, core: 1, crown: 1,
};

export function shardById(id) { return SHARDS.find((s) => s.id === id) ?? null; }
