# Second Harvest

A JRPG about adapting to an indifferent natural fact.

The sun is in a natural variable dim phase. Nobody caused it, nobody can fix it, and the
cities are trees that walk — city-scale migratory megaflora that creep across the land
chasing light at meters per year. Their growth rings are a literal memory medium, so
history here is a physical substance that can be read and, by certain inherited
lineages, written.

You play a licensed audit circuit: four professionals who travel between cities
verifying official histories against what the wood actually remembers. In the course of
an unremarkable migration-rights dispute, you find a forty-ring stretch of record that
is chemically *too smooth* to be natural — in the same hand, at the same depth, in every
city in the world.

No chosen one. No macguffin. No final boss.

## Run it

```sh
npm start        # http://localhost:8080
npm test         # 61 tests, no dependencies
npm run build    # assemble the deployable site into _site/
npm run smoke    # drive every scene in a real browser (needs Playwright, see below)
```

No build step and no dependencies — ES modules, canvas, and a 40-line static server
(ES modules will not load over `file://`, which is the only reason the server exists).

**Controls:** arrows move · `enter` confirm · `x` cancel · `e` sample (hold `e` with
left/right to scrub the ring strip quickly). On touch devices the same actions appear as
on-screen keys.

## What is playable

This is a vertical slice of Act I, built to prove out the three systems that are
specific to this setting rather than generic to the genre.

**The audit** (`src/game/audit/`) — the core non-combat verb. A core sample is drawn as
a strip of rings; you have fourteen cores to spend, and each one reports the local
variance of ring chemistry around that year. Natural years are noisy. A *written* span
is not contradictory, it is **too well behaved** — anomalously low variance. Bracket the
span and file with the Ring Council. Claims are scored by intersection over union, so
bracketing the whole core is not a correct answer, it is a useless one.

**Grafting combat** (`src/game/battle/`) — no elemental wheel, no per-character MP.

- **Grain.** Every combatant has a fibre direction on a four-position dial, drawn as an
  actual wood cross-section, so force *across* the grain is drawn exactly perpendicular
  to the lines. Across hits for ×1.75; *along* the grain hits for ×0.25 **and feeds the
  target**. Any connecting hit rotates the target's grain one step — so exploiting a
  weakness destroys it, and no single character can chain the good hit. Optimal play is
  a rotation dance across the whole party.
- **Sap.** One pool, shared by four people who disagree about strategy. Short on Sap,
  any character may **burn heartwood** and pay in HP.
- **Grafts.** Placed with a maturity timer and doing nothing until they mature. Harvest
  early for less, or watch an opponent excise the investment entirely. Every fight's
  tension curve is unrealised investment.
- **Scars.** Big hits lower maximum capacity *and lock the grain*, which stops the
  rotation dance and lets one character chain across-grain hits. The tactical arc of a
  hard fight is the moral logic of Pruning, and the game lets you feel good about it
  first.

**The field** (`src/game/world/`) — the Braid overworld and Cordwain as a vertical
Crown / Mid / Root town. Traces — the kilometre-wide furrows a Strider's root-crown
drags behind it for its whole migration history — are simultaneously the road network
and the archaeology, which is the map-level version of the game's whole theme: the
written record can be edited, so you navigate by scars.

## Art direction

**"Lantern-lit woodcut."** The Ember is a dying variable star, so the whole game
is drawn by one rule: light is scarce, low and amber, and everything it does not
reach falls into cold blue shade. No neutral grey anywhere.

Everything is geometry — no sprites, no asset files. Rings, grain, bark, light
pools, people and props are all drawn, which suits a world made of wood and keeps
the build under 200 kB.

- **The world is grounded, not diagrammed.** Solid tiles have height and cast
  occlusion; people have shoulders, coats and a walk; crates, barrels, planters
  and lamp posts sit where somebody left them. Opponents are what they actually
  are — a graft that kept growing, a lesion of structural rot, a person with a
  writ — never abstract shapes.
- **Mechanics are diegetic overlays.** Grain is drawn *on* the opponent as an
  auditor's reading overlay, fibre lines and a dial. An unread opponent gets no
  overlay at all, which is what makes spending a turn on Read worth it.
- **Type does two jobs.** A print serif for what the world says about itself,
  monospace for anything an auditor would have typed.
- **Motion and impact.** Grain rotation tweens through its 45°, attackers shove
  toward what they hit, and hits land with hit-stop, directional shake, a screen
  flash and a particle burst chosen by the Grain relation.
- **Sound is procedural.** WebAudio, no samples. Wood, not metal — nothing rings
  brightly except sunwood and a maturing graft. `m` mutes.

The post chain (bloom, warm/cold grade, paper grain) auto-degrades on slow
devices, and the look does not depend on it: the lighting is drawn into the
scene, not added afterwards.

Full detail in
[`docs/worldbuilding/08-art-direction.md`](docs/worldbuilding/08-art-direction.md).

## Mobile

The stage is a fixed 960×540 scaled to fit. On touch devices, on-screen controls are
placed into whatever slack the letterbox leaves — side gutters on a wide phone, a bottom
band on a boxier tablet — whichever leaves the larger stage. They are never drawn *over*
the game, because the battle menu and the audit readout live in exactly the screen
corners a thumb would cover. Only a viewport too small for either falls back to a
translucent overlay. Portrait asks for the long edge instead of pretending a phone can
show this much small type sideways.

Small phones (≈667×375 landscape) work but are cramped; the type is legible and no UI is
hidden, but a larger screen is much better.

## Deployment

`.github/workflows/deploy.yml` publishes to GitHub Pages on every push: it runs the
tests, assembles `_site/` (just `index.html` and `src/` — the tests, tooling and setting
bible are not published), and deploys. A failing test blocks the publish.

`.github/workflows/ci.yml` runs the unit tests on Node 20 and 22, then a headless
Chromium smoke pass over the built artifact — every scene, plus the touch layout across
five viewports — uploading the screenshots as a build artifact.

The browser smoke test needs Playwright, which is deliberately not a dependency of the
game:

```sh
npm install --no-save playwright && npx playwright install chromium
npm run smoke -- --root _site --shots shots
```

**One-time setup:** Pages has to be turned on in the repository — Settings → Pages →
Build and deployment → Source → **GitHub Actions**. Until that is set, the deploy job
fails at the last step.

## Layout

```
docs/worldbuilding/   the setting bible — start at 00-design-principles.md
src/engine/           loop, input, scene stack, renderer, post-processing, palette,
                      particles, procedural audio, seeded RNG, touch controls
src/game/battle/      Grain / Graft / Sap / Scar engine, and its UI
src/game/audit/       ring generation, variance analysis, the audit minigame
src/game/world/       tile-map field scene, figure rendering, the Braid, Cordwain
src/game/data/        the circuit, and what fights you
test/                 pure-logic tests: grain maths, battle rules, ring forensics,
                      map reachability, touch layout, palette ramps, particles
test/browser/         headless Chromium smoke over every scene and five viewports
```

Rendering is geometric rather than sprite-based — rings, grain lines and panels are
circles and strokes — so there are no art assets to load and the visual language matches
the fiction.

`window.__game` is exposed in the browser console for poking at scenes
(`__game.startAudit()`, `__game.goTo('cordwain_crown')`).

## Documentation

**[`docs/worldbuilding/`](docs/worldbuilding/README.md)** — the setting bible. Start with
[`00-design-principles.md`](docs/worldbuilding/00-design-principles.md), the list of
constraints that generated everything else, then
[`07-battle-system.md`](docs/worldbuilding/07-battle-system.md) for the combat design
this code implements.

> `04-story.md` contains full spoilers by design.
