// The first fifteen minutes.
//
// Structure: a cold open with a bell that does not ring, a playable descent in
// the dark where the world is shown before it is explained, a guided fight that
// teaches the one mechanic that matters, a genuine chill, and then arrival at
// the hub having earned it. No exposition dump, no menu tour, no "welcome to
// the tutorial".

export const OPENING = [
  { fade: 'out', time: 0.01 },
  { mood: null },
  { wait: 0.35 },
  { sfx: 'bell' },
  { wait: 0.9 },
  { narrate: 'A Warden went down the Quiet Stair to read the writ on a seam of inlay that had gone cold.' },
  { narrate: 'That was four days ago.' },
  { sfx: 'bell' },
  { narrate: 'A Warden always rings the bell.' },
  { wait: 0.5 },

  { goTo: { map: 'quietstair' } },
  { call: (game) => { game.encountersOff = true; } },
  { fade: 'in', time: 1.4 },
  { objective: 'FIND THE WARDEN' },
  { wait: 0.4 },
  { say: 'ZAHRA', text: 'This lamp is the only light on this stair. Stay inside it.' },
  { say: 'KOFI', text: 'Four days. He would have rung it if he could have rung it.' },
  {
    teach: {
      title: 'THE DESCENT',
      body: 'Arrows walk. The rest of the line follows where you have already been.\n'
        + 'Enter looks at whatever you are facing.',
    },
  },
];

export const BEATS = {
  'quietstair:1': [
    { say: 'AYA', text: 'The seam is out. Not dim -- out. All the way down, as far as the lamp reaches.' },
    { say: 'ZAHRA', text: 'Inlay does not go out. It burns down over a lifetime and somebody re-cuts it.' },
    { say: 'AYA', text: 'I know what inlay does. That is rather the point I am making.' },
  ],

  'quietstair:2': [
    { say: 'KOFI', text: 'Stop.' },
    { wait: 0.5 },
    { say: 'KOFI', text: 'Something came up past us. On the wall, not the steps.' },
    { shake: 2 },
    { sfx: 'crit' },
    { wait: 0.8 },
    {
      battle: {
        encounter: 'tutorial',
        tutorial: {
          hint: 'ENTER TO ATTACK',
          card: {
            title: 'RESONANCE',
            body: 'ZAHRA is EMBER. The crawler is HOLLOW, and HOLLOW is what EMBER opposes.\n'
              + 'Striking a thing with what opposes it RESONATES, for close to double.\n'
              + 'Striking it with its own affinity is DISCORDANT, for about half.\n'
              + 'EMBER opposes HOLLOW.  ROOT opposes BONE.  That is the whole of it.',
          },
        },
      },
    },
    { say: 'TEKO', text: 'Crawler. Gate-warden, shrunk down to the part that still works.' },
    { say: 'ZAHRA', text: 'It came up from below us. They do not go up. They hold a door and they stay at it.' },
  ],

  'quietstair:3': [
    { say: 'AYA', text: 'Two hundred steps and not one live seam. Whatever is down there is drinking it.' },
    { say: 'KOFI', text: 'Or it went out on its own and something moved in after.' },
    { say: 'AYA', text: 'You are not making this better.' },
  ],

  'quietstair:4': [
    { shake: 3 },
    { sfx: 'down' },
    { wait: 0.9 },
    { say: 'ZAHRA', text: 'That was below us.' },
    { say: 'KOFI', text: 'That was a long way below us, and I still felt it in the step.' },
  ],

  'quietstair:5': [
    { say: 'TEKO', text: 'There.' },
    { wait: 0.6 },
    { objective: 'THE MASK' },
  ],

  'quietstair:6': [
    { wait: 0.4 },
    { narrate: 'A Warden\'s mask, face up, cracked clean through.' },
    { narrate: 'The bell is lying beside it, where it fell.' },
    { say: 'AYA', text: 'No body. No mark on the stone. Just the mask, and it is cold.' },
    { say: 'KOFI', text: 'Pick up the bell.' },
    { wait: 0.7 },
    { sfx: 'deny' },
    { say: 'AYA', text: 'It does not ring. There is nothing wrong with it. It simply does not ring.' },
    { flag: 'sawTheMask' },
    { wait: 0.6 },
    { shake: 4 },
    { sfx: 'down' },
    { say: 'ZAHRA', text: 'Up. Now. All of you, up.' },
    { fade: 'out', time: 1.1 },
    { wait: 0.5 },
    { narrate: 'You go up the stair a great deal faster than you came down it.' },

    { goTo: { map: 'rootplaza' } },
    { call: (game) => { game.encountersOff = false; } },
    { mood: 'field' },
    { fade: 'in', time: 1.2 },
    { objective: 'REPORT THE SEAM' },
    { wait: 0.5 },
    { say: 'KOFI', text: 'Rootplaza. Lamps still lit. Everybody still walking about like it is a normal day.' },
    { say: 'ZAHRA', text: 'It is a normal day. Up here.' },
    {
      teach: {
        title: 'ROOTPLAZA',
        body: 'C opens the party. Q and E move between its pages.\n'
          + 'Three of the four stand in the line -- ENTER on a name moves them in or out.\n'
          + 'Walk into a lamp to rest. The Gate Hand is waiting on your report.',
      },
    },
  ],
};

/** Said once, when the player heads back to the stair after reporting. */
export const DESCEND_AGAIN = [
  { objective: 'READ THE SEAM' },
  { say: 'AYA', text: 'It is still cold down there. Colder, if anything.' },
  { say: 'ZAHRA', text: 'Then we read the seam ourselves, and we find out what took a Warden apart.' },
  { say: 'TEKO', text: 'Four of us this time. Whatever it is, it does not get to pick us off one at a time.' },
  { wait: 0.3 },
];

/** Second visit. The same landing, and something is standing on it. */
export const BEATS_AGAIN = {
  'quietstair:6': [
    { wait: 0.4 },
    { narrate: 'The mask is where you left it. The bell is not.' },
    { say: 'KOFI', text: 'Somebody picked it up.' },
    { wait: 0.6 },
    { sfx: 'bell' },
    { wait: 1.0 },
    { say: 'AYA', text: 'That is the bell. That is the Warden\'s bell, and it is ringing.' },
    { shake: 4 },
    { sfx: 'down' },
    { say: 'ZAHRA', text: 'Then something down here knows how to ring it. Line up.' },
    { battle: { encounter: 'warden' } },
    { call: (game) => { game.encountersOff = false; } },
    { objective: 'THE LOW GALLERY' },
  ],
};
