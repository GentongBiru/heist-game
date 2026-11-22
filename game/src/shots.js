// Deterministic screenshot staging. stageShot plays the REAL rules forward
// from a fresh level-1 world, steered by an autopilot, then hands the world
// back for the shell to draw. Nothing here fakes a frame: the autopilot only
// presses the same keys a player would, and every step is a fixed 1/60 s.
//
// The autopilot replans on a 40x20 tile grid (Dijkstra): a tile inside a
// guard or camera cone costs extra, so the thief slips around the danger
// instead of through it; reckless mode ignores the cones and walks straight
// at the loot. Replanning happens every 0.5 s of sim time, or at once when
// the thief stops making progress.
import { TILE, COLS, ROWS, HUD_H, STEP, INTERACT } from './config.js';
import { createWorld, stepWorld, inCone } from './world.js';
import { GUARD, CAMERA } from './config.js';

function tileOf(x, y) {
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.floor(x / TILE))),
    row: Math.max(0, Math.min(ROWS - 1, Math.floor((y - HUD_H) / TILE))),
  };
}

function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: HUD_H + row * TILE + TILE / 2 };
}

function walkable(world, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  const ch = world.grid[row][col];
  return ch !== '#' && ch !== 'D' && ch !== 'R';
}

// Is this tile's centre inside any guard or camera cone right now?
function coneDanger(world, col, row) {
  const { x, y } = tileCenter(col, row);
  for (const guard of world.guards) {
    if (inCone(world, guard.x, guard.y, guard.dir, GUARD.visionRange, GUARD.visionHalfAngle, x, y)) return true;
  }
  for (const camera of world.cameras) {
    if (camera.disabledTimer > 0) continue;
    if (inCone(world, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, x, y)) return true;
  }
  return false;
}

// Cheapest path from (fromCol, fromRow) to (toCol, toRow). Cone tiles cost
// extra (or nothing in reckless mode). Returns tile centres, or [] when the
// target cannot be reached at all.
function planPath(world, fromCol, fromRow, toCol, toRow, reckless) {
  const key = (c, r) => r * COLS + c;
  const dist = new Float64Array(COLS * ROWS).fill(Infinity);
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const done = new Uint8Array(COLS * ROWS);
  const open = [[0, key(fromCol, fromRow)]];
  dist[key(fromCol, fromRow)] = 0;
  const danger = new Uint8Array(COLS * ROWS);
  if (!reckless) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (walkable(world, c, r) && coneDanger(world, c, r)) danger[key(c, r)] = 1;
      }
    }
  }
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i][0] < open[best][0]) best = i;
    const [d, cur] = open.splice(best, 1)[0];
    if (done[cur]) continue;
    done[cur] = 1;
    const cc = cur % COLS;
    const cr = Math.floor(cur / COLS);
    if (cc === toCol && cr === toRow) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (!walkable(world, nc, nr)) continue;
      const nk = key(nc, nr);
      if (done[nk]) continue;
      const cost = 1 + (danger[nk] ? 8 : 0);
      if (d + cost < dist[nk]) {
        dist[nk] = d + cost;
        prev[nk] = cur;
        open.push([dist[nk], nk]);
      }
    }
  }
  const target = key(toCol, toRow);
  if (dist[target] === Infinity) return [];
  const path = [];
  let cur = target;
  while (cur !== -1 && cur !== key(fromCol, fromRow)) {
    path.unshift({ col: cur % COLS, row: Math.floor(cur / COLS) });
    cur = prev[cur];
  }
  return path.map((t) => tileCenter(t.col, t.row));
}

function makeAutopilot(world, reckless) {
  let path = [];
  let replanIn = 0;
  let lastProgress = { x: world.player.x, y: world.player.y, t: 0 };
  return {
    // One step of autopilot input. `target` is {x, y} in pixels.
    input(target) {
      const now = world.time;
      const here = tileOf(world.player.x, world.player.y);
      const goal = tileOf(target.x, target.y);
      const moved = Math.hypot(world.player.x - lastProgress.x, world.player.y - lastProgress.y);
      if (moved > 8) lastProgress = { x: world.player.x, y: world.player.y, t: now };
      replanIn -= STEP;
      if (path.length === 0 || replanIn <= 0 || now - lastProgress.t > 2) {
        path = planPath(world, here.col, here.row, goal.col, goal.row, reckless);
        replanIn = 0.5;
      }
      // Grab anything within reach before moving on.
      const nearLoot = world.loot.find((l) => !l.taken && Math.hypot(world.player.x - l.x, world.player.y - l.y) < INTERACT.grabRadius);
      if (nearLoot) return { mx: 0, my: 0, sneak: true, grab: true, smoke: false, fuse: false };
      let dest = path[0] ?? target;
      if (path.length > 0) {
        const d = Math.hypot(world.player.x - dest.x, world.player.y - dest.y);
        if (d < 8) {
          path.shift();
          dest = path[0] ?? target;
        }
      }
      const dx = dest.x - world.player.x;
      const dy = dest.y - world.player.y;
      const len = Math.hypot(dx, dy) || 1;
      return { mx: dx / len, my: dy / len, sneak: !reckless, grab: false, smoke: false, fuse: false };
    },
  };
}

