// Rootplaza, the hold the party is standing in. Authored as parallel layers so
// the shape, the elevation, the ember inlay and the props all stay editable by
// hand without hunting through coordinates.
//
//   tiles     ' ' void   s stone   p plaza   b bridge   x stair
//   height    0-9 storeys
//   inlay     0 none, 1-5 the patterns in iso.js
//   props     see PROPS

const TILES = [
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
];

const HEIGHT = [
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
];

const INLAY = [
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
];

const PROPS = [
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
];

const TILE_DEFS = {
  s: { walk: true, top: '#bdae94', name: 'stone' },
  p: { walk: true, top: '#d8c9ac', name: 'plaza' },
  b: { walk: true, top: '#9d8f79', bridge: true, name: 'bridge' },
  x: { walk: true, top: '#a89b82', stair: true, name: 'stair' },
  ' ': { walk: false, top: null, name: 'void' },
};

export const PROP_KINDS = {
  C: 'chest', L: 'lamp', T: 'planter', R: 'rail', D: 'door', N: 'npc', '@': 'spawn',
};

function layerAt(layer, x, y) {
  return layer[y]?.[x] ?? ' ';
}

export function buildMap() {
  const h = TILES.length;
  const w = Math.max(...TILES.map((row) => row.length));
  const cells = [];
  const props = [];
  let spawn = { x: 8, y: 11 };

  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = layerAt(TILES, x, y);
      const def = TILE_DEFS[ch] ?? TILE_DEFS[' '];
      const heightCh = layerAt(HEIGHT, x, y);
      const z = heightCh === ' ' ? 0 : Number(heightCh);
      const inlayCh = layerAt(INLAY, x, y);
      row.push({
        x, y, z, ch,
        walk: def.walk,
        top: def.top,
        stair: !!def.stair,
        bridge: !!def.bridge,
        inlay: inlayCh === ' ' ? 0 : Number(inlayCh),
      });

      const propCh = layerAt(PROPS, x, y);
      const kind = PROP_KINDS[propCh];
      if (kind === 'spawn') spawn = { x, y };
      else if (kind) props.push({ kind, x, y, z });
    }
    cells.push(row);
  }

  return {
    id: 'rootplaza', name: 'ROOTPLAZA', subtitle: 'THE LOW GALLERY',
    w, h, cells, props, spawn,
    at(x, y) { return cells[y]?.[x] ?? null; },
    walkable(x, y) { return !!cells[y]?.[x]?.walk; },
  };
}

/** NPCs, keyed by the grid square their marker sits on. */
export const NPC_LINES = {
  '8,7': {
    name: 'GATE HAND',
    lines: [
      'The inlay runs cold past the Quiet Stair. It has never run cold.',
      'Warden went down there four days back to read the writ on it.',
      'Nobody has heard the bell since.',
    ],
  },
  '10,7': {
    name: 'SHARD FACTOR',
    lines: [
      'Cinder and lattice I will buy all day. Core, I will not touch.',
      'A core is somebody\'s whole ember, pressed flat.',
      'You carry one, you carry them.',
    ],
  },
};
