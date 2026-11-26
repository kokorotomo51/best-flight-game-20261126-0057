// The valley: one heightfield for the whole course, from the home runway at
// z=0 to the high strip at z=6000. Everything is a pure function of (x, z)
// and the seed, so the world never changes under the pilot.

import { createValueNoise } from './random.js';

export const WATER_LEVEL = 2.6;
export const HOME_STRIP = { x: 0, z0: 0, z1: 300, elev: 4 };
export const ALDER_STRIP = { x: -40, z0: 5800, z1: 6060, elev: 34 };

export function createTerrain(seed) {
  const fbm = createValueNoise(seed);
  const phaseA = (seed % 97) * 0.13;
  const phaseB = (seed % 53) * 0.21;

  // The river meanders down the valley; the course line follows the valley.
  function riverX(z) {
    return 62 * Math.sin(z * 0.0016 + phaseA) + 26 * Math.sin(z * 0.0041 + phaseB);
  }
  function courseX(z) {
    return 46 * Math.sin(z * 0.0011 + 1.7 + phaseA * 0.2) + 18 * Math.sin(z * 0.0033 + phaseB);
  }

  function blend(edge0, edge1, v) {
    const t = Math.min(1, Math.max(0, (v - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function stripBlend(x, z, strip) {
    const dz = z < strip.z0 ? strip.z0 - z : z > strip.z1 ? z - strip.z1 : 0;
    const dx = Math.abs(x - strip.x) - 17;
    return 1 - blend(0, 60, Math.max(dz, dx));
  }

  function rawHeight(x, z) {
    // Valley walls rise with |x|; rolling hills and sharp peaks texture the floor.
    const wall = Math.pow(Math.abs(x) / 230, 2.3) * 95;
    const hills = 15 * fbm(x * 0.008 + 3.1, z * 0.008, 3);
    const detail = 6 * fbm(x * 0.031, z * 0.031 + 7.7, 2);
    const peaks = 60 * Math.pow(Math.max(0, fbm(x * 0.004 + 9.2, z * 0.004, 3)), 3);
    let h = 7 + wall + hills + detail + peaks;
    // Carve the river channel down to the water.
    const riverD = Math.abs(x - riverX(z));
    const carve = 1 - blend(6, 20, riverD);
    h = h * (1 - carve) + (WATER_LEVEL - 1.6) * carve;
    // Flatten the two airstrips into their pads.
    const home = stripBlend(x, z, HOME_STRIP);
    h = h * (1 - home) + HOME_STRIP.elev * home;
    const alder = stripBlend(x, z, ALDER_STRIP);
    h = h * (1 - alder) + ALDER_STRIP.elev * alder;
    return h;
  }

  function heightAt(x, z) {
    return rawHeight(x, z);
  }

  // What the ground is made of at (x, z): drives the paint, not just the shape.
  function groundKind(x, z) {
    const h = rawHeight(x, z);
    const home = stripBlend(x, z, HOME_STRIP);
    const alder = stripBlend(x, z, ALDER_STRIP);
    if (home > 0.86 || alder > 0.86) {
      const strip = home > alder ? HOME_STRIP : ALDER_STRIP;
      const dx = Math.abs(x - strip.x);
      if (dx < 15 && z >= strip.z0 - 4 && z <= strip.z1 + 4) return 'asphalt';
      return 'dirt';
    }
    if (h <= WATER_LEVEL + 0.15 && Math.abs(x - riverX(z)) < 22) return 'water';
    if (h <= WATER_LEVEL + 1.2) return 'sand';
    const slope = Math.abs(rawHeight(x + 6, z) - h) + Math.abs(rawHeight(x, z + 6) - h);
    if (h > 78) return 'snow';
    if (slope > 9 || h > 55) return 'rock';
    if (fbm(x * 0.05 + 11, z * 0.05, 2) > 0.28) return 'forest';
    return fbm(x * 0.013 + 5, z * 0.013, 2) > 0.1 ? 'grassDry' : 'grass';
  }

  return { heightAt, groundKind, riverX, courseX, stripBlend };
}
