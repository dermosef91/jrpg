// Browser smoke. The unit tests cover the pure logic; this covers what only
// breaks in a real browser -- scenes rendering without throwing, and the touch
// layout landing somewhere a thumb can reach without covering the game.
//
//   npm run smoke -- --root _site --shots shots
//
// Needs Playwright, deliberately not a dependency of the game:
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

const server = spawn(process.execPath, ['tools/serve.mjs', ROOT], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
process.on('exit', () => server.kill());
process.on('SIGINT', () => { server.kill(); process.exit(130); });

for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(BASE)).ok) break; } catch {
    if (attempt > 60) throw new Error(`server never came up on ${BASE}`);
  }
  await new Promise((r) => setTimeout(r, 100));
}
if (SHOTS) await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch();

async function open(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
/** Advance whatever cutscene is on top until the player has the field back. */
const skipScript = async (page, budget = 160) => {
  let lines = 0;
  for (let i = 0; i < budget; i++) {
    const scene = await page.evaluate(() => window.__game?.scenes?.top?.constructor?.name);
    if (scene === 'ExploreScene') return { reached: true, lines, scene };
    lines += 1;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(110);
  }
  const scene = await page.evaluate(() => window.__game?.scenes?.top?.constructor?.name);
  return { reached: false, lines, scene };
};

const hold = async (page, key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
};

// --- 1. every scene renders and responds -----------------------------------

console.log('\nscenes');
{
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const { page, errors } = await open(context);
  await shot(page, '01-title');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  const opened = await skipScript(page);
  if (!opened.reached) fail('title', `never reached the field, stuck in ${opened.scene}`);
  else ok(`title -> opening -> field (${opened.lines} scripted lines)`);
  const startedOn = await page.evaluate(() => window.__game.field?.mapId);
  if (startedOn !== 'quietstair') fail('opening', `the prologue starts on ${startedOn}`);
  else ok('the opening puts the party on the Quiet Stair');
  await shot(page, '02-explore');

  // Walking must actually move the party through the isometric grid.
  const before = await page.evaluate(() => {
    const s = window.__game.field;
    return { x: s.px, y: s.py };
  });
  // The prologue starts at the top of a stair, so no single direction is
  // guaranteed to be open. Try each in turn until the party takes a step.
  for (const key of ['ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowUp']) {
    await hold(page, key, 320);
    const now = await page.evaluate(() => {
      const s = window.__game.field;
      return { x: s.px, y: s.py };
    });
    if (now.x !== before.x || now.y !== before.y) break;
  }
  const after = await page.evaluate(() => {
    const s = window.__game.field;
    return { x: s.px, y: s.py };
  });
  if (before.x === after.x && before.y === after.y) fail('explore', 'the party never moved');
  else ok(`explore movement (${before.x},${before.y} -> ${after.x},${after.y})`);

  // Walking into a story beat is expected on the stair; clear it before asking
  // for the menu, which the field only opens when it is the scene on top.
  await skipScript(page);

  // Menu
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(600);
  const menu = await page.evaluate(() => window.__game.scenes.top?.constructor?.name);
  if (menu !== 'MenuScene') fail('menu', `expected MenuScene, got ${menu}`);
  else ok('menu opens');
  await shot(page, '03-menu');
  for (const tab of ['KeyE', 'KeyE', 'KeyE', 'KeyE', 'KeyE']) {
    await page.keyboard.press(tab);
    await page.waitForTimeout(180);
  }
  await shot(page, '04-menu-tabs');
  const tabIndex = await page.evaluate(() => window.__game.scenes.top.tab);
  if (typeof tabIndex !== 'number') fail('menu', 'tabs did not track');
  else ok(`menu tabs (landed on ${tabIndex})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Battle: drive the real command menu and confirm a turn resolves.
  await page.evaluate(() => window.__game.startBattle('mixed'));
  await page.waitForTimeout(800);
  const opening = await page.evaluate(() => {
    const b = window.__game.scenes.top.battle;
    return { round: b.round, foeHp: b.foes.reduce((n, f) => n + f.hp, 0) };
  });
  await shot(page, '05-battle');
  await page.keyboard.press('Enter');    // ATTACK
  await page.waitForTimeout(300);
  await shot(page, '06-battle-target');
  await page.keyboard.press('Enter');    // confirm target
  await page.waitForTimeout(900);
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(260);
  }
  const later = await page.evaluate(() => {
    const s = window.__game.scenes.top;
    const b = s?.battle;
    return b ? { round: b.round, foeHp: b.foes.reduce((n, f) => n + f.hp, 0), over: b.over } : null;
  });
  await shot(page, '07-battle-later');
  if (!later) ok('battle ran to a conclusion');
  else if (later.foeHp === opening.foeHp && later.round === opening.round) {
    fail('battle', 'nothing advanced after two dozen inputs');
  } else ok(`battle advanced (foe HP ${opening.foeHp} -> ${later.foeHp})`);

  if (errors.length) fail('scenes', `${errors.length} runtime error(s): ${errors[0]}`);
  else ok('no runtime errors');
  await context.close();
}

// --- 2. layout across viewports --------------------------------------------

console.log('\nlayout');
const VIEWPORTS = [
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
  { name: 'phone-portrait', width: 390, height: 844, touch: true, portrait: true },
  { name: 'tablet-landscape', width: 1024, height: 768, touch: true },
  { name: 'small-phone', width: 667, height: 375, touch: true },
  { name: 'desktop', width: 1440, height: 900, touch: false },
];

for (const v of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    hasTouch: v.touch, isMobile: v.touch, deviceScaleFactor: v.touch ? 2 : 1,
  });
  const { page, errors } = await open(context);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  await skipScript(page);

  const info = await page.evaluate(() => {
    const box = document.querySelector('canvas').getBoundingClientRect();
    const pad = document.querySelector('.touch-pad')?.getBoundingClientRect() ?? null;
    const btns = document.querySelector('.touch-btns')?.getBoundingClientRect() ?? null;
    const hits = (a, b) => !!a && !!b
      && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return {
      portrait: document.body.classList.contains('portrait'),
      controls: !!pad,
      fits: box.width <= innerWidth + 1 && box.height <= innerHeight + 1,
      scrolls: document.documentElement.scrollWidth > innerWidth + 1
        || document.documentElement.scrollHeight > innerHeight + 1,
      overlaps: hits(pad, box) || hits(btns, box),
      onScreen: pad ? pad.left >= -1 && pad.right <= innerWidth + 1 : null,
      keyPx: pad ? Math.min(pad.width, pad.height) / 3 : null,
    };
  });

  if (!info.fits) fail(v.name, 'canvas overflows the viewport');
  if (info.scrolls) fail(v.name, 'page scrolls');
  if (v.touch && !v.portrait && !info.controls) fail(v.name, 'no touch controls');
  if (!v.touch && info.controls) fail(v.name, 'touch controls on a mouse device');
  if (v.portrait && !info.portrait) fail(v.name, 'portrait did not ask for the long edge');
  if (info.controls && !info.portrait) {
    if (info.overlaps) fail(v.name, 'controls sit on top of the game');
    if (info.onScreen === false) fail(v.name, 'controls are off screen');
    if (info.keyPx < 34) fail(v.name, `keys too small (${info.keyPx.toFixed(0)}px)`);
  }

  if (v.touch && !v.portrait) {
    const before = await page.evaluate(() => {
      const s = window.__game.field;
      return { x: s.px, y: s.py };
    });
    const box = await page.locator('.touch-key[data-action="right"]').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      const s = window.__game.field;
      return { x: s.px, y: s.py };
    });
    if (before.x === after.x && before.y === after.y) fail(v.name, 'the d-pad did not move the party');
  }

  if (errors.length) fail(v.name, `runtime error: ${errors[0]}`);
  await shot(page, `10-${v.name}`);
  if (!problems.some((p) => p.startsWith(`${v.name}:`))) ok(v.name);
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
