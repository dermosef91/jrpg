# EMBERROOT

A pixel-art JRPG built from concept art.

The world is the inside of a dead colossal tree. Its holds are stone platforms
fused into the root galleries, and the only light is **ember** — fire running
through inlaid channels cut into every floor and pillar. It is going out.

Nothing here is loaded: no sprites, no tilesets, no fonts, no audio files. Every
pixel is drawn and every sound is synthesised at play time.

## Run it

```sh
npm start        # http://localhost:8080
npm test         # 38 tests, no dependencies
npm run build    # assemble the deployable site into _site/
npm run smoke    # drive every scene in a real browser (needs Playwright, see below)
```

No build step and no dependencies — ES modules, canvas, and a small static server
(ES modules will not load over `file://`, which is the only reason it exists).

**Controls:** arrows move · `enter` confirm · `x` back · `c` menu ·
`q`/`e` menu tabs · `m` sound. On touch devices the same actions appear as
on-screen keys.

## The game

**Exploration** is isometric. Rootplaza is a network of stone decks hung over a
drop, joined by stairs and a rope bridge, lit by shard-lamps. Walk into a lamp to
rest, a chest to loot it, an NPC to hear what has gone wrong at the Quiet Stair.
Out on the open decks something eventually finds you.

**Battle** is turn-based, four commands — ATTACK, RITE, ITEM, GUARD — with turn
order by AGI shown as a live queue. HP and **EP**: rites borrow ember, and the
ember comes from you.

**The tactical core is affinity.** Every character, rite and opponent is EMBER,
ROOT, BONE or HOLLOW, and they oppose in two pairs: EMBER ↔ HOLLOW, ROOT ↔ BONE.

- opposing affinity → **resonant**, ×1.8
- matching affinity → **discordant**, ×0.55

That is the entire weakness system. No resistance tables, no elemental wheel to
memorise — just "what is this thing, and who should be swinging at it." The trap
is deliberate: Kofi is the armoured one, and the boss of the low gallery is BONE,
which resonates against Kofi's ROOT. The most protected person in the party is
the one who should not be standing in front of that fight.

Defence mitigates as a ratio rather than a flat subtraction, so stacking DEF has
diminishing returns and can never make a character immune — a bug the tests
caught, where Kofi clamped every incoming hit to 1 and made guarding, buffs and
resonance all meaningless against him.

**The menu** carries PARTY / ITEMS / RITES / EQUIP / MAP / SAVE: character cards,
a full stat block, four equipment slots, the ten-shard inventory, and the world
route drawn as a node map. Three of the four characters stand in the line, so
FORMATION is a real choice — press `enter` on a character to move them in or out.

## Art

480×270, integer-scaled, smoothing off. Three colour families — ink, ember, bone
— and a hand-authored 5×7 bitmap font. Everything that fades, fades by 4×4 Bayer
dithering; there are no smooth gradients anywhere.

Full detail in [`docs/art-direction.md`](docs/art-direction.md). The setting is in
[`docs/world.md`](docs/world.md).

## Layout

```
src/engine/           renderer, bitmap font, input, scene stack, audio, touch, rng
src/game/art/         arena backdrop, party figures, foes, props, portraits
src/game/battle/      battle engine and its scene
src/game/explore/     isometric projection, map, exploration scene
src/game/menu/        the party menu
src/game/data/        party, rites, foes, equipment, items, shards, world route
test/                 pure-logic tests: palette, font, rites, battle, world, touch
test/browser/         headless Chromium smoke over every scene and five viewports
```

`window.__game` is exposed in the console for poking at scenes
(`__game.startBattle('warden')`, `__game.openMenu()`).

## Deployment

`.github/workflows/deploy.yml` publishes to GitHub Pages on every push to `main`:
it runs the tests, assembles `_site/` (only `index.html` and `src/`), and deploys.
A failing test blocks the publish. `.github/workflows/ci.yml` runs the unit tests
on Node 20 and 22, then a headless Chromium smoke pass over the built artifact.

The browser smoke needs Playwright, deliberately not a dependency of the game:

```sh
npm install --no-save playwright && npx playwright install chromium
npm run smoke -- --root _site --shots shots
```
