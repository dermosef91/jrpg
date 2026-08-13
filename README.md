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
npm test         # 49 tests, no dependencies
npm run build    # assemble the deployable site into _site/
npm run smoke    # drive every scene in a real browser (needs Playwright, see below)
```

No build step and no dependencies — ES modules, canvas, and a small static server
(ES modules will not load over `file://`, which is the only reason it exists).

**Controls:** arrows move · `enter` confirm · `x` back · `c` menu ·
`q`/`e` menu tabs · `m` sound. On touch devices the same actions appear as
on-screen keys.

## The first fifteen minutes

The game opens on a black screen and a bell. A Warden went down the Quiet Stair
four days ago to read the writ on a seam of inlay that had gone cold, and a
Warden always rings the bell.

You then walk down that stair yourself, in the dark, with one lamp. The stone
shades out by distance from the lamp rather than being cropped by a black
circle, so what you get is light falling on rock — and every seam of inlay
beside the steps is a cut channel with nothing running through it. Nobody
explains that. You see it, and then Aya says it.

Six trigger tiles carry the descent: the dead seam, an ambush, two hundred
steps of nothing, a shock from far below, a glimpse, and the landing. The
ambush is the tutorial fight, and it is where **resonance** gets taught —
after the player has already landed a resonant hit and watched it come up
double, never before. The fight happens on the stair itself, on its own dark
backdrop, not in the sunlit arena.

The landing is a Warden's mask, cracked through, and a bell that will not ring.
Then you go back up a great deal faster than you came down, and arrive at
Rootplaza having earned it — lamps lit, everyone walking about like it is a
normal day. The NPCs have different lines now that you have seen the mask, the
objective is REPORT THE SEAM, and the Gate Hand is the only person who counts as
having been told.

The script itself is a plain array of steps in
[`src/game/story/prologue.js`](src/game/story/prologue.js), run by a small
director scene that sits on top of the field and drives it. Tests assert that
every beat is hung on a trigger tile that exists, that every trigger has a beat,
that the beats fire in the order the player will walk into them, and that no
script ever ends with the screen still faded to black.

## The game

**Exploration** is top-down on a square grid — 24px tiles, the camera centred on
the party, screen axes and grid axes the same so a press of "up" walks north and
nothing else. Rootplaza is a network of stone decks cut out of the rock, joined
by stairs and a rope bridge, lit by shard-lamps. Walk into a lamp to rest, a
chest to loot it, an NPC to hear what has gone wrong at the Quiet Stair. Out on
the open decks something eventually finds you.

Elevation survives from above as the climb rule (one storey at a time, or any
step where one side is a stair) and as a drawn lip between neighbouring squares
of different height, which is enough to read a flight of stairs looking straight
down at it. Everything that is not floor is the rock the gallery was cut out of:
a dark mass with a face hanging into the square in front of it, painted in a
value range the bone-pale floor never enters, so what is walkable is never a
question the player has to stop and answer.

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
src/game/explore/     top-down grid projection, maps, exploration scene
src/game/menu/        the party menu
src/game/story/       the cutscene director and the prologue script
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
