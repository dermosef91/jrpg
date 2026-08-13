export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeIn = (t) => t * t * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** Overshoots past 1 and settles -- for anything that should feel struck. */
export const backOut = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
export const bounce = (t) => Math.sin(t * Math.PI);
/** Shortest signed distance between two angles, for tweening the Grain dial. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** A one-shot value tween, driven by update(dt). */
export class Tween {
  constructor(value = 0) {
    this.value = value;
    this.from = value;
    this.to = value;
    this.t = 1;
    this.duration = 1;
    this.ease = easeOut;
  }

  set(value) {
    this.value = this.from = this.to = value;
    this.t = 1;
    return this;
  }

  to_(target, duration = 0.25, ease = easeOut) {
    this.from = this.value;
    this.to = target;
    this.duration = Math.max(0.0001, duration);
    this.t = 0;
    this.ease = ease;
    return this;
  }

  get done() { return this.t >= 1; }

  update(dt) {
    if (this.t >= 1) return this.value;
    this.t = clamp01(this.t + dt / this.duration);
    this.value = lerp(this.from, this.to, this.ease(this.t));
    return this.value;
  }
}
