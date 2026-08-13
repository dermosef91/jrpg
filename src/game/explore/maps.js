// Maps are authored as parallel layers so shape, elevation, ember inlay and
// props all stay editable by hand.
//
//   tiles     ' ' void   s stone   p plaza   b bridge   x stair
//   height    0-9 storeys -- top down this is the climb rule and the drawn lip
//             between neighbouring squares, not a screen offset
//   inlay     0 none, 1-5 the patterns in grid.js
//   dead      '#' marks inlay that has gone out
//   props     see PROP_KINDS

const TILE_DEFS = {
  s: { walk: true, top: '#bdae94', name: 'stone' },
  p: { walk: true, top: '#d8c9ac', name: 'plaza' },
  b: { walk: true, top: '#9d8f79', bridge: true, name: 'bridge' },
  x: { walk: true, top: '#a89b82', stair: true, name: 'stair' },
  ' ': { walk: false, top: null, name: 'void' },
};

export const PROP_KINDS = {
  C: 'chest', L: 'lamp', T: 'planter', R: 'rail', D: 'door', N: 'npc',
  '@': 'spawn', M: 'mask', 1: 'trigger', 2: 'trigger', 3: 'trigger',
  4: 'trigger', 5: 'trigger', 6: 'trigger',
};

// --- Rootplaza: the hold the party comes home to ----------------------------

const ROOTPLAZA = {
  id: 'rootplaza', name: 'ROOTPLAZA', subtitle: 'THE LOW GALLERY',
  ambient: 'field',
  tiles: [
    '     ssss      ssss ',
    '    ssssss    ssssss',
    '    ssssss    ssssss',
    '    ssssxs    sxssss',
    '      s ss    ss s  ',
    '   sssssssssssssss  ',
    '   sssssssssssssss  ',
    '   sssssssssssssss  ',
    '   ssxsssssssssbbbb ',
    '     sspppppss      ',
    '    ssppppppps      ',
    '    ssppppppps      ',
    '    ssppppppps      ',
    '     sspppppss      ',
    '      sssssss       ',
    '       sssss        ',
  ],
  height: [
    '     2222      2222 ',
    '    222222    222222',
    '    222222    222222',
    '    222212    212222',
    '      1 11    11 1  ',
    '   111111111111111  ',
    '   111111111111111  ',
    '   111111111111111  ',
    '   1101111111111111 ',
    '     0000000000      ',
    '    00000000000      ',
    '    00000000000      ',
    '    00000000000      ',
    '     0000000000      ',
    '      0000000       ',
    '       00000        ',
  ],
  inlay: [
    '     0000      0000 ',
    '    001000    000100',
    '    002000    000200',
    '    002000    000200',
    '      2 00    00 2  ',
    '   000200000000200  ',
    '   111311111113111  ',
    '   000200000000200  ',
    '   000200000000000  ',
    '     0002000000      ',
    '    00040005000      ',
    '    00000500000      ',
    '    00050005000      ',
    '     0000200000      ',
    '      0002000       ',
    '       00000        ',
  ],
  props: [
    '     L  L      L  L ',
    '    T C  T    T   DT',
    '                    ',
    '                    ',
    '                    ',
    '   R           R    ',
    '                    ',
    '   R    N N    R    ',
    '                    ',
    '        T   T       ',
    '                    ',
    '        @           ',
    '                    ',
    '        T   T       ',
    '                    ',
    '                    ',
  ],
};

// --- The Quiet Stair: where the prologue happens -----------------------------
//
// A narrow flight cut down through the root galleries. It descends nine storeys
// in eighteen rows, which reads as a long way down without becoming a maze, and
// every seam of inlay beside it has gone out.

