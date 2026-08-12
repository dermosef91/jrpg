import { Scene } from '../../engine/scene.js';
import { P } from '../../engine/palette.js';
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
        this.cursor = clamp(this.cursor + (this.input.held('right') ? step : -step),
          0, this.rings.length - 1);
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
      this.notice = 'Already cored here. Sample elsewhere.';
      return;
    }
    if (this.budgetLeft <= 0) {
      this.notice = 'Out of cores. File on what you have.';
      return;
    }
    const v = localVariance(this.rings, this.cursor);
    this.samples.set(this.cursor, v);
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
    this.notice = 'Claim cleared.';
  }

  #confirm() {
    const { start, end } = this.claim;
    if (start == null) {
      this.claim.start = this.cursor;
      this.notice = 'Left bracket set. Mark where the smoothing ends.';
    } else if (end == null) {
      if (this.cursor === start) {
        this.notice = 'A claim must span more than one ring.';
        return;
      }
      this.claim = { start: Math.min(start, this.cursor), end: Math.max(start, this.cursor) + 1 };
      this.notice = 'Bracketed. Enter again to file with the Ring Council.';
    } else {
      this.#file();
    }
  }

  #file() {
    const score = scoreClaim(this.core.edit, this.claim);
    this.result = { ...score, claim: { ...this.claim }, edit: { ...this.core.edit } };
  }

  // --- draw -----------------------------------------------------------------

  draw(r) {
    r.clear(P.deep);

    r.rect(0, 0, r.W, 60, P.bark);
    r.grainFill(0, 0, r.W, 60, P.barkLit, { spacing: 11, alpha: 0.4 });
    r.line(0, 60, r.W, 60, P.wood, 2);
    r.text('CORE AUDIT', 20, 26, { size: 15, color: P.sunwood, weight: 700 });
    r.text(`${this.boleName} — root-crown sample — years ${this.rings[0].year}–${this.rings.at(-1).year}`,
      20, 46, { size: 11, color: P.paleDim });
    r.text(`CORES LEFT  ${this.budgetLeft}/${SAMPLE_BUDGET}`, r.W - 20, 32,
      { size: 13, color: this.budgetLeft ? P.pale : P.scar, align: 'right', weight: 700 });

    this.#drawStrip(r);
    this.#drawPlot(r);
    this.#drawFooter(r);
    if (this.result) this.#drawResult(r);
  }

  #drawStrip(r) {
    r.rect(STRIP_X - 6, STRIP_Y - 6, STRIP_W + 12, STRIP_H + 12, P.void);
    r.strokeRect(STRIP_X - 6, STRIP_Y - 6, STRIP_W + 12, STRIP_H + 12, P.wood, 2);

    this.bands.forEach((band, i) => {
      // Earlywood band plus a dark latewood line: the visual grammar of a core.
      const shade = i % 2 ? P.wood : P.woodLit;
      r.rect(band.x, STRIP_Y, Math.max(band.w, 0.6), STRIP_H, shade);
      r.line(band.x, STRIP_Y, band.x, STRIP_Y + STRIP_H, P.bark, 1);
      if (this.samples.has(i)) {
        r.rect(band.x, STRIP_Y, Math.max(band.w, 1), 5, P.sunwood);
      }
    });

    if (this.result) this.#highlight(r, this.core.edit, P.ember, 'the edit');
    if (this.claim.start != null) {
      const end = this.claim.end ?? this.cursor + 1;
      this.#highlight(r, { start: this.claim.start, end }, P.sunwood, 'your claim');
    }

    // cursor
    const band = this.bands[this.cursor];
    const cx = band.x + band.w / 2;
    r.line(cx, STRIP_Y - 14, cx, STRIP_Y + STRIP_H + 14, P.pale, 1.5);
    r.poly([[cx - 5, STRIP_Y - 20], [cx + 5, STRIP_Y - 20], [cx, STRIP_Y - 12]], P.pale);
    r.text(String(band.ring.year), cx, STRIP_Y + STRIP_H + 28,
      { size: 11, color: P.pale, align: 'center' });
  }

  #highlight(r, span, color, label) {
    const a = this.bands[span.start];
    const bEnd = this.bands[Math.min(span.end, this.bands.length) - 1];
    if (!a || !bEnd) return;
    const x = a.x;
    const w = bEnd.x + bEnd.w - a.x;
    r.save();
    r.alpha(0.16);
    r.rect(x, STRIP_Y, w, STRIP_H, color);
    r.restore();
    r.strokeRect(x, STRIP_Y, w, STRIP_H, color, 2);
    r.text(label, x + w / 2, STRIP_Y - 12, { size: 10, color, align: 'center' });
  }

  #drawPlot(r) {
    r.panel(STRIP_X - 6, PLOT_Y, STRIP_W + 12, PLOT_H, { grain: false });
    r.text('LOCAL VARIANCE OF SAMPLED CORES', STRIP_X + 8, PLOT_Y + 20,
      { size: 11, color: P.paleDim });

    const values = [...this.samples.values()];
    if (!values.length) {
      r.text('Nothing sampled yet. Real years wobble; written ones do not.',
        STRIP_X + 8, PLOT_Y + 74, { size: 12, color: P.wood });
      return;
    }

    const top = PLOT_Y + 32;
    const h = PLOT_H - 48;
    const maxV = Math.max(...values, 0.05) * 1.15;
    const yFor = (v) => top + h - (v / maxV) * h;

    const base = this.#baseline();
    if (base != null) {
      const by = yFor(base);
      const sy = yFor(base * 0.5);
      const dashed = (y, color) => {
        for (let x = STRIP_X + 108; x < STRIP_X + STRIP_W; x += 8) r.line(x, y, x + 4, y, color, 1);
      };
      dashed(by, P.shade);
      dashed(sy, P.ember);
      // Labels live in a reserved left margin, so they never collide with each
      // other or with the data even when the two lines sit close together.
      r.text('natural baseline', STRIP_X + 8, by + 3, { size: 9, color: P.shade });
      r.text('half — suspicious', STRIP_X + 8, sy + 3, { size: 9, color: P.ember });
    }

    r.line(STRIP_X + 100, top, STRIP_X + 100, top + h, P.bark, 1);
    const points = [...this.samples.entries()].sort((a, b) => a[0] - b[0]);
    points.forEach(([idx, v], i) => {
      const band = this.bands[idx];
      const x = band.x + band.w / 2;
      const y = yFor(v);
      if (i > 0) {
        const [pIdx, pV] = points[i - 1];
        const pb = this.bands[pIdx];
        r.line(pb.x + pb.w / 2, yFor(pV), x, y, P.wood, 1);
      }
      const flat = base != null && v < base * 0.5;
      r.circle(x, y, flat ? 5 : 3.5, flat ? P.ember : P.sunwood);
      r.line(x, y, x, top + h, flat ? P.ember : P.wood, 1);
    });
  }

  #drawFooter(r) {
    const y = 386;
    r.panel(STRIP_X - 6, y, STRIP_W + 12, 74);
    if (this.brief) {
      r.text(this.brief, STRIP_X + 8, y + 24, { size: 11, color: P.shadeLit });
    }
    r.text(this.notice, STRIP_X + 8, y + (this.brief ? 46 : 30), { size: 13, color: P.pale });

    const claimText = this.claim.start == null ? 'no claim filed'
      : this.claim.end == null ? `bracket open at ${this.rings[this.claim.start].year}`
      : `claim: ${this.rings[this.claim.start].year}–${this.rings[this.claim.end - 1].year}`
        + ` (${this.claim.end - this.claim.start} rings)`;
    r.text(claimText, STRIP_X + STRIP_W - 4, y + 30, { size: 11, color: P.sunwood, align: 'right' });

    r.text('←/→ move    hold E + ←/→ jump    E sample    enter bracket / file    x clear',
      r.W / 2, 496, { size: 11, color: P.wood, align: 'center' });
  }

  #drawResult(r) {
    const res = this.result;
    r.save();
    r.alpha(0.88);
    r.rect(0, 0, r.W, r.H, P.void);
    r.restore();

    const w = 660;
    const x = (r.W - w) / 2;
    r.panel(x, 120, w, 300, { accent: P.sunwood });

    const headline = {
      [VERDICTS.CERTIFIED]: ['CLAIM CERTIFIED', P.sunwood],
      [VERDICTS.PARTIAL]: ['CLAIM PARTIALLY UPHELD', P.ember],
      [VERDICTS.REJECTED]: ['CLAIM REJECTED', P.scar],
    }[res.verdict];
    r.text(headline[0], r.W / 2, 164, { size: 22, color: headline[1], align: 'center', weight: 700 });

    const stats = `overlap ${(res.iou * 100).toFixed(0)}%   `
      + `recall ${(res.recall * 100).toFixed(0)}%   precision ${(res.precision * 100).toFixed(0)}%`;
    r.text(stats, r.W / 2, 192, { size: 12, color: P.paleDim, align: 'center' });
    r.text(`the written span ran ${this.rings[res.edit.start].year}–${this.rings[res.edit.end - 1].year}`,
      r.W / 2, 214, { size: 12, color: P.pale, align: 'center' });

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

    r.wrap(body, w - 60, 12).forEach((line, i) => {
      r.text(line, x + 30, 252 + i * 18, { size: 12, color: P.paleDim });
    });
    r.text('enter — continue', r.W / 2, 400, { size: 12, color: P.pale, align: 'center' });
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
