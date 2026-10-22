// Standard-layout gamepads (Xbox, PlayStation, most Bluetooth pads) through the Gamepad API, on a
// desktop or a phone (in VR the controllers come through the XR session instead). The sites
// handle them alike, so a pad feels the same on both sides of a door: one dead zone, one stick
// scaling, the same pad chosen. readPad is the Hallway's (its public/js/gamepad.js, as outside has
// it): the left stick walks (clicked in, it hurries), the right one looks, A uses what the middle
// of the view is on, B or Back goes back. stick, held and BUTTONS are vrlbry's pieces
// (public/js/xr/gamepad.js), for a reader of its own. Pure, and allocation-free when given `out`.

/** Buttons readPad reads, by index in the W3C standard mapping (https://w3c.github.io/gamepad/#remapping). */
export const BUTTON = Object.freeze({ a: 0, b: 1, back: 8, leftStick: 10 });

/** Every button's name, by index in the standard mapping (vrlbry's). */
export const BUTTONS = Object.freeze(/** @type {const} */ (['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right', 'home']));

/** How far a stick moves before it counts. */
export const DEADZONE = 0.18;

/**
 * What a gamepad gives, as far as these functions read it: the DOM's Gamepad, or a stand-in.
 * @typedef {{ axes: ArrayLike<number | undefined>, buttons: ArrayLike<{ pressed: boolean, value: number } | null | undefined> }} Pad
 */

/**
 * What a gamepad asks for now (readPad): the sticks as -1 to 1, y down as gamepads give it, and
 * the buttons as held or not.
 * @typedef {object} PadState
 * @property {number} moveX the left stick
 * @property {number} moveY
 * @property {number} lookX the right stick
 * @property {number} lookY
 * @property {boolean} run the left stick clicked in
 * @property {boolean} use A
 * @property {boolean} back B or Back
 */

/**
 * The factor to multiply a stick's (x, y) by: 0 inside the dead zone, then rising to 1 at full tilt.
 * @param {number} x
 * @param {number} y
 * @param {number} deadzone
 */
function scale(x, y, deadzone) {
  const m = Math.hypot(x, y);
  if (m <= deadzone) return 0;
  return Math.min(1, (m - deadzone) / (1 - deadzone)) / m;
}

/**
 * A stick with a radial dead zone, rescaled so motion starts smoothly at its edge and reaches 1 at
 * full tilt, diagonally too.
 * @param {number} [x] -1 to 1, right; 0 for a missing axis
 * @param {number} [y] -1 to 1, down
 * @param {number} [deadzone]
 * @param {{ x: number, y: number }} [out] written and returned, so nothing is allocated
 * @returns {{ x: number, y: number }}
 */
export function stick(x = 0, y = 0, deadzone = DEADZONE, out = { x: 0, y: 0 }) {
  const k = scale(x, y, deadzone);
  out.x = k ? x * k : 0;
  out.y = k ? y * k : 0;
  return out;
}

/**
 * Whether a button is held: pressed, or an analogue one more than half way.
 * @param {Pad} pad
 * @param {number} i its index in the standard mapping (BUTTON, BUTTONS)
 */
export function held(pad, i) {
  const b = pad.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
}

/**
 * What a gamepad asks for now, written into `out`.
 * @param {Pad} pad
 * @param {PadState} [out]
 * @returns {PadState}
 */
export function readPad(pad, out = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, use: false, back: false }) {
  const a = pad.axes;
  const lx = a[0] ?? 0, ly = a[1] ?? 0, rx = a[2] ?? 0, ry = a[3] ?? 0;
  const m = scale(lx, ly, DEADZONE), l = scale(rx, ry, DEADZONE);
  out.moveX = m ? lx * m : 0;
  out.moveY = m ? ly * m : 0;
  out.lookX = l ? rx * l : 0;
  out.lookY = l ? ry * l : 0;
  out.run = held(pad, BUTTON.leftStick);
  out.use = held(pad, BUTTON.a);
  out.back = held(pad, BUTTON.b) || held(pad, BUTTON.back);
  return out;
}

/**
 * The first connected gamepad, preferring one with the standard mapping.
 * @template {{ connected: boolean, mapping: string } | null | undefined} P
 * @param {ArrayLike<P> | null | undefined} pads navigator.getGamepads()
 * @returns {NonNullable<P> | null}
 */
export function firstPad(pads) {
  /** @type {NonNullable<P> | null} */
  let any = null;
  for (let i = 0; pads && i < pads.length; i++) {
    const p = pads[i];
    if (!p?.connected) continue;
    if (p.mapping === 'standard') return /** @type {NonNullable<P>} */ (p);
    any ??= /** @type {NonNullable<P>} */ (p);
  }
  return any;
}
