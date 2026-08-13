// EMBERROOT — palette.
//
// Three families and nothing else, taken straight off the concept art: the
// near-black of the deep root galleries, the burnt ember-orange that every lit
// thing in this world is lit BY, and the bone-cream of carved stone, masks and
// cloth. No blues, no greens, no neutral greys. If a pixel is not black it is
// either burning or it is bone.

const ramp = (...stops) => Object.freeze(stops);

export const RAMP = Object.freeze({
  // the dark: root wood, shadow, the space between platforms
  ink: ramp('#080605', '#0f0a09', '#1b1413', '#2b1e1a', '#3b2921', '#4e372c', '#634736'),
  // ember: inlay, glyphs, firelight, the sun-mandala, every UI accent
  ember: ramp('#5c1f08', '#8a3210', '#b04517', '#c9541f', '#d9682a', '#ea8038', '#f8a24e', '#ffc880'),
  // bone: carved stone, masks, cloth, type
  bone: ramp('#3f382e', '#5c5346', '#7d7160', '#9d8f79', '#bdae94', '#d8c9ac', '#eee0c4', '#fbf3e2'),
  // skin: the people of the root galleries
  skin: ramp('#2a1912', '#3f261a', '#5a3623', '#79482d', '#96603c', '#b07a50', '#c99468'),
  // blood/alarm — used sparingly, for damage only
  wound: ramp('#3d0d0a', '#6b1a12', '#9c2a1c', '#c43d28'),
});

export const P = Object.freeze({
  void: RAMP.ink[0],
  black: RAMP.ink[1],
  root: RAMP.ink[2],
  rootLit: RAMP.ink[3],
  bark: RAMP.ink[4],
  barkLit: RAMP.ink[5],
  barkHi: RAMP.ink[6],

  emberDeep: RAMP.ember[1],
  emberDim: RAMP.ember[2],
  ember: RAMP.ember[3],
  emberLit: RAMP.ember[4],
  emberBright: RAMP.ember[5],
  emberHot: RAMP.ember[6],
  emberWhite: RAMP.ember[7],

  stoneShadow: RAMP.bone[1],
  stoneDark: RAMP.bone[2],
  stoneMid: RAMP.bone[3],
  stone: RAMP.bone[4],
  stoneLit: RAMP.bone[5],
  boneLit: RAMP.bone[6],
  boneWhite: RAMP.bone[7],

  ink0: RAMP.ink[0],
  wound: RAMP.wound[2],
  woundLit: RAMP.wound[3],
});

/** Affinities — the elemental axis of Rites, shown on the menu as a glyph. */
export const AFFINITY = Object.freeze({
  EMBER: { id: 'EMBER', name: 'Ember', color: P.emberBright, glyph: 'flame' },
  ROOT: { id: 'ROOT', name: 'Root', color: P.barkHi, glyph: 'root' },
  BONE: { id: 'BONE', name: 'Bone', color: P.boneLit, glyph: 'bone' },
  HOLLOW: { id: 'HOLLOW', name: 'Hollow', color: P.stoneMid, glyph: 'hollow' },
});

const hex = (c) => [
  parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16),
];

export function mix(a, b, t) {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const k = Math.max(0, Math.min(1, t));
  const to = (x, y) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
}

export function alpha(color, a) {
  const [r, g, b] = hex(color);
  return `rgba(${r},${g},${b},${a})`;
}

export function step(name, index) {
  const stops = RAMP[name];
  const i = Math.max(0, Math.min(stops.length - 1, Math.round(index)));
  return stops[i];
}
