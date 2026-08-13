import { Scene } from '../../engine/scene.js';
import { P, alpha, mix, AFFINITY } from '../../engine/palette.js';
import { panel, ornateBorder, tabs, meter, cursor, glyph, heading, cornerTicks } from '../ui/frame.js';
import { drawPortrait } from '../art/portrait.js';
import { effectiveStats, EQUIPMENT, SLOTS, SLOT_LABEL, SLOT_GLYPH } from '../data/equipment.js';
import { getRite } from '../data/rites.js';
import { getItem } from '../data/items.js';
import { SHARDS } from '../data/shards.js';
import { ROUTE_NODES, ROUTE_EDGES } from '../data/route.js';

const TABS = ['PARTY', 'ITEMS', 'RITES', 'EQUIP', 'MAP', 'SAVE'];
// Which route nodes hang their label above the marker rather than below.
const LABEL_ABOVE = new Set(['lantern', 'baobab', 'crown']);
const SHORT = {
  sill: 'SILL', lantern: 'LANTERN', crossing: 'CROSS', baobab: 'STANDING',
  quiet: 'STAIR', plaza: 'ROOTPLAZA', reach: 'REACH', crown: 'CROWN',
};
const STAT_ROWS = [
  ['STR', 'str'], ['AGI', 'agi'], ['DEF', 'def'],
  ['MAG', 'mag'], ['RES', 'res'], ['LCK', 'lck'],
];

export class MenuScene extends Scene {
  constructor() {
    super();
    this.tab = 0;
    this.who = 0;
    this.row = 0;
    this.focus = 'party';   // 'party' | 'body'
    this.t = 0;
  }

  enter() { this.audio?.setMood('menu'); }
  exit() { this.audio?.setMood('field'); }

  get party() { return this.game.party; }
  get selected() { return this.party[this.who]; }

  update(dt) {
    this.t += dt;
    if (this.input.pressed('cancel')) {
      this.audio?.play('cancel');
      this.game.scenes.pop();
      return;
    }
    if (this.input.pressed('pageLeft')) { this.#tab(-1); return; }
    if (this.input.pressed('pageRight')) { this.#tab(1); return; }

    const dir = this.input.dir(dt);
    if (dir === 'left' && this.focus === 'body') { this.focus = 'party'; this.audio?.play('cursor'); return; }
    if (dir === 'right' && this.focus === 'party') { this.focus = 'body'; this.row = 0; this.audio?.play('cursor'); return; }

    if (this.focus === 'party') {
      if (dir === 'up') { this.who = (this.who + this.party.length - 1) % this.party.length; this.audio?.play('cursor'); }
      if (dir === 'down') { this.who = (this.who + 1) % this.party.length; this.audio?.play('cursor'); }
      if (this.input.pressed('confirm')) {
        this.audio?.play('confirm');
        this.#toggleFormation(this.selected.id);
      }
      return;
    }

    const rows = this.#bodyRowCount();
    if (dir === 'up') { this.row = (this.row + rows - 1) % rows; this.audio?.play('cursor'); }
    if (dir === 'down') { this.row = (this.row + 1) % rows; this.audio?.play('cursor'); }
    if (this.input.pressed('confirm')) this.#activate();
  }

  #tab(delta) {
    this.tab = (this.tab + delta + TABS.length) % TABS.length;
    this.row = 0;
    this.audio?.play('page');
  }

  #bodyRowCount() {
    switch (TABS[this.tab]) {
      case 'ITEMS': return Math.max(1, this.game.inventory.length);
      case 'RITES': return Math.max(1, this.selected.rites.length);
      case 'EQUIP': return SLOTS.length;
      case 'MAP': return Math.max(1, ROUTE_NODES.length);
      case 'SAVE': return 2;
      default: return 1;
    }
  }

