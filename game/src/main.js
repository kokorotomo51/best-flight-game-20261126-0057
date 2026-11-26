// Boot and the one loop: input every frame, the world in fixed 1/60 s steps,
// the renderer paints what is there. Screens: title, play, paused, over,
// complete. ?seed=N fixes the world; ?shot=start|play|landing|end stages a
// scene, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, MISSIONS, STEP, VIEW_H, VIEW_W } from './config.js';
import { createRng } from './random.js';
import { ALDER_STRIP, HOME_STRIP, createTerrain } from './terrain.js';
import { createAircraft } from './aircraft.js';
import { createMission } from './missions.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { drawEndScreen, drawHud, drawTitleScreen } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const PALETTE_RED = '#ff5a4e';
const PALETTE_GREEN = '#8dff6a';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const status = document.getElementById('status');
const terrain = createTerrain(seed);
const rng = createRng(seed);
const aircraft = createAircraft();
const plane = aircraft.state;
const renderer = createRenderer(canvas, terrain);
const input = createInput(canvas);
const audio = createAudio();

let mission = createMission('rings', terrain, seed);
let screen = 'title';
let selected = 'courier';
let particles = [];
let dyingUntil = 0;
let crashAt = 0;
let now = 0;
let bests = readBests();

function readBests() {
  const out = { rings: 0, courier: 0, canyon: 0 };
  try {
    for (const kind of Object.keys(out)) {
      out[kind] = Number.parseInt(window.localStorage.getItem(`${BEST_KEY}-${kind}`) ?? '0', 10) || 0;
    }
  } catch {
    // Storage off: bests last the visit only.
  }
  return out;
}

function saveBest(kind, score) {
  if (score <= bests[kind]) return;
  bests[kind] = score;
  try {
    window.localStorage.setItem(`${BEST_KEY}-${kind}`, String(score));
  } catch {
    // Ignore: storage off.
  }
}

function announce(message) {
  status.textContent = message;
}

function onRunway(x, z, groundH) {
  for (const strip of [HOME_STRIP, ALDER_STRIP]) {
    if (Math.abs(x - strip.x) < 15 && z >= strip.z0 - 10 && z <= strip.z1 + 10 && Math.abs(groundH - strip.elev) < 1.5) {
      return strip;
    }
  }
  return null;
}

function burst(x, y, z, count, kind) {
  for (let i = 0; i < count; i += 1) {
    const a = rng() * Math.PI * 2;
    const b = rng() * Math.PI - Math.PI / 2;
    const sp = 6 + rng() * 16;
    particles.push({
      x,
      y,
      z,
      vx: Math.cos(a) * Math.cos(b) * sp,
      vy: Math.abs(Math.sin(b)) * sp * 0.8 + 3,
      vz: Math.sin(a) * Math.cos(b) * sp,
      life: 0.7 + rng() * 0.9,
      maxLife: 1.6,
      size: kind === 'smoke' ? 3 + rng() * 4 : 1 + rng() * 2,
      kind,
    });
  }
}

function setMission(kind) {
  mission = createMission(kind, terrain, seed);
  selected = kind;
}

function startRun(kind) {
  setMission(kind);
  const s = mission.spawn();
  aircraft.reset(s);
  particles = [];
  crashAt = 0;
  dyingUntil = 0;
  screen = 'play';
  mission.begin(now);
  audio.resume();
  announce(`${MISSIONS[kind].name}. ${MISSIONS[kind].brief}`);
}

function endRun(kind, title) {
  screen = kind;
  saveBest(mission.kind, mission.score);
  announce(`${title}. Score ${mission.score}.`);
}

// One fixed world step. Input is steering intent; the mission judges the run.
function stepWorld(dt, steering) {
  plane.prevZ = plane.z;
  const groundH = terrain.heightAt(plane.x, plane.z);
  const strip = onRunway(plane.x, plane.z, groundH);
  aircraft.step(dt, steering, groundH, Boolean(strip));

  if (plane.onGround) {
    plane.y = groundH + 1.1;
    plane.heading += steering.roll * 0.45 * dt;
    if (plane.speed > 34 && steering.pitch > 0.25) {
      plane.onGround = false;
      plane.y += 0.6;
      mission.say('Airborne.', now, 2);
    }
  }

  const events = { groundHeight: groundH, touchdown: false, touchdownQuality: 0, crashed: false };
  const contactH = terrain.heightAt(plane.x, plane.z);
  if (plane.y <= contactH + 1.1 && !plane.crashed) {
    const res = aircraft.resolveGroundContact(contactH, Boolean(strip));
    if (res.event === 1) {
      events.touchdown = true;
      events.touchdownQuality = res.quality;
      audio.touchdownThump();
    } else if (res.event === 2 || res.event === 4) {
      events.crashed = true;
    } else if (res.event === 8) {
      // A glancing strike: damage, wings levelled, a bounce, and a warning.
      // One strike is survivable; three in quick succession are not.
      aircraft.damage(25);
      plane.bank *= 0.3;
      plane.y = contactH + 4;
      plane.pitch = 0.2;
      renderer.addShake(9);
      mission.say('TERRAIN STRIKE — damage 25%. Climb away.', now, 3);
      if (plane.damage >= 100) {
        plane.crashed = true;
        events.crashed = true;
      }
    }
  }

  if (events.crashed && !crashAt) {
    crashAt = now;
    dyingUntil = now + 1.4;
    burst(plane.x, plane.y, plane.z, 26, 'debris');
    burst(plane.x, plane.y, plane.z, 14, 'fire');
    burst(plane.x, plane.y, plane.z, 10, 'smoke');
    renderer.addShake(14);
    audio.crashNoise();
  }

  const outcome = mission.update(plane, now, dt, events);
  if (outcome === 1) {
    endRun('complete', 'MISSION COMPLETE');
  } else if (crashAt && now >= dyingUntil) {
    endRun('over', 'AIRCRAFT DOWN');
  }

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 6 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
  if (actions & ACTION_RESTART && (screen === 'play' || screen === 'paused' || screen === 'over' || screen === 'complete')) {
    startRun(mission.kind);
    return;
  }
  if (screen === 'title') {
    if (actions & ACTION_CONFIRM) startRun(selected);
    return;
  }
  if (screen === 'play') {
    if (actions & ACTION_PAUSE) {
      screen = 'paused';
      announce('Paused.');
    }
    return;
  }
  if (screen === 'paused') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = 'play';
      announce('Playing.');
    }
    return;
  }
  if (screen === 'over' || screen === 'complete') {
    if (actions & ACTION_CONFIRM) startRun(mission.kind);
  }
}

