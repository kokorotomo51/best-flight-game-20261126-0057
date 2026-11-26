// The picture: a chase view over a voxel-strip valley. Sky, sun and clouds,
// then terrain painted far-to-near into a column buffer, then rings, then the
// aircraft itself, fixed on the screen while the world streams past it.

import {
  CAM_DIST,
  CAM_HEIGHT,
  FAR_Z,
  HORIZON_Y,
  NEAR_Z,
  PALETTE,
  VIEW_H,
  VIEW_W,
} from './config.js';
import { ALDER_STRIP, HOME_STRIP, WATER_LEVEL } from './terrain.js';

const FOCAL = (VIEW_H / 2) / Math.tan((35 * Math.PI) / 180);

function mixHex(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

export function createRenderer(canvas, terrain) {
  const ctx = canvas.getContext('2d');
  const ybuffer = new Float32Array(VIEW_W);
  let camHeading = 0;
  let camPitch = 0;
  let shake = 0;

  const clouds = [];
  {
    let s = 1234567;
    const rnd = () => {
      s = (Math.imul(s ^ (s >>> 15), 2246822519) ^ 61) >>> 0;
      s ^= s >>> 14;
      return ((s ^ (s >>> 7)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 26; i += 1) {
      clouds.push({ x: (rnd() - 0.5) * 900, y: 120 + rnd() * 160, z: rnd() * 1000, s: 26 + rnd() * 42 });
    }
  }

  function project(cam, x, y, z) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;
    const cosH = Math.cos(cam.heading);
    const sinH = Math.sin(cam.heading);
    const X = dx * cosH - dz * sinH;
    let Z = dx * sinH + dz * cosH;
    let Y = dy;
    const cosP = Math.cos(cam.pitch);
    const sinP = Math.sin(cam.pitch);
    const Y2 = Y * cosP - Z * sinP;
    Z = Y * sinP + Z * cosP;
    Y = Y2;
    if (Z < 0.6) return null;
    return { sx: VIEW_W / 2 + (X * FOCAL) / Z, sy: VIEW_H / 2 - (Y * FOCAL) / Z, z: Z, X };
  }

  function cameraFor(plane, dt) {
    const targetHeading = plane.heading;
    let dh = targetHeading - camHeading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    camHeading += dh * Math.min(1, dt * 4);
    const targetPitch = plane.pitch * 0.4;
    camPitch += (targetPitch - camPitch) * Math.min(1, dt * 3);
    const fx = Math.sin(camHeading);
    const fz = Math.cos(camHeading);
    return {
      x: plane.x - fx * CAM_DIST,
      y: plane.y + CAM_HEIGHT,
      z: plane.z - fz * CAM_DIST,
      heading: camHeading,
      pitch: camPitch,
    };
  }

  function drawSky(time) {
    // Base the whole frame in horizon haze: any pixel the terrain sweep
    // never reaches still reads as warm distance, never as black.
    ctx.fillStyle = PALETTE.skyHorizon;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 60);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, HORIZON_Y + 60);
    // Sun with a soft halo.
    const sunX = VIEW_W * 0.78;
    const sunY = 118;
    const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 130);
    halo.addColorStop(0, 'rgba(255, 246, 200, 0.95)');
    halo.addColorStop(0.25, 'rgba(255, 238, 170, 0.55)');
    halo.addColorStop(1, 'rgba(255, 238, 170, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
    ctx.fill();
    void time;
  }

  function drawClouds(cam, time) {
    ctx.fillStyle = PALETTE.cloud;
    for (const cloud of clouds) {
      let z = cloud.z;
      while (z < cam.z - 60) z += 1000;
      const p = project(cam, cloud.x, cloud.y, z);
      if (!p) continue;
      const s = (cloud.s * FOCAL) / p.z;
      if (s < 3) continue;
      const drift = Math.sin(time * 0.11 + cloud.x * 0.01) * 4;
      ctx.globalAlpha = Math.min(0.9, Math.max(0.25, 1 - p.z / 1000));
      ctx.beginPath();
      ctx.ellipse(p.sx + drift, p.sy, s, s * 0.34, 0, 0, Math.PI * 2);
      ctx.ellipse(p.sx + drift - s * 0.7, p.sy + s * 0.1, s * 0.6, s * 0.24, 0, 0, Math.PI * 2);
      ctx.ellipse(p.sx + drift + s * 0.7, p.sy + s * 0.08, s * 0.65, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function terrainColor(kind, x, z, h, time) {
    let base;
    if (kind === 'water') {
      const shimmer = 0.5 + 0.5 * Math.sin(time * 1.7 + x * 0.45 + z * 0.05);
      base = mixHex(PALETTE.waterDeep, PALETTE.water, 0.35 + shimmer * 0.4);
    } else if (kind === 'asphalt') {
      base = PALETTE.asphalt;
      const strip = Math.abs(z - HOME_STRIP.z0) < 320 || z < HOME_STRIP.z1 + 40 ? HOME_STRIP : ALDER_STRIP;
      const dx = Math.abs(x - strip.x);
      if (dx < 1.1 && Math.floor(z / 44) % 2 === 0) base = PALETTE.asphaltLine;
      if (dx > 12.4 && dx < 14.6) base = PALETTE.asphaltLine;
      if (z > strip.z0 && z < strip.z0 + 14) base = dx < 13 ? PALETTE.asphaltLine : base;
    } else if (kind === 'sand') base = PALETTE.sand;
    else if (kind === 'forest') base = PALETTE.forest;
    else if (kind === 'rock') base = mixHex(PALETTE.rockDark, PALETTE.rock, 0.5 + 0.5 * Math.sin(x * 0.4 + z * 0.3));
    else if (kind === 'snow') base = PALETTE.snow;
    else if (kind === 'grassDry') base = PALETTE.grassDry;
    else if (kind === 'dirt') base = '#8a7a5c';
    else base = PALETTE.grass;
    void h;
    return base;
  }

  function drawTerrain(cam, time) {
    ybuffer.fill(VIEW_H);
    const cosH = Math.cos(cam.heading);
    const sinH = Math.sin(cam.heading);
    let z = NEAR_Z;
    // Columns span the whole view frustum: half-width = z * (half screen /
    // focal length), with a small margin so the ground meets the screen
    // edges at every depth instead of pinching to the middle.
    const samples = 120;
    const spreadFactor = (VIEW_W / 2 + 24) / FOCAL;
    while (z < FAR_Z) {
      const spread = z * spreadFactor;
      const stepX = (spread * 2) / samples;
      let prevSx = null;
      let prevSy = null;
      let prevCol = 0;
      for (let i = 0; i <= samples; i += 1) {
        const offX = -spread + i * stepX;
        const wx = cam.x + offX * cosH + z * sinH;
        const wz = cam.z - offX * sinH + z * cosH;
        const h = terrain.heightAt(wx, wz);
        const kind = terrain.groundKind(wx, wz);
        const p = project(cam, wx, h, wz);
        if (!p) {
          prevSx = null;
          continue;
        }
        const hazeT = Math.min(0.78, Math.max(0, (z - 130) / 720));
        let color = terrainColor(kind, wx, wz, h, time);
        if (hazeT > 0) color = mixHex(color.startsWith('#') ? color : '#5d8a3c', PALETTE.haze, hazeT);
        if (prevSx !== null) {
          // Paint the strip column by column, interpolating the top edge
          // between the two samples: a strip drawn at one constant height
          // leaves triangular gaps against the next row, which read as a
          // checkerboard in the distance.
          const x0 = Math.max(0, Math.floor(Math.min(prevSx, p.sx)));
          const x1 = Math.min(VIEW_W - 1, Math.ceil(Math.max(prevSx, p.sx)));
          ctx.fillStyle = color;
          for (let c = x0; c <= x1; c += 1) {
            const t = (c - prevSx) / (p.sx - prevSx || 1);
            const top = prevSy + (p.sy - prevSy) * Math.max(0, Math.min(1, t));
            if (top < ybuffer[c]) {
              ctx.fillRect(c, top, 1, ybuffer[c] - top);
              ybuffer[c] = top;
            }
          }
          void prevCol;
        }
        prevSx = p.sx;
        prevSy = p.sy;
      }
      void prevSy;
      z = z * 1.055 + 0.6;
    }
  }

  // True line-of-sight: is the point hidden by terrain between the camera
  // and it? The column buffer cannot answer that — it holds the skyline,
  // the highest terrain anywhere along the column, so a ring flying in
  // front of a distant mountain would be culled as "behind" it.
  function occluded(cam, x, y, z) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 9;
      if (terrain.heightAt(cam.x + dx * t, cam.z + dz * t) > cam.y + dy * t + 1.5) return true;
    }
    return false;
  }

  function drawRing(ring, cam, isNext, time) {
    const p = project(cam, ring.x, ring.y, ring.z);
    if (!p || p.z < 3) return;
    if (occluded(cam, ring.x, ring.y, ring.z)) return;
    const rx = (ring.r * FOCAL) / p.z;
    const ry = rx * 0.96;
    const pulse = isNext ? 1 + 0.045 * Math.sin(time * 4) : 1;
    ctx.save();
    ctx.translate(p.sx, p.sy);
    ctx.scale(pulse, pulse);
    if (isNext) {
      // Light pillar above the next ring, so it reads from far away.
      const grad = ctx.createLinearGradient(0, -ry * 5, 0, 0);
      grad.addColorStop(0, 'rgba(255, 201, 60, 0)');
      grad.addColorStop(1, 'rgba(255, 201, 60, 0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(-3, -ry * 5, 6, ry * 5);
      ctx.fillStyle = PALETTE.ringGold;
      ctx.beginPath();
      ctx.moveTo(0, -ry - 26);
      ctx.lineTo(9, -ry - 12);
      ctx.lineTo(0, -ry - 4);
      ctx.lineTo(-9, -ry - 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineWidth = Math.max(2.5, rx * 0.14);
    ctx.strokeStyle = ring.beacon ? PALETTE.beacon : PALETTE.ringGold;
    ctx.globalAlpha = ring.passed ? 0.25 : 0.92;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = ring.passed ? 0.15 : 1;
    ctx.lineWidth = Math.max(1.5, rx * 0.05);
    ctx.strokeStyle = PALETTE.ringGlow;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Chevrons pointing in.
    ctx.fillStyle = ring.beacon ? PALETTE.beacon : PALETTE.ringGlow;
    for (let k = 0; k < 4; k += 1) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const cxp = Math.cos(a) * rx * 0.82;
      const cyp = Math.sin(a) * ry * 0.82;
      ctx.save();
      ctx.translate(cxp, cyp);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 4);
      ctx.lineTo(-5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawApproachLights(cam, time) {
    for (const strip of [HOME_STRIP, ALDER_STRIP]) {
      for (let i = 0; i < 6; i += 1) {
        const z = strip.z0 + 14 + i * 44;
        for (const side of [-14.5, 14.5]) {
          const p = project(cam, strip.x + side, strip.elev + 0.6, z);
          if (!p || occluded(cam, strip.x + side, strip.elev + 0.6, z)) continue;
          const tw = 0.5 + 0.5 * Math.sin(time * 3 + i);
          ctx.fillStyle = `rgba(255, 220, 130, ${0.35 + tw * 0.55})`;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, Math.max(2, 140 / p.z), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawAircraft(plane, time) {
    if (plane.crashed) return;
    const bob = Math.sin(time * 2.1) * 1.6;
    const vib = plane.speed > 70 ? Math.sin(time * 47) * 0.7 : 0;
    const px = VIEW_W / 2;
    const py = VIEW_H * 0.64 + bob + vib - plane.pitch * 60;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-plane.bank * 0.9);
    const S = 1.05;

    // Far wing.
    ctx.fillStyle = '#c65a1e';
    ctx.beginPath();
    ctx.moveTo(-14 * S, -6 * S);
    ctx.lineTo(-96 * S, -30 * S);
    ctx.lineTo(-100 * S, -18 * S);
    ctx.lineTo(-16 * S, 6 * S);
    ctx.closePath();
    ctx.fill();
    // Tailplane and fin.
    ctx.fillStyle = '#e0701f';
    ctx.beginPath();
    ctx.moveTo(-8 * S, 34 * S);
    ctx.lineTo(-34 * S, 44 * S);
    ctx.lineTo(-30 * S, 34 * S);
    ctx.lineTo(-8 * S, 26 * S);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 30 * S);
    ctx.lineTo(4 * S, 8 * S);
    ctx.lineTo(12 * S, 30 * S);
    ctx.closePath();
    ctx.fill();
    // Fuselage: cream belly, orange back, panel lines.
    const body = ctx.createLinearGradient(0, -14 * S, 0, 20 * S);
    body.addColorStop(0, '#f08a2e');
    body.addColorStop(0.55, '#e0701f');
    body.addColorStop(1, '#f7e8c8');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -46 * S);
    ctx.quadraticCurveTo(11 * S, -30 * S, 11 * S, -6 * S);
    ctx.quadraticCurveTo(11 * S, 22 * S, 4 * S, 40 * S);
    ctx.quadraticCurveTo(0, 44 * S, -4 * S, 40 * S);
    ctx.quadraticCurveTo(-11 * S, 22 * S, -11 * S, -6 * S);
    ctx.quadraticCurveTo(-11 * S, -30 * S, 0, -46 * S);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 40, 8, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10 * S, -18 * S);
    ctx.quadraticCurveTo(0, -14 * S, 10 * S, -18 * S);
    ctx.moveTo(-11 * S, 6 * S);
    ctx.quadraticCurveTo(0, 10 * S, 11 * S, 6 * S);
    ctx.stroke();
    // Canopy glass with a glint.
    const glass = ctx.createLinearGradient(-8 * S, -30 * S, 8 * S, -8 * S);
    glass.addColorStop(0, '#bfe8ff');
    glass.addColorStop(0.5, '#3f7fae');
    glass.addColorStop(1, '#173a52');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.ellipse(0, -20 * S, 6.5 * S, 12 * S, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-2.5 * S, -26 * S, 2 * S, 5 * S, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Propeller: blurred disc + spinner, spinning with throttle.
    const propA = time * (6 + plane.throttle * 30);
    ctx.fillStyle = 'rgba(40, 44, 52, 0.28)';
    ctx.save();
    ctx.translate(0, -48 * S);
    ctx.rotate(propA);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4 * S, 20 * S, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2a2e36';
    ctx.beginPath();
    ctx.arc(0, -48 * S, 4 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7e8c8';
    ctx.beginPath();
    ctx.arc(0, -48 * S, 1.8 * S, 0, Math.PI * 2);
    ctx.fill();
    // Near wing with navigation light.
    ctx.fillStyle = '#e0701f';
    ctx.beginPath();
    ctx.moveTo(14 * S, -6 * S);
    ctx.lineTo(96 * S, -30 * S);
    ctx.lineTo(100 * S, -18 * S);
    ctx.lineTo(16 * S, 6 * S);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8dff6a';
    ctx.beginPath();
    ctx.arc(96 * S, -25 * S, 3 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.arc(-96 * S, -25 * S, 3 * S, 0, Math.PI * 2);
    ctx.fill();
    // Registration and courier stripe.
    ctx.fillStyle = '#3a2410';
    ctx.font = `700 ${11 * S}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('N7RC', 0, 30 * S);
    ctx.fillStyle = 'rgba(247, 232, 200, 0.85)';
    ctx.fillRect(-11 * S, -2 * S, 22 * S, 3 * S);
    ctx.restore();
  }

  function drawCrashDebris(particles, cam) {
    for (const p of particles) {
      const proj = project(cam, p.x, p.y, p.z);
      if (!proj) continue;
      const life = p.life / p.maxLife;
      const size = Math.max(1, (p.size * FOCAL) / proj.z);
      if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(70, 66, 62, ${0.45 * life})`;
      } else if (p.kind === 'fire') {
        ctx.fillStyle = `rgba(255, ${Math.round(120 + 100 * life)}, 30, ${0.85 * life})`;
      } else {
        ctx.fillStyle = `rgba(40, 36, 32, ${life})`;
      }
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy, size * (p.kind === 'smoke' ? 2.4 - life : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function addShake(amount) {
    shake = Math.min(18, shake + amount);
  }

  function draw(plane, mission, screen, particles, time, dt) {
    ctx.save();
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= Math.max(0, 1 - dt * 3);
    }
    const cam = cameraFor(plane, dt);
    drawSky(time);
    drawClouds(cam, time);
    drawTerrain(cam, time);
    drawApproachLights(cam, time);
    const sorted = [...mission.rings].sort((a, b) => b.z - a.z);
    const nextRing = mission.rings[mission.nextRing];
    sorted.forEach((ring) => {
      if (!ring.passed) drawRing(ring, cam, ring === nextRing, time);
    });
    drawCrashDebris(particles, cam);
    drawAircraft(plane, time);
    ctx.restore();
    return cam;
  }

  return { draw, addShake, project, cameraFor, occluded };
}
