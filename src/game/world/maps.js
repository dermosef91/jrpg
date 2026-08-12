import { P } from '../../engine/palette.js';

// Tile art is authored loosely and padded by makeMap, and entities are placed by
// marker characters embedded in the art rather than by hand-counted coordinates.

const LEGEND = {
  ' ': { solid: true, color: P.void },
  '.': { solid: false, color: '#2b2620', speck: '#3a332a' },
  ',': { solid: false, color: '#3b3026', grain: true, grainColor: '#4a3c2d', angle: -0.1 },
  '"': { solid: false, color: '#26301f', speck: '#33421f' },
  ':': { solid: false, color: '#332b22', speck: '#443a2c' },
  '=': { solid: false, color: '#4a3728', grain: true, grainColor: '#5d4632', angle: 0.9 },
  '~': { solid: true, color: '#23343d', edge: '#2d4450' },
  '#': { solid: true, color: '#241c17', grain: true, grainColor: '#33271f' },
  'T': { solid: true, color: '#3a2c20', grain: true, grainColor: '#55402d', angle: 1.35 },
  '%': { solid: true, color: '#2e2823', speck: '#3d352c' },
  'o': { solid: true, color: '#2b2620', speck: P.sunwood },
  '^': { solid: false, color: '#4a3728', edge: '#6b5138' },
};

function makeMap(spec) {
  const w = Math.max(...spec.tiles.map((row) => row.length));
  const entities = [];
  const tiles = spec.tiles.map((row, y) => {
    const padded = row.padEnd(w, spec.fill ?? ' ');
    let out = '';
    for (let x = 0; x < padded.length; x++) {
      const ch = padded[x];
      const marker = spec.markers?.[ch];
      if (marker) {
        entities.push({ ...marker, x, y });
        out += marker.under ?? '.';
      } else {
        out += ch;
      }
    }
    return out;
  });
  return {
    ...spec, w, h: tiles.length, tiles, entities,
    legend: { ...LEGEND, ...(spec.legend ?? {}) },
  };
}

// --- the Braid ---------------------------------------------------------------
// Three river-courses cross the light-corridor here, which is why everyone lives
// on top of each other and why the ground is a chaos of overlapping furrows.

export const BRAID = makeMap({
  id: 'braid',
  name: 'The Braid',
  subtitle: 'eleven generations of overlapping Traces',
  spawn: { x: 12, y: 14 },
  encounterRate: 0.085,
  fill: '"',
  markers: {
    '1': {
      kind: 'exit', to: 'cordwain_mid', label: 'Cordwain', under: '=',
      spawn: { x: 13, y: 13, facing: 'up' },
    },
    '2': {
      kind: 'sign', under: ',',
      beats: [{
        speaker: 'Trace marker',
        text: 'CORDWAIN TRACE — cut depth 31m at this station. Council of the Ninth.\n'
            + 'Dating a furrow is dating a decision. Nothing down here can be re-inked.',
      }],
    },
    '3': {
      kind: 'npc', name: 'Carter', color: '#7a6a52', under: ',',
      beats: [
        { speaker: 'Carter', text: 'Hauling sunwood up to Crown. Same run my mother did, except '
          + 'her run was forty metres shorter and she got paid in the good resin.' },
        { speaker: 'Carter', text: 'You feel that? Trace runs east. They all run east. Nobody thinks '
          + 'about it because who walks east? There is nothing east.' },
      ],
    },
    '4': {
      kind: 'npc', name: 'Surveyor', color: '#5c7286', under: '.',
      beats: [
        { speaker: 'Surveyor', text: 'Anneal is two days that way and getting no further. Nothing '
          + 'gets further. Meters a year, and the light is climbing the hill without us.' },
        { speaker: 'Surveyor', text: 'You are the audit circuit, yes? Then you already know what '
          + 'I am not allowed to write on a survey form.' },
      ],
    },
  },
  tiles: [
    '""""""""""""""""""""""""""""""""""""""""',
    '"""...........""""""""""""".............',
    '""..........."""""""""%%%""..........,,,',
    '"...........""""""""""%TT%"".........,,,',
    '"....##oo##.."""""""""%TT%""........,,,,',
    '"....#TTTT#.........."""""""".....,,,,,,',
    '"....#TTTT#..........""""""""...,,,,,,,,',
    '"....#TTTT#.........."""""""..,,,,,,,,""',
    '"....##=1##..........""""""..,,,,,,,""""',
    '"....======.........."""""..,,,,,,,"""""',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,2,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,3,,,,,,,,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    '::::::::::::::::::::::::::::::::::::::::',
    '""""~~~"""""""""::::::::::::""""""""""""',
    '"""~~~~~""""""""::::::::::"""""""""4""""',
    '"""~~~~~"""""""""::::::::""""""""""""""" ',
    '""""~~~"""""""""""::::::""""""""""""""""',
    '"""""~"""""""""""""::::"""""""""""""""""',
    '""""""""""""""""""""""""""""""""""""""""',
  ],
});

