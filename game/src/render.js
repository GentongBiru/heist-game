// The Gilded Gallery — all canvas drawing. One job: turn a world state
// into a readable frame. The whole room fits the 1280x720 frame, the HUD
// band sits on top, and safe cover, danger cones and loot read at a glance:
// cones are bright translucent wedges, loot pulses gold, the exit glows green.
import {
  TILE, COLS, ROWS, HUD_H, VIEW_W, VIEW_H, HINT_H, PLAYER, GUARD, CAMERA,
  TOOLS, PALETTE,
} from './config.js';

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function conePath(ctx, x, y, dir, range, halfAngle) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, dir - halfAngle, dir + halfAngle);
  ctx.closePath();
}

function drawCone(ctx, x, y, dir, range, halfAngle, color) {
  conePath(ctx, x, y, dir, range, halfAngle);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLootShape(ctx, x, y, kind, pulse) {
  const glow = 0.55 + 0.35 * pulse;
  ctx.save();
  ctx.shadowColor = '#ffd94d';
  ctx.shadowBlur = 14 + 10 * pulse;
  if (kind === 0) {
    // A painting: gold frame, dark canvas, bright centre.
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x - 13, y - 10, 26, 20);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(x - 10, y - 7, 20, 14);
    ctx.fillStyle = `rgba(255, 217, 77, ${glow})`;
    ctx.fillRect(x - 5, y - 3, 10, 6);
  } else if (kind === 1) {
    // A gem: cyan diamond.
    ctx.fillStyle = '#6ee7ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x, y + 12);
    ctx.lineTo(x - 9, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.4 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  } else {
    // An idol: a small gold statue on a plinth.
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x + 6, y + 2);
    ctx.lineTo(x - 6, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 8, y + 2, 16, 4);
    ctx.fillRect(x - 5, y + 6, 10, 4);
  }
  ctx.restore();
}

