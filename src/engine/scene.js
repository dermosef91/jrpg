/** Scene stack. Only the top scene updates; scenes below may still draw
 *  (a battle over an overworld, a dialogue box over a town). */
export class SceneStack {
  #stack = [];

  constructor(ctxObject) { this.game = ctxObject; }

  get top() { return this.#stack.at(-1) ?? null; }
  get depth() { return this.#stack.length; }

  push(scene) {
    scene.game = this.game;
    this.#stack.push(scene);
    scene.enter?.();
    return scene;
  }

  pop(result) {
    const scene = this.#stack.pop();
    scene?.exit?.();
    this.top?.resume?.(result, scene);
    return scene;
  }

  replace(scene) {
    while (this.#stack.length) this.#stack.pop()?.exit?.();
    return this.push(scene);
  }

  update(dt) { this.top?.update?.(dt); }

  draw(r, alpha) {
    // Draw from the deepest scene that is opaque, so overlays composite correctly.
    let base = 0;
    for (let i = this.#stack.length - 1; i >= 0; i--) {
      if (!this.#stack[i].overlay) { base = i; break; }
    }
    for (let i = base; i < this.#stack.length; i++) {
      this.#stack[i].draw?.(r, alpha, i === this.#stack.length - 1);
    }
  }
}

/** Base class. `overlay` means "scenes below me should keep drawing". */
export class Scene {
  overlay = false;
  game = null;
  get input() { return this.game.input; }
}
