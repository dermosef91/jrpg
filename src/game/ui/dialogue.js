import { Scene } from '../../engine/scene.js';
import { P } from '../../engine/palette.js';

/** Bottom-of-screen dialogue overlay. Pages through an array of
 *  {speaker, text} beats; the field below keeps drawing. */
export class DialogueScene extends Scene {
  overlay = true;

  constructor(beats, { onEnd = null } = {}) {
    super();
    this.beats = Array.isArray(beats) ? beats : [beats];
    this.page = 0;
    this.reveal = 0;
    this.onEnd = onEnd;
  }

  get beat() { return this.beats[this.page]; }

  update(dt) {
    const full = this.beat.text.length;
    if (this.reveal < full) {
      this.reveal = Math.min(full, this.reveal + dt * 90);
      if (this.input.pressed('confirm')) this.reveal = full;
      return;
    }
    if (!this.input.pressed('confirm') && !this.input.pressed('cancel')) return;
    this.page += 1;
    this.reveal = 0;
    if (this.page >= this.beats.length) {
      this.game.scenes.pop();
      this.onEnd?.();
    }
  }

  draw(r) {
    const h = 148;
    const y = r.H - h - 16;
    r.panel(20, y, r.W - 40, h, { accent: P.sunwood });

    const beat = this.beat;
    if (beat.speaker) {
      r.rect(38, y - 13, r.measure(beat.speaker, 13, 700) + 24, 26, P.wood);
      r.strokeRect(38, y - 13, r.measure(beat.speaker, 13, 700) + 24, 26, P.woodLit, 2);
      r.text(beat.speaker, 50, y + 4, { size: 13, color: P.pale, weight: 700 });
    }

    const shown = beat.text.slice(0, Math.floor(this.reveal));
    r.wrap(shown, r.W - 100, 14).slice(0, 5).forEach((line, i) => {
      r.text(line, 44, y + 44 + i * 22, { size: 14, color: P.pale });
    });

    if (this.reveal >= beat.text.length) {
      const bob = Math.sin(performance.now() / 220) * 2;
      r.text(this.page + 1 < this.beats.length ? '▾' : '■',
        r.W - 52, y + h - 18 + bob, { size: 14, color: P.sunwood });
    }
  }
}
