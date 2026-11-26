// Input: keyboard, mouse and touch, folded into one frame of intent.
// Arrows/WASD steer, W/S or Shift/Ctrl work the throttle, Space confirms,
// P pauses, R restarts, M mutes. The mouse steers when it moves; a click
// confirms. Touch drag steers, tap confirms.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseActive = false;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeenAt = 0;
  let touchActive = false;
  let touchX = 0;
  let touchY = 0;

  function press(action) {
    actions |= action;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.key.toLowerCase());
    if (event.key === ' ' || event.key === 'Enter') press(ACTION_CONFIRM);
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') press(ACTION_PAUSE);
    if (event.key === 'r' || event.key === 'R') press(ACTION_RESTART);
    if (event.key === 'm' || event.key === 'M') press(ACTION_MUTE);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width - 0.5;
    mouseY = (event.clientY - rect.top) / rect.height - 0.5;
    mouseActive = true;
    mouseSeenAt = performance.now();
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') {
      touchActive = true;
      const rect = canvas.getBoundingClientRect();
      touchX = (event.clientX - rect.left) / rect.width - 0.5;
      touchY = (event.clientY - rect.top) / rect.height - 0.5;
    } else {
      press(ACTION_CONFIRM);
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch' || !touchActive) return;
    const rect = canvas.getBoundingClientRect();
    touchX = (event.clientX - rect.left) / rect.width - 0.5;
    touchY = (event.clientY - rect.top) / rect.height - 0.5;
  });
  window.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch') touchActive = false;
  });

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  // Steering intent in [-1, 1] for pitch (positive = pull up) and roll.
  function steering() {
    let pitch = 0;
    let roll = 0;
    if (keys.has('arrowup') || keys.has('w')) pitch += 1;
    if (keys.has('arrowdown') || keys.has('s')) pitch -= 1;
    if (keys.has('arrowleft') || keys.has('a')) roll -= 1;
    if (keys.has('arrowright') || keys.has('d')) roll += 1;
    // The mouse takes over only while it is actually being moved.
    if (mouseActive && performance.now() - mouseSeenAt < 2600 && !keys.size) {
      roll = Math.max(-1, Math.min(1, mouseX * 2.4));
      pitch = Math.max(-1, Math.min(1, -mouseY * 2.4));
    }
    if (touchActive) {
      roll = Math.max(-1, Math.min(1, touchX * 2.6));
      pitch = Math.max(-1, Math.min(1, -touchY * 2.6));
    }
    let throttle = 0;
    if (keys.has('shift')) throttle += 1;
    if (keys.has('control')) throttle -= 1;
    return { pitch, roll, throttle };
  }

  return { takeActions, steering };
}
