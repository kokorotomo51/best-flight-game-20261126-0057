// Flight physics: an arcade model with real discipline in it. Throttle sets the
// speed the airframe wants; pitch trades speed for altitude; bank turns the
// nose and costs lift; slow flight mushes the controls and then stalls.

import {
  CRUISE_SPEED,
  FUEL_BURN_FULL,
  FUEL_BURN_IDLE,
  GRAVITY,
  MAX_BANK,
  MAX_PITCH,
  MAX_SPEED,
  PITCH_RATE,
  ROLL_RATE,
  STALL_SPEED,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_TOUCHDOWN = 1;
export const EVENT_CRASHED = 2;
export const EVENT_SPLASHED = 4;
export const EVENT_STRIKE = 8;

export function createAircraft() {
  const state = {
    x: 0,
    y: 4,
    z: 60,
    heading: 0,
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    fuel: 100,
    damage: 0,
    verticalSpeed: 0,
    onGround: true,
    engineOut: false,
    crashed: false,
  };

  function reset(spawn) {
    state.x = spawn.x;
    state.y = spawn.y;
    state.z = spawn.z;
    state.heading = spawn.heading ?? 0;
    state.pitch = 0;
    state.bank = 0;
    state.speed = spawn.speed ?? 0;
    state.throttle = spawn.throttle ?? 0;
    state.fuel = spawn.fuel ?? 100;
    state.damage = 0;
    state.verticalSpeed = 0;
    state.onGround = spawn.onGround ?? false;
    state.engineOut = false;
    state.crashed = false;
  }

  function controlAuthority() {
    // Below stall speed the controls go soft; on the ground there is no authority.
    if (state.onGround) return 0;
    return Math.min(1, Math.max(0.25, state.speed / STALL_SPEED));
  }

  // One fixed step. input: { pitch: -1..1 (pull positive), roll: -1..1, throttle: -1..1 }
  // Returns the vertical speed at ground contact for the landing judgement, in m/s.
  function step(dt, input, groundHeight, onRunway) {
    const auth = controlAuthority();

    state.throttle = Math.min(1, Math.max(0, state.throttle + input.throttle * dt * 0.7));
    if (state.engineOut) state.throttle = 0;

    const wantSpeed = state.throttle * MAX_SPEED;
    const drag = state.onGround ? 1.6 : 0.55;
    state.speed += (wantSpeed - state.speed) * drag * dt;
    // Climbing spends speed, diving earns it.
    state.speed -= Math.sin(state.pitch) * 26 * dt;
    if (state.speed < 0) state.speed = 0;

    const targetBank = input.roll * MAX_BANK;
    state.bank += (targetBank - state.bank) * Math.min(1, ROLL_RATE * auth * dt * 3);
    const targetPitch = input.pitch * MAX_PITCH;
    state.pitch += (targetPitch - state.pitch) * Math.min(1, PITCH_RATE * auth * dt * 3);

    // A banked turn swings the heading; the turn tightens as speed falls.
    const turnRate = (GRAVITY * Math.tan(state.bank)) / Math.max(18, state.speed);
    state.heading += turnRate * dt;

    const stalled = state.speed < STALL_SPEED && !state.onGround;
    let climb = state.speed * Math.sin(state.pitch);
    climb -= (1 - Math.cos(state.bank)) * 9; // banked flight sinks without back-pressure
    if (stalled) climb -= (STALL_SPEED - state.speed) * 0.9;
    if (state.onGround) climb = 0;
    state.verticalSpeed = climb;
    state.y += climb * dt;

    state.x += Math.sin(state.heading) * state.speed * dt;
    state.z += Math.cos(state.heading) * state.speed * dt;

    // Fuel: thirst grows with throttle; empty tanks mean a glide.
    if (!state.onGround || state.speed > 4) {
      state.fuel -= (FUEL_BURN_IDLE + state.throttle * FUEL_BURN_FULL) * dt;
      if (state.fuel <= 0) {
        state.fuel = 0;
        state.engineOut = true;
      }
    }
    return { stalled, groundHeight, onRunway };
  }

  // Called by the world after the step when the airframe meets the ground.
  // Soft runway contact lands; a steep or fast impact breaks the airframe;
  // a glancing strike is survivable and costs damage instead.
  function resolveGroundContact(groundHeight, onRunway) {
    if (state.y > groundHeight + 1.1) return { event: EVENT_NONE, quality: 0 };
    const vs = state.verticalSpeed;
    const soft = vs > -7 && state.speed < 58 && Math.abs(state.bank) < 0.35;
    // A slow, level arrival on open ground is a landing too, not a strike:
    // the courier can put down in a field and take off again.
    const gentleField = vs > -4 && state.speed < 30 && Math.abs(state.bank) < 0.35;
    if (((onRunway && soft) || gentleField) && !state.crashed) {
      state.y = groundHeight + 1.1;
      state.onGround = true;
      state.pitch = 0;
      state.bank = 0;
      const quality = Math.min(1, Math.max(0, 1 - Math.abs(vs) / 7) * 0.6 + (1 - state.speed / 58) * 0.4);
      return { event: EVENT_TOUCHDOWN, quality };
    }
    if (vs < -12 || state.speed > 70) {
      state.crashed = true;
      state.y = groundHeight + 0.4;
      return { event: groundHeight <= 3.4 ? EVENT_SPLASHED : EVENT_CRASHED, quality: 0 };
    }
    return { event: EVENT_STRIKE, quality: 0 };
  }

  function damage(amount) {
    state.damage = Math.min(100, state.damage + amount);
    if (state.damage >= 100) state.crashed = true;
    return state.damage;
  }

  return { state, reset, step, resolveGroundContact, damage, controlAuthority };
}
