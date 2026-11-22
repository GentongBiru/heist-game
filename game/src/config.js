// The Gilded Gallery — every tuning number lives here, so a playtest can
// change the feel of the game by editing this file alone. All speeds are in
// pixels per second, all radii in pixels, all rates per second.
export const TILE = 32;
export const COLS = 40;
export const ROWS = 20;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 64;
export const HINT_H = 16;
export const PLAY_W = COLS * TILE;
export const PLAY_H = ROWS * TILE;
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 12,
  walkSpeed: 175,
  sneakSpeed: 100,
  noiseWalk: 70,
  noiseSneak: 25,
  invulnerableAfterTouch: 1.5,
  shoveDistance: 60,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 85,
  chaseSpeed: 150,
  visionRange: 210,
  visionHalfAngle: (32 * Math.PI) / 180,
  suspicionRise: 55,
  suspicionCloseMultiplier: 1.6,
  suspicionCloseRange: 100,
  suspicionFall: 25,
  hearingRise: 40,
  suspiciousAt: 40,
  chaseAt: 100,
  waypointDwell: 0.9,
  touchAlarm: 40,
  touchSuspicionReset: 30,
  scanPause: 1.2,
};

export const CAMERA = {
  range: 230,
  halfAngle: (28 * Math.PI) / 180,
  sweepSpeed: 0.5,
  alarmPerSecond: 22,
  beepInterval: 2.0,
  beepIntervalSeen: 0.5,
};

export const ALARM = {
  guardSeePerSecond: 26,
  fallPerSecond: 6,
  fuseCost: 8,
  bustedAt: 100,
};

export const TOOLS = {
  smokeStart: 2,
  smokeRadius: 90,
  smokeSeconds: 3,
  smokeSuspicionFall: 60,
  fuseRadius: 28,
  fuseDisableSeconds: 15,
};

export const INTERACT = {
  grabRadius: 26,
  exitRadius: 24,
};

export const LEVEL_NAMES = [
  'The Gilded Gallery',
  'The Vault Hall',
  'The Crown Chamber',
];

export const PALETTE = {
  floorA: '#2b2620',
  floorB: '#332c24',
  wall: '#1c2733',
  wallTrim: '#c9a227',
  caseGlass: '#3d5566',
  caseEdge: '#7fa3b8',
  ropePost: '#8c1f28',
  ropeCord: '#b03040',
  lootGlow: '#ffd94d',
  exitGreen: '#37d67a',
  exitLocked: '#6b7280',
  coneCalm: 'rgba(255, 214, 64, 0.20)',
  coneSuspicious: 'rgba(255, 140, 40, 0.28)',
  coneChase: 'rgba(255, 60, 60, 0.32)',
  coneCamera: 'rgba(255, 70, 70, 0.20)',
  coneCameraOff: 'rgba(120, 120, 120, 0.10)',
  thief: '#151a24',
  thiefTrim: '#c9a227',
  guard: '#22304a',
  guardTrim: '#d8b45a',
  hudBand: 'rgba(8, 10, 16, 0.82)',
  hudText: '#f2ead8',
  hudMuted: '#a89f8a',
};
