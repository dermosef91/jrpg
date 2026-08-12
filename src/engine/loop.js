// Fixed-timestep update, free-running draw.
export function runLoop({ update, draw, step = 1 / 60, maxFrame = 0.25 }) {
  let last = performance.now() / 1000;
  let acc = 0;
  let running = true;

  const frame = () => {
    if (!running) return;
    const now = performance.now() / 1000;
    // Clamp so a backgrounded tab does not spiral into hundreds of catch-up steps.
    acc += Math.min(now - last, maxFrame);
    last = now;

    while (acc >= step) {
      update(step);
      acc -= step;
    }
    draw(acc / step);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
  return { stop() { running = false; } };
}
