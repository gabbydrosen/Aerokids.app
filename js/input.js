export class KeyboardInput {
  constructor() {
    this.keys = new Set();
    this.pitch = 0;
    this.roll = 0;
    this.rudder = 0;
    this.throttle = 0;

    window.flightControlsEnabled = false;

    window.addEventListener(
      "keydown",
      (e) => {
        if (isTextEntry(e.target)) return;

        const watched = new Set(["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown"]);

        if (!window.flightControlsEnabled || !watched.has(e.code)) return;

        e.preventDefault();
        this.keys.add(e.code);

        if (!e.repeat && e.code === "ArrowUp") this.throttle += 0.06;
        if (!e.repeat && e.code === "ArrowDown") this.throttle -= 0.06;
        this.throttle = clamp(this.throttle, 0, 1);
      },
      { passive: false },
    );

    window.addEventListener("blur", () => this.clearAxes());
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
  }

  reset() {
    this.keys.clear();
    this.pitch = 0;
    this.roll = 0;
    this.rudder = 0;
    this.throttle = 0;
  }

  clearAxes() {
    this.keys.clear();
    this.pitch = 0;
    this.roll = 0;
    this.rudder = 0;
  }

  update(dt) {
    // keys ramp up and spring back so it feels like a yoke, not an on/off switch
    const pressRate = 1.35;
    const returnRate = 0.92;
    const keyboardLimits = { pitch: 0.78, roll: 0.84, rudder: 0.8 };

    // W/S = nose up/down, A/D = roll
    const pitchDirection = (this.keys.has("KeyW") ? 1 : 0) + (this.keys.has("KeyS") ? -1 : 0);
    const rollDirection = (this.keys.has("KeyD") ? 1 : 0) + (this.keys.has("KeyA") ? -1 : 0);
    const rudderDirection = (this.keys.has("KeyE") ? 1 : 0) + (this.keys.has("KeyQ") ? -1 : 0);

    const pitchTarget = pitchDirection * keyboardLimits.pitch;
    const rollTarget = rollDirection * keyboardLimits.roll;
    const rudderTarget = rudderDirection * keyboardLimits.rudder;

    this.pitch = approach(this.pitch, pitchTarget, (pitchDirection ? pressRate : returnRate) * dt);
    this.roll = approach(this.roll, rollTarget, (rollDirection ? pressRate : returnRate) * dt);
    this.rudder = approach(this.rudder, rudderTarget, (rudderDirection ? pressRate : returnRate) * dt);

    if (window.flightControlsEnabled) {
      if (this.keys.has("ArrowUp")) this.throttle += 0.65 * dt;
      if (this.keys.has("ArrowDown")) this.throttle -= 0.65 * dt;
    }
    this.throttle = clamp(this.throttle, 0, 1);

    const keyboard = {
      pitch: clamp(this.pitch, -1, 1),
      roll: clamp(this.roll, -1, 1),
      rudder: clamp(this.rudder, -1, 1),
      throttle: this.throttle,
    };

    const hw = window.flightHardwareInput;
    if (hw && hw.connected) {
      return {
        pitch: clamp(Number(hw.pitch) || 0, -1, 1),
        roll: clamp(Number(hw.roll) || 0, -1, 1),
        rudder: clamp(Number(hw.rudder) || 0, -1, 1),
        // camera yoke has no throttle so keep the lever's power
        throttle: Number.isFinite(hw.throttle) ? clamp(hw.throttle, 0, 1) : keyboard.throttle,
      };
    }

    return keyboard;
  }
}

function isTextEntry(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable === true;
}

function approach(value, target, step) {
  if (value < target) return Math.min(value + step, target);
  if (value > target) return Math.max(value - step, target);
  return value;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
