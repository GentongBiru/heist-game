// The Gilded Gallery — boot, fixed 1/60 s loop, and the screen machine:
// title -> play <-> paused -> level-done -> next room -> win, or busted ->
// retry. A ?shot= query instead stages a deterministic scene for screenshots
// and paints it twice, then sets window.__shotReady.
import { VIEW_W, VIEW_H, STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  drawWorld, drawHud, drawBanners, drawTitle, drawPaused, drawLevelDone,
  drawWin, drawBusted,
} from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const input = createInput();
const audio = createAudio();

const BEST_KEY = 'gilded-gallery-best';
let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
} catch {
  best = 0;
}

function ratingFor(maxAlarm) {
  if (maxAlarm <= 50) return 'GHOST — never seen';
  if (maxAlarm <= 80) return 'CLEAN getaway';
  return 'LOUD — but rich';
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 1) || 1;

let screen = 'title';
let world = createWorld(0, seed);
let runLoot = 0;
let runTime = 0;
let runMaxAlarm = 0;
let stepTimer = 0;
let lastStatus = '';

function setStatus(text) {
  if (text === lastStatus) return;
  lastStatus = text;
  statusLine.textContent = text;
}

function startRun() {
  runLoot = 0;
  runTime = 0;
  runMaxAlarm = 0;
  world = createWorld(0, seed);
  screen = 'play';
}

function nextLevel() {
  runLoot += world.lootValue;
  runTime += world.time;
  runMaxAlarm = Math.max(runMaxAlarm, world.maxAlarm);
  if (world.levelIndex >= 2) {
    screen = 'win';
    try {
      if (runLoot > best) {
        best = runLoot;
        window.localStorage.setItem(BEST_KEY, String(best));
      }
    } catch {
      // Best score is a nicety, never a failure.
    }
    return;
  }
  world = createWorld(world.levelIndex + 1, seed);
  screen = 'play';
}

function retryLevel() {
  world = createWorld(world.levelIndex, seed);
  screen = 'play';
}

function playEventSounds(events) {
  for (const event of events) {
    if (event.type === 'alert') audio.guardAlert();
    else if (event.type === 'chase') audio.chaseSting();
    else if (event.type === 'cameraBeep') audio.cameraBeep(event.urgent);
    else if (event.type === 'loot') audio.lootChime();
    else if (event.type === 'smoke') audio.smokePoof();
    else if (event.type === 'pickup') audio.pickupBlip();
    else if (event.type === 'fuse') audio.fuseBuzz();
    else if (event.type === 'busted') audio.bustedSting();
    else if (event.type === 'levelDone' && world.levelIndex >= 2) audio.winJingle();
  }
}

function stepPlay() {
  const dir = input.direction();
  const actions = input.takeActions();
  const simInput = {
    mx: dir.mx,
    my: dir.my,
    sneak: dir.sneak,
    grab: actions.includes('grab'),
    smoke: actions.includes('smoke'),
    fuse: actions.includes('fuse'),
  };
  stepWorld(world, simInput, STEP);
  playEventSounds(world.events);
  audio.setAlarmLevel(world.alarm / 100);
  if (world.player.moving) {
    stepTimer -= STEP;
    if (stepTimer <= 0) {
      audio.footstep(world.player.sneak);
      stepTimer = world.player.sneak ? 0.5 : 0.32;
    }
  } else {
    stepTimer = 0;
  }
  if (world.busted) {
    screen = 'busted';
    setStatus('Busted! The alarm hit 100. Press Space to retry the room.');
  } else if (world.levelDone) {
    screen = 'leveldone';
    if (world.levelIndex >= 2) nextLevel();
    setStatus(`Room cleared. Press Space for the next room.`);
  }
}

function handleScreenActions() {
  // Only take the actions this screen owns (mute / pause / confirm) and
  // leave grab, smoke and fuse queued for the simulation step below.
  if (input.hasAction('mute')) {
    audio.unlock();
    const muted = audio.toggleMute();
    setStatus(muted ? 'Muted.' : 'Sound on.');
  }
  const pausePressed = input.hasAction('pause');
  if (pausePressed && screen === 'play') {
    screen = 'paused';
    setStatus('Paused. Press P to keep stealing.');
    return;
  }
  if (pausePressed && screen === 'paused') {
    screen = 'play';
    setStatus('');
    return;
  }
  if (!input.hasAction('confirm')) return;
  audio.unlock();
  if (screen === 'title') {
    startRun();
    setStatus('Steal every treasure, then reach the green exit.');
  } else if (screen === 'leveldone') {
    nextLevel();
    setStatus('Steal every treasure, then reach the green exit.');
  } else if (screen === 'win') {
    startRun();
    setStatus('Steal every treasure, then reach the green exit.');
  } else if (screen === 'busted') {
    retryLevel();
    setStatus('Steal every treasure, then reach the green exit.');
  }
}

function render() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawWorld(ctx, world);
  drawHud(ctx, world, audio.muted);
  if (screen === 'play' || screen === 'paused') drawBanners(ctx, world);
  if (screen === 'title') drawTitle(ctx, world, best);
  else if (screen === 'paused') drawPaused(ctx);
  else if (screen === 'leveldone') drawLevelDone(ctx, world);
  else if (screen === 'win') drawWin(ctx, { lootValue: runLoot, time: runTime }, ratingFor(runMaxAlarm));
  else if (screen === 'busted') drawBusted(ctx, world);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (frame.last === undefined) frame.last = now;
  let elapsed = (now - frame.last) / 1000;
  frame.last = now;
  if (elapsed > 0.25) elapsed = 0.25;
  frame.acc = (frame.acc ?? 0) + elapsed;
  handleScreenActions();
  if (screen === 'play') {
    while (frame.acc >= STEP) {
      stepPlay();
      frame.acc -= STEP;
      if (screen !== 'play') {
        frame.acc = 0;
        break;
      }
    }
  } else if (screen === 'title') {
    // The room stays alive behind the title: guards patrol, cameras sweep.
    while (frame.acc >= STEP) {
      stepWorld(world, { mx: 0, my: 0, sneak: false, grab: false, smoke: false, fuse: false }, STEP);
      frame.acc -= STEP;
    }
  } else {
    frame.acc = 0;
  }
  render();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') {
    screen = 'paused';
    setStatus('Paused. Press P to keep stealing.');
  }
});

if (shotName) {
  // Screenshot staging: play the scene forward, paint it twice, signal ready.
  world = stageShot(shotName);
  screen = world.levelDone ? 'leveldone' : shotName === 'start' ? 'title' : 'play';
  render();
  requestAnimationFrame(() => {
    render();
    window.__shotReady = true;
  });
} else {
  setStatus('The Gilded Gallery. Press Space to begin the heist.');
  requestAnimationFrame(frame);
}
