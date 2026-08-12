import { Scene } from '../engine/scene.js';
import { P } from '../engine/palette.js';

/** Title. The rings drawn behind the text are the same cross-section the whole
 *  game is drawn with -- and one band of them is conspicuously even. */
export class TitleScene extends Scene {
  constructor(onStart) {
    super();
    this.onStart = onStart;
    this.t = 0;
    this.widths = Array.from({ length: 46 }, (_, i) => {
      // A smooth, too-regular span sits between rings 16 and 30.
      if (i >= 16 && i < 30) return 5.4 + Math.sin(i * 0.4) * 0.25;
      return 4 + ((i * 2654435761) % 1000) / 1000 * 5.5;
    });
  }

  update(dt) {
    this.t += dt;
    if (this.input.pressed('confirm')) this.onStart();
  }

  draw(r) {
    r.clear(P.void);

    let radius = 6;
    for (let i = 0; i < this.widths.length; i++) {
      radius += this.widths[i];
      const edited = i >= 16 && i < 30;
      r.save();
      r.alpha(edited ? 0.5 : 0.28);
      r.circle(r.W / 2, r.H / 2 + 30, radius, edited ? P.woodLit : P.wood, { stroke: true, lw: 1.4 });
      r.restore();
    }

    const glow = 0.6 + 0.4 * Math.sin(this.t * 0.9);
    r.save();
    r.alpha(glow);
    r.circle(r.W / 2, r.H / 2 + 30, 5, P.ember);
    r.restore();

    r.save();
    r.alpha(0.9);
    r.rect(0, 132, r.W, 128, P.void);
    r.restore();

    r.text('SECOND HARVEST', r.W / 2, 196, {
      size: 42, color: P.pale, align: 'center', weight: 700,
    });
    r.text('the sun is in a dim phase  ·  nobody caused it  ·  nobody can fix it',
      r.W / 2, 226, { size: 13, color: P.sunwood, align: 'center' });

    r.text('You are a licensed audit circuit. You read the memory in the growth rings of',
      r.W / 2, 400, { size: 12, color: P.paleDim, align: 'center' });
    r.text('cities that walk, and certify what actually happened against what was filed.',
      r.W / 2, 420, { size: 12, color: P.paleDim, align: 'center' });

    r.save();
    r.alpha(0.55 + 0.45 * Math.sin(this.t * 3));
    r.text('press enter', r.W / 2, 470, { size: 14, color: P.pale, align: 'center', weight: 700 });
    r.restore();
    r.text('arrows move  ·  enter confirm  ·  x cancel  ·  e sample', r.W / 2, 500,
      { size: 11, color: P.wood, align: 'center' });
  }
}
