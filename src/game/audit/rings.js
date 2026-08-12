import { makeRng } from '../../engine/rng.js';

// The forensic premise, in code. See docs/worldbuilding/02-grafting.md.
//
// Real ring chemistry is NOISY -- rainfall, disease, insect load, light. The
// signature of a written passage is not contradiction but anomalously LOW
// variance: a stretch of history that is suspiciously well-behaved.
//
// So generation lays down gaussian noise plus occasional shock years, then
// overwrites a span with a smooth curve. Detection is a rolling standard
// deviation. Nothing here knows about rendering.

export const SAMPLE_WINDOW = 4;   // rings either side included in a local reading
export const SAMPLE_BUDGET = 14;  // cores you may pull before filing

/**
 * @returns {{rings: Array, edit: {start: number, end: number}, seed: number, firstYear: number}}
 */
export function generateCore({
  seed = 1, count = 120, firstYear = 812, editLength = 40,
} = {}) {
  const rng = makeRng(seed);
  const rings = [];

  // Slow environmental trend: the Ember's output wandering over a century.
  const trend = (i) => 1
    + 0.22 * Math.sin((i / count) * Math.PI * 1.7 + rng.next() * 0)
    + 0.10 * Math.sin((i / count) * Math.PI * 5.3);

  for (let i = 0; i < count; i++) {
    const base = trend(i);
    let width = base + rng.normal(0, 0.17);
    let shock = false;
    // Shock years: a drought, a fire, an insect year. Nature is lumpy.
    if (rng.next() < 0.06) {
      width = base + rng.normal(0, 0.55);
      shock = true;
    }
    rings.push({
      index: i,
      year: firstYear + i,
      width: clamp(width, 0.16, 2.4),
      shock,
      edited: false,
    });
  }

  // The edit. Placed away from both margins so it cannot be found by guessing an end.
  const margin = 14;
  const start = Math.floor(rng.range(margin, count - editLength - margin));
  const end = start + editLength;
  // Anchor to the local trend either side rather than to two individual rings.
  // A forger blends into the surrounding century; anchoring on single noisy rings
  // would leave a steep ramp whose own slope reads as variance.
  const localMean = (a, b) => mean(rings.slice(Math.max(0, a), Math.min(count, b)).map((r) => r.width));
  const anchorA = localMean(start - 4, start + 1);
  const anchorB = localMean(end - 1, end + 4);
  for (let i = start; i < end; i++) {
    const p = (i - start) / (editLength - 1);
    // Smooth interpolation with a token wobble -- too regular to be a real century.
    const smooth = anchorA + (anchorB - anchorA) * p
      + 0.03 * Math.sin(p * Math.PI * 2);
    rings[i].width = clamp(smooth + rng.normal(0, 0.02), 0.16, 2.4);
    rings[i].shock = false;
    rings[i].edited = true;
  }

  return { rings, edit: { start, end }, seed, firstYear };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function mean(values) {
  return values.reduce((a, b) => a + b, 0) / (values.length || 1);
}

export function stddev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** Local standard deviation of ring width around `index`. This is the reading a
 *  sample gives you, and the only number that actually matters. */
export function localVariance(rings, index, window = SAMPLE_WINDOW) {
  const lo = Math.max(0, index - window);
  const hi = Math.min(rings.length, index + window + 1);
  return stddev(rings.slice(lo, hi).map((r) => r.width));
}

/** The full rolling profile. Used for the reference plot and by the tests. */
export function varianceProfile(rings, window = SAMPLE_WINDOW) {
  return rings.map((_, i) => localVariance(rings, i, window));
}

/** Natural baseline, taken as the median so the edited span cannot drag it down. */
export function naturalBaseline(profile) {
  const sorted = [...profile].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Automated read, used to sanity-check generated cores and as the reference
 *  implementation the tests assert against: the contiguous span whose mean local
 *  variance is furthest below the core's natural baseline. Scanning candidate
 *  spans directly is far steadier than thresholding, which fragments on the one
 *  or two rings inside an edit that happen to wobble. */
export function detectEditedSpan(rings, {
  window = SAMPLE_WINDOW, minLength = 18, maxLength = 64,
} = {}) {
  const profile = varianceProfile(rings, window);
  const n = profile.length;
  if (n < minLength) return null;

  // Prefix sums so each candidate span costs O(1) to score.
  const prefix = [0];
  for (let i = 0; i < n; i++) prefix.push(prefix[i] + profile[i]);
  const spanMean = (a, b) => (prefix[b] - prefix[a]) / (b - a);

  const baseline = naturalBaseline(profile);
  let best = null;
  for (let len = minLength; len <= Math.min(maxLength, n); len++) {
    for (let a = 0; a + len <= n; a++) {
      const inside = spanMean(a, a + len);
      // Reward depth below baseline and length, so the scan does not collapse
      // onto the single flattest handful of rings.
      const score = (baseline - inside) * Math.sqrt(len);
      if (!best || score > best.score) best = { start: a, end: a + len, score, inside };
    }
  }
  return best && best.inside < baseline ? { start: best.start, end: best.end } : null;
}

export const VERDICTS = Object.freeze({
  CERTIFIED: 'certified',
  PARTIAL: 'partial',
  REJECTED: 'rejected',
});

/**
 * Score a filed claim against the true edit. Intersection over union, because an
 * auditor who brackets the whole core is not right -- they are useless.
 */
export function scoreClaim(edit, claim) {
  const lo = Math.max(edit.start, claim.start);
  const hi = Math.min(edit.end, claim.end);
  const overlap = Math.max(0, hi - lo);
  const union = Math.max(edit.end, claim.end) - Math.min(edit.start, claim.start);
  const iou = union > 0 ? overlap / union : 0;
  const recall = overlap / Math.max(1, edit.end - edit.start);
  const precision = overlap / Math.max(1, claim.end - claim.start);

  const verdict = iou >= 0.7 ? VERDICTS.CERTIFIED
    : iou >= 0.35 ? VERDICTS.PARTIAL
    : VERDICTS.REJECTED;

  return { iou, recall, precision, overlap, verdict };
}