// --- Cordwain, Mid -----------------------------------------------------------

export const CORDWAIN_MID = makeMap({
  id: 'cordwain_mid',
  name: 'Cordwain — Mid',
  subtitle: 'the working city; three council seats it cannot afford',
  spawn: { x: 13, y: 13 },
  fill: ' ',
  markers: {
    '1': { kind: 'exit', to: 'braid', label: 'down to ground', under: '=', spawn: { x: 12, y: 9, facing: 'down' } },
    '2': { kind: 'exit', to: 'cordwain_root', label: 'Root', under: '=', spawn: { x: 20, y: 4, facing: 'down' } },
    '3': { kind: 'exit', to: 'cordwain_crown', label: 'Crown', under: '=', spawn: { x: 15, y: 11, facing: 'down' } },
    '4': {
      kind: 'action', label: 'audit bench', under: '=',
      run: (game) => game.startAudit(),
    },
    '5': {
      kind: 'npc', name: 'Wend', color: '#d99a3f', under: '=',
      beats: [
        { speaker: 'Wend', text: 'The claim reads clean. Cordwain moved when Cordwain says it moved, '
          + 'and Anneal can keep its writ.' },
        { speaker: 'Wend', text: 'Tarn will not leave it alone though. He says the physical grain in '
          + 'the 840s does not sit right against the chemistry. He is usually wrong about this.' },
        { speaker: 'Wend', text: 'He is not wrong about this. Go and read it yourself — bench is behind me. '
          + 'Sample wide first, then close in. You are looking for a stretch that is too well behaved.' },
      ],
    },
    '6': {
      kind: 'npc', name: 'Factor', color: '#7c9a5e', under: '=',
      beats: [
        { speaker: 'Sunwood factor', text: 'Rate is eleven to the measure and I will not be moved. '
          + 'Root buys at eleven, Crown buys at eleven. I am scrupulous.' },
        { speaker: 'Sunwood factor', text: 'That Root pays eleven out of a smaller purse is a matter '
          + 'for the Council, not for me. I only weigh it.' },
      ],
    },
  },
  tiles: [
    '     ##################       ',
    '     #================#       ',
    '     #==####====####==#       ',
    '     #==#..#====#..#==#       ',
    '  ####==####====####==####    ',
    '  #==================2===#    ',
    '  #==####==========####==#    ',
    '  #==#TT#====5=====#TT#==#    ',
    '  #==#TT#==========#TT#==#    ',
    '  #==#TT#===4======#TT#==#    ',
    '  #==####==========####==#    ',
    '  #======6==============3#    ',
    '  ####==================##    ',
    '     #========1=========#     ',
    '     ####################     ',
  ],
});

// --- Cordwain, Root ----------------------------------------------------------

