// Browser smoke test. The unit tests cover the pure logic; this covers the part
// that only breaks in a real browser -- scenes actually rendering without
// throwing, and the on-screen controls landing somewhere a thumb can reach
// without covering the game.
//
//   npm run smoke                 # against the repo
//   npm run smoke -- --root _site --shots shots
//
// Needs Playwright, which is deliberately not a dependency of the game:
//   npm install --no-save playwright && npx playwright install chromium

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const ROOT = flag('root', '.');
const SHOTS = flag('shots');
const PORT = Number(flag('port', 8931));
const BASE = `http://127.0.0.1:${PORT}/`;

const problems = [];
const fail = (where, why) => problems.push(`${where}: ${why}`);
const ok = (where) => console.log(`  ok   ${where}`);

// --- server -----------------------------------------------------------------

const server = spawn(process.execPath, ['tools/serve.mjs', ROOT], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const shutdown = () => server.kill();
process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(130); });

for (let attempt = 0; ; attempt++) {
  try {
    const res = await fetch(BASE);
    if (res.ok) break;
  } catch {
    if (attempt > 60) throw new Error(`server never came up on ${BASE}`);
  }
  await new Promise((r) => setTimeout(r, 100));
}

if (SHOTS) await mkdir(SHOTS, { recursive: true });

// --- helpers ----------------------------------------------------------------

const browser = await chromium.launch();

async function openPage(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  return { page, errors };
}

const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

const hold = async (page, key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(140);
};

// --- 1. every scene renders without throwing --------------------------------

console.log('\nscenes');
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const { page, errors } = await openPage(context);
  await shot(page, '01-title');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  if (!(await page.evaluate(() => !!window.__game?.field))) fail('title', 'never reached the field');
  else ok('title -> field');
  await shot(page, '02-braid');

  for (const map of ['cordwain_mid', 'cordwain_root', 'cordwain_crown']) {
    await page.evaluate((id) => window.__game.goTo(id), map);
    await page.waitForTimeout(260);
    const loaded = await page.evaluate(() => window.__game.field.map.id);
    if (loaded !== map) fail('field', `goTo(${map}) landed on ${loaded}`);
    else ok(`field ${map}`);
  }
  await shot(page, '03-town');

  // Dialogue: walk into Verity on Crown.
  await hold(page, 'ArrowLeft', 1100);
  await hold(page, 'ArrowUp', 700);
  await hold(page, 'ArrowLeft', 900);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  await shot(page, '04-dialogue');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Audit: sample, then file the true span and check the verdict comes back.
  await page.evaluate(() => window.__game.startAudit());
  await page.waitForTimeout(300);
  for (let i = 0; i < 4; i++) {
    await hold(page, 'ArrowRight', 400);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(120);
  }
  const sampled = await page.evaluate(() => window.__game.scenes.top.samples.size);
  if (sampled < 3) fail('audit', `sampling did not register (${sampled} cores)`);
  else ok(`audit sampling (${sampled} cores)`);
  await shot(page, '05-audit');

  await page.evaluate(() => {
    const s = window.__game.scenes.top;
    s.claim = { start: s.core.edit.start, end: s.core.edit.end };
  });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const verdict = await page.evaluate(() => window.__game.scenes.top.result?.verdict);
  if (verdict !== 'certified') fail('audit', `filing the true span returned '${verdict}'`);
  else ok('audit verdict');
  await shot(page, '06-audit-result');
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(180); }

  // Battle: drive the real menus and confirm a turn resolves.
  await page.evaluate(() => window.__game.startBattle());
  await page.waitForTimeout(400);
  const opening = await page.evaluate(() => {
    const b = window.__game.scenes.top.battle;
    return { round: b.round, sap: b.sap, foeHp: b.foes[0].hp };
  });
  await shot(page, '07-battle');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await shot(page, '08-battle-targeting');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(320); }
  const later = await page.evaluate(() => {
    const b = window.__game.scenes.top?.battle;
    return b ? { round: b.round, sap: b.sap, foeHp: b.foes[0].hp, over: b.over } : null;
  });
  await shot(page, '09-battle-later');
  if (!later) ok('battle ran to a conclusion');
  else if (later.round === opening.round && later.foeHp === opening.foeHp && later.sap === opening.sap) {
    fail('battle', 'nothing advanced after sixteen inputs');
  } else ok(`battle advanced (round ${opening.round} -> ${later.round})`);

  if (errors.length) fail('scenes', `${errors.length} runtime error(s): ${errors[0]}`);
  else ok('no runtime errors');
  await context.close();
}

// --- 2. layout across viewports ---------------------------------------------

console.log('\nlayout');
const VIEWPORTS = [
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
  { name: 'phone-portrait', width: 390, height: 844, touch: true, portrait: true },
  { name: 'tablet-landscape', width: 1024, height: 768, touch: true },
  { name: 'small-phone-landscape', width: 667, height: 375, touch: true },
  { name: 'desktop', width: 1440, height: 900, touch: false },
];

for (const v of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    hasTouch: v.touch,
    isMobile: v.touch,
    deviceScaleFactor: v.touch ? 3 : 1,
  });
  const { page, errors } = await openPage(context);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);

  const info = await page.evaluate(() => {
    const box = document.querySelector('canvas').getBoundingClientRect();
    const pad = document.querySelector('.touch-pad')?.getBoundingClientRect() ?? null;
    const buttons = document.querySelector('.touch-buttons')?.getBoundingClientRect() ?? null;
    const hits = (a, b) => !!a && !!b
      && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return {
      portrait: document.body.classList.contains('is-portrait'),
      controls: !!pad,
      fits: box.width <= innerWidth + 1 && box.height <= innerHeight + 1,
      scrolls: document.documentElement.scrollWidth > innerWidth + 1
        || document.documentElement.scrollHeight > innerHeight + 1,
      overlaps: hits(pad, box) || hits(buttons, box),
      onScreen: pad ? pad.left >= -1 && pad.right <= innerWidth + 1
        && pad.top >= -1 && pad.bottom <= innerHeight + 1 : null,
      keyPx: pad ? Math.min(pad.width, pad.height) / 3 : null,
    };
  });

  const where = v.name;
  if (!info.fits) fail(where, 'canvas overflows the viewport');
  if (info.scrolls) fail(where, 'page scrolls');
  if (v.touch && !v.portrait && !info.controls) fail(where, 'no touch controls');
  if (!v.touch && info.controls) fail(where, 'touch controls on a mouse device');
  if (v.portrait && !info.portrait) fail(where, 'portrait did not ask for the long edge');
  if (info.controls && !info.portrait) {
    if (info.overlaps) fail(where, 'controls sit on top of the game');
    if (info.onScreen === false) fail(where, 'controls are off screen');
    if (info.keyPx < 34) fail(where, `keys too small (${info.keyPx.toFixed(0)}px)`);
  }

  // The d-pad must actually drive the party.
  if (v.touch && !v.portrait) {
    const before = await page.evaluate(() => ({ x: window.__game.field.px, y: window.__game.field.py }));
    const box = await page.locator('.touch-key[data-action="right"]').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(260);
    const after = await page.evaluate(() => ({ x: window.__game.field.px, y: window.__game.field.py }));
    if (after.x === before.x && after.y === before.y) fail(where, 'the d-pad did not move the party');
  }

  if (errors.length) fail(where, `runtime error: ${errors[0]}`);
  await shot(page, `10-${v.name}`);
  if (!problems.some((p) => p.startsWith(`${where}:`))) ok(where);
  await context.close();
}

await browser.close();
server.kill();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(` FAIL ${p}`);
  process.exit(1);
}
console.log('\nsmoke passed');
