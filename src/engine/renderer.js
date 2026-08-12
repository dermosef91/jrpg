import { P } from './palette.js';

const VIRTUAL_W = 960;
const VIRTUAL_H = 540;

/** Canvas2D wrapper on a fixed 960x540 virtual stage, letterboxed to the window.
 *  The game is drawn with geometry rather than sprites -- rings, grain lines and
 *  panels are all circles and strokes, which suits the setting and needs no assets. */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = VIRTUAL_W;
    this.H = VIRTUAL_H;
    this.scale = 1;
    this.insets = { left: 0, right: 0, top: 0, bottom: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Reserve edge space (for touch controls) that the stage must not occupy. */
  setInsets(insets) {
    this.insets = { left: 0, right: 0, top: 0, bottom: 0, ...insets };
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { left, right, top, bottom } = this.insets;
    const availW = Math.max(120, window.innerWidth - left - right);
    const availH = Math.max(90, window.innerHeight - top - bottom);
    const fit = Math.min(availW / VIRTUAL_W, availH / VIRTUAL_H);
    this.scale = Math.max(fit, 0.2);
    this.canvas.style.width = `${Math.floor(VIRTUAL_W * this.scale)}px`;
    this.canvas.style.height = `${Math.floor(VIRTUAL_H * this.scale)}px`;
    // The page centres the canvas, so asymmetric reservations are applied as margin.
    this.canvas.style.marginLeft = `${left - right}px`;
    this.canvas.style.marginTop = `${top - bottom}px`;
    this.canvas.width = Math.floor(VIRTUAL_W * this.scale * dpr);
    this.canvas.height = Math.floor(VIRTUAL_H * this.scale * dpr);
    this.ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, 0, 0);
  }

  clear(color = P.deep) {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  save() { this.ctx.save(); }
  restore() { this.ctx.restore(); }
  alpha(a) { this.ctx.globalAlpha = a; }
  translate(x, y) { this.ctx.translate(x, y); }

  clipRect(x, y, w, h) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  strokeRect(x, y, w, h, color, lw = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lw;
    this.ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  }

  line(x1, y1, x2, y2, color, lw = 1) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
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

  poly(points, color, { stroke = false, lw = 1 } = {}) {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (stroke) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  #font(size, weight) {
    return `${weight} ${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  }

  text(str, x, y, opts = {}) {
    const {
      size = 14, color = P.pale, align = 'left',
      baseline = 'alphabetic', weight = 400, alpha = 1,
    } = opts;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = this.#font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
    ctx.restore();
    return this;
  }

  measure(str, size = 14, weight = 400) {
    this.ctx.font = this.#font(size, weight);
    return this.ctx.measureText(str).width;
  }

  /** Greedy word wrap at a pixel width. Returns an array of lines. */
  wrap(str, maxWidth, size = 14, weight = 400) {
    const out = [];
    for (const paragraph of String(str).split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && this.measure(candidate, size, weight) > maxWidth) {
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

  /** Diagonal grain lines inside a rect. Used for panels, bark, and the dial --
   *  the visual language of the whole game is "you are looking at wood". */
  grainFill(x, y, w, h, color, { angle = -0.35, spacing = 7, lw = 1, alpha = 0.5 } = {}) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const span = Math.abs(h * Math.tan(angle)) + w;
    for (let i = -span; i < span + w; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h * Math.tan(angle), y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Standard UI chrome: bark panel, wood border, notched corners. */
  panel(x, y, w, h, { fill = P.bark, border = P.wood, accent = null, grain = true } = {}) {
    this.rect(x, y, w, h, fill);
    if (grain) this.grainFill(x, y, w, h, P.barkLit, { spacing: 9, alpha: 0.55 });
    this.strokeRect(x, y, w, h, border, 2);
    const n = 7;
    const c = accent ?? border;
    for (const [cx, cy, dx, dy] of [
      [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
    ]) {
      this.line(cx, cy + dy * n, cx + dx * n, cy + dy * n, c, 2);
      this.line(cx + dx * n, cy, cx + dx * n, cy + dy * n, c, 2);
    }
    return this;
  }
}
