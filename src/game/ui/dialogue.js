import { Scene } from '../../engine/scene.js';
import { P, RAMP, alpha, mix } from '../../engine/palette.js';

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
    this.t = 0;
    this.spoken = 0;
  }

  get beat() { return this.beats[this.page]; }

  update(dt) {
    this.t += dt;
    const full = this.beat.text.length;
    if (this.reveal < full) {
      this.reveal = Math.min(full, this.reveal + dt * 92);
      // One dry tick every few glyphs, so speech has a texture without chattering.
      if (this.reveal - this.spoken > 3.5) {
        this.spoken = this.reveal;
        this.game.audio.play('page');
      }
      if (this.input.pressed('confirm')) this.reveal = full;
      return;
    }
    if (!this.input.pressed('confirm') && !this.input.pressed('cancel')) return;
    this.game.audio.play('confirm');
    this.page += 1;
    this.reveal = 0;
    this.spoken = 0;
    if (this.page >= this.beats.length) {
      this.game.scenes.pop();
      this.onEnd?.();
    }
  }

  draw(r) {
    const h = 156;
    const y = r.H - h - 18;
    const x = 22;
    const w = r.W - 44;

    // Darken the world behind the box so the type carries the frame.
    r.save();
    const g = r.ctx.createLinearGradient(0, y - 70, 0, r.H);
    g.addColorStop(0, alpha(RAMP.bark[0], 0));
    g.addColorStop(1, alpha(RAMP.bark[0], 0.75));
    r.ctx.fillStyle = g;
    r.ctx.fillRect(0, y - 70, r.W, h + 88);
    r.restore();

    r.panel(x, y, w, h, { accent: RAMP.amber[3] });
    r.light(x + 60, y + 10, 220, RAMP.amber[2], 0.12);

    const beat = this.beat;
    if (beat.speaker) {
      const tw = r.measure(beat.speaker, 13, 700, 'display') + 30;
      r.roundRect(x + 18, y - 15, tw, 30, 4, mix(RAMP.wood[1], RAMP.bark[2], 0.4));
      r.roundRect(x + 18, y - 15, tw, 30, 4, RAMP.amber[3], { stroke: true, lw: 1.5 });
      r.text(beat.speaker, x + 33, y + 5, {
        size: 13, color: RAMP.pale[5], weight: 700, font: 'display', tracking: 0.5,
      });
    }

    const shown = beat.text.slice(0, Math.floor(this.reveal));
    r.wrap(shown, w - 76, 14.5).slice(0, 5).forEach((line, i) => {
      r.text(line, x + 30, y + 52 + i * 23, { size: 14.5, color: RAMP.pale[4] });
    });

    if (this.reveal >= beat.text.length) {
      const bob = Math.sin(this.t * 5) * 2.5;
      const more = this.page + 1 < this.beats.length;
      const ax = x + w - 34;
      const ay = y + h - 22 + bob;
      r.save();
      r.blend('lighter', () => {
        if (more) r.poly([[ax - 6, ay - 4], [ax + 6, ay - 4], [ax, ay + 5]], RAMP.amber[4]);
        else r.rect(ax - 4, ay - 4, 8, 8, RAMP.amber[4]);
      });
      r.restore();
    }

    // Page pips, so a long speech shows how long it is.
    if (this.beats.length > 1) {
      for (let i = 0; i < this.beats.length; i++) {
        r.circle(x + 30 + i * 10, y + h - 18, 2.5,
          i <= this.page ? RAMP.amber[3] : alpha(RAMP.wood[1], 0.8));
      }
    }
  }
}
