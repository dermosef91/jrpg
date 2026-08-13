import { Scene } from '../engine/scene.js';
import { P, alpha, mix } from '../engine/palette.js';
import { makeRng } from '../engine/rng.js';
import { ornateBorder } from './ui/frame.js';

/** Title: the mandala burning alone in the dark, and the name cut into stone. */
export class TitleScene extends Scene {
  constructor(onStart) {
    super();
    this.onStart = onStart;
    this.t = 0;
    this.started = false;
    this.motes = Array.from({ length: 40 }, () => {
      const rng = makeRng(Math.floor(Math.random() * 1e9));
      return {
        x: rng.range(0, 480), y: rng.range(0, 270),
        vy: -rng.range(2, 8), vx: rng.range(-2, 2), s: rng.next(),
      };
    });
  }

  enter() { this.audio?.setMood('menu'); }

  update(dt) {
    this.t += dt;
    for (const m of this.motes) {
      m.y += m.vy * dt;
      m.x += m.vx * dt;
      if (m.y < -4) { m.y = 274; m.x = Math.random() * 480; }
    }
    if (this.input.pressed('confirm') && !this.started) {
      this.started = true;
      this.audio?.resume();
      this.audio?.play('open');
      this.onStart();
    }
  }

  draw(r) {
    r.begin(P.void);
    const cx = r.W >> 1;
    const cy = 118;

    // the mandala, breathing
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 0.8);
    r.glow(cx, cy, 92 + pulse * 10, P.emberDeep, 0.24);
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2 + this.t * 0.03;
      const inner = i % 2 ? 34 : 40;
      const outer = i % 4 === 0 ? 74 : 60;
      r.line(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner,
        cx + Math.cos(a) * outer, cy + Math.sin(a) * outer,
        i % 4 === 0 ? P.ember : P.emberDeep);
    }
    r.circle(cx, cy, 46, P.ember, { fill: false });
    r.circle(cx, cy, 43, P.emberDeep, { fill: false });
    r.circle(cx, cy, 28, P.emberLit, { fill: false });
    r.circle(cx, cy, 12, P.emberHot);
    r.circle(cx, cy, 6, P.emberWhite);

    // motes rising through the light
    for (const m of this.motes) {
      r.px(Math.round(m.x), Math.round(m.y), m.s > 0.6 ? P.emberLit : P.emberDeep);
    }

    // root silhouettes closing in
    for (let i = 0; i < 8; i++) {
      const x = i < 4 ? i * 14 : r.W - (8 - i) * 14;
      for (let y = 0; y < r.H; y += 3) {
        const w = 8 + Math.round(Math.sin(y * 0.05 + i) * 4);
        r.rect(x + Math.sin(y * 0.06 + i * 2) * 4, y, w, 3, i % 2 ? P.black : P.root);
      }
    }

    // the name, cut into a stone band
    r.rect(0, 96, r.W, 44, alpha(P.void, 0.86));
    r.hline(0, 96, r.W, alpha(P.ember, 0.5));
    r.hline(0, 139, r.W, alpha(P.ember, 0.5));
    r.text('EMBERROOT', cx, 108, {
      color: P.boneWhite, align: 'center', tracking: 5, shadow: P.emberDeep,
    });
    r.text('the fire is going out and the roots are still walking', cx, 124, {
      color: P.stoneMid, align: 'center',
    });

    ornateBorder(r, 2, 2, r.W - 4, r.H - 4);

    if (Math.sin(this.t * 3) > -0.4) {
      r.text('PRESS ENTER', cx, 210, { color: P.emberBright, align: 'center', tracking: 3 });
    }
    r.text('ARROWS MOVE   ENTER CONFIRM   X BACK   C MENU   M SOUND', cx, 244, {
      color: P.stoneShadow, align: 'center',
    });
  }
}
