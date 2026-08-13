import { Scene } from '../../engine/scene.js';
import { P, alpha, mix } from '../../engine/palette.js';
import { panel, cornerTicks } from '../ui/frame.js';
import { drawPortrait } from '../art/portrait.js';
import { CHARACTERS } from '../data/party.js';

// A step-based script runner. Cutscenes are plain arrays of steps, which keeps
// the writing readable as writing and keeps the engine out of the content.
//
//   { say: 'ZAHRA', text: '...' }   a line, with portrait
//   { narrate: '...' }              unattributed, centred, no box
//   { teach: { title, body } }      a rules card the player must dismiss
//   { walk: [[x, y], ...] }         drive the party along a path
//   { face: 'down' }                turn the party
//   { wait: 0.8 }                   beat
//   { fade: 'out' | 'in', time }    screen wipe
//   { shake: 2 }                    camera
//   { sfx: 'bell' }                 one sound
//   { mood: 'field' }               swap the ambient bed
//   { battle: { encounter, tutorial } }
//   { goTo: { map, spawn } }
//   { objective: 'REPORT THE SEAM' }
//   { flag: 'sawTheMask' }
//   { call: (game) => {} }          escape hatch

const PORTRAITS = new Map(CHARACTERS.map((c) => [c.name, c.figure]));

export class Director extends Scene {
  overlay = true;

  constructor(script, { field = null, onEnd = null } = {}) {
    super();
    this.script = script;
    this.field = field;
    this.onEnd = onEnd;
    this.i = 0;
    this.step = null;
    this.reveal = 0;
    this.spoken = 0;
    this.wait = 0;
    this.fade = 0;
    this.fadeTo = 0;
    this.fadeRate = 1;
    this.t = 0;
    this.blockedOnBattle = false;
  }

  enter() { this.#next(); }

  get lineDone() {
    const text = this.step?.text ?? this.step?.narrate ?? '';
    return this.reveal >= text.length;
  }

  #next() {
    this.reveal = 0;
    this.spoken = 0;
    if (this.i >= this.script.length) {
      this.game.scenes.pop();
      this.onEnd?.();
      return;
    }
    this.step = this.script[this.i++];
    this.#begin(this.step);
  }

  #begin(step) {
    const game = this.game;
    if (step.sfx) this.audio?.play(step.sfx);
    if (step.mood !== undefined) this.audio?.setMood(step.mood);
    if (step.shake) {
      game.renderer.shakeX = (Math.random() - 0.5) * step.shake * 2;
      game.renderer.shakeY = (Math.random() - 0.5) * step.shake * 2;
    }
    if (step.flag) game.flags.add(step.flag);
    if (step.objective !== undefined) game.setObjective(step.objective);
    if (step.call) step.call(game, this);
    if (step.wait) this.wait = step.wait;
    if (step.face && this.field) this.field.facing = step.face;
    if (step.walk && this.field) this.field.scriptWalk(step.walk);
    if (step.fade) {
      this.fadeTo = step.fade === 'out' ? 1 : 0;
      this.fadeRate = 1 / Math.max(0.05, step.time ?? 0.5);
      if (step.fade === 'out' && this.fade === 0) this.fade = 0.001;
    }
    if (step.goTo) {
      game.goToMap(step.goTo.map, step.goTo.spawn);
      this.field = game.field;
    }
    if (step.battle) {
      this.blockedOnBattle = true;
      game.startBattle(step.battle.encounter, {
        tutorial: step.battle.tutorial,
        onEnd: () => { this.blockedOnBattle = false; },
      });
    }
    // Steps with nothing to wait on fall straight through.
    if (!this.#blocking(step)) this.#next();
  }