function handleTitleKeys() {
  // Number keys pick a mission on the title screen; T returns to it.
  window.addEventListener('keydown', (event) => {
    if (screen === 'title') {
      if (event.key === '1') startRun('rings');
      else if (event.key === '2') startRun('courier');
      else if (event.key === '3') startRun('canyon');
    } else if ((screen === 'over' || screen === 'complete') && (event.key === 't' || event.key === 'T')) {
      screen = 'title';
      announce('Ridgeline Courier. Pick a mission.');
    }
  });
}

function frame(stepNow) {
  requestAnimationFrame(frame);
  const dt = Math.min((stepNow - last) / 1000, MAX_FRAME);
  last = stepNow;
  now += dt;
  handleActions();
  if (screen === 'play' || screen === 'title') {
    accumulator += dt;
    while (accumulator >= STEP && (screen === 'play' || screen === 'title')) {
      if (screen === 'play') {
        if (now < dyingUntil) {
          // The wreck is still burning: particles only.
          for (const p of particles) {
            p.x += p.vx * STEP;
            p.y += p.vy * STEP;
            p.z += p.vz * STEP;
            p.vy -= 6 * STEP;
            p.life -= STEP;
          }
          particles = particles.filter((p) => p.life > 0);
        } else {
          stepWorld(STEP, input.steering());
        }
      } else {
        // Idle drift on the title screen: the parked plane waits.
      }
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }
  audio.update(plane.throttle, plane.speed, screen === 'play');

  const ctx = canvas.getContext('2d');
  renderer.draw(plane, mission, screen, particles, now, dt);
  if (screen === 'title') {
    drawTitleScreen(ctx, bests, selected, now);
  } else if (screen === 'play' || screen === 'paused') {
    drawHud(ctx, plane, mission, screen, now);
  } else if (screen === 'complete') {
    drawHud(ctx, plane, mission, screen, now);
    drawEndScreen(ctx, 'MISSION COMPLETE', [
      `${MISSIONS[mission.kind].name}  •  Score ${mission.score}  •  Time ${Math.round(mission.time)}s`,
      `Rings ${mission.ringsHit}/${mission.rings.length}  •  Fuel ${Math.round(plane.fuel)}% left`,
      bests[mission.kind] >= mission.score ? `Best ${bests[mission.kind]}` : 'New best!',
    ], PALETTE_GREEN);
  } else if (screen === 'over') {
    drawHud(ctx, plane, mission, screen, now);
    drawEndScreen(ctx, 'AIRCRAFT DOWN', [
      `${MISSIONS[mission.kind].name}  •  Score ${mission.score}`,
      `Rings ${mission.ringsHit}/${mission.rings.length} before the crash`,
      'The valley keeps what it catches. Fly it again, smoother.',
    ], PALETTE_RED);
  }
}

let accumulator = 0;
let last = performance.now();

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') {
    screen = 'paused';
    announce('Paused.');
  }
});

function runShot(name) {
  const world = {
    plane,
    terrain,
    mission,
    particles,
    setMission(kind) {
      setMission(kind);
      world.mission = mission;
    },
    stepWorld,
  };
  world.mission = mission;
  const staged = stageShot(name, world);
  screen = staged.screen;
  if (staged.selected) selected = staged.selected;
  let painted = 0;
  function paint() {
    const ctx = canvas.getContext('2d');
    // A long dt snaps the smoothed chase camera to the staged plane at once.
    renderer.draw(plane, mission, screen, particles, 1.2, 0.5);
    if (screen === 'title') drawTitleScreen(ctx, bests, selected, 1.2);
    else if (screen === 'complete') {
      drawHud(ctx, plane, mission, screen, 1.2);
      drawEndScreen(ctx, 'MISSION COMPLETE', [
        `${MISSIONS[mission.kind].name}  •  Score ${mission.score}  •  Time ${Math.round(mission.time)}s`,
        `Rings ${mission.ringsHit}/${mission.rings.length}  •  Fuel ${Math.round(plane.fuel)}% left`,
        `Best ${Math.max(bests[mission.kind], mission.score)}`,
      ], PALETTE_GREEN);
    } else drawHud(ctx, plane, mission, screen, 1.2);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) {
  runShot(shot);
} else {
  // Park the courier on the home runway behind the title screen.
  setMission('courier');
  const s = mission.spawn();
  aircraft.reset(s);
  handleTitleKeys();
  announce('Ridgeline Courier. Press 1, 2 or 3, or click to fly.');
  requestAnimationFrame(frame);
}
