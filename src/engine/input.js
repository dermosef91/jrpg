const BINDINGS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', Space: 'confirm', KeyZ: 'confirm',
  Escape: 'cancel', KeyX: 'cancel', Backspace: 'cancel',
  Tab: 'menu', KeyC: 'menu',
  KeyQ: 'pageLeft', KeyE: 'pageRight',
  KeyM: 'mute',
};

export class Input {
  #held = new Set();
  #pressed = new Set();
  #consumed = new Set();
  #deferred = new Set();
  #repeat = new Map();

  attach(target = window) {
    target.addEventListener('keydown', (e) => {
      const action = BINDINGS[e.code];
      if (!action) return;
      e.preventDefault();
      if (!this.#held.has(action)) this.#pressed.add(action);
      this.#held.add(action);
    });
    target.addEventListener('keyup', (e) => {
      const action = BINDINGS[e.code];
      if (!action) return;
      e.preventDefault();
      this.#held.delete(action);
      this.#repeat.delete(action);
    });
    target.addEventListener('blur', () => this.clear());
    return this;
  }

  clear() {
    this.#held.clear();
    this.#deferred.clear();
    this.#repeat.clear();
  }

  /** Synthetic press, for on-screen touch controls. */
  press(action) {
    if (!this.#held.has(action)) this.#pressed.add(action);
    this.#held.add(action);
  }

  release(action) {
    // A tap may begin and end between two ticks; hold it for one frame so it
    // is never swallowed.
    if (this.#pressed.has(action)) this.#deferred.add(action);
    else { this.#held.delete(action); this.#repeat.delete(action); }
  }

  held(action) { return this.#held.has(action); }

  pressed(action) {
    if (!this.#pressed.has(action) || this.#consumed.has(action)) return false;
    this.#consumed.add(action);
    return true;
  }

  /** Menu-style auto-repeat: fires once, pauses, then repeats while held. */
  repeat(action, dt, { delay = 0.34, rate = 0.09 } = {}) {
    if (!this.#held.has(action)) return false;
    if (this.pressed(action)) { this.#repeat.set(action, -delay); return true; }
    const t = (this.#repeat.get(action) ?? 0) + dt;
    if (t >= rate) { this.#repeat.set(action, t - rate); return true; }
    this.#repeat.set(action, t);
    return false;
  }

  dir(dt = 0) {
    for (const d of ['up', 'down', 'left', 'right']) {
      if (dt ? this.repeat(d, dt) : this.pressed(d)) return d;
    }
    return null;
  }

  endFrame() {
    for (const a of this.#deferred) { this.#held.delete(a); this.#repeat.delete(a); }
    this.#deferred.clear();
    this.#pressed.clear();
    this.#consumed.clear();
  }
}