  #blocking(step) {
    return !!(step.say || step.narrate || step.teach || step.wait || step.walk
      || step.fade || step.battle);
  }

  update(dt) {
    this.t += dt;
    const g = this.game;
    g.renderer.shakeX *= 0.86;
    g.renderer.shakeY *= 0.86;

    // The field keeps animating under a cutscene, but never reads input.
    this.field?.updateScripted?.(dt);

    if (this.fade !== this.fadeTo) {
      const d = this.fadeRate * dt;
      this.fade = this.fadeTo > this.fade
        ? Math.min(this.fadeTo, this.fade + d)
        : Math.max(this.fadeTo, this.fade - d);
    }

    if (this.blockedOnBattle) return;

    const step = this.step;
    if (!step) return;

    // The fight is over and the scene beneath us has come back. A battle step
    // has nothing else to wait on, so the script picks straight back up.
    if (step.battle) { this.#next(); return; }

    if (step.walk) {
      if (this.field?.scriptedWalking) return;
      this.#next();
      return;
    }
    if (step.fade) {
      if (this.fade !== this.fadeTo) return;
      this.#next();
      return;
    }
    if (step.wait) {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.#next();
      return;
    }
    if (step.teach) {
      if (this.input.pressed('confirm') || this.input.pressed('cancel')) {
        this.audio?.play('confirm');
        this.#next();
      }
      return;
    }
    if (step.say || step.narrate) {
      const text = step.text ?? step.narrate;
      if (this.reveal < text.length) {
        this.reveal = Math.min(text.length, this.reveal + dt * 74);
        if (this.reveal - this.spoken > 4) {
          this.spoken = this.reveal;
          this.audio?.play('page');
        }
        if (this.input.pressed('confirm')) this.reveal = text.length;
        return;
      }
      if (this.input.pressed('confirm') || this.input.pressed('cancel')) {
        this.audio?.play('confirm');
        this.#next();
      }
    }
  }

  // --- draw ----------------------------------------------------------------

  draw(r) {
    const step = this.step;
    if (step?.narrate) this.#drawNarration(r, step);
    else if (step?.say) this.#drawLine(r, step);
    if (step?.teach) this.#drawTeach(r, step.teach);
    if (this.fade > 0) r.rect(0, 0, r.W, r.H, alpha(P.void, this.fade));
  }

  #drawLine(r, step) {
    const h = 54;
    const y = r.H - h - 6;
    r.dither(0, y - 14, r.W, h + 20, P.void, 0.72);
    panel(r, 6, y, r.W - 12, h, { fill: alpha(P.void, 0.96) });

    const figure = PORTRAITS.get(step.say);
    let textX = 16;
    if (figure) {
      drawPortrait(r, figure, 12, y + 8, { frameColor: P.ember });
      textX = 38;
    }
    const w = r.measure(step.say, { tracking: 1 }) + 10;
    r.rect(textX - 2, y - 5, w, 11, P.black);
    r.frame(textX - 2, y - 5, w, 11, P.ember, 1);
    r.text(step.say, textX + 3, y - 3, { color: P.emberBright, tracking: 1 });

    const shown = (step.text ?? '').slice(0, Math.floor(this.reveal));
    r.wrap(shown, r.W - textX - 30).slice(0, 4).forEach((line, i) => {
      r.text(line, textX, y + 12 + i * 10, { color: P.stoneLit });
    });
    if (this.lineDone && Math.sin(this.t * 6) > -0.3) {
      r.text('v', r.W - 20, y + h - 12, { color: P.emberBright });
    }
  }

  #drawNarration(r, step) {
    const lines = r.wrap(step.narrate.slice(0, Math.floor(this.reveal)), 320);
    const total = lines.length * 12;
    const top = (r.H - total) / 2;
    r.dither(0, top - 22, r.W, total + 44, P.void, 0.8);
    lines.forEach((line, i) => {
      r.text(line, r.W / 2, top + i * 12, { color: P.boneLit, align: 'center' });
    });
    if (this.lineDone && Math.sin(this.t * 4) > -0.2) {
      r.text('.', r.W / 2, top + total + 12, { color: P.emberDim, align: 'center' });
    }
  }

  /** A rules card. Deliberately blunt: the player is being taught something. */
  #drawTeach(r, teach) {
    r.rect(0, 0, r.W, r.H, alpha(P.void, 0.82));
    const w = 260;
    const lines = r.wrap(teach.body, w - 28);
    const h = 34 + lines.length * 10;
    const x = (r.W - w) >> 1;
    const y = (r.H - h) >> 1;
    panel(r, x, y, w, h, { fill: P.black, accent: P.emberBright });
    r.rect(x + 1, y + 1, w - 2, 12, alpha(P.ember, 0.2));
    r.text(teach.title, x + w / 2, y + 4, {
      color: P.emberHot, align: 'center', tracking: 2,
    });
    lines.forEach((line, i) => {
      r.text(line, x + 14, y + 20 + i * 10, { color: P.stoneLit });
    });
    if (Math.sin(this.t * 5) > -0.3) {
      r.text('ENTER', x + w / 2, y + h - 10, { color: P.boneWhite, align: 'center', tracking: 2 });
    }
  }
}