export const CORDWAIN_ROOT = makeMap({
  id: 'cordwain_root',
  name: 'Cordwain — Root',
  subtitle: 'sheltered, stable, and permanently shaded',
  spawn: { x: 20, y: 4 },
  fill: ' ',
  markers: {
    '1': { kind: 'exit', to: 'cordwain_mid', label: 'up to Mid', under: '=', spawn: { x: 20, y: 5, facing: 'down' } },
    '2': {
      kind: 'npc', name: 'Organizer', color: '#7c9a5e', under: '=',
      beats: [
        { speaker: 'Compact organizer', text: 'We have filed. Third time. The formula was set under '
          + 'a Ember nobody alive has seen, and it has not been reopened in three cohorts.' },
        { speaker: 'Compact organizer', text: 'Not a rebellion. A petition. We are extremely boring '
          + 'and we intend to stay that way — it is the only thing that has ever worked.' },
        { speaker: 'Compact organizer', text: 'Process takes years, auditor. I have started doing the '
          + 'arithmetic on whether we have years. I do not recommend it.' },
      ],
    },
    '3': {
      kind: 'npc', name: 'Medic', color: '#a2917a', under: '=',
      beats: [
        { speaker: 'Root medic', text: 'Two more shade-rickets this season. Both of them Root, both of '
          + 'them under six. Sunwood is medicine before it is money and the ledger does not care.' },
        { speaker: 'Root medic', text: 'Crown loses people to weather. I do not say that to be fair. '
          + 'I say it because when I forget it I start hating people, and that helps nobody.' },
      ],
    },
    '4': {
      kind: 'sign', under: '=',
      beats: [{
        speaker: 'Notice board',
        text: 'RATION — 11 to the measure, unchanged.\n'
            + 'UNDERCANOPY COMPACT — petition III lodged, awaiting the Ring Council of the Eleventh.\n'
            + 'Below, in a different hand: petition II, awaiting. petition I, awaiting.',
      }],
    },
  },
  tiles: [
    '  ####################      ',
    '  #==================#      ',
    '  #==####======####==#      ',
    '  #==#TT#==4===#TT#==#      ',
    '  #==#TT#======#TT#==1##    ',
    '  #==####======####===#     ',
    '  #==================#      ',
    '  #===2=========3====#      ',
    '  #==================#      ',
    '  #~~~~~~~~~~~~~~~~~~#      ',
    '  ####################      ',
  ],
});

// --- Cordwain, Crown ---------------------------------------------------------

export const CORDWAIN_CROWN = makeMap({
  id: 'cordwain_crown',
  name: 'Cordwain — Crown',
  subtitle: 'direct light, and everything the wind does to you for it',
  spawn: { x: 15, y: 11 },
  fill: ' ',
  markers: {
    '1': { kind: 'exit', to: 'cordwain_mid', label: 'down to Mid', under: '=', spawn: { x: 22, y: 11, facing: 'left' } },
    '2': {
      kind: 'npc', name: 'Verity', color: '#e8622c', under: '=',
      beats: [
        { speaker: 'Verity Anneal-of-the-Ninth', text: 'You are the circuit Cordwain hired to tell it '
          + 'what it wanted to hear. I have read your filing. It is competent.' },
        { speaker: 'Verity Anneal-of-the-Ninth', text: 'It is also going to lose, and not because I am '
          + 'clever. Cordwain cannot carry three seats and a sunwood debt into a Long Dusk. '
          + 'The arithmetic does that, not me.' },
        { speaker: 'Verity Anneal-of-the-Ninth', text: 'Ask me the other thing. Go on.' },
        { speaker: 'Verity Anneal-of-the-Ninth', text: 'Yes. Anneal has the same smoothing. Same forty '
          + 'rings, same depth, same hand. I have known for six years.' },
        { speaker: 'Verity Anneal-of-the-Ninth', text: 'I did not bury it. I simply never pulled the '
          + 'thread, which I am aware is the same thing wearing better clothes. I did not want to know.' },
        { speaker: 'Verity Anneal-of-the-Ninth', text: 'You are going to want to know. That is the '
          + 'difference between us, and I do not yet know which of us it will cost more.' },
      ],
    },
    '3': {
      kind: 'npc', name: 'Windreader', color: '#5c7286', under: '=',
      beats: [
        { speaker: 'Crown windreader', text: 'Angle is down another degree off last season. Not the '
          + 'output — the angle. Everyone watches the brightness. The brightness is not the problem.' },
        { speaker: 'Crown windreader', text: 'Low light only clears high ground. You can derive it with '
          + 'a stick and one season of shadows. A child could. That is what frightens me.' },
      ],
    },
  },
  tiles: [
    '        ####??####          ',
    '      ###========###        ',
    '     ##============##       ',
    '    ##====####=======##      ',
    '   ##=====#TT#=====3==#      ',
    '   #======#TT#========#      ',
    '   #===2==####========#      ',
    '   #==================#      ',
    '   ##===============###      ',
    '    ##=============##        ',
    '     ##===========##         ',
    '      ###=======1###         ',
    '        #########            ',
  ],
  legend: { '?': { solid: false, color: '#5a4a33', speck: P.sunwood } },
});

export const MAPS = {
  braid: BRAID,
  cordwain_mid: CORDWAIN_MID,
  cordwain_root: CORDWAIN_ROOT,
  cordwain_crown: CORDWAIN_CROWN,
};
