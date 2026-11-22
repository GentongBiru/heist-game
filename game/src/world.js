// The Gilded Gallery — the simulation. Everything the game rules do lives
// here, with no drawing and no input devices: createWorld builds a level,
// stepWorld advances it one fixed 1/60 s step from an input object
// { mx, my, sneak, grab, smoke, fuse } (one-shot flags are consumed here).
// main.js feeds it real keyboard input; shots.js feeds it the autopilot.
import {
  TILE, COLS, ROWS, HUD_H, STEP, PLAYER, GUARD, CAMERA, ALARM, TOOLS,
  INTERACT, LEVEL_NAMES,
} from './config.js';
import { LEVELS, parseGrid, tileToPx } from './levels.js';

export const STEP_SECONDS = STEP;

// --- geometry helpers -------------------------------------------------------

function tileAt(world, px, py) {
  const col = Math.floor(px / TILE);
  const row = Math.floor((py - HUD_H) / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return world.grid[row][col];
}

function blocksSightAt(world, px, py) {
  const ch = tileAt(world, px, py);
  return ch === '#' || ch === 'D';
}

function blocksMoveAt(world, px, py) {
  const ch = tileAt(world, px, py);
  return ch === '#' || ch === 'D' || ch === 'R';
}

// Sampled line of sight: walls and display cases block it, velvet ropes do not.
export function hasLineOfSight(world, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (blocksSightAt(world, x1 + dx * t, y1 + dy * t)) return false;
  }
  return true;
}

// Does the segment from (x1,y1) to (x2,y2) pass through a smoke cloud?
export function isSmokeBlocked(world, x1, y1, x2, y2) {
  for (const cloud of world.smoke) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) t = ((cloud.x - x1) * dx + (cloud.y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    if (Math.hypot(cloud.x - cx, cloud.y - cy) < TOOLS.smokeRadius) return true;
  }
  return false;
}

// Cone test: inside range, inside the half-angle, clear line of sight, and
// no smoke cloud in the way. `dir` is the observer's facing in radians.
export function inCone(world, ox, oy, dir, range, halfAngle, tx, ty) {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1) return true;
  let diff = Math.atan2(dy, dx) - dir;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > halfAngle) return false;
  if (!hasLineOfSight(world, ox, oy, tx, ty)) return false;
  if (isSmokeBlocked(world, ox, oy, tx, ty)) return false;
  return true;
}

// --- world construction -----------------------------------------------------

export function createWorld(levelIndex, seed = 1) {
  const level = LEVELS[levelIndex];
  const parsed = parseGrid(level);
  const grid = level.grid;
  const player = {
    x: parsed.playerStart.x,
    y: parsed.playerStart.y,
    dir: 0,
    moving: false,
    sneak: false,
    invulnerable: 0,
  };
  const guards = parsed.guardSpawns.map((spawn, i) => {
    const patrol = level.patrols[i].map(([c, r]) => tileToPx(c, r));
    const next = patrol[1] ?? patrol[0];
    return {
      x: spawn.x,
      y: spawn.y,
      dir: Math.atan2(next.y - spawn.y, next.x - spawn.x),
      patrol,
      waypoint: 1 % patrol.length,
      suspicion: 0,
      mode: 'patrol',
      lastSeen: { x: spawn.x, y: spawn.y },
      scanTimer: 0,
      dwellTimer: 0,
      speedMultiplier: level.guardSpeedMultiplier,
    };
  });
  const cameras = level.cameras.map(([col, row, baseDeg, sweepDeg]) => {
    const pos = tileToPx(col, row);
    // Wall-edge mounts sit on the wall itself, not a tile into the room.
    if (col === 1) pos.x = TILE + 4;
    if (row === 0) pos.y = HUD_H + TILE / 2;
    return {
      x: pos.x,
      y: pos.y,
      baseAngle: (baseDeg * Math.PI) / 180,
      sweep: (sweepDeg * Math.PI) / 180,
      angle: (baseDeg * Math.PI) / 180,
      disabledTimer: 0,
      beepTimer: 1.5,
      sweepMultiplier: level.cameraSweepMultiplier,
      sees: false,
    };
  });
  return {
    levelIndex,
    levelName: LEVEL_NAMES[levelIndex],
    grid,
    walls: parsed.walls,
    cases: parsed.cases,
    ropes: parsed.ropes,
    loot: parsed.loot,
    lootTotal: parsed.loot.length,
    lootGrabbed: 0,
    lootValue: 0,
    exit: parsed.exit,
    exitOpen: false,
    fuseBox: parsed.fuseBox,
    pellets: parsed.pellets,
    pelletsLeft: TOOLS.smokeStart,
    player,
    guards,
    cameras,
    smoke: [],
    alarm: 0,
    maxAlarm: 0,
    time: 0,
    levelTime: 0,
    busted: false,
    levelDone: false,
    touches: 0,
    seed,
    // Transient events drained once per step by the shell (sound + banners).
    events: [],
  };
}

