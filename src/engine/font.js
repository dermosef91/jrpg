// A 5x7 bitmap font, authored by hand.
//
// Glyphs are rasterised once into a per-colour atlas and blitted, rather than
// drawn pixel-by-pixel every frame: a busy menu is several hundred characters,
// and one drawImage per character is the difference between 60fps and a slideshow.

const W = 5;
const H = 7;
const CELL_W = 6;   // 5px glyph + 1px letter spacing
const CELL_H = 8;

const G = {
  ' ': '..... ..... ..... ..... ..... ..... .....',
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .###.',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '##### ..#.. ..#.. ..#.. ..#.. ..#.. #####',
  J: '..### ...#. ...#. ...#. ...#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# ##..# #.#.# #.#.# #..## #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# ##.## #...#',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  a: '..... ..... .###. ....# .#### #...# .####',
  b: '#.... #.... ####. #...# #...# #...# ####.',
  c: '..... ..... .###. #.... #.... #...# .###.',
  d: '....# ....# .#### #...# #...# #...# .####',
  e: '..... ..... .###. #...# ##### #.... .###.',
  f: '..##. .#..# .#... ###.. .#... .#... .#...',
  g: '..... ..... .#### #...# .#### ....# .###.',
  h: '#.... #.... ####. #...# #...# #...# #...#',
  i: '..#.. ..... .##.. ..#.. ..#.. ..#.. .###.',
  j: '...#. ..... ..##. ...#. ...#. #..#. .##..',
  k: '#.... #.... #..#. #.#.. ##... #.#.. #..#.',
  l: '.##.. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  m: '..... ..... ##.#. #.#.# #.#.# #.#.# #.#.#',
  n: '..... ..... ####. #...# #...# #...# #...#',
  o: '..... ..... .###. #...# #...# #...# .###.',
  p: '..... ..... ####. #...# ####. #.... #....',
  q: '..... ..... .#### #...# .#### ....# ....#',
  r: '..... ..... #.##. ##..# #.... #.... #....',
  s: '..... ..... .#### #.... .###. ....# ####.',
  t: '.#... .#... ###.. .#... .#... .#..# ..##.',
  u: '..... ..... #...# #...# #...# #..## .##.#',
  v: '..... ..... #...# #...# #...# .#.#. ..#..',
  w: '..... ..... #...# #.#.# #.#.# #.#.# .#.#.',
  x: '..... ..... #...# .#.#. ..#.. .#.#. #...#',
  y: '..... ..... #...# #...# .#### ....# .###.',
  z: '..... ..... ##### ...#. ..#.. .#... #####',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.',
  1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  2: '.###. #...# ....# ...#. ..#.. .#... #####',
  3: '##### ...#. ..#.. ...#. ....# #...# .###.',
  4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  5: '##### #.... ####. ....# ....# #...# .###.',
  6: '..##. .#... #.... ####. #...# #...# .###.',
  7: '##### ....# ...#. ..#.. .#... .#... .#...',
  8: '.###. #...# #...# .###. #...# #...# .###.',
  9: '.###. #...# #...# .#### ....# ...#. .##..',
  '.': '..... ..... ..... ..... ..... ..... ..#..',
  ',': '..... ..... ..... ..... ..#.. ..#.. .#...',
  ':': '..... ..#.. ..#.. ..... ..#.. ..#.. .....',
  ';': '..... ..#.. ..#.. ..... ..#.. ..#.. .#...',
  "'": '..#.. ..#.. ..... ..... ..... ..... .....',
  '"': '.#.#. .#.#. ..... ..... ..... ..... .....',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  '-': '..... ..... ..... ##### ..... ..... .....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  '/': '....# ....# ...#. ..#.. .#... #.... #....',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.',
  ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  '[': '..### ..#.. ..#.. ..#.. ..#.. ..#.. ..###',
  ']': '###.. ..#.. ..#.. ..#.. ..#.. ..#.. ###..',
  '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.',
  '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
  '=': '..... ..... ##### ..... ##### ..... .....',
  '%': '#...# #...# ...#. ..#.. .#... #...# #...#',
  '*': '..... #.#.# .###. ##### .###. #.#.# .....',
  '#': '.#.#. ##### .#.#. .#.#. ##### .#.#. .....',
  '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
  '_': '..... ..... ..... ..... ..... ..... #####',
  '|': '..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  '\\': '#.... #.... .#... ..#.. ...#. ....# ....#',
  '~': '..... ..... .#..# #.#.# #..#. ..... .....',
};

const ORDER = Object.keys(G);
const INDEX = new Map(ORDER.map((ch, i) => [ch, i]));
const COLS = 16;

const atlases = new Map();

function buildAtlas(color) {
  const rows = Math.ceil(ORDER.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL_W;
  canvas.height = rows * CELL_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ORDER.forEach((ch, i) => {
    const ox = (i % COLS) * CELL_W;
    const oy = Math.floor(i / COLS) * CELL_H;
    const grid = G[ch].split(' ');
    for (let y = 0; y < H; y++) {
      const row = grid[y] ?? '.....';
      for (let x = 0; x < W; x++) {
        if (row[x] === '#') ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  });
  return canvas;
}

function atlasFor(color) {
  let a = atlases.get(color);
  if (!a) {
    if (atlases.size > 24) atlases.clear();
    a = buildAtlas(color);
    atlases.set(color, a);
  }
  return a;
}

export const FONT_W = W;
export const FONT_H = H;
export const GLYPH_ADVANCE = CELL_W;

/** Width in virtual pixels of a string at the given tracking. */
export function textWidth(text, { tracking = 0 } = {}) {
  const n = String(text).length;
  if (!n) return 0;
  return n * (CELL_W + tracking) - (1 + tracking);
}

/**
 * Draw text. Coordinates are the top-left of the first glyph cell, in virtual
 * pixels, so everything lands on the pixel grid exactly.
 */
export function drawText(ctx, text, x, y, {
  color = '#fff', tracking = 0, align = 'left', shadow = null,
} = {}) {
  const str = String(text);
  const width = textWidth(str, { tracking });
  let ox = Math.round(x);
  if (align === 'center') ox = Math.round(x - width / 2);
  else if (align === 'right') ox = Math.round(x - width);
  const oy = Math.round(y);

  if (shadow) blit(ctx, str, ox + 1, oy + 1, shadow, tracking);
  blit(ctx, str, ox, oy, color, tracking);
  return width;
}

function blit(ctx, str, x, y, color, tracking) {
  const atlas = atlasFor(color);
  let cx = x;
  for (const ch of str) {
    const i = INDEX.has(ch) ? INDEX.get(ch) : INDEX.get('?');
    const sx = (i % COLS) * CELL_W;
    const sy = Math.floor(i / COLS) * CELL_H;
    ctx.drawImage(atlas, sx, sy, W, H, cx, y, W, H);
    cx += CELL_W + tracking;
  }
}

/** Greedy word wrap, measured in glyph cells. */
export function wrapText(text, maxWidth, { tracking = 0 } = {}) {
  const out = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && textWidth(candidate, { tracking }) > maxWidth) {
        out.push(line);
        line = word;
      } else line = candidate;
    }
    out.push(line);
  }
  return out;
}

export const GLYPH_COUNT = ORDER.length;