function nearestLoot(world) {
  let best = null;
  let bestDist = Infinity;
  for (const piece of world.loot) {
    if (piece.taken) continue;
    const d = Math.hypot(world.player.x - piece.x, world.player.y - piece.y);
    if (d < bestDist) {
      bestDist = d;
      best = piece;
    }
  }
  return best;
}

function currentTarget(world) {
  const loot = nearestLoot(world);
  if (loot) return { x: loot.x, y: loot.y };
  return { x: world.exit.x, y: world.exit.y };
}

// Run `seconds` of sim at fixed steps, calling `drive` for each step's input.
function simulate(world, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.busted || world.levelDone) break;
    stepWorld(world, drive());
  }
}

// --- the four staged shots ----------------------------------------------------

// start: 5 s of title-screen idle — guards patrol, cameras sweep, the thief
// waits at the door. The shell draws the TITLE screen over this live room.
function stageStart(world) {
  simulate(world, 5, () => ({ mx: 0, my: 0, sneak: false, grab: false, smoke: false, fuse: false }));
}

// play: autopilot toward the loot for up to 26 s, stopping once one piece is
// grabbed and the alarm is low. The shell draws PLAY.
function stagePlay(world) {
  const pilot = makeAutopilot(world, false);
  const steps = Math.round(26 / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.busted || world.levelDone) break;
    if (world.lootGrabbed >= 1 && world.alarm < 30) break;
    stepWorld(world, pilot.input(currentTarget(world)));
  }
}

// alarm: the thief walks to a bait point 210 px ahead of where guard A
// starts its eastward leg along row 13, then stands still. The guard walks
// straight at the thief down a long clear corridor: suspicion climbs to a
// chase, the alarm climbs with it, and the frame freezes the moment the
// chase is on and the alarm is in the band — before the guard closes the
// gap and the touch (+40) overshoots it.
function stageAlarm(world) {
  const pilot = makeAutopilot(world, true);
  // The bait sits just north of guard A's eastward leg, with a velvet rope
  // tile between it and the guard's approach: the guard sees the thief at
  // the cone's full range, chases, and has to slide around the rope to get
  // to them — which buys the alarm time to climb into the band while the
  // guard is still chasing (red cone, SPOTTED! on screen).
  const bait = { x: 528, y: 464 };
  const touches0 = world.touches;
  const inBand = () => world.guards.some((g) => g.mode === 'chase') && world.alarm >= 50;
  let t = 0;
  while (t < 5 && !world.busted && !inBand()
    && Math.hypot(world.player.x - bait.x, world.player.y - bait.y) > 4) {
    stepWorld(world, pilot.input(bait));
    t += STEP;
    if (world.touches !== touches0) break;
  }
  let idle = 0;
  while (idle < 8 && !inBand() && world.touches === touches0 && world.alarm < 70 && !world.busted) {
    stepWorld(world, { mx: 0, my: 0, sneak: true, grab: false, smoke: false, fuse: false });
    idle += STEP;
  }
}

// win: autopilot plays level 1 to completion — every loot piece, then the
// exit — capped at 150 s of sim. The shell draws the level-complete screen.
function stageWin(world) {
  const pilot = makeAutopilot(world, false);
  const steps = Math.round(150 / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.busted || world.levelDone) break;
    stepWorld(world, pilot.input(currentTarget(world)));
  }
}

export function stageShot(name) {
  const world = createWorld(0, 1);
  if (name === 'start') stageStart(world);
  else if (name === 'play') stagePlay(world);
  else if (name === 'alarm') stageAlarm(world);
  else if (name === 'win') stageWin(world);
  else stageStart(world);
  return world;
}
