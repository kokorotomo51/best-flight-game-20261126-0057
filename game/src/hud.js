// The instruments: lit dials and tapes over a dashboard brow, plus the
// mission banner, the centre messages and the title / pause / end screens.
// Everything is drawn, nothing is DOM, so the screenshots show it all.

import { HORIZON_Y, MISSIONS, PALETTE, VIEW_H, VIEW_W } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dialFace(ctx, cx, cy, r, label) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#232a36');
  g.addColorStop(0.8, '#10141b');
  g.addColorStop(1, '#05070a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 182, 72, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = '700 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r - 9);
}

function drawArtificialHorizon(ctx, cx, cy, r, pitch, bank) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-bank);
  const shift = pitch * r * 1.6;
  ctx.fillStyle = '#4a86c4';
  ctx.fillRect(-r * 2, -r * 2 + shift, r * 4, r * 2);
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(-r * 2, shift, r * 4, r * 2);
  ctx.strokeStyle = 'rgba(244, 248, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 2, shift);
  ctx.lineTo(r * 2, shift);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(244, 248, 255, 0.45)';
  ctx.lineWidth = 1;
  for (const deg of [-10, 10]) {
    const y = shift - (deg * Math.PI / 180) * r * 1.6;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, y);
    ctx.lineTo(r * 0.45, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0);
  ctx.lineTo(-r * 0.18, 0);
  ctx.lineTo(0, -5);
  ctx.lineTo(r * 0.18, 0);
  ctx.lineTo(r * 0.55, 0);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.font = '700 15px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', cx, cy + r + 16);
}

function drawTape(ctx, x, y, w, h, value, unit, label, color) {
  ctx.fillStyle = 'rgba(10, 13, 18, 0.72)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '700 26px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(value)), x + w / 2, y + 36);
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.font = '700 11px ui-monospace, monospace';
  ctx.fillText(unit, x + w / 2, y + 54);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = '700 11px ui-monospace, monospace';
  ctx.fillText(label, x + w / 2, y + h - 8);
}

function drawCompass(ctx, cx, y, heading) {
  const w = 300;
  const h = 34;
  ctx.fillStyle = 'rgba(10, 13, 18, 0.72)';
  roundRect(ctx, cx - w / 2, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y, w, h);
  ctx.clip();
  const deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.font = '700 14px ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 10) {
    const tick = ((Math.round(deg / 10) * 10 + d) % 360 + 360) % 360;
    const off = (tick - deg) * 3.4;
    const x = cx + off;
    const label = tick === 0 ? 'N' : tick === 90 ? 'E' : tick === 180 ? 'S' : tick === 270 ? 'W' : String(tick).padStart(3, '0');
    ctx.fillText(label, x, y + 22);
    ctx.fillRect(x - 1, y + h - 6, 2, 5);
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx, y - 2);
  ctx.lineTo(cx - 6, y - 12);
  ctx.lineTo(cx + 6, y - 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillText(`HDG ${String(Math.round(deg)).padStart(3, '0')}°`, cx, y + h + 18);
}

function drawFuelThrottle(ctx, x, y, w, fuel, throttle, damage, engineOut) {
  ctx.fillStyle = 'rgba(10, 13, 18, 0.72)';
  roundRect(ctx, x, y, w, 64, 8);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.stroke();
  // Fuel bar.
  ctx.fillStyle = '#20262f';
  ctx.fillRect(x + 12, y + 14, w - 24, 10);
  const fuelColor = fuel < 20 ? PALETTE.hudRed : PALETTE.hudGreen;
  ctx.fillStyle = fuelColor;
  ctx.fillRect(x + 12, y + 14, (w - 24) * Math.max(0, fuel / 100), 10);
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.font = '700 11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(engineOut ? 'FUEL EMPTY' : `FUEL ${Math.round(fuel)}%`, x + 12, y + 38);
  // Throttle bar.
  ctx.fillStyle = '#20262f';
  ctx.fillRect(x + 12, y + 44, w - 24, 8);
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.fillRect(x + 12, y + 44, (w - 24) * throttle, 8);
  ctx.textAlign = 'right';
  ctx.fillText(`THR ${Math.round(throttle * 100)}%`, x + w - 12, y + 38);
  if (damage > 0) {
    ctx.fillStyle = damage > 50 ? PALETTE.hudRed : PALETTE.hudAmber;
    ctx.textAlign = 'center';
    ctx.fillText(`DAMAGE ${Math.round(damage)}%`, x + w / 2, y + 62);
  }
}

