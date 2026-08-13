// Art direction: "lantern-lit woodcut".
//
// The Ember is dying, so light is the subject of every frame: scarce, low-angle,
// and amber. Everything it does not reach falls into cold blue shade. That warm
// key / cool fill split is the single rule the whole game is drawn by -- if a
// surface is lit it goes up the AMBER or WOOD ramp, and if it is not, it goes
// down the SHADE ramp. Nothing is neutral grey anywhere.
//
// Colours live in ramps rather than as isolated swatches, so shading a surface
// means stepping along a ramp instead of inventing a new hex code.

const ramp = (...stops) => Object.freeze(stops);

export const RAMP = Object.freeze({
  // structural dark: the inside of things, panel grounds, night
  bark: ramp('#080605', '#100c0a', '#191310', '#241b16', '#31251d', '#412f24'),
  // lit timber: decks, walls, trunks
  wood: ramp('#2e221a', '#3f2f22', '#54402d', '#6b503a', '#856448', '#a07c59'),
  // the Ember, sunwood, lamplight -- the only true light in the world
  amber: ramp('#4a2c0d', '#7a4d17', '#a86c22', '#d99a3f', '#f0bd6b', '#ffe3ad'),
  // heat: fire, rot-glow, hostile grafts
  ember: ramp('#4d1a0b', '#7d2d12', '#b1421a', '#e8622c', '#ff8b55', '#ffb38c'),
  // shadow, water, sky, the Long Shade -- everything light failed to reach
  shade: ramp('#080e12', '#101b22', '#1b2d38', '#2a4351', '#3d6070', '#5b8698'),
  // living tissue, grafts, healthy canopy
  sap: ramp('#16200f', '#26351a', '#3b5228', '#587539', '#78994f', '#9dbd72'),
  // paper, bone, text
  pale: ramp('#6f6152', '#8b7a66', '#a8977e', '#c9b899', '#e4d6bb', '#f7ecd8'),
  // damage, scars, refusal
  scar: ramp('#33100c', '#5c1d15', '#8b2f22', '#b84834', '#d96b55', '#f0947f'),
  // vitrified ground, glass, the Glassing
  glass: ramp('#3b4a52', '#586c76', '#7b929c', '#a3bac3', '#cddde3'),
});

/** Step a ramp; fractional indices interpolate, out-of-range clamps. */
export function step(name, index) {
  const stops = RAMP[name];
  const i = Math.max(0, Math.min(stops.length - 1, index));
  if (Number.isInteger(i)) return stops[i];
  const lo = Math.floor(i);
  return mix(stops[lo], stops[Math.min(lo + 1, stops.length - 1)], i - lo);
}

const hex = (c) => [
  parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16),
];

/** Linear blend between two hex colours. */
export function mix(a, b, t) {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const k = Math.max(0, Math.min(1, t));
  const to = (x, y) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
}

/** Hex plus alpha, as rgba() -- for gradients and washes. */
export function alpha(color, a) {
  const [r, g, b] = hex(color);
  return `rgba(${r},${g},${b},${a})`;
}

// Named picks. Everything in the game refers to these rather than to raw hex,
// so the whole look can be re-graded from this one block.
export const P = Object.freeze({
  void: RAMP.bark[0],
  deep: RAMP.bark[1],
  bark: RAMP.bark[2],
  barkLit: RAMP.bark[3],
  barkHi: RAMP.bark[4],
  wood: RAMP.wood[1],
  woodMid: RAMP.wood[2],
  woodLit: RAMP.wood[3],
  woodHi: RAMP.wood[4],
  sunwood: RAMP.amber[3],
  sunwoodDim: RAMP.amber[1],
  sunwoodHi: RAMP.amber[4],
  ignite: RAMP.amber[5],
  ember: RAMP.ember[3],
  emberHi: RAMP.ember[4],
  pale: RAMP.pale[5],
  paleMid: RAMP.pale[3],
  paleDim: RAMP.pale[1],
  sap: RAMP.sap[3],
  sapHi: RAMP.sap[4],
  shade: RAMP.shade[2],
  shadeLit: RAMP.shade[4],
  shadeHi: RAMP.shade[5],
  scar: RAMP.scar[3],
  scarHi: RAMP.scar[4],
  glass: RAMP.glass[3],
});

// The four Grain positions keep one colour everywhere they appear -- battle
// dial, cross-sections, kit tables, tooltips.
export const GRAIN_COLOR = Object.freeze([
  RAMP.amber[4],  // Rising
  RAMP.sap[4],    // Lateral
  RAMP.shade[5],  // Twisted
  RAMP.ember[4],  // Compacted
]);
export const GRAIN_COLOR_DIM = Object.freeze([
  RAMP.amber[2], RAMP.sap[2], RAMP.shade[3], RAMP.ember[2],
]);

/** Typography. A print serif for display against monospace for anything the
 *  auditors would have typed -- forms, readouts, logs. */
export const FONT = Object.freeze({
  display: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif',
  ui: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
});