// --- movement ---------------------------------------------------------------

function moveCircle(world, body, dx, dy, radius) {
  // Axis-separated so the thief slides along walls instead of sticking.
  const nx = body.x + dx;
  if (!circleHitsSolid(world, nx, body.y, radius)) body.x = nx;
  const ny = body.y + dy;
  if (!circleHitsSolid(world, body.x, ny, radius)) body.y = ny;
}

function circleHitsSolid(world, x, y, radius) {
  const minCol = Math.floor((x - radius) / TILE);
  const maxCol = Math.floor((x + radius) / TILE);
  const minRow = Math.floor((y - HUD_H - radius) / TILE);
  const maxRow = Math.floor((y - HUD_H + radius) / TILE);
  for (let c = minCol; c <= maxCol; c += 1) {
    for (let r = minRow; r <= maxRow; r += 1) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
      const ch = world.grid[r][c];
      if (ch !== '#' && ch !== 'D' && ch !== 'R') continue;
      // Circle vs tile rectangle overlap.
      const tx0 = c * TILE;
      const ty0 = HUD_H + r * TILE;
      const cx = Math.max(tx0, Math.min(x, tx0 + TILE));
      const cy = Math.max(ty0, Math.min(y, ty0 + TILE));
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < radius * radius) return true;
    }
  }
  return false;
}

function moveToward(world, body, tx, ty, speed, dt, radius) {
  const dx = tx - body.x;
  const dy = ty - body.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const stepLen = Math.min(dist, speed * dt);
  body.dir = Math.atan2(dy, dx);
  moveCircle(world, body, (dx / dist) * stepLen, (dy / dist) * stepLen, radius);
  return dist - stepLen < 4;
}

// --- the step ----------------------------------------------------------------

