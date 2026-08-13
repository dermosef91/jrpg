import { Scene } from '../../engine/scene.js';
import { P, alpha } from '../../engine/palette.js';
import { panel } from './frame.js';

/** Bottom-of-screen dialogue. The world keeps drawing behind it. */
export class DialogueScene extends Scene {
  overlay = true;

  constructor(beats, { onEnd = null } = {}) {
    super();
    this.beats = Array.isArray(beats) ? beats : [beats];
    this.page = 0;
    this.reveal = 0;
    this.spoken = 0;
    this.onEnd = onEnd;
    this.t = 0;
  }

  get beat() { return this.beats[this.page]; }

  update(dt) {
    this.t += dt;
    const full = this.beat.text.length;
    if (this.reveal < full) {
      this.reveal = Math.min(full, this.reveal + dt * 78);
      if (this.reveal - this.spoken > 4) {
        this.spoken = this.reveal;
        this.audio?.play('page');
      }
      if (this.input.pressed('confirm')) this.reveal = full;
      return;
    }
    if (!this.input.pressed('confirm') && !this.input.pressed('cancel')) return;
    this.audio?.play('confirm');
    this.page += 1;
    this.reveal = 0;
    this.spoken = 0;
    if (this.page >= this.beats.length) {
      this.game.scenes.pop();
      this.onEnd?.();
    }
  }

  draw(r) {
    const h = 56;
    const y = r.H - h - 6;
    r.dither(0, y - 16, r.W, h + 22, P.void, 0.7);
    panel(r, 6, y, r.W - 12, h, { fill: alpha(P.void, 0.95) });

    const beat = this.beat;
    if (beat.speaker) {
      const w = r.measure(beat.speaker, { tracking: 1 }) + 10;
      r.rect(14, y - 5, w, 11, P.black);
      r.frame(14, y - 5, w, 11, P.ember, 1);
      r.text(beat.speaker, 19, y - 3, { color: P.emberBright, tracking: 1 });
    }

    const shown = beat.text.slice(0, Math.floor(this.reveal));
    r.wrap(shown, r.W - 40).slice(0, 4).forEach((line, i) => {
      r.text(line, 16, y + 12 + i * 10, { color: P.stoneLit });
    });

    if (this.reveal >= beat.text.length && Math.sin(this.t * 6) > -0.3) {
      const more = this.page + 1 < this.beats.length;
      r.text(more ? 'v' : '.', r.W - 20, y + h - 12, { color: P.emberBright });
    }
  }
}