const QUIETSTAIR = {
  id: 'quietstair', name: 'THE QUIET STAIR', subtitle: 'THE SEAM IS COLD',
  ambient: null,
  dark: true,
  tiles: [
    '      sss       ',
    '      sxs       ',
    '     ssss       ',
    '     sxss       ',
    '     ssss       ',
    '    sssss       ',
    '    sxsss       ',
    '   sssss        ',
    '   ssxss        ',
    '   sssss        ',
    '   sssss        ',
    '  ssxss         ',
    '  sssss         ',
    '  ssxss         ',
    '  sssss         ',
    ' ssssss         ',
    ' sssxss         ',
    ' ssssss         ',
    ' ssssss         ',
    ' ssssss         ',
  ],
  height: [
    '      999       ',
    '      999       ',
    '     8888       ',
    '     8888       ',
    '     7777       ',
    '    77777       ',
    '    66666       ',
    '   66666        ',
    '   55555        ',
    '   55555        ',
    '   44444        ',
    '  44444         ',
    '  33333         ',
    '  33333         ',
    '  22222         ',
    ' 222222         ',
    ' 111111         ',
    ' 111111         ',
    ' 000000         ',
    ' 000000         ',
  ],
  inlay: [
    '      020       ',
    '      020       ',
    '     0020       ',
    '     0020       ',
    '     0200       ',
    '    00200       ',
    '    00200       ',
    '   00200        ',
    '   02000        ',
    '   02000        ',
    '   02000        ',
    '  002000        ',
    '  02000         ',
    '  02000         ',
    '  02000         ',
    ' 002000         ',
    ' 020000         ',
    ' 020000         ',
    ' 035000         ',
    ' 000000         ',
  ],
  dead: [
    '      ..       ',
    '      ##       ',
    '     ###       ',
    '     ###       ',
    '     ###       ',
    '    ####       ',
    '    ####       ',
    '   ####        ',
    '   ####        ',
    '   ####        ',
    '   ####        ',
    '  #####        ',
    '  ####         ',
    '  ####         ',
    '  ####         ',
    ' #####         ',
    ' #####         ',
    ' #####         ',
    ' #####         ',
    ' #####         ',
  ],
  props: [
    '      @         ',
    '                ',
    '      1         ',
    '                ',
    '                ',
    '     2          ',
    '                ',
    '                ',
    '    3           ',
    '                ',
    '                ',
    '                ',
    '   4            ',
    '                ',
    '                ',
    '                ',
    '  5             ',
    '                ',
    '   M            ',
    '   6            ',
  ],
};

const SOURCES = { rootplaza: ROOTPLAZA, quietstair: QUIETSTAIR };
export const MAP_IDS = Object.keys(SOURCES);

function layerAt(layer, x, y) {
  return layer?.[y]?.[x] ?? ' ';
}

export function buildMap(id = 'rootplaza') {
  const src = SOURCES[id];
  if (!src) throw new Error(`unknown map: ${id}`);
  const h = src.tiles.length;
  const w = Math.max(...src.tiles.map((row) => row.length));
  const cells = [];
  const props = [];
  let spawn = { x: 0, y: 0 };
  let triggerN = 0;

  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = layerAt(src.tiles, x, y);
      const def = TILE_DEFS[ch] ?? TILE_DEFS[' '];
      const heightCh = layerAt(src.height, x, y);
      const inlayCh = layerAt(src.inlay, x, y);
      row.push({
        x, y,
        z: heightCh === ' ' ? 0 : Number(heightCh),
        ch,
        walk: def.walk,
        top: def.top,
        stair: !!def.stair,
        bridge: !!def.bridge,
        inlay: inlayCh === ' ' ? 0 : Number(inlayCh),
        dead: layerAt(src.dead, x, y) === '#',
      });

      const propCh = layerAt(src.props, x, y);
      const kind = PROP_KINDS[propCh];
      if (kind === 'spawn') spawn = { x, y };
      else if (kind === 'trigger') {
        props.push({ kind, x, y, z: row[x].z, id: `${id}:${propCh}`, order: triggerN++ });
      } else if (kind) {
        props.push({ kind, x, y, z: row[x].z });
      }
    }
    cells.push(row);
  }

  return {
    ...src, w, h, cells, props, spawn,
    at(x, y) { return cells[y]?.[x] ?? null; },
    walkable(x, y) { return !!cells[y]?.[x]?.walk; },
  };
}

/** NPC lines, keyed by map and grid square. Prologue-aware. */
export const NPC_LINES = {
  'rootplaza:8,7': {
    name: 'GATE HAND',
    // The one person the Council counts as having been told.
    report: true,
    before: [
      'The seam past the Quiet Stair has gone cold. It has never gone cold.',
      'A Warden went down four days back to read the writ on it.',
      'A Warden always rings the bell. Nobody has heard the bell.',
    ],
    after: [
      'You found the mask and not the Warden. That is worse, and you know it.',
      'Council wants the seam read properly. That means going back down.',
      'Take the lamp. Take all of it you can carry.',
    ],
  },
  'rootplaza:10,7': {
    name: 'SHARD FACTOR',
    before: [
      'Cinder and lattice I will buy all day. Core, I will not touch.',
      'A core is somebody\'s whole ember, pressed flat.',
      'You carry one, you carry them.',
    ],
    after: [
      'You have the look of somebody who came back up a stair they went down.',
      'Everything below the Quiet Stair is running on stored ember now.',
      'When that goes, it goes all at once. Buy what you need before it does.',
    ],
  },
};
