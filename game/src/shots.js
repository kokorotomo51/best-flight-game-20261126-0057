// Staged scenes for the screenshots: real renders of the game's own code,
// set up deterministically so the same seed always paints the same frame.
// ?shot=start|play|landing|end with &seed=N. The page paints twice and sets
// window.__shotReady, the way the kit's starter does.

import { ALDER_STRIP, HOME_STRIP } from './terrain.js';
import { STEP } from './config.js';

export function stageShot(name, world) {
  const { plane, mission, terrain } = world;
  const place = (x, y, z, heading, speed, throttle) => {
    plane.x = x;
    plane.y = y;
    plane.z = z;
    plane.heading = heading;
    plane.pitch = 0;
    plane.bank = 0;
    plane.speed = speed;
    plane.throttle = throttle;
    plane.fuel = 100;
    plane.damage = 0;
    plane.onGround = false;
    plane.crashed = false;
  };

  if (name === 'start') {
    // Title screen: the courier parked on the home runway at dawn.
    world.setMission('courier');
    const s = world.mission.spawn();
    plane.x = s.x;
    plane.y = s.y;
    plane.z = s.z;
    plane.heading = 0;
    plane.speed = 0;
    plane.throttle = 0;
    plane.onGround = true;
    plane.fuel = 100;
    return { screen: 'title', selected: 'courier' };
  }

  if (name === 'play') {
    // Mid-flight on the ring run: one ring banked, the next dead ahead.
    world.setMission('rings');
    world.mission.begin(0);
    const ring = world.mission.rings[1];
    world.mission.rings[0].passed = true;
    world.mission.nextRing = 1;
    world.mission.ringsHit = 1;
    world.mission.score = 150;
    place(ring.x - 6, ring.y + 4, ring.z - 150, 0.03, 62, 0.62);
    world.mission.say('Ring 2 of 10 — thread it clean.', 0, 999);
    for (let i = 0; i < 24; i += 1) world.stepWorld(STEP, { pitch: 0, roll: 0.04, throttle: 0 });
    return { screen: 'play' };
  }

  if (name === 'landing') {
    // Final approach to the high strip: runway ahead, beacons flown.
    world.setMission('courier');
    world.mission.begin(0);
    world.mission.rings.forEach((r) => {
      r.passed = true;
    });
    world.mission.nextRing = world.mission.rings.length;
    world.mission.ringsHit = world.mission.rings.length;
    world.mission.score = 240;
    const mid = (ALDER_STRIP.z0 + ALDER_STRIP.z1) / 2;
    place(ALDER_STRIP.x + 4, ALDER_STRIP.elev + 30, mid - 120, 0, 52, 0.42);
    plane.pitch = -0.1;
    world.mission.say('FINAL — Alder strip ahead. Ease her down.', 0, 999);
    for (let i = 0; i < 12; i += 1) world.stepWorld(STEP, { pitch: -0.06, roll: 0, throttle: 0 });
    return { screen: 'play' };
  }

  // 'end': the delivery complete, parked on the high strip.
  world.setMission('courier');
  world.mission.begin(0);
  world.mission.rings.forEach((r) => {
    r.passed = true;
  });
  world.mission.nextRing = world.mission.rings.length;
  world.mission.ringsHit = world.mission.rings.length;
  world.mission.score = 812;
  world.mission.done = true;
  world.mission.time = 196;
  const s = { x: ALDER_STRIP.x, y: ALDER_STRIP.elev + 1.1, z: (ALDER_STRIP.z0 + ALDER_STRIP.z1) / 2 };
  plane.x = s.x;
  plane.y = s.y;
  plane.z = s.z;
  plane.heading = 0;
  plane.speed = 0;
  plane.throttle = 0;
  plane.onGround = true;
  plane.fuel = 61;
  void HOME_STRIP;
  void terrain;
  return { screen: 'complete' };
}