function drawThief(ctx, x, y, dir, sneak, invulnerable, time) {
  ctx.save();
  if (invulnerable > 0 && Math.floor(time * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  // Hooded figure: dark cloak with a gold trim ring and a pale face slit.
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(x, y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.thiefTrim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, PLAYER.radius - 2, 0, Math.PI * 2);
  ctx.stroke();
  // Hood point in the facing direction.
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(dir) * 15, y + Math.sin(dir) * 15);
  ctx.lineTo(x + Math.cos(dir + 2.4) * 9, y + Math.sin(dir + 2.4) * 9);
  ctx.lineTo(x + Math.cos(dir - 2.4) * 9, y + Math.sin(dir - 2.4) * 9);
  ctx.closePath();
  ctx.fill();
  // White facing tick so the direction reads at a glance.
  ctx.strokeStyle = '#f2ead8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(dir) * 5, y + Math.sin(dir) * 5);
  ctx.lineTo(x + Math.cos(dir) * 11, y + Math.sin(dir) * 11);
  ctx.stroke();
  if (sneak) {
    // Crouched: a smaller, tighter silhouette.
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGuard(ctx, x, y, dir, mode) {
  ctx.save();
  // Navy uniform with brass buttons and a white direction tick.
  ctx.fillStyle = PALETTE.guard;
  ctx.beginPath();
  ctx.arc(x, y, GUARD.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mode === 'chase' ? '#ff5040' : mode === 'suspicious' ? '#ff8c28' : PALETTE.guardTrim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, GUARD.radius - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.guardTrim;
  ctx.beginPath();
  ctx.arc(x - 3, y - 2, 1.6, 0, Math.PI * 2);
  ctx.arc(x + 3, y - 2, 1.6, 0, Math.PI * 2);
  ctx.arc(x, y + 3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(dir) * 5, y + Math.sin(dir) * 5);
  ctx.lineTo(x + Math.cos(dir) * 12, y + Math.sin(dir) * 12);
  ctx.stroke();
  ctx.restore();
}

function drawCamera(ctx, camera) {
  ctx.save();
  const disabled = camera.disabledTimer > 0;
  ctx.translate(camera.x, camera.y);
  ctx.rotate(camera.angle);
  ctx.fillStyle = disabled ? '#3a3f46' : '#14181f';
  ctx.fillRect(-4, -7, 16, 14);
  ctx.fillStyle = disabled ? '#555' : '#ff2d2d';
  ctx.beginPath();
  ctx.arc(13, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (disabled) {
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(camera.x - 8, camera.y - 8);
    ctx.lineTo(camera.x + 8, camera.y + 8);
    ctx.moveTo(camera.x + 8, camera.y - 8);
    ctx.lineTo(camera.x - 8, camera.y + 8);
    ctx.stroke();
    ctx.restore();
  }
}

function drawExit(ctx, world, time) {
  const { exit } = world;
  const open = world.exitOpen;
  const pulse = 0.6 + 0.4 * Math.sin(time * 4);
  ctx.save();
  ctx.shadowColor = open ? '#37d67a' : '#6b7280';
  ctx.shadowBlur = open ? 18 + 10 * pulse : 4;
  ctx.fillStyle = open ? '#0d3d24' : '#23272e';
  ctx.fillRect(exit.x - 15, exit.y - 20, 30, 40);
  ctx.strokeStyle = open ? PALETTE.exitGreen : PALETTE.exitLocked;
  ctx.lineWidth = 3;
  ctx.strokeRect(exit.x - 15, exit.y - 20, 30, 40);
  ctx.strokeStyle = open ? PALETTE.exitGreen : PALETTE.exitLocked;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(exit.x, exit.y - 20);
  ctx.lineTo(exit.x, exit.y + 20);
  ctx.stroke();
  ctx.fillStyle = open ? PALETTE.exitGreen : '#9aa0aa';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', exit.x, exit.y - 26);
  if (!open) {
    // Padlock while the room still holds loot.
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(exit.x - 5, exit.y - 4, 10, 8);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(exit.x, exit.y - 4, 4, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

// --- the room -----------------------------------------------------------------

export function drawWorld(ctx, world) {
  const time = world.time;
  // Marble floor, two warm dark tones in a checker.
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      ctx.fillStyle = (c + r) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(c * TILE, HUD_H + r * TILE, TILE, TILE);
    }
  }
  // Walls with a thin gold trim line; cases; velvet ropes.
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const ch = world.grid[r][c];
      const x = c * TILE;
      const y = HUD_H + r * TILE;
      if (ch === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = PALETTE.wallTrim;
        ctx.fillRect(x, y + TILE - 2, TILE, 2);
      } else if (ch === 'D') {
        ctx.fillStyle = PALETTE.caseGlass;
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = PALETTE.caseEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.fillRect(x + 5, y + 5, TILE - 10, 6);
      } else if (ch === 'R') {
        ctx.fillStyle = PALETTE.ropePost;
        ctx.beginPath();
        ctx.arc(x + 5, y + TILE / 2, 4, 0, Math.PI * 2);
        ctx.arc(x + TILE - 5, y + TILE / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.ropeCord;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + TILE / 2 + 3);
        ctx.quadraticCurveTo(x + TILE / 2, y + TILE / 2 + 10, x + TILE - 5, y + TILE / 2 + 3);
        ctx.stroke();
      }
    }
  }
  // Loot, fuse box, pellet pickups.
  world.loot.forEach((piece, i) => {
    if (piece.taken) return;
    const pulse = (Math.sin(time * 3 + i * 1.7) + 1) / 2;
    ctx.fillStyle = `rgba(255, 217, 77, ${0.10 + 0.12 * pulse})`;
    ctx.beginPath();
    ctx.arc(piece.x, piece.y, 24 + 6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    drawLootShape(ctx, piece.x, piece.y, i % 3, pulse);
  });
  if (world.fuseBox && !world.fuseBox.used) {
    const { x, y } = world.fuseBox;
    ctx.fillStyle = '#8a6d1f';
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('F', x, y + 4);
  }
  for (const pellet of world.pellets) {
    if (pellet.taken) continue;
    ctx.fillStyle = '#dfe6ea';
    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a97a3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawExit(ctx, world, time);
  // Smoke clouds.
  for (const cloud of world.smoke) {
    const alpha = Math.min(0.75, (cloud.ttl / 3) * 0.75 + 0.15);
    ctx.fillStyle = `rgba(210, 214, 218, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, TOOLS.smokeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(235, 238, 240, ${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(cloud.x - 20, cloud.y - 10, 45, 0, Math.PI * 2);
    ctx.arc(cloud.x + 25, cloud.y + 12, 40, 0, Math.PI * 2);
    ctx.fill();
  }
  // Vision cones: guards first, then cameras, so the danger reads at once.
  for (const guard of world.guards) {
    const color = guard.mode === 'chase' ? PALETTE.coneChase
      : guard.mode === 'suspicious' ? PALETTE.coneSuspicious : PALETTE.coneCalm;
    drawCone(ctx, guard.x, guard.y, guard.dir, GUARD.visionRange, GUARD.visionHalfAngle, color);
  }
  for (const camera of world.cameras) {
    if (camera.disabledTimer > 0) {
      drawCone(ctx, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, PALETTE.coneCameraOff);
    } else {
      drawCone(ctx, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, PALETTE.coneCamera);
    }
  }
  for (const camera of world.cameras) drawCamera(ctx, camera);
  for (const guard of world.guards) drawGuard(ctx, guard.x, guard.y, guard.dir, guard.mode);
  const p = world.player;
  drawThief(ctx, p.x, p.y, p.dir, p.sneak, p.invulnerable, time);
  // A soft radial darkness outside the thief's nearby light.
  const vignette = ctx.createRadialGradient(p.x, p.y, 180, p.x, p.y, 620);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H - HUD_H - HINT_H);
}

// --- the HUD -------------------------------------------------------------------

export function drawHud(ctx, world, muted) {
  ctx.fillStyle = PALETTE.hudBand;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`LEVEL ${world.levelIndex + 1} — ${world.levelName.toUpperCase()}`, 16, 26);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`TIME ${fmtTime(world.time)}`, 16, 50);

  // Alarm meter: wide centre bar, green under 40, amber to 79, red above.
  const barX = 470;
  const barW = 340;
  const barY = 22;
  const barH = 22;
  const alarm = world.alarm;
  const alarmColor = alarm < 40 ? '#37d67a' : alarm < 80 ? '#ffb02e' : '#ff3b30';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', barX - 78, barY + 18);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = alarmColor;
  const pulse = alarm >= 80 ? 0.7 + 0.3 * Math.sin(world.time * 8) : 1;
  ctx.globalAlpha = pulse;
  ctx.fillRect(barX, barY, Math.max(0, (barW * alarm) / 100), barH);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#f2ead8';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`${Math.round(alarm)}`, barX + barW + 10, barY + 18);

  // Loot count + value, with a drawn gold diamond (no emoji glyphs).
  const lootText = `LOOT ${world.lootGrabbed}/${world.lootTotal}  $${world.lootValue.toLocaleString('en-US')}`;
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(lootText, VIEW_W - 16, 26);
  const diamondX = VIEW_W - 16 - ctx.measureText(lootText).width - 18;
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(diamondX, 12);
  ctx.lineTo(diamondX + 8, 20);
  ctx.lineTo(diamondX, 28);
  ctx.lineTo(diamondX - 8, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`SMOKE x${world.pelletsLeft}${muted ? '  ·  MUTED' : ''}`, VIEW_W - 16, 50);

  // Bottom hint strip.
  ctx.fillStyle = 'rgba(8, 10, 16, 0.82)';
  ctx.fillRect(0, VIEW_H - HINT_H, VIEW_W, HINT_H);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move  ·  SHIFT sneak  ·  E grab  ·  Q smoke  ·  F fuse box  ·  P pause  ·  M mute', VIEW_W / 2, VIEW_H - 4);
}

// --- banners and screens -------------------------------------------------------

function overlay(ctx, alpha = 0.72) {
  ctx.fillStyle = `rgba(4, 6, 10, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function bigTitle(ctx, text, y, color = '#f2ead8', size = 56) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, y);
}

function bodyLine(ctx, text, y, color = '#d8d2c2', size = 20) {
  ctx.fillStyle = color;
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, y);
}

export function drawBanners(ctx, world) {
  const chasing = world.guards.some((g) => g.mode === 'chase');
  if (chasing) {
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPOTTED!', VIEW_W / 2, 150);
  }
  if (world.exitOpen && !world.levelDone) {
    const pulse = 0.65 + 0.35 * Math.sin(world.time * 5);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT OPEN — RUN FOR THE GREEN DOOR', VIEW_W / 2, 190);
    ctx.globalAlpha = 1;
  }
}

export function drawTitle(ctx, world, best) {
  overlay(ctx, 0.66);
  bigTitle(ctx, 'THE GILDED GALLERY', 220, '#ffd94d', 58);
  bodyLine(ctx, 'A night-museum heist in three rooms', 262, '#f2ead8', 22);
  bodyLine(ctx, 'You are Wren, a thief in the dark. Take every treasure, dodge the', 330);
  bodyLine(ctx, 'guards and their cones, blind the cameras — and leave unseen.', 358);
  bodyLine(ctx, 'WASD / arrows — move      SHIFT — sneak      E — grab loot', 420, '#a89f8a', 18);
  bodyLine(ctx, 'Q — smoke pellet      F — fuse box (kills cameras, +8 alarm)', 448, '#a89f8a', 18);
  bodyLine(ctx, 'P — pause      M — mute', 476, '#a89f8a', 18);
  if (best > 0) bodyLine(ctx, `Best haul so far: $${best.toLocaleString('en-US')}`, 520, '#ffd94d', 18);
  bigTitle(ctx, 'PRESS SPACE TO BEGIN', 600, '#f2ead8', 26);
}

export function drawPaused(ctx) {
  overlay(ctx, 0.6);
  bigTitle(ctx, 'PAUSED', 330);
  bodyLine(ctx, 'Press P to keep stealing', 380);
}

export function drawLevelDone(ctx, world) {
  overlay(ctx, 0.66);
  bigTitle(ctx, 'ROOM CLEARED', 260, '#37d67a', 52);
  bodyLine(ctx, `${world.levelName} — all ${world.lootTotal} treasures taken`, 310, '#f2ead8', 22);
  bodyLine(ctx, `Haul so far: $${world.lootValue.toLocaleString('en-US')}   ·   Time: ${fmtTime(world.time)}`, 350);
  bigTitle(ctx, 'PRESS SPACE FOR THE NEXT ROOM', 450, '#f2ead8', 26);
}

export function drawWin(ctx, world, rating) {
  overlay(ctx, 0.72);
  bigTitle(ctx, 'THE GETAWAY IS CLEAN', 220, '#ffd94d', 52);
  bodyLine(ctx, 'Every treasure in the museum is yours. Wren vanishes into the night.', 272, '#f2ead8', 22);
  bodyLine(ctx, `Total haul: $${world.lootValue.toLocaleString('en-US')}`, 340, '#ffd94d', 26);
  bodyLine(ctx, `Total time: ${fmtTime(world.time)}`, 380);
  bodyLine(ctx, `Rating: ${rating}`, 420, '#37d67a', 26);
  bodyLine(ctx, 'Press SPACE to steal it all again', 500, '#a89f8a', 20);
}

export function drawBusted(ctx, world) {
  overlay(ctx, 0.72);
  bigTitle(ctx, 'BUSTED!', 260, '#ff3b30', 64);
  bodyLine(ctx, 'The alarm hit 100 and the museum woke up.', 316, '#f2ead8', 22);
  bodyLine(ctx, `You kept $${world.lootValue.toLocaleString('en-US')} of loot from this room.`, 352);
  bigTitle(ctx, 'PRESS SPACE TO RETRY THE ROOM', 450, '#f2ead8', 26);
}
