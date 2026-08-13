export function runLoop({ update, draw, step = 1 / 60, maxFrame = 0.25 }) {
  let last = performance.now() / 1000;
  let acc = 0;
  let running = true;
  const frame = () => {
    if (!running) return;
    const now = performance.now() / 1000;
    acc += Math.min(now - last, maxFrame);
    last = now;
    while (acc >= step) { update(step); acc -= step; }
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return { stop() { running = false; } };
}