export function stepWorld(world, input, dt = STEP) {
  world.events.length = 0;
  if (world.busted || world.levelDone) return;
  world.time += dt;
  world.levelTime += dt;
  const player = world.player;

  // Player movement.
  const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const moving = input.mx !== 0 || input.my !== 0;
  player.moving = moving;
  player.sneak = !!input.sneak;
  if (moving) {
    const len = Math.hypot(input.mx, input.my) || 1;
    const dx = (input.mx / len) * speed * dt;
    const dy = (input.my / len) * speed * dt;
    player.dir = Math.atan2(input.my, input.mx);
    moveCircle(world, player, dx, dy, PLAYER.radius);
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;

  // Smoke clouds age out.
  for (let i = world.smoke.length - 1; i >= 0; i -= 1) {
    world.smoke[i].ttl -= dt;
    if (world.smoke[i].ttl <= 0) world.smoke.splice(i, 1);
  }

  // Pellet pickups: walk over one to carry it.
  for (const pellet of world.pellets) {
    if (!pellet.taken && Math.hypot(player.x - pellet.x, player.y - pellet.y) < 22) {
      pellet.taken = true;
      world.pelletsLeft += 1;
      world.events.push({ type: 'pickup' });
    }
  }

  // One-shot tools.
  if (input.grab) grabLoot(world);
  if (input.smoke) useSmokePellet(world);
  if (input.fuse) useFuseBox(world);

  const noiseRadius = player.sneak ? PLAYER.noiseSneak : PLAYER.noiseWalk;

  // Guards: see, hear, patrol, get suspicious, chase, catch.
  let anyGuardSees = false;
  for (const guard of world.guards) {
    const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
    const sees = inCone(world, guard.x, guard.y, guard.dir, GUARD.visionRange, GUARD.visionHalfAngle, player.x, player.y);
    if (sees) {
      anyGuardSees = true;
      guard.lastSeen = { x: player.x, y: player.y };
      const close = dist < GUARD.suspicionCloseRange ? GUARD.suspicionCloseMultiplier : 1;
      guard.suspicion = Math.min(100, guard.suspicion + GUARD.suspicionRise * close * dt);
    } else {
      const inSmoke = world.smoke.some((c) => Math.hypot(guard.x - c.x, guard.y - c.y) < TOOLS.smokeRadius);
      guard.suspicion = Math.max(0, guard.suspicion - (inSmoke ? TOOLS.smokeSuspicionFall : GUARD.suspicionFall) * dt);
    }
    // Hearing: a moving thief inside the noise radius draws the guard's eye.
    if (moving && dist < noiseRadius) {
      guard.suspicion = Math.min(100, guard.suspicion + GUARD.hearingRise * dt);
      guard.lastSeen = { x: player.x, y: player.y };
      guard.dir = Math.atan2(player.y - guard.y, player.x - guard.x);
    }

    const wasMode = guard.mode;
    if (guard.suspicion >= GUARD.chaseAt) guard.mode = 'chase';
    else if (guard.suspicion >= GUARD.suspiciousAt) guard.mode = 'suspicious';
    else guard.mode = 'patrol';
    if (guard.mode === 'suspicious' && wasMode === 'patrol') world.events.push({ type: 'alert' });
    if (guard.mode === 'chase' && wasMode !== 'chase') world.events.push({ type: 'chase' });

    if (guard.mode === 'patrol') {
      if (guard.dwellTimer > 0) {
        // Pausing at a corner, still facing down the corridor just walked:
        // a thief who stepped into the guard's view stays in it.
        guard.dwellTimer -= dt;
      } else {
        const target = guard.patrol[guard.waypoint];
        if (moveToward(world, guard, target.x, target.y, GUARD.patrolSpeed * guard.speedMultiplier, dt, GUARD.radius)) {
          guard.waypoint = (guard.waypoint + 1) % guard.patrol.length;
          guard.dwellTimer = GUARD.waypointDwell;
        }
      }
    } else if (guard.mode === 'suspicious') {
      const arrived = moveToward(world, guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.patrolSpeed * guard.speedMultiplier, dt, GUARD.radius);
      if (arrived) {
        guard.scanTimer += dt;
        guard.dir += 1.2 * dt;
        if (guard.scanTimer > GUARD.scanPause) guard.scanTimer = 0;
      } else {
        guard.scanTimer = 0;
      }
    } else {
      // Chase: run at the thief while seen, else at the last seen spot.
      const target = sees ? { x: player.x, y: player.y } : guard.lastSeen;
      const arrived = moveToward(world, guard, target.x, target.y, GUARD.chaseSpeed * guard.speedMultiplier, dt, GUARD.radius);
      if (arrived && !sees) guard.mode = 'suspicious';
    }

    // Caught: a touch costs alarm and shoves the thief free — a fair scare,
    // not an instant fail. The guard then goes back to hunting the last spot.
    if (dist < PLAYER.radius + GUARD.radius && player.invulnerable <= 0) {
      world.alarm = Math.min(100, world.alarm + GUARD.touchAlarm);
      world.touches += 1;
      player.invulnerable = PLAYER.invulnerableAfterTouch;
      const away = Math.atan2(player.y - guard.y, player.x - guard.x);
      moveCircle(world, player, Math.cos(away) * PLAYER.shoveDistance, Math.sin(away) * PLAYER.shoveDistance, PLAYER.radius);
      guard.suspicion = GUARD.touchSuspicionReset;
      guard.mode = 'suspicious';
      guard.lastSeen = { x: player.x, y: player.y };
      world.events.push({ type: 'touch' });
    }
  }

  // Cameras sweep; a live one that sees the thief feeds the alarm and beeps.
  let anyCameraSees = false;
  for (const camera of world.cameras) {
    if (camera.disabledTimer > 0) {
      camera.disabledTimer -= dt;
      camera.sees = false;
      continue;
    }
    camera.angle = camera.baseAngle + camera.sweep * Math.sin(world.time * CAMERA.sweepSpeed * camera.sweepMultiplier);
    camera.sees = inCone(world, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, player.x, player.y);
    if (camera.sees) anyCameraSees = true;
    camera.beepTimer -= dt;
    if (camera.beepTimer <= 0) {
      world.events.push({ type: 'cameraBeep', urgent: camera.sees });
      camera.beepTimer = camera.sees ? CAMERA.beepIntervalSeen : CAMERA.beepInterval;
    }
  }

  // The alarm meter: rises while seen, falls while hidden.
  const rise = (anyGuardSees ? ALARM.guardSeePerSecond : 0) + (anyCameraSees ? CAMERA.alarmPerSecond : 0);
  if (rise > 0) world.alarm = Math.min(100, world.alarm + rise * dt);
  else world.alarm = Math.max(0, world.alarm - ALARM.fallPerSecond * dt);
  world.maxAlarm = Math.max(world.maxAlarm, world.alarm);
  if (world.alarm >= 100) {
    world.busted = true;
    world.events.push({ type: 'busted' });
    return;
  }

  // Exit: locked until every loot piece is grabbed.
  if (world.exitOpen && Math.hypot(player.x - world.exit.x, player.y - world.exit.y) < INTERACT.exitRadius) {
    world.levelDone = true;
    world.events.push({ type: 'levelDone' });
  }
}

function grabLoot(world) {
  const player = world.player;
  for (const piece of world.loot) {
    if (piece.taken) continue;
    if (Math.hypot(player.x - piece.x, player.y - piece.y) < INTERACT.grabRadius) {
      piece.taken = true;
      world.lootGrabbed += 1;
      world.lootValue += piece.value;
      world.events.push({ type: 'loot', value: piece.value });
      if (world.lootGrabbed === world.lootTotal) {
        world.exitOpen = true;
        world.events.push({ type: 'exitOpen' });
      }
      return;
    }
  }
}

function useSmokePellet(world) {
  if (world.pelletsLeft <= 0) return;
  world.pelletsLeft -= 1;
  world.smoke.push({ x: world.player.x, y: world.player.y, ttl: TOOLS.smokeSeconds });
  world.events.push({ type: 'smoke' });
}

function useFuseBox(world) {
  const box = world.fuseBox;
  if (!box || box.used) return;
  if (Math.hypot(world.player.x - box.x, world.player.y - box.y) > TOOLS.fuseRadius) return;
  box.used = true;
  for (const camera of world.cameras) camera.disabledTimer = TOOLS.fuseDisableSeconds;
  world.alarm = Math.min(100, world.alarm + ALARM.fuseCost);
  world.events.push({ type: 'fuse' });
}

// Read-only snapshot for the playtest hook (stripped before the final commit).
export function snapshotWorld(world) {
  return {
    level: world.levelIndex + 1,
    alarm: world.alarm,
    loot: world.lootGrabbed,
    lootTotal: world.lootTotal,
    lootValue: world.lootValue,
    pellets: world.pelletsLeft,
    player: { x: world.player.x, y: world.player.y },
    guards: world.guards.map((g) => ({ x: g.x, y: g.y, dir: g.dir, suspicion: g.suspicion, mode: g.mode })),
    cameras: world.cameras.map((c) => ({ x: c.x, y: c.y, angle: c.angle, disabled: c.disabledTimer > 0 })),
    exitOpen: world.exitOpen,
    time: world.time,
    lootList: world.loot.map((l) => ({ x: l.x, y: l.y, taken: l.taken })),
    fuseBox: { x: world.fuseBox.x, y: world.fuseBox.y },
    exit: { x: world.exit.x, y: world.exit.y },
  };
}
