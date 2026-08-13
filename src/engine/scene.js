export class SceneStack {
  #stack = [];
  constructor(game) { this.game = game; }
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

  draw(r) {
    let base = 0;
    for (let i = this.#stack.length - 1; i >= 0; i--) {
      if (!this.#stack[i].overlay) { base = i; break; }
    }
    for (let i = base; i < this.#stack.length; i++) {
      this.#stack[i].draw?.(r, i === this.#stack.length - 1);
    }
  }
}

export class Scene {
  overlay = false;
  game = null;
  get input() { return this.game.input; }
  get audio() { return this.game.audio; }
}
