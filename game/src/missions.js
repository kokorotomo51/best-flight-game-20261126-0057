// Missions: what "done" means, where the rings and strips are, and what a
// sortie scores. The world owns the airframe; a mission owns the goal.

import { ALDER_STRIP, HOME_STRIP } from './terrain.js';
import { MISSIONS } from './config.js';

export const MISSION_DONE = 1;
export const MISSION_FAILED = 2;

function ringCourse(terrain, kind, seed) {
  const rings = [];
  if (kind === 'rings') {
    for (let i = 0; i < MISSIONS.rings.ringCount; i += 1) {
      const z = 420 + i * 390;
      const x = terrain.courseX(z);
      const y = terrain.heightAt(x, z) + 30 + 8 * Math.sin(i * 1.3 + seed);
      rings.push({ x, y, z, r: 13, passed: false, index: i });
    }
  } else if (kind === 'courier') {
    // Beacons, not gates: wide rings that mark the route to Alder.
    const stops = [900, 2200, 3600, 4900];
    stops.forEach((z, i) => {
      const x = terrain.courseX(z);
      rings.push({ x, y: terrain.heightAt(x, z) + 55, z, r: 26, passed: false, index: i, beacon: true });
    });
  } else {
    // Canyon gates hug the valley floor, between the walls.
    for (let i = 0; i < MISSIONS.canyon.ringCount; i += 1) {
      const z = 500 + i * 520;
      const x = terrain.courseX(z);
      rings.push({ x, y: terrain.heightAt(x, z) + 20, z, r: 12, passed: false, index: i });
    }
  }
  return rings;
}

export function createMission(kind, terrain, seed) {
  const def = MISSIONS[kind];
  const rings = ringCourse(terrain, kind, seed);
  const mission = {
    kind,
    def,
    rings,
    nextRing: 0,
    score: 0,
    time: 0,
    started: false,
    done: false,
    failed: false,
    message: '',
    messageUntil: 0,
    landingQuality: 0,
    ringsHit: 0,
    startTime: 0,
  };

  function spawn() {
    if (kind === 'courier') {
      return { x: HOME_STRIP.x, y: HOME_STRIP.elev + 1.1, z: 60, speed: 0, throttle: 0, fuel: def.fuel, onGround: true };
    }
    const z = 120;
    return {
      x: terrain.courseX(z),
      y: terrain.heightAt(terrain.courseX(z), z) + 60,
      z,
      speed: 58,
      throttle: 0.62,
      fuel: def.fuel,
      onGround: false,
    };
  }

  function say(text, now, seconds = 3.2) {
    mission.message = text;
    mission.messageUntil = now + seconds;
  }

  function begin(now) {
    mission.started = true;
    mission.startTime = now;
    mission.time = 0;
    say(kind === 'courier' ? 'Full throttle, rotate at 65 knots. Follow the beacons.' : 'Fly the course. Smooth hands win.', now, 4);
  }

  // A crossing counts when the plane passes the ring's z-plane inside its
  // radius: prevZ is where the plane was last step, z is where it is now.
  function crossedRing(plane, ring) {
    if (plane.prevZ === undefined || plane.prevZ >= ring.z || plane.z < ring.z) return false;
    return Math.hypot(plane.x - ring.x, plane.y - ring.y) <= ring.r;
  }

  // Called every step with the airframe state; returns MISSION_DONE / MISSION_FAILED / 0.
  function update(plane, now, dt, events) {
    if (!mission.started) return 0;
    mission.time = now - mission.startTime;

    const ring = rings[mission.nextRing];
    if (ring && crossedRing(plane, ring)) {
      ring.passed = true;
      mission.nextRing += 1;
      mission.ringsHit += 1;
      const points = ring.beacon ? 60 : 150;
      mission.score += points;
      say(ring.beacon ? `Beacon ${mission.ringsHit} of ${rings.length}.` : `Ring ${mission.ringsHit} of ${rings.length}! +${points}`, now);
      mission.lastRingAt = now;
    }

    if (events.touchdown) {
      mission.landingQuality = events.touchdownQuality;
      if (kind === 'courier') {
        const nearAlder = Math.abs(plane.z - (ALDER_STRIP.z0 + ALDER_STRIP.z1) / 2) < 220;
        if (nearAlder && mission.nextRing >= rings.length) {
          const soft = Math.round(mission.landingQuality * 400);
          const fuelBonus = Math.round(plane.fuel * 2);
          mission.score += soft + fuelBonus;
          mission.done = true;
          say(`Delivery complete. Touchdown +${soft}, fuel +${fuelBonus}.`, now, 6);
          return MISSION_DONE;
        }
        if (nearAlder) {
          say('Alder strip — but the beacons are not all flown. Go around.', now, 4);
        } else {
          say('Down safe at Pinefield. Throttle up to go again.', now, 3.5);
        }
      } else {
        say('Touchdown. Throttle up and climb away to keep flying.', now, 3);
      }
    }

    if (events.crashed) {
      mission.failed = true;
      return MISSION_FAILED;
    }

    // Time bonus at the last ring, and the ceiling rule in the canyon.
    if (mission.nextRing >= rings.length && kind !== 'courier') {
      const bonus = Math.max(0, Math.round((def.parSeconds - mission.time) * 5));
      mission.score += bonus;
      mission.done = true;
      say(`Course complete! Time bonus +${bonus}.`, now, 6);
      return MISSION_DONE;
    }
    if (kind === 'canyon') {
      const ground = events.groundHeight;
      const above = plane.y - ground;
      if (above > def.ceiling && plane.speed > 20) {
        mission.ceilingWarned = true;
      }
    }
    return 0;
  }

  function objectiveLine() {
    if (kind === 'rings' || kind === 'canyon') {
      return `Rings ${mission.ringsHit}/${rings.length}  •  Score ${mission.score}`;
    }
    return `Beacons ${mission.ringsHit}/${rings.length}  •  Land at Alder  •  Score ${mission.score}`;
  }

  // State and behaviour in one object: the renderer reads the state, the
  // loop calls the methods, the screenshots stage it directly.
  mission.spawn = spawn;
  mission.begin = begin;
  mission.update = update;
  mission.say = say;
  mission.objectiveLine = objectiveLine;
  return mission;
}