  #activate() {
    const tab = TABS[this.tab];
    if (tab === 'ITEMS') {
      const entry = this.game.inventory[this.row];
      const item = entry && getItem(entry.id);
      if (!item || !item.heal) { this.audio?.play('deny'); return; }
      const target = this.selected;
      if (target.hp >= target.maxHp) { this.audio?.play('deny'); return; }
      target.hp = Math.min(target.maxHp, target.hp + item.heal);
      entry.count -= 1;
      if (entry.count <= 0) this.game.inventory.splice(this.row, 1);
      this.row = Math.min(this.row, Math.max(0, this.game.inventory.length - 1));
      this.audio?.play('heal');
      return;
    }
    if (tab === 'SAVE') {
      if (this.row === 0) { this.game.rest(); this.audio?.play('revive'); }
      else this.audio?.play('confirm');
      return;
    }
    this.audio?.play('confirm');
  }

  #toggleFormation(id) {
    const f = this.game.formation;
    const i = f.indexOf(id);
    if (i >= 0) {
      if (f.length <= 1) { this.audio?.play('deny'); return; }
      f.splice(i, 1);
    } else if (f.length >= 3) {
      f.shift();
      f.push(id);
    } else f.push(id);
  }

  // --- draw ----------------------------------------------------------------

  draw(r) {
    r.begin(P.void);
    r.dither(0, 0, r.W, r.H, P.black, 0.75);
    ornateBorder(r, 2, 2, r.W - 4, r.H - 4);
    tabs(r, 10, 8, r.W - 20, TABS, this.tab, { height: 13 });

    this.#drawPartyColumn(r, 8, 26, 96, 128);
    this.#drawBody(r, 108, 26, r.W - 116, 128);
    this.#drawShards(r, 8, 158, 176, r.H - 168);
    this.#drawRoute(r, 188, 158, r.W - 196, r.H - 168);

    r.text('Q / E  TABS      X  CLOSE', r.W / 2, r.H - 13, {
      color: P.stoneShadow, align: 'center',
    });
  }

  #drawPartyColumn(r, x, y, w, h) {
    panel(r, x, y, w, h, { fill: alpha(P.void, 0.85) });
    this.party.forEach((c, i) => {
      const cy = y + 5 + i * 30;
      const sel = i === this.who;
      const inLine = this.game.formation.includes(c.id);
      if (sel) {
        r.rect(x + 3, cy - 1, w - 6, 28, alpha(P.ember, this.focus === 'party' ? 0.22 : 0.1));
        cornerTicks(r, x + 3, cy - 1, w - 6, 28, P.emberBright, 3);
        if (this.focus === 'party') cursor(r, x - 1, cy + 12, P.emberBright, 4);
      }
      drawPortrait(r, c.figure, x + 6, cy + 3, {
        frameColor: inLine ? P.emberBright : P.stoneShadow,
      });
      r.text(c.name, x + 28, cy + 2, { color: sel ? P.boneWhite : P.stoneLit, tracking: 1 });
      r.text(`LV ${c.level}`, x + 28, cy + 11, { color: P.stoneShadow });
      meter(r, x + 28, cy + 19, 40, 5, c.hp / c.maxHp, { color: P.ember, segments: false });
      meter(r, x + 70, cy + 19, 20, 5, c.ep / Math.max(1, c.maxEp), { color: P.emberDeep, segments: false });
      if (inLine) r.text('*', x + w - 9, cy + 2, { color: P.emberHot });
    });
    r.text('* IN LINE', x + 5, y + h - 9, { color: P.stoneShadow });
  }

  #drawBody(r, x, y, w, h) {
    panel(r, x, y, w, h, { fill: alpha(P.void, 0.85) });
    const tab = TABS[this.tab];
    if (tab === 'PARTY') this.#drawStatus(r, x, y, w, h);
    else if (tab === 'ITEMS') this.#drawList(r, x, y, w, h, this.game.inventory.map((e) => {
      const item = getItem(e.id);
      return { label: item?.name ?? e.id, right: `x${e.count}`, desc: item?.desc ?? '' };
    }), 'ITEMS CARRIED');
    else if (tab === 'RITES') this.#drawList(r, x, y, w, h, this.selected.rites.map((id) => {
      const rite = getRite(id);
      return {
        label: rite.name, right: `${rite.ep} EP`, desc: rite.desc,
        color: AFFINITY[rite.affinity]?.color, glyph: AFFINITY[rite.affinity]?.glyph,
      };
    }), `RITES OF ${this.selected.name}`);
    else if (tab === 'EQUIP') this.#drawEquip(r, x, y, w, h);
    else if (tab === 'MAP') this.#drawMapTab(r, x, y, w, h);
    else this.#drawSave(r, x, y, w, h);
  }

  #drawStatus(r, x, y, w, h) {
    const c = this.selected;
    const stats = effectiveStats(c);
    const aff = AFFINITY[c.affinity];

    r.text(c.name, x + 8, y + 6, { color: P.emberHot, tracking: 2 });
    r.hline(x + 8, y + 16, w - 16, alpha(P.ember, 0.4));
    r.text('CLASS', x + 8, y + 22, { color: P.stoneShadow });
    r.text(c.cls, x + 8, y + 31, { color: P.boneLit, tracking: 1 });
    r.text('AFFINITY', x + 8, y + 43, { color: P.stoneShadow });
    r.text(aff.name.toUpperCase(), x + 8, y + 52, { color: aff.color, tracking: 1 });
    glyph(r, aff.glyph, x + 54, y + 50, aff.color);

    r.hline(x + 8, y + 62, 72, alpha(P.ember, 0.3));
    r.text(`HP ${c.hp}/${c.maxHp}`, x + 8, y + 66, { color: P.ember });
    r.text(`EP ${c.ep}/${c.maxEp}`, x + 8, y + 75, { color: P.emberDim });
    r.hline(x + 8, y + 84, 72, alpha(P.ember, 0.3));

    // stat block -- 6 rows at 7px clears the panel floor exactly
    STAT_ROWS.forEach(([label, key], i) => {
      const sy = y + 88 + i * 7;
      r.text(label, x + 8, sy, { color: P.stoneShadow });
      r.text(`${stats[key]}`, x + 48, sy, { color: P.boneLit, align: 'right' });
      const bar = Math.min(1, stats[key] / 50);
      r.hline(x + 52, sy + 3, 24, alpha(P.stoneShadow, 0.5));
      r.rect(x + 52, sy + 2, Math.round(24 * bar), 3, P.emberDim);
    });

    // equipment column
    const ex = x + 88;
    heading(r, ex, y + 22, w - 96, 'CARRIED');
    SLOTS.forEach((slot, i) => {
      const sy = y + 34 + i * 16;
      const item = EQUIPMENT[c.equipment?.[slot]];
      glyph(r, SLOT_GLYPH[slot], ex, sy, P.emberDim);
      r.text(SLOT_LABEL[slot], ex + 11, sy - 1, { color: P.stoneShadow });
      r.text(item?.name ?? '-', ex + 11, sy + 7, { color: P.boneLit });
    });

    r.hline(ex, y + 100, w - 96, alpha(P.ember, 0.3));
    r.wrap(c.note, w - 100).slice(0, 2).forEach((line, i) => {
      r.text(line, ex, y + 106 + i * 9, { color: P.stoneMid });
    });

  }

  #drawList(r, x, y, w, h, entries, title) {
    heading(r, x + 8, y + 6, w - 16, title);
    if (!entries.length) {
      r.text('NOTHING HERE', x + 12, y + 24, { color: P.stoneShadow });
      return;
    }
    const perPage = 7;
    const start = Math.max(0, Math.min(this.row - 3, entries.length - perPage));
    entries.slice(start, start + perPage).forEach((entry, i) => {
      const idx = start + i;
      const ry = y + 20 + i * 11;
      const sel = idx === this.row && this.focus === 'body';
      if (sel) {
        r.rect(x + 5, ry - 2, w - 10, 11, alpha(P.ember, 0.2));
        cursor(r, x + 6, ry + 3, P.emberBright, 3);
      }
      if (entry.glyph) glyph(r, entry.glyph, x + 12, ry - 1, entry.color ?? P.emberDim);
      r.text(entry.label, x + 22, ry, { color: sel ? P.boneWhite : P.stoneLit });
      if (entry.right) r.text(entry.right, x + w - 8, ry, { color: P.emberLit, align: 'right' });
    });
    const current = entries[Math.min(this.row, entries.length - 1)];
    if (current?.desc) {
      r.hline(x + 8, y + h - 24, w - 16, alpha(P.ember, 0.3));
      r.wrap(current.desc, w - 20).slice(0, 2).forEach((line, i) => {
        r.text(line, x + 8, y + h - 18 + i * 9, { color: P.stoneMid });
      });
    }
  }

  #drawEquip(r, x, y, w, h) {
    const c = this.selected;
    heading(r, x + 8, y + 6, w - 16, `EQUIPMENT  ${c.name}`);
    SLOTS.forEach((slot, i) => {
      const ry = y + 22 + i * 22;
      const sel = i === this.row && this.focus === 'body';
      const item = EQUIPMENT[c.equipment?.[slot]];
      if (sel) {
        r.rect(x + 5, ry - 2, w - 10, 21, alpha(P.ember, 0.18));
        cursor(r, x + 6, ry + 8, P.emberBright, 3);
      }
      glyph(r, SLOT_GLYPH[slot], x + 12, ry + 4, P.emberDim);
      r.text(SLOT_LABEL[slot], x + 24, ry, { color: P.stoneShadow });
      r.text(item?.name ?? '-', x + 24, ry + 9, { color: sel ? P.boneWhite : P.stoneLit });
      if (item) {
        const mods = ['str', 'agi', 'def', 'mag', 'res', 'lck', 'hp', 'ep']
          .filter((k) => item[k])
          .map((k) => `${k.toUpperCase()} ${item[k] > 0 ? '+' : ''}${item[k]}`)
          .join('  ');
        r.text(mods, x + w - 8, ry + 9, { color: P.emberDim, align: 'right' });
      }
    });
    const item = EQUIPMENT[c.equipment?.[SLOTS[this.row]]];
    if (item?.desc) {
      r.hline(x + 8, y + h - 24, w - 16, alpha(P.ember, 0.3));
      r.wrap(item.desc, w - 20).slice(0, 2).forEach((line, i) => {
        r.text(line, x + 8, y + h - 18 + i * 9, { color: P.stoneMid });
      });
    }
  }

  #drawMapTab(r, x, y, w, h) {
    heading(r, x + 8, y + 6, w - 16, 'THE ROUTE SO FAR');
    const node = ROUTE_NODES[Math.min(this.row, ROUTE_NODES.length - 1)];
    ROUTE_NODES.forEach((n, i) => {
      const ry = y + 20 + i * 11;
      const sel = i === this.row && this.focus === 'body';
      if (sel) {
        r.rect(x + 5, ry - 2, w - 10, 11, alpha(P.ember, 0.2));
        cursor(r, x + 6, ry + 3, P.emberBright, 3);
      }
      r.text(n.name, x + 22, ry, {
        color: !n.visited ? P.stoneShadow : sel ? P.boneWhite : P.stoneLit,
      });
      r.text(n.here ? 'HERE' : n.visited ? 'WALKED' : 'UNKNOWN', x + w - 8, ry, {
        color: n.here ? P.emberHot : n.visited ? P.emberDim : P.stoneShadow, align: 'right',
      });
    });
    if (node) {
      r.hline(x + 8, y + h - 18, w - 16, alpha(P.ember, 0.3));
      r.text(`${node.kind.toUpperCase()}`, x + 8, y + h - 12, { color: P.stoneMid });
    }
  }

  #drawSave(r, x, y, w, h) {
    heading(r, x + 8, y + 6, w - 16, 'THE LONG REST');
    const rows = [
      { label: 'REST AT THE LAMP', desc: 'Restores the whole line. Costs a day nobody is counting.' },
      { label: 'RECORD THE ROUTE', desc: 'Cuts your progress into the inlay. It will remember.' },
    ];
    rows.forEach((row, i) => {
      const ry = y + 24 + i * 16;
      const sel = i === this.row && this.focus === 'body';
      if (sel) {
        r.rect(x + 5, ry - 3, w - 10, 14, alpha(P.ember, 0.2));
        cursor(r, x + 6, ry + 4, P.emberBright, 3);
      }
      glyph(r, i === 0 ? 'flame' : 'save', x + 12, ry - 1, P.emberDim);
      r.text(row.label, x + 24, ry, { color: sel ? P.boneWhite : P.stoneLit });
    });
    const desc = rows[Math.min(this.row, rows.length - 1)].desc;
    r.hline(x + 8, y + h - 24, w - 16, alpha(P.ember, 0.3));
    r.wrap(desc, w - 20).slice(0, 2).forEach((line, i) => {
      r.text(line, x + 8, y + h - 18 + i * 9, { color: P.stoneMid });
    });
  }

  #drawShards(r, x, y, w, h) {
    panel(r, x, y, w, h, { fill: alpha(P.void, 0.85) });
    heading(r, x + 6, y + 5, w - 12, 'SHARDS');
    SHARDS.forEach((shard, i) => {
      const col = i % 5;
      const rowN = Math.floor(i / 5);
      const sx = x + 7 + col * 34;
      const sy = y + 17 + rowN * 30;
      const count = this.game.shards[shard.id] ?? 0;
      const dim = count === 0;
      r.rect(sx, sy, 16, 16, alpha(P.black, 0.9));
      r.frame(sx, sy, 16, 16, dim ? P.stoneShadow : P.stoneDark, 1);
      if (!dim) r.glow(sx + 8, sy + 8, 10, shard.color, 0.3);
      glyph(r, shard.glyph, sx + 4, sy + 4, dim ? P.stoneShadow : shard.color);
      r.text(`${count}`, sx + 20, sy + 2, { color: dim ? P.stoneShadow : P.boneLit });
      r.text(shard.short ?? shard.name.slice(0, 4), sx, sy + 18, { color: P.stoneShadow });
    });
  }

  #drawRoute(r, x, y, w, h) {
    panel(r, x, y, w, h, { fill: alpha(P.void, 0.85) });
    heading(r, x + 6, y + 5, w - 12, 'WORLD ROUTE');
    const px = (n) => x + 12 + n.x * (w - 28);
    const py = (n) => y + 18 + n.y * (h - 32);

    for (const [a, b] of ROUTE_EDGES) {
      const na = ROUTE_NODES.find((n) => n.id === a);
      const nb = ROUTE_NODES.find((n) => n.id === b);
      if (!na || !nb) continue;
      const known = na.visited && nb.visited;
      r.line(px(na), py(na), px(nb), py(nb), known ? P.emberDeep : alpha(P.stoneShadow, 0.5));
    }
    for (const n of ROUTE_NODES) {
      const nx = px(n);
      const ny = py(n);
      if (n.here) {
        const pulse = Math.sin(this.t * 4) > 0 ? 5 : 4;
        r.glow(nx, ny, 14, P.ember, 0.5);
        r.circle(nx, ny, pulse, P.emberHot, { fill: false });
      }
      const color = n.here ? P.emberWhite : n.visited ? P.emberBright : P.stoneShadow;
      if (n.kind === 'city' || n.kind === 'spire') {
        r.poly([[nx, ny - 4], [nx + 3, ny], [nx, ny + 4], [nx - 3, ny]], color);
      } else if (n.kind === 'tree') {
        r.vline(nx, ny - 1, 5, color);
        r.circle(nx, ny - 3, 3, color, { fill: false });
      } else {
        r.rect(nx - 2, ny - 2, 4, 4, color);
      }
      // Label only where there is room: the current hold, plus alternating
      // nodes offset above and below so names never sit on each other.
      if (n.visited || n.here) {
        const above = LABEL_ABOVE.has(n.id);
        r.text(SHORT[n.id] ?? n.name.slice(0, 6), nx, above ? ny - 10 : ny + 6, {
          color: n.here ? P.emberLit : P.stoneShadow, align: 'center',
        });
      }
    }
  }
}
