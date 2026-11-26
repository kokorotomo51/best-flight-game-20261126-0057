// Tuning for Ridgeline Courier: speeds in m/s, angles in radians, fuel in percent.
// One place for every number a designer would argue about.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HORIZON_Y = 318;

export const STEP = 1 / 60;
export const GRAVITY = 9.8;

export const MAX_SPEED = 96;
export const CRUISE_SPEED = 62;
export const STALL_SPEED = 27;
export const TAKEOFF_SPEED = 34;
export const MAX_BANK = 1.05;
export const MAX_PITCH = 0.44;
export const ROLL_RATE = 2.6;
export const PITCH_RATE = 1.5;

export const CAM_DIST = 9.5;
export const CAM_HEIGHT = 3.4;
export const NEAR_Z = 7;
export const FAR_Z = 950;

export const FUEL_BURN_IDLE = 0.2;
export const FUEL_BURN_FULL = 0.9;
export const FUEL_START = 100;

export const BEST_KEY = 'ridgeline-courier-best-v1';

// Mission catalogue. kind is the key the title screen and ?shot= use.
export const MISSIONS = {
  rings: {
    kind: 'rings',
    name: 'RING RUN',
    tag: 'Valley slalom',
    brief: 'Thread 10 gold rings down the valley. Smooth throttle, gentle banks, beat the clock.',
    parSeconds: 150,
    ringCount: 10,
    fuel: 100,
  },
  courier: {
    kind: 'courier',
    name: 'COURIER',
    tag: 'Mountain delivery',
    brief: 'Take off from Pinefield, follow the beacons, and put her down soft on the high strip at Alder.',
    parSeconds: 240,
    ringCount: 4,
    fuel: 100,
  },
  canyon: {
    kind: 'canyon',
    name: 'CANYON DASH',
    tag: 'Low and fast',
    brief: 'Stay under the ceiling, thread 8 gates, and mind the fuel. The walls do not forgive.',
    parSeconds: 170,
    ringCount: 8,
    fuel: 78,
    ceiling: 46,
  },
};

// The palette: one golden-morning style for sky, land and instruments.
export const PALETTE = {
  skyTop: '#2e6db4',
  skyMid: '#7fb2dd',
  skyHorizon: '#f6cf8e',
  sun: '#fff3c4',
  sunCore: '#fffbe8',
  cloud: 'rgba(255, 251, 240, 0.92)',
  haze: '#e8d9b4',
  grass: '#5d8a3c',
  grassDry: '#8aa04b',
  forest: '#3e6b2f',
  rock: '#7d7468',
  rockDark: '#5f574e',
  snow: '#eef1f4',
  sand: '#c9b078',
  water: '#3f7fae',
  waterDeep: '#2c5f88',
  asphalt: '#4a4a50',
  asphaltLine: '#e8e6da',
  ringGold: '#ffc93c',
  ringGlow: '#ffdf7e',
  beacon: '#ff7847',
  hudAmber: '#ffb648',
  hudCyan: '#7fe3ff',
  hudGreen: '#8dff6a',
  hudRed: '#ff5a4e',
  hudWhite: '#f4f8ff',
  panel: '#14181f',
  panelEdge: '#2a3140',
};
