import { P } from './palette.js';

// On-screen controls for touch devices, placed into the letterbox slack rather
// than over the game: at 480x270 the command menu and the party HUD sit in the
// screen corners a thumb would otherwise cover.

const GAP = 12;
const PAD = [
  { action: 'up', glyph: '^', col: 2, row: 1 },
  { action: 'left', glyph: '<', col: 1, row: 2 },
  { action: 'right', glyph: '>', col: 3, row: 2 },
  { action: 'down', glyph: 'v', col: 2, row: 3 },
];
const BUTTONS = [
  { action: 'confirm', label: 'OK' },
  { action: 'cancel', label: 'X' },
  { action: 'menu', label: 'C' },
];

export function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/** Fraction of the un-reserved stage we are willing to give up to keep the
 *  controls off the game. Below this the screen is too small either way and the
 *  overlay is the lesser evil. */
const RESERVE_FLOOR = 0.5;

/**
 * Decide where the controls go and how much stage the renderer gives up.
 *
 * Side gutters on a wide screen, a bottom band on a boxy one -- whichever leaves
 * the larger stage. Reserving is preferred even when it costs integer scaling:
 * a slightly soft stage beats a thumb parked on the command menu, which is
 * exactly where the d-pad would otherwise land.
 */
export function planLayout(viewport, key, { vw = 480, vh = 270 } = {}) {
  const padSpan = key * 3;
  const columnW = key * 1.3;
  const stage = (w, h) => Math.min(w / vw, h / vh);
  const sideNeed = Math.max(padSpan, columnW) + GAP * 2;
  const bandNeed = padSpan + GAP * 2;

  const sideScale = stage(viewport.width - sideNeed * 2, viewport.height);
  const bandScale = stage(viewport.width, viewport.height - bandNeed);
  const overlayScale = stage(viewport.width, viewport.height);
  const best = Math.max(sideScale, bandScale);

  if (best < overlayScale * RESERVE_FLOOR) {
    return { mode: 'overlay', insets: {}, scale: overlayScale };
  }
  return sideScale >= bandScale
    ? { mode: 'side', insets: { left: sideNeed, right: sideNeed }, scale: sideScale }
    : { mode: 'band', insets: { bottom: bandNeed }, scale: bandScale };
}

export function installTouchControls(input, renderer, { force = false } = {}) {
  if (!force && !isTouchDevice()) return null;

  const root = document.createElement('div');
  root.className = 'touch';
  root.innerHTML = `
    <div class="touch-pad">${PAD.map(cell).join('')}</div>
    <div class="touch-btns">${BUTTONS.map(button).join('')}</div>
  `;
  document.body.append(root);
  const pad = root.querySelector('.touch-pad');
  const btns = root.querySelector('.touch-btns');
  const owned = new Map();

  const release = (id) => {
    const entry = owned.get(id);
    if (!entry) return;
    entry.el.classList.remove('down');
    input.release(entry.action);
    owned.delete(id);
  };
  const claim = (id, el) => {
    const action = el?.dataset.action;
    if (owned.get(id)?.action === action) return;
    if (owned.has(id)) release(id);
    if (!action) return;
    el.classList.add('down');
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
  const onUp = (e) => { if (owned.has(e.pointerId)) { e.preventDefault(); release(e.pointerId); } };
  const releaseAll = () => [...owned.keys()].forEach(release);

  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('blur', releaseAll);

  const relayout = () => {
    const key = pad.querySelector('.touch-key')?.getBoundingClientRect().height || 44;
    const plan = planLayout(
      { width: window.innerWidth, height: window.innerHeight }, key,
      { vw: renderer.W, vh: renderer.H },
    );
    root.classList.toggle('overlay', plan.mode === 'overlay');
    btns.style.flexDirection = plan.mode === 'side' ? 'column' : 'row';
    renderer.setInsets(plan.insets);

    const box = renderer.canvas.getBoundingClientRect();
    const padBox = pad.getBoundingClientRect();
    const btnBox = btns.getBoundingClientRect();
    const place = (el, style) => Object.assign(el.style, { left: '', right: '', top: '', bottom: '', ...style });

    if (plan.mode === 'side') {
      place(pad, {
        left: `${Math.round((box.left - padBox.width) / 2)}px`,
        top: `${Math.round(box.top + box.height / 2 - padBox.height / 2)}px`,
      });
      place(btns, {
        right: `${Math.round((window.innerWidth - box.right - btnBox.width) / 2)}px`,
        top: `${Math.round(box.top + box.height / 2 - btnBox.height / 2)}px`,
      });
    } else if (plan.mode === 'band') {
      const band = window.innerHeight - box.bottom;
      place(pad, { left: `${GAP}px`, top: `${Math.round(box.bottom + (band - padBox.height) / 2)}px` });
      place(btns, { right: `${GAP}px`, top: `${Math.round(box.bottom + (band - btnBox.height) / 2)}px` });
    } else {
      place(pad, { left: `${Math.round(box.left) + GAP}px`, bottom: `${GAP}px` });
      place(btns, { right: `${Math.round(window.innerWidth - box.right) + GAP}px`, bottom: `${GAP}px` });
    }
  };
  relayout();
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);

  return () => {
    releaseAll();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('resize', relayout);
    window.removeEventListener('orientationchange', relayout);
    renderer.setInsets({});
    root.remove();
  };
}

function cell({ action, glyph, col, row }) {
  return `<button class="touch-key" data-action="${action}" aria-label="${action}"
    style="grid-column:${col};grid-row:${row}">${glyph}</button>`;
}
function button({ action, label }) {
  return `<button class="touch-key round" data-action="${action}" aria-label="${action}">${label}</button>`;
}
