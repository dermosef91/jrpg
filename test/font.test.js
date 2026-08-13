import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The font module builds a canvas atlas on import, so the glyph table is checked
// as source here rather than by importing it under Node.
const SRC = readFileSync(new URL('../src/engine/font.js', import.meta.url), 'utf8');
const BODY = SRC.match(/const G = \{([\s\S]*?)\n\};/)[1];
const ROWS = [...BODY.matchAll(/['"]([.#][.# ]{6,})['"]/g)].map((m) => m[1]);

test('every glyph is exactly 5 wide and 7 tall', () => {
  assert.ok(ROWS.length > 80, `only found ${ROWS.length} glyphs`);
  for (const glyph of ROWS) {
    const rows = glyph.split(' ');
    assert.equal(rows.length, 7, `glyph has ${rows.length} rows: ${glyph}`);
    for (const row of rows) assert.equal(row.length, 5, `row is ${row.length} wide: ${row}`);
  }
});

test('the font covers everything the UI actually prints', () => {
  const keys = [...BODY.matchAll(/^\s*(?:(['"])(.*?)\1|(\w))\s*:/gm)]
    .map((m) => m[2] ?? m[3]);
  const needed = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?-+/()[]<>=%*#&_|\'"';
  const missing = [...needed].filter((ch) => !keys.includes(ch));
  assert.deepEqual(missing, [], `font is missing: ${missing.join('')}`);
});

test('no glyph is entirely blank except space', () => {
  const keys = [...BODY.matchAll(/^\s*(?:(['"])(.*?)\1|(\w))\s*:\s*(['"])(.*?)\4/gm)]
    .map((m) => [m[2] ?? m[3], m[5]]);
  for (const [ch, glyph] of keys) {
    if (ch === ' ') continue;
    assert.ok(glyph.includes('#'), `glyph '${ch}' is blank`);
  }
});
