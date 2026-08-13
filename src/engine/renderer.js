import { P, alpha, mix } from './palette.js';
import { drawText, textWidth, wrapText, FONT_H, GLYPH_ADVANCE } from './font.js';

export const VW = 480;
export const VH = 270;

// 4x4 Bayer. Pixel art has no smooth gradients -- everything that fades, fades
// by dithering, which is what gives the concept art its texture.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * A 480x270 pixel-art renderer.
 *
 * Everything is drawn into a real 480x270 backbuffer and blitted to screen at an
 * integer scale with smoothing off, so a virtual pixel is always a clean square
 * block of device pixels and nothing is ever half-lit.
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.screen = canvas.getContext('2d', { alpha: false });
    this.buffer = document.createElement('canvas');
    this.buffer.width = VW;
    this.buffer.height = VH;
    this.ctx = this.buffer.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.W = VW;
    this.H = VH;
    this.scale = 1;
    this.insets = { left: 0, right: 0, top: 0, bottom: 0 };
    this.cache = new Map();
    this.shakeX = 0;
    this.shakeY = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setInsets(insets) {
    this.insets = { left: 0, right: 0, top: 0, bottom: 0, ...insets };
    this.resize();
  }

  resize() {
    const { left, right, top, bottom } = this.insets;
    const availW = Math.max(160, window.innerWidth - left - right);
    const availH = Math.max(90, window.innerHeight - top - bottom);
    // Integer scale keeps pixels square; fall back to a fractional fit only on
    // screens too small for 1:1.
    const fit = Math.min(availW / VW, availH / VH);
    this.scale = fit >= 1 ? Math.floor(fit) : fit;

    const cssW = Math.floor(VW * this.scale);
    const cssH = Math.floor(VH * this.scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.style.marginLeft = `${left - right}px`;
    this.canvas.style.marginTop = `${top - bottom}px`;
    this.canvas.width = cssW;
    this.canvas.height = cssH;
    this.screen.imageSmoothingEnabled = false;
  }

  begin(color = P.void) {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, VW, VH);
  }

  present() {
    const { screen, canvas } = this;
    screen.imageSmoothingEnabled = false;
    screen.drawImage(this.buffer,
      Math.round(this.shakeX * this.scale), Math.round(this.shakeY * this.scale),
      canvas.width, canvas.height);
  }

  // --- state ---------------------------------------------------------------

  save() { this.ctx.save(); }
  restore() { this.ctx.restore(); }
  alpha(a) { this.ctx.globalAlpha = a; }
  translate(x, y) { this.ctx.translate(Math.round(x), Math.round(y)); }

  clip(x, y, w, h) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.rect(x | 0, y | 0, w | 0, h | 0);
    ctx.clip();
  }

  /** Memoised offscreen art. Static backgrounds and frames are drawn once. */
  cached(key, w, h, draw) {
    let sprite = this.cache.get(key);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = Math.max(1, w | 0);
      sprite.height = Math.max(1, h | 0);
      const sctx = sprite.getContext('2d');
      sctx.imageSmoothingEnabled = false;
      const real = this.ctx;
      this.ctx = sctx;
      draw(this);
      this.ctx = real;
      if (this.cache.size > 64) this.cache.clear();
      this.cache.set(key, sprite);
    }
    return sprite;
  }

  blit(sprite, x, y) { this.ctx.drawImage(sprite, Math.round(x), Math.round(y)); }

  // --- primitives ----------------------------------------------------------

  px(x, y, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x | 0, y | 0, 1, 1);
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  frame(x, y, w, h, color, weight = 1) {
    const X = Math.round(x);
    const Y = Math.round(y);
    const W = Math.round(w);
    const H = Math.round(h);
    this.rect(X, Y, W, weight, color);
    this.rect(X, Y + H - weight, W, weight, color);
    this.rect(X, Y, weight, H, color);
    this.rect(X + W - weight, Y, weight, H, color);
  }

  hline(x, y, w, color) { this.rect(x, y, w, 1, color); }
  vline(x, y, h, color) { this.rect(x, y, 1, h, color); }

  /** Bresenham, so diagonals are proper pixel staircases. */
  line(x0, y0, x1, y1, color) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    this.ctx.fillStyle = color;
    for (let guard = 0; guard < 4000; guard++) {
      this.ctx.fillRect(x, y, 1, 1);
      if (x === ex && y === ey) break;
      const e2 = err * 2;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  /** Midpoint circle, filled or outlined. */
  circle(cx, cy, radius, color, { fill = true } = {}) {
    const r = Math.round(radius);
    const CX = Math.round(cx);
    const CY = Math.round(cy);
    this.ctx.fillStyle = color;
    if (fill) {
      for (let y = -r; y <= r; y++) {
        const span = Math.floor(Math.sqrt(r * r - y * y));
        this.ctx.fillRect(CX - span, CY + y, span * 2 + 1, 1);
      }
      return;
    }
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      for (const [px, py] of [[x, y], [y, x], [-x, y], [-y, x], [-x, -y], [-y, -x], [x, -y], [y, -x]]) {
        this.ctx.fillRect(CX + px, CY + py, 1, 1);
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    const RX = Math.max(1, Math.round(rx));
    const RY = Math.max(1, Math.round(ry));
    const CX = Math.round(cx);
    const CY = Math.round(cy);
    this.ctx.fillStyle = color;
    for (let y = -RY; y <= RY; y++) {
      const t = 1 - (y * y) / (RY * RY);
      if (t <= 0) continue;
      const span = Math.floor(RX * Math.sqrt(t));
      this.ctx.fillRect(CX - span, CY + y, span * 2 + 1, 1);
    }
  }

  /** Scanline polygon fill. Points are [x, y] pairs. */
  poly(points, color) {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, Math.round(y));
      maxY = Math.max(maxY, Math.round(y));
    }
    this.ctx.fillStyle = color;
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.round(xs[i]);
        const b = Math.round(xs[i + 1]);
        if (b > a) this.ctx.fillRect(a, y, b - a, 1);
      }
    }
  }

  // --- dithering -----------------------------------------------------------

  /** Fill a rect with `color` at a dithered coverage of 0..1. */
  dither(x, y, w, h, color, coverage) {
    const c = Math.max(0, Math.min(1, coverage));
    if (c <= 0) return;
    if (c >= 1) { this.rect(x, y, w, h, color); return; }
    const threshold = c * 16;
    const X = Math.round(x);
    const Y = Math.round(y);
    const W = Math.round(w);
    const H = Math.round(h);
    this.ctx.fillStyle = color;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        if (BAYER[py & 3][px & 3] < threshold) this.ctx.fillRect(X + px, Y + py, 1, 1);
      }
    }
  }

  /**
   * A soft radial wash, built from stacked translucent ellipses rather than a
   * dither. `glow` is the right tool for a bright source, but below about a
   * quarter coverage its Bayer pattern stops reading as light and starts
   * reading as a lattice of loose pixels -- which is exactly the range a big
   * ambient wash lives in.
   */
  wash(cx, cy, rx, ry, color, strength = 0.3, steps = 7) {
    const a = strength / steps;
    for (let i = steps; i >= 1; i--) {
      const k = i / steps;
      this.ellipse(cx, cy, rx * k, ry * k, alpha(color, a * (1.4 - k * 0.6)));
    }
  }

  /** A dithered radial glow: the only kind of light this renderer has. */
  glow(cx, cy, radius, color, strength = 1) {
    const r = Math.round(radius);
    if (r < 1) return;
    const CX = Math.round(cx);
    const CY = Math.round(cy);
    this.ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y) / r;
        if (d > 1) continue;
        const c = (1 - d) ** 1.7 * strength;
        if (BAYER[(CY + y) & 3][(CX + x) & 3] < c * 16) {
          this.ctx.fillRect(CX + x, CY + y, 1, 1);
        }
      }
    }
  }

  /** Vertical dithered ramp between two colours. */
  vramp(x, y, w, h, top, bottom, steps = 5) {
    const H = Math.round(h);
    const band = Math.max(1, Math.floor(H / steps));
    for (let i = 0; i < steps; i++) {
      const t = i / Math.max(1, steps - 1);
      const yy = Math.round(y) + i * band;
      const hh = i === steps - 1 ? Math.round(y) + H - yy : band;
      this.rect(x, yy, w, hh, mix(top, bottom, t));
    }
  }

  // --- text ----------------------------------------------------------------

  text(str, x, y, opts = {}) {
    return drawText(this.ctx, str, x, y, opts);
  }

  measure(str, opts) { return textWidth(str, opts); }
  wrap(str, maxWidth, opts) { return wrapText(str, maxWidth, opts); }

  get lineHeight() { return FONT_H + 3; }
  get glyphAdvance() { return GLYPH_ADVANCE; }
}

export { alpha, mix };
