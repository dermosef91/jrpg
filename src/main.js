import { Renderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { SceneStack } from './engine/scene.js';
import { runLoop } from './engine/loop.js';
import { Audio } from './engine/audio.js';
import { makeRng } from './engine/rng.js';
import { P } from './engine/palette.js';
import { installTouchControls, isTouchDevice } from './engine/touch.js';

import { TitleScene } from './game/title-scene.js';
import { BattleScene } from './game/battle/battle-scene.js';
import { heroUnit, foeUnit } from './game/battle/battle.js';
import { makeParty, DEFAULT_FORMATION } from './game/data/party.js';
import { STARTING_INVENTORY } from './game/data/items.js';
import { STARTING_SHARDS } from './game/data/shards.js';
import { ENCOUNTERS, getFoe } from './game/data/foes.js';
import { Director } from './game/story/director.js';
import { OPENING, BEATS, BEATS_AGAIN, DESCEND_AGAIN } from './game/story/prologue.js';

export async function boot(bootEl) {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  bootEl?.remove();
  const game = new Game(canvas);
  game.start();
  installTouchControls(game.input, game.renderer);
  watchOrientation();
  globalThis.__game = game;
  return game;
}

/** A portrait phone cannot show 480x270 of UI at a usable size. Ask for the
 *  long edge rather than pretending otherwise. */
function watchOrientation() {
  const apply = () => {
    const portrait = isTouchDevice() && window.innerHeight > window.innerWidth;
    document.body.classList.toggle('portrait', portrait);
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
    this.audio = new Audio();
    this.rng = makeRng(0xe1b3);
    this.t = 0;

    this.party = makeParty();
    this.formation = [...DEFAULT_FORMATION];
    this.inventory = STARTING_INVENTORY.map((e) => ({ ...e }));
    this.shards = { ...STARTING_SHARDS };
    this.muteFlash = 0;
    this.flags = new Set();
    // Story beats fire once per run, not once per time a map is loaded.
    this.firedTriggers = new Set();
    this.objective = null;
    this.encountersOff = false;
    this.field = null;

    const wake = () => this.audio.resume();
    for (const evt of ['keydown', 'pointerdown']) {
      window.addEventListener(evt, wake, { once: true });
    }
  }

  get activeParty() {
    return this.formation.map((id) => this.party.find((c) => c.id === id)).filter(Boolean);
  }

  start() {
    this.scenes.push(new TitleScene(() => this.enterWorld()));
    runLoop({
      update: (dt) => {
        this.t += dt;
        if (this.input.pressed('mute')) {
          this.audio.resume();
          this.audio.toggleMute();
          this.muteFlash = 1.5;
        }
        this.muteFlash = Math.max(0, this.muteFlash - dt);
        this.scenes.update(dt);
        this.input.endFrame();
      },
      draw: () => {
        this.scenes.draw(this.renderer);
        if (this.muteFlash > 0) this.#drawMuteToast(this.renderer);
        this.renderer.present();
      },
    });
  }

  #drawMuteToast(r) {
    const label = this.audio.muted ? 'SOUND OFF' : 'SOUND ON';
    const w = r.measure(label, { tracking: 1 }) + 12;
    r.rect(r.W - w - 4, 4, w, 12, P.black);
    r.frame(r.W - w - 4, 4, w, 12, P.ember, 1);
    r.text(label, r.W - w / 2 - 4, 7, { color: P.emberLit, align: 'center', tracking: 1 });
  }

  /** Start the prologue. The world scene is loaded lazily so the title appears
   *  instantly, then the opening script takes it from there. */
  enterWorld() {
    import('./game/explore/explore-scene.js').then(({ ExploreScene }) => {
      this.ExploreScene = ExploreScene;
      // Built on the map the prologue actually opens on. If a frame ever does
      // slip out before the cold open blacks the screen, it should at least be
      // a frame of the right place.
      this.field = this.scenes.replace(new ExploreScene({ mapId: 'quietstair' }));
      this.runScript(OPENING);
    });
  }

  runScript(script, onEnd = null) {
    this.scenes.push(new Director(script, { field: this.field, onEnd }));
  }

  goToMap(mapId, spawn = null) {
    if (!this.ExploreScene) return null;
    this.field = new this.ExploreScene({ mapId, spawn });
    // The director sits on top of the field, so swap the field underneath it.
    this.scenes.replaceUnderTop(this.field);
    return this.field;
  }

  setObjective(text) { this.objective = text || null; }

  /** A trigger tile was stepped on. Returns true if a script took over. */
  fireTrigger(id) {
    const beat = (this.flags.has('reported') ? BEATS_AGAIN[id] : null) ?? BEATS[id];
    if (!beat) return false;
    this.runScript(beat);
    return true;
  }

  /** Walking into the Quiet Stair door from Rootplaza. */
  descend() {
    if (!this.flags.has('sawTheMask')) {
      this.runScript([
        { say: 'ZAHRA', text: 'We have already been down. Report it first -- the Gate Hand is waiting.' },
      ]);
      return;
    }
    if (this.flags.has('reported')) {
      // Back down, but only the last flight of it: the player has walked the
      // long way once already and does not need to walk it again to be scared.
      this.firedTriggers.delete('quietstair:6');
      this.runScript([
        { fade: 'out', time: 0.8 },
        { goTo: { map: 'quietstair', spawn: { x: 2, y: 16 } } },
        { call: (game) => { game.encountersOff = true; } },
        { fade: 'in', time: 1.0 },
        ...DESCEND_AGAIN,
      ]);
      return;
    }
    this.runScript([
      { say: 'KOFI', text: 'Report first. Then we go back down with something better than one lamp.' },
    ]);
  }

  startBattle(encounterId = null, { tutorial = null, onEnd = null } = {}) {
    const spec = encounterId
      ? ENCOUNTERS.find((e) => e.id === encounterId) ?? this.rng.pick(ENCOUNTERS)
      : this.rng.pick(ENCOUNTERS.filter((e) => !e.boss && !e.scripted));
    const counts = new Map();
    const foes = spec.foes.map((id) => {
      const n = (counts.get(id) ?? 0) + 1;
      counts.set(id, n);
      const dupes = spec.foes.filter((k) => k === id).length;
      return foeUnit(id, dupes > 1 ? ` ${'ABCD'[n - 1]}` : '');
    });
    const party = this.activeParty.map(heroUnit);
    this.scenes.push(new BattleScene({
      party, foes, title: spec.title, seed: this.rng.int(1, 1e6),
      backdrop: spec.backdrop ?? (this.field?.map?.dark ? 'stair' : 'low'),
      tutorial, onEnd,
    }));
  }

  openMenu() {
    import('./game/menu/menu-scene.js').then(({ MenuScene }) => {
      this.scenes.push(new MenuScene());
    });
  }

  /** Carry HP/EP back out of a battle onto the persistent party. */
  syncPartyFromBattle(units) {
    for (const u of units) {
      const c = this.party.find((p) => p.id === u.id);
      if (!c) continue;
      c.hp = Math.max(0, Math.round(u.hp));
      c.ep = Math.max(0, Math.round(u.ep));
      c.down = c.hp <= 0;
    }
  }

  awardSpoils({ exp = 0, shards = {} } = {}) {
    for (const c of this.activeParty) c.exp = (c.exp ?? 0) + exp;
    for (const [id, n] of Object.entries(shards)) {
      this.shards[id] = (this.shards[id] ?? 0) + n;
    }
  }

  /** Rest: full restore. Used by camp points in the world. */
  rest() {
    for (const c of this.party) {
      c.hp = c.maxHp;
      c.ep = c.maxEp;
      c.down = false;
    }
  }
}

export { Game };
