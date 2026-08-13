import { Scene } from '../../engine/scene.js';
import { P, RAMP, alpha, mix } from '../../engine/palette.js';
import {
  generateCore, localVariance, naturalBaseline, scoreClaim,
  SAMPLE_BUDGET, VERDICTS, mean,
} from './rings.js';

const STRIP_X = 40;
const STRIP_W = 880;
const STRIP_Y = 96;
const STRIP_H = 96;
const PLOT_Y = 236;
const PLOT_H = 128;

/** The audit. You are not looking for a lie -- you are looking for a stretch of
 *  history that is suspiciously well-behaved. */
export class AuditScene extends Scene {
  grade = { bloom: 0.42, vignette: 1.05, grain: 0.06, warmth: 0.3 };

  constructor({ seed = 3, boleName = 'Cordwain', onEnd = null, brief = null } = {}) {
    super();
    this.core = generateCore({ seed });
    this.boleName = boleName;
    this.onEnd = onEnd;
    this.brief = brief;
    this.cursor = Math.floor(this.core.rings.length / 2);
    this.samples = new Map();   // ring index -> local stddev
    this.claim = { start: null, end: null };
    this.result = null;
    this.notice = 'Pull cores. Find the span that is too smooth to be a real century.';
    this.t = 0;
    this.repeat = 0;
    this.#layout();
  }

  enter() { this.game.audio.setAmbient('audit'); }
  get audio() { return this.game.audio; }

