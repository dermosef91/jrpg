// Edge-triggered input. Scenes ask "was this pressed since the last update",
// never "is it held", except for movement.
const BINDINGS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', Space: 'confirm', KeyZ: 'confirm',
  Escape: 'cancel', KeyX: 'cancel', Backspace: 'cancel',
  Tab: 'detail', KeyE: 'detail',
  KeyM: 'mute',
};

export class Input {
  #held = new Set();
  #pressed = new Set();
  #consumed = new Set();
  #deferredRelease = new Set();

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
    });
    // Losing focus mid-hold otherwise leaves the party walking forever.
    target.addEventListener('blur', () => {
      this.#held.clear();
      this.#deferredRelease.clear();
    });
    return this;
  }

  /** Synthetic press, used by the on-screen touch controls. */
  press(action) {
    if (!this.#held.has(action)) this.#pressed.add(action);
    this.#held.add(action);
  }

  release(action) {
    // A tap can start and finish between two update ticks. If the press has not
    // been seen by a frame yet, hold it until one has, or the tap is swallowed.
    if (this.#pressed.has(action)) this.#deferredRelease.add(action);
    else this.#held.delete(action);
  }

  held(action) { return this.#held.has(action); }

  /** True once per physical keypress. Consuming prevents one press firing in
   *  two scenes during the same frame (e.g. closing a menu and re-opening it). */
  pressed(action) {
    if (!this.#pressed.has(action) || this.#consumed.has(action)) return false;
    this.#consumed.add(action);
    return true;
  }

  /** Direction pressed this frame, or null. */
  dir() {
    for (const d of ['up', 'down', 'left', 'right']) if (this.pressed(d)) return d;
    return null;
  }

  endFrame() {
    for (const action of this.#deferredRelease) this.#held.delete(action);
    this.#deferredRelease.clear();
    this.#pressed.clear();
    this.#consumed.clear();
  }
}
