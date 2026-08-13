# Art direction

Everything is drawn to a **480×270 backbuffer** and blitted at an integer scale
with smoothing off, so a virtual pixel is always a clean square block of device
pixels. There are no image assets: every sprite, tile, glyph and UI frame is
drawn with primitives and cached.

## The palette rule

Three families, and nothing else:

- **ink** — the near-black of the deep galleries
- **ember** — burnt orange, the only light in the world
- **bone** — carved stone, masks, cloth, type

Plus a skin ramp for people and a small wound ramp for damage. **If a pixel is
not black it is either burning or it is bone.** No blues, no greens, no neutral
grey — a test asserts every ramp stop is warm (red channel ≥ blue channel) and
that every ramp runs monotonically dark to light, so shading means stepping a
ramp rather than inventing a colour.

## Rendering rules

1. **No smooth gradients.** Everything that fades, fades by **4×4 Bayer
   dithering** — `dither()` for flat coverage, `glow()` for radial falloff. That
   dither texture is most of what makes the image read as pixel art rather than
   as vector shapes at low resolution.
2. **Light is placed, not ambient.** Lamps, shards, mandalas and inlay are the
   only sources; everything else is falloff.
3. **Everything lands on the pixel grid.** All primitives round their
   coordinates. Bresenham lines, midpoint circles, scanline polygons.
4. **Cache aggressively.** Arena backdrops, character poses, UI frames and font
   atlases are each rasterised once into an offscreen canvas and blitted.

## Type

A hand-authored **5×7 bitmap font** (89 glyphs: full upper and lower case,
digits, and punctuation), rasterised into a tinted atlas per colour and blitted
one `drawImage` per character. A test asserts every glyph is exactly 5×7, that
nothing but space is blank, and that the font covers every character the UI
actually prints.

## Composition

- **Battle** is a side view: opponents left, the line right, on a ritual circle
  inlaid into the gallery floor, with a sun-mandala burning on the back wall
  behind a bone monolith. Bodies are lit a step or two above the wall tone so
  they never read as floating masks.
- **Exploration** is isometric — 24×12 diamonds, one storey of elevation at 10px
  — stone platforms with ember inlay, hung in blackness among colossal roots.
- **Menus** are ember rules and bone plates with hard corner brackets and a root
  ornament in each corner. Nothing is rounded and nothing is soft.

## Sound

Procedural WebAudio, no samples. Struck wood, bone flute and low drum. Nothing
rings brightly except ember itself — resonance, rites and shards ring; everything
else knocks. `m` mutes, and the setting persists.

## Darkness, and how light is drawn

Two rules, both learned the hard way.

**Light is a colour, not an overlay.** On the Quiet Stair the floor is shaded by
grid distance from Zahra's lamp — every tile is mixed toward the void before it
is drawn — and the black mask on top exists only to take the props, the party
line and the hanging roots with it. Laying black over uniformly bright stone
gives you a hole cut in a picture; shading the stone gives you light falling on
rock. The battle backdrop for that fight bakes the same falloff into its cached
sprite, so its gradient lives in the colours and never in a dither.

**Dithered glow has a floor.** `glow()` is a 4x4 Bayer threshold, so below about
a quarter coverage it stops reading as light and starts reading as a lattice of
loose orange pixels on a regular grid — which is what a wide, weak ambient wash
always is. Big soft light uses `wash()` instead: stacked translucent ellipses,
smooth at any strength. `glow()` is kept for small bright sources, where it is
dense enough to read as a flame.

The same applies to scrims. A full-screen Bayer dither at two thirds coverage
behind a teaching card turns every pixel of the fight into static; a flat
translucent rect does not.

## The stair, side on

A fight that happens in the dark does not cut to a sunlit hall. `arena.js`
carries two backdrops: the low gallery with its sun mandala, and the Quiet
Stair — courses of dressed rock climbing out of the lamp, a dead seam running
the full height with the sockets where its shards used to sit, roots through
the joints, and a flagged landing whose joints splay toward the camera. Which
one is drawn comes off the encounter, falling back to wherever the party is
standing when the fight starts.