  /** Ring width drives on-screen band width, so the strip reads like a real core:
   *  the edited span looks regular before you have measured anything. */
  #layout() {
    const total = this.core.rings.reduce((a, r) => a + r.width, 0);
    let x = STRIP_X;
    this.bands = this.core.rings.map((ring) => {
      const w = (ring.width / total) * STRIP_W;
      const band = { x, w, ring };
      x += w;
      return band;
    });
  }

  get rings() { return this.core.rings; }
  get budgetLeft() { return SAMPLE_BUDGET - this.samples.size; }

  update(dt) {
    this.t += dt;
    if (this.result) {
      if (this.input.pressed('confirm') || this.input.pressed('cancel')) {
        this.game.scenes.pop(this.result);
        this.onEnd?.(this.result);
      }
      return;
    }

    // Held movement with acceleration; 120 rings is too many to tap through.
    this.repeat -= dt;
    const step = this.input.held('detail') ? 5 : 1;
    if (this.input.held('left') || this.input.held('right')) {
      if (this.repeat <= 0) {
        const next = clamp(this.cursor + (this.input.held('right') ? step : -step),
          0, this.rings.length - 1);
        if (next !== this.cursor && this.cursor % 6 === 0) this.audio.play('cursor');
        this.cursor = next;
        this.repeat = 0.045;
      }
    } else {
      this.repeat = 0;
    }

    if (this.input.pressed('detail')) this.#sample();
    if (this.input.pressed('cancel')) this.#clearClaim();
    if (this.input.pressed('confirm')) this.#confirm();
  }

  #sample() {
    if (this.samples.has(this.cursor)) {
      this.audio.play('denied');
      this.notice = 'Already cored here. Sample elsewhere.';
      return;
    }
    if (this.budgetLeft <= 0) {
      this.audio.play('denied');
      this.notice = 'Out of cores. File on what you have.';
      return;
    }
    const v = localVariance(this.rings, this.cursor);
    this.samples.set(this.cursor, v);
    const base = this.#baseline();
    const flat = base && v < base * 0.5;
    this.audio.play(flat ? 'suspicious' : 'sample');
    const band = this.bands[this.cursor];
    this.game.particles.burst('sunwood', band.x + band.w / 2, STRIP_Y + STRIP_H / 2,
      { count: flat ? 10 : 5, speedScale: 0.6 });
    const year = this.rings[this.cursor].year;
    this.notice = `Year ${year}: local variance ${v.toFixed(3)}.`
      + (this.#baseline() && v < this.#baseline() * 0.5 ? '  Too smooth.' : '');
  }

  #baseline() {
    if (this.samples.size < 3) return null;
    return naturalBaseline([...this.samples.values()]);
  }

  #clearClaim() {
    if (this.claim.start == null) {
      this.notice = 'Nothing to clear.';
      return;
    }
    this.claim = { start: null, end: null };
    this.audio.play('cancel');
    this.notice = 'Claim cleared.';
  }

  #confirm() {
    const { start, end } = this.claim;
    if (start == null) {
      this.claim.start = this.cursor;
      this.audio.play('bracket');
      this.notice = 'Left bracket set. Mark where the smoothing ends.';
    } else if (end == null) {
      if (this.cursor === start) {
        this.audio.play('denied');
        this.notice = 'A claim must span more than one ring.';
        return;
      }
      this.claim = { start: Math.min(start, this.cursor), end: Math.max(start, this.cursor) + 1 };
      this.audio.play('bracket');
      this.notice = 'Bracketed. Enter again to file with the Ring Council.';
    } else {
      this.#file();
    }
  }

  #file() {
    const score = scoreClaim(this.core.edit, this.claim);
    this.result = { ...score, claim: { ...this.claim }, edit: { ...this.core.edit } };
    this.audio.play(score.verdict === VERDICTS.REJECTED ? 'rejected' : 'certified');
    if (score.verdict !== VERDICTS.REJECTED) {
      const a = this.bands[this.core.edit.start];
      const b = this.bands[this.core.edit.end - 1];
      this.game.particles.burst('sunwood', (a.x + b.x) / 2, STRIP_Y + STRIP_H / 2,
        { count: 30, speedScale: 1.4 });
    }
  }

  // --- draw -----------------------------------------------------------------

  draw(r) {
    r.begin(RAMP.bark[0]);

    // The bench: a dark desk under one hard lamp, which is what this work is.
    r.vgrad(0, 0, r.W, r.H, mix(RAMP.shade[1], RAMP.bark[1], 0.55), RAMP.bark[0]);
    r.light(r.W / 2, STRIP_Y + 30, 620, RAMP.amber[2], 0.16);
    r.light(r.W / 2, STRIP_Y + 40, 300, RAMP.amber[3], 0.12);

    this.#drawHeader(r);
    this.#drawStrip(r);
    this.#drawPlot(r);
    this.#drawFooter(r);
    this.game.particles.draw(r);
    if (this.result) this.#drawResult(r);
  }

  #drawHeader(r) {
    r.vgrad(0, 0, r.W, 62, alpha(RAMP.bark[0], 0.95), alpha(RAMP.bark[0], 0.55));
    r.line(0, 62, r.W, 62, alpha(RAMP.wood[1], 0.7), 1.5);
    r.text('CORE AUDIT', 22, 30, {
      size: 17, color: RAMP.pale[5], weight: 700, font: 'display', tracking: 2,
    });
    r.text(`${this.boleName} · root-crown sample · years ${this.rings[0].year}–${this.rings.at(-1).year}`,
      22, 50, { size: 10.5, color: RAMP.pale[1] });

    // Cores left, as spendable tokens rather than a number.
    const left = this.budgetLeft;
    r.text('CORES', r.W - 22, 24, { size: 9, color: RAMP.pale[0], align: 'right', tracking: 2 });
    for (let i = 0; i < SAMPLE_BUDGET; i++) {
      const cx = r.W - 22 - i * 12;
      const spent = i >= left;
      if (!spent) r.light(cx, 42, 11, RAMP.amber[4], 0.5);
      r.circle(cx, 42, 3.5, spent ? RAMP.bark[4] : RAMP.amber[4]);
    }
  }

  #drawStrip(r) {
    const x = STRIP_X - 10;
    const y = STRIP_Y - 10;
    const w = STRIP_W + 20;
    const h = STRIP_H + 20;
    r.panel(x, y, w, h, { grain: false, accent: RAMP.wood[2] });
    r.rect(STRIP_X, STRIP_Y, STRIP_W, STRIP_H, RAMP.bark[0]);

    this.bands.forEach((band, i) => {
      const bw = Math.max(band.w, 0.6);
      // Wide rings are pale earlywood, narrow ones are dark latewood. This is
      // the physical reading: the edited span looks regular before it is measured.
      const density = 1 - Math.min(1, band.ring.width / 1.9);
      r.vgrad(band.x, STRIP_Y, bw, STRIP_H,
        mix(RAMP.wood[4], RAMP.wood[1], density),
        mix(RAMP.wood[2], RAMP.wood[0], density));
      r.line(band.x, STRIP_Y, band.x, STRIP_Y + STRIP_H, alpha(RAMP.bark[0], 0.75), 1);
      if (this.samples.has(i)) {
        r.rect(band.x, STRIP_Y, Math.max(bw, 1.2), 4, RAMP.amber[4]);
        r.light(band.x + bw / 2, STRIP_Y, 22, RAMP.amber[4], 0.4);
      }
    });

    // Varnish: one specular sweep so the core reads as a physical object.
    r.save();
    r.blend('lighter', () => {
      const g = r.ctx.createLinearGradient(0, STRIP_Y, 0, STRIP_Y + STRIP_H);
      g.addColorStop(0, alpha(RAMP.pale[3], 0.11));
      g.addColorStop(0.3, alpha(RAMP.pale[3], 0.03));
      g.addColorStop(1, alpha(RAMP.pale[3], 0));
      r.ctx.fillStyle = g;
      r.ctx.fillRect(STRIP_X, STRIP_Y, STRIP_W, STRIP_H);
    });
    r.restore();

    if (this.result) this.#highlight(r, this.core.edit, RAMP.ember[3], 'the written span');
    if (this.claim.start != null) {
      const end = this.claim.end ?? this.cursor + 1;
      this.#highlight(r, { start: this.claim.start, end }, RAMP.amber[4], 'your claim');
    }

    const band = this.bands[this.cursor];
    const cx = band.x + band.w / 2;
    r.save();
    r.blend('lighter', () => r.line(cx, STRIP_Y - 12, cx, STRIP_Y + STRIP_H + 12,
      alpha(RAMP.pale[5], 0.8), 1.5));
    r.restore();
    r.poly([[cx - 6, STRIP_Y - 22], [cx + 6, STRIP_Y - 22], [cx, STRIP_Y - 12]], RAMP.pale[5]);
    r.text(String(band.ring.year), cx, STRIP_Y + STRIP_H + 30, {
      size: 12, color: RAMP.pale[4], align: 'center', font: 'display',
    });
  }

  #highlight(r, span, color, label) {
    const a = this.bands[span.start];
    const bEnd = this.bands[Math.min(span.end, this.bands.length) - 1];
    if (!a || !bEnd) return;
    const x = a.x;
    const w = bEnd.x + bEnd.w - a.x;
    r.save();
    r.alpha(0.18);
    r.rect(x, STRIP_Y, w, STRIP_H, color);
    r.restore();
    r.strokeRect(x, STRIP_Y, w, STRIP_H, color, 2);
    for (const bx of [x, x + w]) {
      r.line(bx, STRIP_Y - 6, bx, STRIP_Y + STRIP_H + 6, color, 2);
    }
    r.text(label, x + w / 2, STRIP_Y - 16, {
      size: 10, color, align: 'center', tracking: 1,
      shadow: alpha(RAMP.bark[0], 0.9),
    });
  }

  #drawPlot(r) {
    r.panel(STRIP_X - 10, PLOT_Y, STRIP_W + 20, PLOT_H, { grain: false, accent: RAMP.wood[2] });
    r.text('LOCAL VARIANCE OF SAMPLED CORES', STRIP_X + 6, PLOT_Y + 22,
      { size: 9.5, color: RAMP.pale[1], tracking: 1.6 });

    const values = [...this.samples.values()];
    const top = PLOT_Y + 34;
    const h = PLOT_H - 50;

    if (!values.length) {
      r.text('Nothing sampled yet. Real years wobble; written ones do not.',
        STRIP_X + 6, PLOT_Y + 76, { size: 12, color: RAMP.wood[2] });
      return;
    }

    const maxV = Math.max(...values, 0.05) * 1.15;
    const yFor = (v) => top + h - (v / maxV) * h;
    const base = this.#baseline();
    const gutter = STRIP_X + 104;

    if (base != null) {
      const dashed = (yy, color) => {
        for (let dx = gutter; dx < STRIP_X + STRIP_W; dx += 9) r.line(dx, yy, dx + 4, yy, color, 1);
      };
      const baseY = yFor(base);
      const halfY = yFor(base * 0.5);
      dashed(baseY, RAMP.shade[3]);
      dashed(halfY, RAMP.ember[2]);
      // When the two lines nearly coincide the labels must not stack on top of
      // each other, so nudge them apart without moving the lines they describe.
      const gap = Math.max(0, 13 - (halfY - baseY)) / 2;
      r.text('natural baseline', STRIP_X + 6, baseY + 3 - gap, { size: 9, color: RAMP.shade[4] });
      r.text('half — suspicious', STRIP_X + 6, halfY + 3 + gap, { size: 9, color: RAMP.ember[3] });
    }
    r.line(gutter - 6, top, gutter - 6, top + h, alpha(RAMP.wood[0], 0.8), 1);

    const points = [...this.samples.entries()].sort((a, b) => a[0] - b[0]);
    points.forEach(([idx, v], i) => {
      const band = this.bands[idx];
      const px = band.x + band.w / 2;
      const py = yFor(v);
      if (i > 0) {
        const [pIdx, pV] = points[i - 1];
        const pb = this.bands[pIdx];
        r.line(pb.x + pb.w / 2, yFor(pV), px, py, alpha(RAMP.wood[3], 0.65), 1.2);
      }
      const flat = base != null && v < base * 0.5;
      r.line(px, py, px, top + h, alpha(flat ? RAMP.ember[3] : RAMP.wood[2], 0.45), 1);
      if (flat) r.light(px, py, 20, RAMP.ember[3], 0.6);
      r.circle(px, py, flat ? 5 : 3.5, flat ? RAMP.ember[4] : RAMP.amber[4]);
      r.circle(px, py, flat ? 5 : 3.5, RAMP.bark[0], { stroke: true, lw: 1 });
    });
  }

  #drawFooter(r) {
    const y = 392;
    r.panel(STRIP_X - 10, y, STRIP_W + 20, 76, { accent: RAMP.wood[2] });
    if (this.brief) {
      r.text(this.brief, STRIP_X + 6, y + 24, { size: 10.5, color: RAMP.shade[5] });
    }
    r.text(this.notice, STRIP_X + 6, y + (this.brief ? 48 : 32), { size: 13, color: RAMP.pale[4] });

    const claimText = this.claim.start == null ? 'no claim filed'
      : this.claim.end == null ? `bracket open at ${this.rings[this.claim.start].year}`
      : `claim ${this.rings[this.claim.start].year}–${this.rings[this.claim.end - 1].year}`
        + `  (${this.claim.end - this.claim.start} rings)`;
    r.text(claimText, STRIP_X + STRIP_W + 4, y + 30, {
      size: 11, color: this.claim.end == null ? RAMP.pale[1] : RAMP.amber[3], align: 'right',
    });

    r.save();
    r.alpha(0.6);
    r.text('←/→ move    hold E + ←/→ jump    E sample    enter bracket / file    x clear',
      r.W / 2, 502, { size: 10.5, color: RAMP.pale[0], align: 'center', tracking: 0.6 });
    r.restore();
  }

  #drawResult(r) {
    const res = this.result;
    r.save();
    r.alpha(0.9);
    r.rect(0, 0, r.W, r.H, RAMP.bark[0]);
    r.restore();

    const w = 690;
    const x = (r.W - w) / 2;
    const [headline, color] = {
      [VERDICTS.CERTIFIED]: ['CLAIM CERTIFIED', RAMP.amber[4]],
      [VERDICTS.PARTIAL]: ['CLAIM PARTIALLY UPHELD', RAMP.ember[3]],
      [VERDICTS.REJECTED]: ['CLAIM REJECTED', RAMP.scar[3]],
    }[res.verdict];

    r.light(r.W / 2, 168, 420, color, 0.22);
    r.panel(x, 108, w, 312, { accent: color });
    r.text(headline, r.W / 2, 156, {
      size: 25, color, align: 'center', weight: 700, font: 'display', tracking: 2,
    });
    r.line(x + 40, 172, x + w - 40, 172, alpha(RAMP.wood[2], 0.6), 1);

    const stats = [
      ['overlap', `${(res.iou * 100).toFixed(0)}%`],
      ['recall', `${(res.recall * 100).toFixed(0)}%`],
      ['precision', `${(res.precision * 100).toFixed(0)}%`],
    ];
    stats.forEach(([label, value], i) => {
      const sx = x + w / 2 + (i - 1) * 150;
      r.text(value, sx, 204, {
        size: 20, color: RAMP.pale[5], align: 'center', weight: 700, font: 'display',
      });
      r.text(label, sx, 220, { size: 9, color: RAMP.pale[0], align: 'center', tracking: 1.5 });
    });
    r.text(`the written span ran ${this.rings[res.edit.start].year}–${this.rings[res.edit.end - 1].year}`,
      r.W / 2, 244, { size: 11, color: RAMP.pale[2], align: 'center' });

    const body = {
      [VERDICTS.CERTIFIED]:
        'Forty rings, chemically too consistent to be weather. Someone wrote this century.\n\n'
        + 'The technique is inherited and hand-specific. Wend knows the hand before she\n'
        + 'finishes the comparison, and does not say so for a long moment.\n\n'
        + 'It is her lineage. She has been re-inking passages like this since she was nine.',
      [VERDICTS.PARTIAL]:
        'The council accepts that something was written here and declines to say what.\n\n'
        + 'A partial finding is worse than none: it puts Anneal on notice without giving\n'
        + 'you standing. Whoever maintains this record now knows you are reading it.',
      [VERDICTS.REJECTED]:
        'You bracketed weather. Shock years look like anything you want them to look like,\n'
        + 'which is exactly why the standard is variance and not intuition.\n\n'
        + 'Verity does not gloat. That is somehow worse.',
    }[res.verdict];

    r.wrap(body, w - 76, 12).forEach((line, i) => {
      r.text(line, x + 38, 274 + i * 18, { size: 12, color: RAMP.pale[1] });
    });

    r.save();
    r.alpha(0.5 + 0.5 * Math.sin(performance.now() / 400));
    r.text('ENTER', r.W / 2, 400, {
      size: 12, color: RAMP.pale[4], align: 'center', tracking: 3, weight: 700,
    });
    r.restore();
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
