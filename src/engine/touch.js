// On-screen controls for touch devices.
//
// These are DOM, not canvas: hit areas keep a comfortable physical size however
// far the 960x540 stage has been scaled down. Crucially they do not sit on top
// of the game -- the stage is shrunk to reserve room for them, because the
// battle menu and the audit readout live in exactly the screen corners a thumb
// would otherwise cover.

const GAP = 14;
const MIN_USABLE_SCALE = 0.26;  // below this, reserving space costs more than it saves

const PAD = [
  { action: 'up', glyph: '▲', col: 2, row: 1 },
  { action: 'left', glyph: '◀', col: 1, row: 2 },
  { action: 'right', glyph: '▶', col: 3, row: 2 },
  { action: 'down', glyph: '▼', col: 2, row: 3 },
];

const BUTTONS = [
  { action: 'confirm', label: 'OK', hint: 'confirm' },
  { action: 'cancel', label: '✕', hint: 'back' },
  { action: 'detail', label: 'E', hint: 'sample' },
];

export function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches
    || navigator.maxTouchPoints > 0;
}

/**
 * Build the overlay and wire it into Input, reserving stage space via Renderer.
 * @returns {null|Function} teardown, or null on a device that does not need them
 */
export function installTouchControls(input, renderer, { force = false } = {}) {
  if (!force && !isTouchDevice()) return null;

  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.innerHTML = `
    <div class="touch-pad">${PAD.map(cell).join('')}</div>
    <div class="touch-buttons">${BUTTONS.map(button).join('')}</div>
  `;
  document.body.append(root);

  const pad = root.querySelector('.touch-pad');
  const buttons = root.querySelector('.touch-buttons');

  // Track which action each pointer owns, so sliding off a key releases it and
  // multi-touch (walk while confirming) behaves.
  const owned = new Map();

  const release = (id) => {
    const entry = owned.get(id);
    if (!entry) return;
    entry.el.classList.remove('is-down');
    input.release(entry.action);
    owned.delete(id);
  };

  const claim = (id, el) => {
    const action = el?.dataset.action;
    if (owned.get(id)?.action === action) return;
    if (owned.has(id)) release(id);
    if (!action) return;
    el.classList.add('is-down');
    input.press(action);
    owned.set(id, { action, el });
  };

  const onDown = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    e.preventDefault();
    claim(e.pointerId, el);
  };
  const onMove = (e) => {
    if (!owned.has(e.pointerId)) return;
    e.preventDefault();
    claim(e.pointerId, document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-action]'));
  };
  const onUp = (e) => {
    if (!owned.has(e.pointerId)) return;
    e.preventDefault();
    release(e.pointerId);
  };
  const releaseAll = () => [...owned.keys()].forEach(release);

  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('blur', releaseAll);

  const relayout = () => applyLayout(root, pad, buttons, renderer);
  relayout();
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);

  return () => {
    releaseAll();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('blur', releaseAll);
    window.removeEventListener('resize', relayout);
    window.removeEventListener('orientationchange', relayout);
    renderer.setInsets({});
    root.remove();
  };
}

/** Size of one d-pad key in CSS pixels, as resolved by the stylesheet's clamp(). */
function keySize(root) {
  return root.querySelector('.touch-key')?.getBoundingClientRect().height || 44;
}

/**
 * Decide where the controls go, and how much stage the renderer must give up.
 *
 * Side gutters are preferred on wide screens and a bottom band on boxy ones --
 * whichever leaves the larger stage. If both would shrink the game past
 * readability the controls fall back to a translucent overlay, on the grounds
 * that a phone that small is a compromise either way.
 */
export function planLayout(viewport, key) {
  const padSpan = key * 3;
  const columnW = key * 1.25;
  const stage = (w, h) => Math.min(w / 960, h / 540);

  const sideNeed = Math.max(padSpan, columnW) + GAP * 2;
  const bandNeed = padSpan + GAP * 2;

  const sideScale = stage(viewport.width - sideNeed * 2, viewport.height);
  const bandScale = stage(viewport.width, viewport.height - bandNeed);
  const overlayScale = stage(viewport.width, viewport.height);
  const best = Math.max(sideScale, bandScale);

  if (best < MIN_USABLE_SCALE && overlayScale > best) {
    return { mode: 'overlay', insets: {}, scale: overlayScale };
  }
  return sideScale >= bandScale
    ? { mode: 'side', insets: { left: sideNeed, right: sideNeed }, scale: sideScale }
    : { mode: 'band', insets: { bottom: bandNeed }, scale: bandScale };
}

function applyLayout(root, pad, buttons, renderer) {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const plan = planLayout(viewport, keySize(root));

  root.classList.toggle('is-overlay', plan.mode === 'overlay');
  buttons.style.flexDirection = plan.mode === 'side' ? 'column' : 'row';
  renderer.setInsets(plan.insets);

  // Measure after the stage has resized and the button cluster has reflowed.
  const box = renderer.canvas.getBoundingClientRect();
  const padBox = pad.getBoundingClientRect();
  const btnBox = buttons.getBoundingClientRect();
  const place = (el, style) => Object.assign(el.style,
    { left: '', right: '', top: '', bottom: '', ...style });
  const centred = (rect, span) => `${Math.round(rect + span)}px`;

  if (plan.mode === 'side') {
    place(pad, {
      left: `${Math.round((box.left - padBox.width) / 2)}px`,
      top: centred(box.top, box.height / 2 - padBox.height / 2),
    });
    place(buttons, {
      right: `${Math.round((viewport.width - box.right - btnBox.width) / 2)}px`,
      top: centred(box.top, box.height / 2 - btnBox.height / 2),
    });
    return;
  }

  if (plan.mode === 'band') {
    const band = viewport.height - box.bottom;
    place(pad, { left: `${GAP}px`, top: centred(box.bottom, (band - padBox.height) / 2) });
    place(buttons, {
      right: `${GAP}px`, top: centred(box.bottom, (band - btnBox.height) / 2),
    });
    return;
  }

  place(pad, { left: `${Math.round(box.left) + GAP}px`, bottom: `${GAP}px` });
  place(buttons, {
    right: `${Math.round(viewport.width - box.right) + GAP}px`, bottom: `${GAP}px`,
  });
}

function cell({ action, glyph, col, row }) {
  return `<button class="touch-key" data-action="${action}" aria-label="${action}"
    style="grid-column:${col};grid-row:${row}">${glyph}</button>`;
}

function button({ action, label, hint }) {
  return `<button class="touch-key touch-key--round" data-action="${action}"
    aria-label="${hint}"><span>${label}</span><em>${hint}</em></button>`;
}
