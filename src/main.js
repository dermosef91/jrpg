import { Renderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { SceneStack } from './engine/scene.js';
import { runLoop } from './engine/loop.js';
import { installTouchControls, isTouchDevice } from './engine/touch.js';
import { Audio } from './engine/audio.js';
import { Particles } from './engine/particles.js';
import { makeRng } from './engine/rng.js';

import { TitleScene } from './game/title-scene.js';
import { FieldScene } from './game/world/field-scene.js';
import { MAPS } from './game/world/maps.js';
import { BattleScene } from './game/battle/battle-scene.js';
import { AuditScene } from './game/audit/audit-scene.js';
import { DialogueScene } from './game/ui/dialogue.js';
import { makeParty } from './game/data/cast.js';
import { rollEncounter } from './game/data/foes.js';
import { P } from './engine/palette.js';

export async function boot(bootEl) {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  bootEl?.remove();

  const game = new Game(canvas);
  game.start();
  installTouchControls(game.input, game.renderer);
  watchOrientation();
  // Handy from the console, and how the browser smoke test drives each scene.
  globalThis.__game = game;
  return game;
}

/** A portrait phone cannot show 960x540 of small type at a readable size, so ask
 *  for the long edge rather than pretending otherwise. */
function watchOrientation() {
  const apply = () => {
    const portrait = isTouchDevice() && window.innerHeight > window.innerWidth;
    document.body.classList.toggle('is-portrait', portrait);
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}

class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.input = new Input().attach(window);
    this.scenes = new SceneStack(this);
    this.party = makeParty();
    this.rng = makeRng(20240812);
    this.auditsFiled = 0;
    this.field = null;
    this.time = 0;
    this.audio = new Audio();
    this.particles = new Particles();
    this.muteFlash = 0;

    // Audio cannot start until the player has interacted with the page.
    const wake = () => this.audio.resume();
    for (const evt of ['keydown', 'pointerdown']) {
      window.addEventListener(evt, wake, { once: true });
    }
  }

  start() {
    this.scenes.push(new TitleScene(() => this.goTo('braid')));
    runLoop({
      update: (dt) => {
        this.time += dt;
        if (this.input.pressed('mute')) {
          this.audio.resume();
          this.muteFlash = 1.6;
          this.audio.toggleMute();
          if (!this.audio.muted) this.audio.play('confirm');
        }
        this.muteFlash = Math.max(0, this.muteFlash - dt);
        this.particles.update(dt);
        this.scenes.update(dt);
        this.input.endFrame();
      },
      draw: (alpha) => {
        this.scenes.draw(this.renderer, alpha);
        // Each scene grades its own frame: the field is warm and hazy, a battle
        // is contrastier, the audit bench is a cold clean desk lamp.
        if (this.muteFlash > 0) this.#drawMuteToast(this.renderer);
        this.renderer.grade = this.scenes.top?.grade ?? {};
        this.renderer.present(this.time);
      },
    });
  }

  #drawMuteToast(r) {
    const text = this.audio.muted ? 'sound off' : 'sound on';
    const w = r.measure(text, 12) + 34;
    r.save();
    r.alpha(Math.min(1, this.muteFlash / 0.4));
    r.panel(r.W - w - 16, 16, w, 30, { accent: P.sunwood });
    r.text(text, r.W - w / 2 - 16, 36, { size: 12, color: P.pale, align: 'center' });
    r.restore();
  }

  goTo(mapId, spawn = null) {
    const map = MAPS[mapId];
    if (!map) throw new Error(`no such map: ${mapId}`);
    this.field = new FieldScene(map, {
      spawn,
      onEncounter: () => this.startBattle(),
    });
    this.scenes.replace(this.field);
    return this.field;
  }

  // --- encounters -----------------------------------------------------------

  startBattle() {
    const { title, foes } = rollEncounter(this.rng);
    resetForEncounter(this.party);
    this.scenes.push(new BattleScene({
      party: this.party,
      foes,
      title,
      seed: this.rng.int(1, 1e6),
      onEnd: (outcome) => this.#afterBattle(outcome),
    }));
  }

  #afterBattle(outcome) {
    // Nothing here is lethal in the slice: a lost encounter costs the circuit
    // time it does not have, which is the only currency that matters.
    const fraction = outcome === 'victory' ? 0.35 : 1;
    resetForEncounter(this.party);
    for (const c of this.party) {
      c.hp = Math.max(1, Math.min(c.maxHp, Math.round(c.hp + c.maxHp * fraction)));
    }
  }

  // --- the audit ------------------------------------------------------------

  startAudit() {
    const seed = 101 + this.auditsFiled * 37;
    this.scenes.push(new AuditScene({
      seed,
      boleName: 'Cordwain',
      brief: 'Disputed span: the 840s. Cordwain says it migrated. Anneal says it did not.',
      onEnd: (result) => this.#afterAudit(result),
    }));
  }

  #afterAudit(result) {
    this.auditsFiled += 1;
    if (result.verdict !== 'certified') {
      this.scenes.push(new DialogueScene([{
        speaker: 'Wend',
        text: 'Then we pull another core and we do it again. Nobody is paying us by the hour, '
            + 'which is fortunate, because this is going to take a while.',
      }]));
      return;
    }
    this.scenes.push(new DialogueScene([
      { speaker: 'Tarn', text: 'Forty rings. I said forty rings.' },
      { speaker: 'Pell', text: 'Forty rings of a century that did not wobble once. There is no '
        + 'weather that does that. There is no century that does that.' },
      { speaker: 'Wend', text: '...' },
      { speaker: 'Pell', text: 'Wend.' },
      { speaker: 'Wend', text: 'The hand is a cant-hand. It is a maintenance hand — someone has been '
        + 're-inking this, deliberately, on a schedule, for a very long time.' },
      { speaker: 'Wend', text: 'I know the technique because I was taught the technique. In my '
        + "grandmother's kitchen. I was nine. I have passages of my own." },
      { speaker: 'Kite', text: 'Then pull Anneal. Pull Sill. Pull Marrow. If it is only Cordwain '
        + 'it is a fraud, and if it is everywhere it is something else.' },
      { speaker: 'Tarn', text: 'It will be everywhere. Ask the councilor on Crown — she has been '
        + 'sitting on hers for six years.' },
    ]));
  }
}

/** Grafts, scars, guard state and revealed-ness are per-encounter. HP is not. */
function resetForEncounter(party) {
  for (const c of party) {
    c.grafts.length = 0;
    c.scars = 0;
    c.maxHp = c.baseMaxHp;
    c.guarding = false;
    c.revealed = true;
    c.intent = null;
    c.intentVisible = false;
    c.hp = Math.min(c.hp, c.maxHp);
  }
}