export function drawHud(ctx, plane, mission, screen, now) {
  // Dashboard brow along the bottom, holding the lit instruments.
  const dashY = VIEW_H - 118;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, dashY, VIEW_W, 118);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, dashY, VIEW_W, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let x = 20; x < VIEW_W; x += 46) {
    ctx.beginPath();
    ctx.arc(x, dashY + 10, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawArtificialHorizon(ctx, 92, dashY + 56, 44, plane.pitch, plane.bank);
  drawTape(ctx, 168, dashY + 12, 104, 92, plane.speed * 1.944, 'KTS', 'AIRSPEED', PALETTE.hudCyan);
  drawTape(ctx, 288, dashY + 12, 104, 92, plane.y * 3.281, 'FT', 'ALTITUDE', PALETTE.hudCyan);
  drawCompass(ctx, VIEW_W / 2, dashY + 16, plane.heading);
  drawTape(ctx, VIEW_W - 392, dashY + 12, 104, 92, plane.verticalSpeed * 196.85, 'FPM', 'VERT SPEED', plane.verticalSpeed < -8 ? PALETTE.hudRed : PALETTE.hudCyan);
  drawFuelThrottle(ctx, VIEW_W - 272, dashY + 26, 248, plane.fuel, plane.throttle, plane.damage, plane.engineOut);

  // Objective line, top centre.
  ctx.font = '700 17px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10, 13, 18, 0.6)';
  const line = mission.objectiveLine();
  const tw = ctx.measureText(line).width + 36;
  roundRect(ctx, VIEW_W / 2 - tw / 2, 14, tw, 30, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.fillText(line, VIEW_W / 2, 35);

  // Stall + ceiling warnings.
  if (plane.speed < 27 && !plane.onGround) {
    ctx.fillStyle = Math.sin(now * 8) > 0 ? PALETTE.hudRed : '#ffb0a8';
    ctx.font = '700 22px ui-monospace, monospace';
    ctx.fillText('STALL — NOSE DOWN, ADD POWER', VIEW_W / 2, 84);
  }
  if (mission.kind === 'canyon' && mission.ceilingWarned) {
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = '700 15px ui-monospace, monospace';
    ctx.fillText('CEILING — STAY LOW', VIEW_W / 2, 84);
  }

  // Centre message. Only while flying: on the end screens the same words
  // would sit behind the result panel.
  if (screen === 'play' && mission.message && now < mission.messageUntil) {
    ctx.font = '700 20px ui-monospace, monospace';
    const msg = mission.message;
    const mw = ctx.measureText(msg).width + 40;
    ctx.fillStyle = 'rgba(10, 13, 18, 0.62)';
    roundRect(ctx, VIEW_W / 2 - mw / 2, HORIZON_Y + 8, mw, 34, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.fillText(msg, VIEW_W / 2, HORIZON_Y + 31);
  }

  if (screen === 'paused') {
    ctx.fillStyle = 'rgba(8, 10, 14, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = PALETTE.hudWhite;
    ctx.font = '700 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 8);
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillText('P or click to resume  •  R to restart', VIEW_W / 2, VIEW_H / 2 + 30);
  }
}

function missionCard(ctx, x, y, w, h, key, def, best, selected) {
  ctx.fillStyle = selected ? 'rgba(255, 182, 72, 0.16)' : 'rgba(10, 13, 18, 0.66)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = selected ? PALETTE.hudAmber : PALETTE.panelEdge;
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = '700 15px ui-monospace, monospace';
  ctx.fillText(`[${key}]`, x + 18, y + 30);
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(def.name, x + 60, y + 32);
  ctx.fillStyle = '#c8d2e0';
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillText(def.tag, x + 18, y + 56);
  ctx.fillStyle = '#9fb0c4';
  ctx.font = '400 13px system-ui, sans-serif';
  wrapText(ctx, def.brief, x + 18, y + 78, w - 36, 18);
  ctx.fillStyle = best ? PALETTE.hudGreen : '#7c8a9e';
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillText(best ? `BEST ${best}` : 'NOT FLOWN YET', x + 18, y + h - 14);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawTitleScreen(ctx, bests, selected, time) {
  ctx.fillStyle = 'rgba(8, 12, 18, 0.42)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.font = '700 64px system-ui, sans-serif';
  ctx.fillText('RIDGELINE COURIER', VIEW_W / 2, 108);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = '700 17px ui-monospace, monospace';
  ctx.fillText('A MORNING RUN OVER THE VALLEY  •  PINEFIELD → ALDER', VIEW_W / 2, 140);
  const cardW = 348;
  const gap = 22;
  const total = cardW * 3 + gap * 2;
  const x0 = (VIEW_W - total) / 2;
  const keys = ['rings', 'courier', 'canyon'];
  keys.forEach((kind, i) => {
    missionCard(ctx, x0 + i * (cardW + gap), 176, cardW, 190, String(i + 1), MISSIONS[kind], bests[kind], selected === kind);
  });
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.textAlign = 'center';
  ctx.font = '400 17px system-ui, sans-serif';
  ctx.fillText('Arrows / WASD — steer   •   Shift / Ctrl — throttle   •   Mouse — steer   •   P — pause   •   M — sound', VIEW_W / 2, 420);
  ctx.fillStyle = Math.sin(time * 2.4) > -0.2 ? PALETTE.hudAmber : '#8a6a30';
  ctx.font = '700 19px ui-monospace, monospace';
  ctx.fillText('CLICK A MISSION OR PRESS 1 · 2 · 3 TO FLY', VIEW_W / 2, 462);
}

export function drawEndScreen(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8, 10, 14, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = '700 52px system-ui, sans-serif';
  ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 46);
  ctx.fillStyle = PALETTE.hudWhite;
  ctx.font = '400 19px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 + 2 + i * 30);
  });
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = '700 17px ui-monospace, monospace';
  ctx.fillText('SPACE OR CLICK — FLY AGAIN   •   T — TITLE', VIEW_W / 2, VIEW_H / 2 + 118);
}
