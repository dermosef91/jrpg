import { alpha, P, RAMP } from './palette.js';

// Post-processing. The game is drawn into an offscreen buffer and composited
// through this, which is what turns flat vector shapes into a lit scene:
// highlights bloom the way lamplight does through dusty air, the frame falls
// off into cold shade at the edges, and a paper grain sits over everything so
// the image reads as a printed plate rather than as clean canvas fills.

const BLOOM_DIVISOR = 6;
const NOISE_SIZE = 160;

const supportsFilter = (() => {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.filter = 'blur(1px)';
    return ctx.filter !== 'none';
  } catch { return false; }
})();

export class PostFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gradeSprite = null;
    this.bloom = document.createElement('canvas');
    this.bloomCtx = this.bloom.getContext('2d');
    this.noise = makeNoiseTile(NOISE_SIZE);
    this.enabled = true;
    this.quality = 2;          // 2 = bloom + grain, 1 = grain only, 0 = neither
    this.#slowFrames = 0;
    this.w = 0;
    this.h = 0;
  }

  #slowFrames;

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.bloom.width = Math.max(1, Math.round(w / BLOOM_DIVISOR));
    this.bloom.height = Math.max(1, Math.round(h / BLOOM_DIVISOR));
    this.vignette = null;
    this.grade = null;
    this.noisePattern = null;
  }

  /**
   * Composite the buffer onto the visible canvas.
   * @param {HTMLCanvasElement} buffer
   * @param {object} opts  time, and per-frame grade overrides from the scene
   */
  /**
   * Apply the post chain to the visible canvas.
   * @param {HTMLCanvasElement|null} buffer  the offscreen scene, or null when the
   *   scene was drawn straight to the visible canvas (the cheap path)
   */
  render(buffer, {
    time = 0, bloom = 0.55, vignette = 0.85, grain = 0.055, warmth = 0.5, flash = null,
  } = {}) {
    const started = performance.now();
    const { ctx, w, h } = this;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';

    if (buffer) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(buffer, 0, 0, w, h);
      if (bloom > 0) this.#bloomPass(buffer, bloom);
    }

    // The grade is a plain source-over wash rather than a multiply/soft-light
    // stack: on a software rasteriser a full-screen separable blend costs more
    // than everything else in the frame put together, and the look survives.
    if (vignette > 0 || warmth > 0) this.#gradePass(vignette, warmth);
    if (grain > 0 && this.quality >= 2) this.#grainPass(grain, time);
    if (flash) this.#flashPass(flash);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Auto-degrade rather than stutter: bloom and grain go first, together.
    if (performance.now() - started > 6) {
      if (++this.#slowFrames > 24) {
        this.quality = Math.max(0, this.quality - 1);
        this.#slowFrames = 0;
      }
    } else {
      this.#slowFrames = Math.max(0, this.#slowFrames - 1);
    }
  }

  /** Cold, dark edges and a warm centre, in one transparent pass. */
  #gradePass(vignette, warmth) {
    const { ctx, w, h } = this;
    if (!this.grade) {
      const g = ctx.createRadialGradient(
        w * 0.5, h * 0.46, Math.min(w, h) * 0.16,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.78,
      );
      g.addColorStop(0, `rgba(255,214,150,${(0.05 * warmth).toFixed(3)})`);
      g.addColorStop(0.5, 'rgba(20,18,26,0.06)');
      g.addColorStop(0.82, `rgba(14,13,20,${(0.4 * vignette).toFixed(3)})`);
      g.addColorStop(1, `rgba(6,6,10,${(0.78 * vignette).toFixed(3)})`);
      this.grade = g;
    }
    ctx.save();
    ctx.fillStyle = this.grade;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** Bright areas smear into the air around them. Downscale, blur, add back. */
  #bloomPass(buffer, strength) {
    const { bloomCtx, bloom, ctx, w, h } = this;
    bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
    bloomCtx.globalCompositeOperation = 'source-over';
    bloomCtx.clearRect(0, 0, bloom.width, bloom.height);
    // Crushing the midtones leaves only lamps, sunwood and highlights glowing.
    bloomCtx.filter = supportsFilter ? 'brightness(1.1) contrast(2.9) saturate(1.25)' : 'none';
    bloomCtx.drawImage(buffer, 0, 0, bloom.width, bloom.height);
    bloomCtx.filter = 'none';

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = strength;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (supportsFilter) ctx.filter = `blur(${Math.max(2, w / 260).toFixed(1)}px)`;
    ctx.drawImage(bloom, 0, 0, w, h);
    ctx.filter = 'none';
    ctx.restore();
  }

  /** Paper fibre. Offset every frame so it shimmers like grain, not like dirt. */
  #grainPass(strength, time) {
    const { ctx, w, h } = this;
    const ox = -Math.floor((time * 977) % NOISE_SIZE);
    const oy = -Math.floor((time * 613) % NOISE_SIZE);
    this.noisePattern ??= ctx.createPattern(this.noise, 'repeat');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = strength;
    ctx.translate(ox, oy);
    ctx.fillStyle = this.noisePattern;
    ctx.fillRect(-ox, -oy, w + NOISE_SIZE, h + NOISE_SIZE);
    ctx.restore();
  }

  #flashPass({ color = P.pale, amount = 0 }) {
    if (amount <= 0) return;
    const { ctx, w, h } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, amount);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function makeNoiseTile(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    // Centred around mid-grey so `overlay` neither lifts nor crushes on average.
    const v = 118 + Math.random() * 24;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
