// Grain: the weakness system that consumes itself.
// See docs/worldbuilding/07-battle-system.md section 1.
//
//         RISING (0)
//             |
// COMPACTED(3)-+-LATERAL (1)
//             |
//        TWISTED (2)

export const GRAIN = Object.freeze({ RISING: 0, LATERAL: 1, TWISTED: 2, COMPACTED: 3 });
export const GRAIN_NAMES = Object.freeze(['Rising', 'Lateral', 'Twisted', 'Compacted']);
export const GRAIN_COUNT = 4;

export const RELATION = Object.freeze({ ACROSS: 'across', OBLIQUE: 'oblique', ALONG: 'along' });

/** Force multipliers. `along` is below 1 *and* feeds the target -- see feedsTarget(). */
export const MULTIPLIER = Object.freeze({
  [RELATION.ACROSS]: 1.75,
  [RELATION.OBLIQUE]: 1.0,
  [RELATION.ALONG]: 0.25,
});

/** How force applied along `actionGrain` meets a fibre running along `targetGrain`. */
export function relation(actionGrain, targetGrain) {
  const d = (targetGrain - actionGrain + GRAIN_COUNT) % GRAIN_COUNT;
  if (d === 2) return RELATION.ACROSS;
  if (d === 0) return RELATION.ALONG;
  return RELATION.OBLIQUE;
}

export function multiplier(actionGrain, targetGrain) {
  return MULTIPLIER[relation(actionGrain, targetGrain)];
}

/** Along-grain force is absorbed as growth: the target gains Sap instead of taking it. */
export function feedsTarget(actionGrain, targetGrain) {
  return relation(actionGrain, targetGrain) === RELATION.ALONG;
}

export function rotate(grain, steps = 1) {
  return (((grain + steps) % GRAIN_COUNT) + GRAIN_COUNT) % GRAIN_COUNT;
}

/** The action grain that would strike across a given fibre. */
export function acrossFrom(targetGrain) {
  return rotate(targetGrain, 2);
}
