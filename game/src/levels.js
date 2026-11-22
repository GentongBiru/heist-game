// The three rooms of the heist. Each grid is 40 columns by 20 rows of 32 px
// tiles; row 0, row 19, column 0 and column 39 are always wall.
//
// Legend: # wall (blocks move + sight)  . floor  D display case (blocks
// move + sight)  R velvet rope (blocks move, NOT sight)  L loot  E exit
// P player start  g guard spawn  K camera mount  F fuse box  X smoke pickup
//
// One deliberate deviation from the research draft: level 1, row 2 used to
// hold a display case at column 7, right in front of the player's start.
// It blocked the straight corridor the movement check needs, so that tile
// is floor now. Everything else matches the validated grids exactly.
import { TILE, HUD_H } from './config.js';

export function tileToPx(col, row) {
  return { x: col * TILE + TILE / 2, y: HUD_H + row * TILE + TILE / 2 };
}

export const LEVELS = [
  {
    name: 'The Gilded Gallery',
    grid: [
      '########################################',
      '#......D.......R...........D...........#',
      '#..P.......................D.....L.....#',
      '#......D.......R...........D...........#',
      '#......................................#',
      '#....R..........D....D.........R.......#',
      '#......................................#',
      '#..D...g.......................D.......#',
      '#..D...........................D......K#',
      '#..................R...................#',
      '#......L.......D.........D....g........#',
      '#......................................#',
      '#...D...........R.....R.........D......#',
      '#...D..................................#',
      '#..........R............L..............#',
      '#..F...................................#',
      '#......X.......D..........D............#',
      '#......................................#',
      '#....................E.................#',
      '########################################',
    ],
    patrols: [
      [[7, 7], [7, 13], [20, 13], [20, 7]],
      [[30, 10], [30, 4], [36, 4], [36, 10]],
    ],
    // Cameras mounted on a wall edge: [tile col, tile row, base angle deg, sweep deg]
    cameras: [[38, 8, 180, 45]],
    lootValues: [500, 750, 1000],
    guardSpeedMultiplier: 1,
    cameraSweepMultiplier: 1,
  },
  {
    name: 'The Vault Hall',
    grid: [
      '########################################',
      '#..P.....D.............D........L......#',
      '#........D....R.............D..........#',
      '#................D.....................#',
      '#..D........R........D......R....D.....#',
      '#..D............................D......#',
      '#......g..........D....D.......g.......#',
      '#......................................#',
      '#....R.....D...............D.....R.....#',
      '#......................................#',
      '#..L...........D.....D.........L.......#',
      '#......................................#',
      '#.....D......R........R.......D........#',
      '#......................................#',
      '#..g..............D...................K#',
      '#......................................#',
      '#......X....D.............D......F.....#',
      '#................R.....................#',
      '#..D..........L.............E..........#',
      '########################################',
    ],
    patrols: [
      [[7, 6], [7, 12], [15, 12], [15, 6]],
      [[31, 6], [31, 12], [24, 12], [24, 6]],
      [[3, 14], [3, 17], [12, 17], [12, 14]],
    ],
    cameras: [
      [38, 14, 180, 45],
      [20, 0, 90, 40],
    ],
    lootValues: [750, 1000, 1250, 1500],
    guardSpeedMultiplier: 1,
    cameraSweepMultiplier: 1,
  },
  {
    name: 'The Crown Chamber',
    grid: [
      '########################################',
      '#..P....D......R.......D......L........#',
      '#.......D..................D...........#',
      '#..R.........D.....D..........R........#',
      '#......................................#',
      '#....D....g.........D...g........D.....#',
      '#....D..........................D......#',
      '#..........R........R..................#',
      '#..L...................................#',
      '#......D...........D...........D.......#',
      '#......................................#',
      '#..g.......R...........R.........g.....#',
      '#......................................#',
      '#....D......L.......D.....L......D.....#',
      '#......................................#',
      '#.........R..........R................K#',
      '#..F...................................#',
      '#......D..........D..........D...L.....#',
      '#...................E..................#',
      '########################################',
    ],
    patrols: [
      [[10, 5], [10, 9], [18, 9], [18, 5]],
      [[24, 5], [24, 9], [32, 9], [32, 5]],
      [[3, 11], [3, 15], [12, 15], [12, 11]],
      [[33, 11], [33, 16], [26, 16], [26, 11]],
    ],
    cameras: [
      [38, 15, 180, 45],
      [20, 0, 90, 40],
      [1, 9, 0, 40],
    ],
    lootValues: [1000, 1250, 1500, 2000, 2500],
    guardSpeedMultiplier: 1.1,
    cameraSweepMultiplier: 1.3,
  },
];

// Turn a level's grid strings into the objects the simulation works with:
// walls and cases (block move + sight), ropes (block move only), loot, the
// exit, the player start, guard spawns, the fuse box and pellet pickups.
// Cameras come from the level's camera list, not the grid: a K tile marks
// the mount, but wall-edge cameras (top row, left column) live in the list.
export function parseGrid(level) {
  const walls = new Set();
  const cases = new Set();
  const ropes = new Set();
  const loot = [];
  let exit = null;
  let playerStart = null;
  let fuseBox = null;
  const pellets = [];
  const guardSpawns = [];
  const cameraTiles = [];
  level.grid.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c];
      const key = `${c},${r}`;
      if (ch === '#') walls.add(key);
      else if (ch === 'D') cases.add(key);
      else if (ch === 'R') ropes.add(key);
      else if (ch === 'L') loot.push({ ...tileToPx(c, r), col: c, row: r, taken: false, value: 0 });
      else if (ch === 'E') exit = { ...tileToPx(c, r), col: c, row: r };
      else if (ch === 'P') playerStart = { ...tileToPx(c, r), col: c, row: r };
      else if (ch === 'g') guardSpawns.push({ ...tileToPx(c, r), col: c, row: r });
      else if (ch === 'K') cameraTiles.push({ col: c, row: r });
      else if (ch === 'F') fuseBox = { ...tileToPx(c, r), col: c, row: r, used: false };
      else if (ch === 'X') pellets.push({ ...tileToPx(c, r), col: c, row: r, taken: false });
    }
  });
  // Loot values are assigned in reading order (top row first, left to right).
  loot.forEach((piece, i) => {
    piece.value = level.lootValues[i] ?? 500;
  });
  return { walls, cases, ropes, loot, exit, playerStart, fuseBox, pellets, guardSpawns, cameraTiles };
}
