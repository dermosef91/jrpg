import { P, FONT, alpha, mix } from './palette.js';
import { PostFX } from './postfx.js';

const VIRTUAL_W = 960;
const VIRTUAL_H = 540;
const MAX_BUFFER_SCALE = 1.6;
const LIGHT_CACHE_LIMIT = 96;
const PANEL_PAD = 6;

/**
 * Canvas2D renderer on a fixed 960x540 virtual stage.
 *
 * Scenes draw into an offscreen buffer in virtual coordinates; `present()`
 * composites that buffer to the visible canvas through the post-processing
 * chain. Nothing in the game uses sprites -- rings, grain, light pools and
 * panels are all geometry, which suits a setting where every surface is wood
 * and keeps the whole build under 200 kB with no assets to load.
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.buffer = document.createElement('canvas');
    this.bufferCtx = this.buffer.getContext('2d');
    this.screenCtx = canvas.getContext('2d');
    this.ctx = this.bufferCtx;
    this.usingBuffer = true;
    this.fx = new PostFX(canvas);
    this.W = VIRTUAL_W;
    this.H = VIRTUAL_H;
    this.scale = 1;
    this.insets = { left: 0, right: 0, top: 0, bottom: 0 };
    this.grade = {};
    this.supportsLetterSpacing = 'letterSpacing' in this.ctx;
    // Radial gradients are expensive to build. Lights and contact shadows are
    // drawn every frame from a handful of shapes, so they are rendered once into
    // sprites and blitted after that.
    this.lightCache = new Map();
    // Panels are static geometry redrawn every frame, and their grain fill is the
    // most expensive thing in the UI. Each distinct panel is rendered once into a
    // sprite and blitted after that.
    this.panelCache = new Map();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Reserve edge space (for touch controls) the stage must not occupy. */
  setInsets(insets) {
    this.insets = { left: 0, right: 0, top: 0, bottom: 0, ...insets };
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { left, right, top, bottom } = this.insets;
    const availW = Math.max(120, window.innerWidth - left - right);
    const availH = Math.max(90, window.innerHeight - top - bottom);
    this.scale = Math.max(Math.min(availW / VIRTUAL_W, availH / VIRTUAL_H), 0.2);

    const cssW = Math.floor(VIRTUAL_W * this.scale);
    const cssH = Math.floor(VIRTUAL_H * this.scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    // The page centres the canvas, so asymmetric reservations become margin.
    this.canvas.style.marginLeft = `${left - right}px`;
    this.canvas.style.marginTop = `${top - bottom}px`;

    const bufferScale = Math.min(this.scale * dpr, MAX_BUFFER_SCALE);
    const pw = Math.max(1, Math.floor(VIRTUAL_W * bufferScale));
    const ph = Math.max(1, Math.floor(VIRTUAL_H * bufferScale));
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.buffer.width = pw;
    this.buffer.height = ph;
    this.bufferScale = bufferScale;
    this.ctx.setTransform(bufferScale, 0, 0, bufferScale, 0, 0);
    // Cached sprites are rasterised at the old scale and would go soft.
    this.lightCache.clear();
    this.panelCache.clear();
    this.fx.resize(pw, ph);
  }

  /** Reset per-frame state and clear the target.
   *
   *  Bloom is the only effect that needs the scene in an offscreen buffer, so
   *  when it is off the scene is drawn straight to the visible canvas and the
   *  frame skips a full-screen blit entirely. */
  begin(color = P.deep) {
    this.usingBuffer = this.fx.quality >= 2;
    this.ctx = this.usingBuffer ? this.bufferCtx : this.screenCtx;
    const { ctx } = this;
    ctx.setTransform(this.bufferScale, 0, 0, this.bufferScale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.W, this.H);
  }

  /** Apply the post chain. `grade` is set by the active scene. */
  present(time) {
    this.fx.render(this.usingBuffer ? this.buffer : null, { time, ...this.grade });
  }

  /** Back-compat alias: scenes call clear() at the top of draw(). */
  clear(color = P.deep) { this.begin(color); }

  save() { this.ctx.save(); }
  restore() { this.ctx.restore(); }
  alpha(a) { this.ctx.globalAlpha = a; }
  translate(x, y) { this.ctx.translate(x, y); }
  rotate(a) { this.ctx.rotate(a); }
  scaleBy(x, y = x) { this.ctx.scale(x, y); }

  /** Run a draw callback under a blend mode, then restore. */
  blend(mode, fn, a = 1) {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha *= a;
    fn(this);
    ctx.restore();
  }

  clipRect(x, y, w, h) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }

  // --- primitives -----------------------------------------------------------

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  strokeRect(x, y, w, h, color, lw = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lw;
    this.ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  }

  roundRect(x, y, w, h, r, color, { stroke = false, lw = 1 } = {}) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (stroke) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  /** Vertical two-stop fill -- the workhorse for giving flat surfaces a light
   *  direction without hand-authoring every shade. */
  vgrad(x, y, w, h, top, bottom) {
    const { ctx } = this;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  /** Horizontal two-stop fill -- used for cylindrical shading on trunks and posts. */
  hgrad(x, y, w, h, left, mid, right) {
    const { ctx } = this;
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, left);
    g.addColorStop(0.42, mid);
    g.addColorStop(1, right);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  line(x1, y1, x2, y2, color, lw = 1, cap = 'butt') {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = cap;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  circle(x, y, radius, color, { stroke = false, lw = 1 } = {}) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(radius, 0.1), 0, Math.PI * 2);
    if (stroke) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  ellipse(x, y, rx, ry, color, { rotation = 0, stroke = false, lw = 1 } = {}) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.1), Math.max(ry, 0.1), rotation, 0, Math.PI * 2);
    if (stroke) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  arc(x, y, radius, from, to, color, lw = 1) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(radius, 0.1), from, to);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  poly(points, color, { stroke = false, lw = 1, close = true } = {}) {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (close) ctx.closePath();
    if (stroke) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  // --- light ----------------------------------------------------------------

  /** Render (or fetch) a radial falloff sprite. Radii are quantised so pulsing
   *  lights reuse a few sprites instead of minting one per frame. */
  #falloff(radius, color, intensity, mid) {
    const q = Math.max(4, Math.round(radius / 6) * 6);
    const key = `${q}|${color}|${intensity.toFixed(2)}|${mid}`;
    let sprite = this.lightCache.get(key);
    if (sprite) return sprite;

    if (this.lightCache.size > LIGHT_CACHE_LIMIT) this.lightCache.clear();
    const size = Math.max(2, Math.ceil(q * 2));
    sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const sctx = sprite.getContext('2d');
    const g = sctx.createRadialGradient(q, q, 0, q, q, q);
    g.addColorStop(0, alpha(color, intensity));
    if (mid) g.addColorStop(0.45, alpha(color, intensity * 0.35));
    g.addColorStop(1, alpha(color, 0));
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, size, size);
    sprite.q = q;
    this.lightCache.set(key, sprite);
    return sprite;
  }

  /** An additive pool of light. Lamps, the Ember, sunwood, graft glow. */
  light(x, y, radius, color = P.sunwood, intensity = 0.6) {
    if (radius < 1 || intensity <= 0) return;
    const sprite = this.#falloff(radius, color, intensity, true);
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  /** A soft contact shadow under an object. */
  groundShadow(x, y, rx, ry, strength = 0.5) {
    if (rx < 1) return;
    const sprite = this.#falloff(rx, P.void, strength, false);
    this.ctx.drawImage(sprite, x - rx, y - ry, rx * 2, ry * 2);
  }

  /** Diagonal grain lines inside a rect. The visual language of the game is
   *  "you are looking at wood", so almost every surface gets some. */
  grainFill(x, y, w, h, color, { angle = -0.35, spacing = 7, lw = 1, alpha: a = 0.5, jitter = 0 } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalAlpha *= a;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const span = Math.abs(h * Math.tan(angle)) + w;
    let n = 0;
    for (let i = -span; i < span + w; i += spacing) {
      const wobble = jitter ? Math.sin(n * 2.3) * jitter : 0;
      ctx.beginPath();
      ctx.moveTo(x + i + wobble, y + h);
      ctx.lineTo(x + i + h * Math.tan(angle) - wobble, y);
      ctx.stroke();
      n++;
    }
    ctx.restore();
  }

  // --- text -----------------------------------------------------------------

  #font(size, weight, family) {
    return `${weight} ${size}px ${family === 'display' ? FONT.display : FONT.ui}`;
  }

  text(str, x, y, opts = {}) {
    const {
      size = 14, color = P.pale, align = 'left', baseline = 'alphabetic',
      weight = 400, alpha: a = 1, font = 'ui', tracking = 0, shadow = null,
    } = opts;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.font = this.#font(size, weight, font);
    if (this.supportsLetterSpacing) ctx.letterSpacing = `${tracking}px`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.fillText(str, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    if (this.supportsLetterSpacing) ctx.letterSpacing = '0px';
    ctx.restore();
    return this;
  }

  measure(str, size = 14, weight = 400, font = 'ui') {
    this.ctx.font = this.#font(size, weight, font);
    return this.ctx.measureText(str).width;
  }

  /** Greedy word wrap at a pixel width. */
  wrap(str, maxWidth, size = 14, weight = 400, font = 'ui') {
    const out = [];
    for (const paragraph of String(str).split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && this.measure(candidate, size, weight, font) > maxWidth) {
          out.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      out.push(line);
    }
    return out;
  }

  // --- chrome ---------------------------------------------------------------

  /** Standard UI panel: a carved board. Bevelled top edge catching the light,
   *  dark underside, grain across the face, notched corners. Cached per shape. */
  panel(x, y, w, h, {
    fill = null, border = P.wood, accent = null, grain = true, lit = true, radius = 3,
  } = {}) {
    const key = `${Math.round(w)}x${Math.round(h)}|${fill}|${border}|${accent}|${grain}|${lit}|${radius}`;
    let sprite = this.panelCache.get(key);
    if (!sprite) {
      sprite = this.#renderPanel(Math.round(w), Math.round(h), { fill, border, accent, grain, lit, radius });
      if (this.panelCache.size > 48) this.panelCache.clear();
      this.panelCache.set(key, sprite);
    }
    this.ctx.drawImage(sprite, x - PANEL_PAD, y - PANEL_PAD,
      sprite.width / this.bufferScale, sprite.height / this.bufferScale);
    return this;
  }

  #renderPanel(w, h, { fill, border, accent, grain, lit, radius }) {
    const scale = this.bufferScale;
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil((w + PANEL_PAD * 2) * scale);
    sprite.height = Math.ceil((h + PANEL_PAD * 2) * scale);
    const ctx = sprite.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Draw into the sprite using this renderer's own primitives.
    const realCtx = this.ctx;
    this.ctx = ctx;
    const x = PANEL_PAD;
    const y = PANEL_PAD;

    this.roundRect(x + 2, y + 4, w, h, radius, alpha(P.void, 0.45));
    this.roundRect(x, y, w, h, radius, fill ?? P.bark);

    if (!fill) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, mix(P.bark, P.barkHi, 0.55));
      g.addColorStop(0.35, P.bark);
      g.addColorStop(1, P.deep);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.clip();
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    if (grain) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.clip();
      this.grainFill(x, y, w, h, P.barkHi, { spacing: 9, alpha: 0.45, jitter: 1.2 });
      ctx.restore();
    }

    if (lit) {
      this.line(x + 2, y + 1.5, x + w - 2, y + 1.5, alpha(P.woodHi, 0.5), 1.5);
      this.line(x + 2, y + h - 1.5, x + w - 2, y + h - 1.5, alpha(P.void, 0.6), 1.5);
    }
    this.roundRect(x, y, w, h, radius, border, { stroke: true, lw: 2 });

    const n = 8;
    const c = accent ?? border;
    for (const [cx, cy, dx, dy] of [
      [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
    ]) {
      this.line(cx, cy + dy * n, cx + dx * n, cy + dy * n, c, 2);
      this.line(cx + dx * n, cy, cx + dx * n, cy + dy * n, c, 2);
    }

    this.ctx = realCtx;
    return sprite;
  }

  /** A filled meter with a lit top edge and a dark well. */
  bar(x, y, w, h, ratio, color, { back = P.void, glow = false } = {}) {
    const filled = Math.max(0, Math.min(1, ratio)) * w;
    this.rect(x, y, w, h, back);
    if (filled > 0) {
      this.vgrad(x, y, filled, h, mix(color, P.pale, 0.35), color);
      if (glow) this.light(x + filled, y + h / 2, h * 2.4, color, 0.4);
    }
    this.strokeRect(x, y, w, h, alpha(P.void, 0.8), 1);
    this.line(x, y, x + w, y, alpha(P.void, 0.5), 1);
    return this;
  }
}
