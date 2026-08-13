// The world route, as drawn on the menu map: named holds joined by walked roads.
// Coordinates are in a 0..1 box so the map panel can be any size.

export const ROUTE_NODES = [
  { id: 'sill', name: 'THE SILL', kind: 'gate', x: 0.13, y: 0.62, visited: true },
  { id: 'lantern', name: 'LANTERN HOLD', kind: 'hold', x: 0.28, y: 0.30, visited: true },
  { id: 'crossing', name: 'LOW CROSSING', kind: 'way', x: 0.42, y: 0.46, visited: true },
  { id: 'baobab', name: 'THE STANDING ONE', kind: 'tree', x: 0.50, y: 0.20, visited: true },
  { id: 'quiet', name: 'QUIET STAIR', kind: 'way', x: 0.66, y: 0.50, visited: true },
  { id: 'plaza', name: 'ROOTPLAZA', kind: 'city', x: 0.50, y: 0.78, visited: true, here: true },
  { id: 'reach', name: 'HOLLOW REACH', kind: 'way', x: 0.74, y: 0.22, visited: false },
  { id: 'crown', name: 'CROWNFALL', kind: 'spire', x: 0.88, y: 0.44, visited: false },
];

export const ROUTE_EDGES = [
  ['sill', 'lantern'], ['lantern', 'crossing'], ['crossing', 'baobab'],
  ['crossing', 'plaza'], ['baobab', 'quiet'], ['quiet', 'plaza'],
  ['quiet', 'reach'], ['reach', 'crown'], ['plaza', 'crown'],
];

export function nodeById(id) { return ROUTE_NODES.find((n) => n.id === id) ?? null; }
