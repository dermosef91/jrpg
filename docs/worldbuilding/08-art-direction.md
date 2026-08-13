# Art Direction — "lantern-lit woodcut"

The rule the whole game is drawn by, in one line: **light is scarce, low, and
amber; everything it does not reach falls into cold blue shade.** There is no
neutral grey anywhere. A lit surface steps up the AMBER or WOOD ramp; an unlit
one steps down the SHADE ramp.

That is not styling. The Ember is a dying variable star, so scarce directional
warm light against cold fill *is* the premise, rendered.

## Rules

1. **Everything is wood.** Grain on almost every surface, at several scales:
   fibre in a combatant, boards in a deck, ridges in bark, rings in a core.
2. **Ground everything.** No floating tokens and no flat plans. Solid tiles have
   height and cast occlusion; people have shoulders, coats and a walk; props sit
   on the deck where somebody left them. If a thing exists in the fiction it is
   drawn as that thing, not as a symbol for it.
3. **Light is placed, not ambient.** Lamps, sunwood, graft glow and the Ember
   are the only sources. Everything else is falloff. Pools of light are how the
   player reads a space.
4. **Type does two jobs.** A print serif for anything the world says about
   itself (titles, names, verdicts); monospace for anything an auditor would
   have typed (readouts, logs, forms, numbers).
5. **Mechanics are diegetic overlays.** The Grain mechanic is drawn *on* the
   opponent as a reading overlay — fibre lines and a dial — because that is what
   the party would actually see through a lens. Unread opponents get no overlay
   at all, which is what makes Read worth a turn.

## Palette

Eight ramps, five to six stops each (`src/engine/palette.js`), ordered dark to
light so shading a surface means stepping a ramp rather than inventing a colour.

| Ramp | Carries |
|---|---|
| `bark` | interiors, panel grounds, night, the void |
| `wood` | decks, walls, trunks — anything milled or living and lit |
| `amber` | the Ember, sunwood, lamplight. The only true light in the world |
| `ember` | heat: fire, rot-glow, hostile grafts |
| `shade` | shadow, water, sky, everything the light failed to reach |
| `sap` | living tissue, allied grafts, healthy canopy |
| `pale` | paper, bone, text |
| `scar` | damage, scars, refusal |
| `glass` | vitrified ground, the Glassing |

The four Grain positions hold one colour each everywhere they appear, so the
dial, the overlay, the kit table and the action list all agree.

## Rendering

No sprites and no asset files: rings, grain, light pools, figures and props are
all geometry. That suits a world made of wood, and keeps the build under 200 kB.

- **Post chain.** Bloom, a warm-centre/cold-edge grade, and paper grain. The
  grade is a plain source-over wash rather than a blend stack — on a software
  rasteriser a full-screen separable blend costs more than the rest of the frame
  put together, and the look survives the substitution.
- **Auto-degrade.** Quality steps down (bloom, then grain) after sustained slow
  frames, and when bloom is off the scene is drawn straight to the visible canvas
  instead of through an offscreen buffer. The look does not depend on the post
  chain — the lighting is drawn into the scene.
- **Caching.** Panels and radial falloffs are rasterised once into sprites and
  blitted after that; radii are quantised so pulsing lights reuse a few sprites.

## Motion

Nothing snaps. Grain rotation tweens through its 45°, HP bars chase their value,
attackers shove toward what they hit, and damage numbers arc and fade. Impact is
sold with hit-stop, a directional shake, a screen flash and a particle burst
whose preset is chosen by the Grain relation — splinters across the fibre,
a glancing scatter along it.

## Sound

Procedural WebAudio, no samples (`src/engine/audio.js`). Wood, not metal:
nothing rings brightly except sunwood and a maturing graft, the only things in
this world meant to feel like light. Sounds take parameters, so an across-grain
hit is a brighter, sharper version of the same crack as a glancing one. Each
region gets a low drone bed; `m` mutes, and the setting persists.
