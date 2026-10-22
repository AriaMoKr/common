// Standard-layout gamepads (src/gamepad.js). The cases come from hallway's test/gamepad.test.js
// (readPad, as outside has it too) and vrlbry's test/client-gamepad.test.js (stick, firstPad, and
// its own reader, rebuilt here on stick, held and BUTTONS as vrlbry can build it).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUTTON, BUTTONS, DEADZONE, firstPad, held, readPad, stick } from '../src/gamepad.js';

/** hallway's stand-in: a standard pad with axes and the buttons pressed, by index. */
const pad = (axes, pressed = [], extra = {}) => ({
  connected: true, mapping: 'standard', axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
  ...extra,
});
/** vrlbry's stand-in: axes, the buttons pressed by name, and the triggers' values. */
function namedPad({ axes = [0, 0, 0, 0], pressed = [], lt = 0, rt = 0, mapping = 'standard', connected = true } = {}) {
  const buttons = BUTTONS.map((name) => ({ pressed: pressed.includes(name), value: pressed.includes(name) ? 1 : 0 }));
  buttons[6] = { pressed: lt > 0.5, value: lt };
  buttons[7] = { pressed: rt > 0.5, value: rt };
  return { axes, buttons, mapping, connected };
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);
const RAMP = (0.5 - DEADZONE) / (1 - DEADZONE);

describe('the names', () => {
  it('are the standard mapping\'s, and BUTTON agrees with BUTTONS', () => {
    assert.equal(DEADZONE, 0.18);
    assert.equal(BUTTONS.length, 17);
    assert.deepEqual([BUTTONS[BUTTON.a], BUTTONS[BUTTON.b], BUTTONS[BUTTON.back], BUTTONS[BUTTON.leftStick]], ['a', 'b', 'back', 'ls']);
    assert.deepEqual([BUTTONS[6], BUTTONS[7], BUTTONS[16]], ['lt', 'rt', 'home']);
    assert.ok(Object.isFrozen(BUTTON) && Object.isFrozen(BUTTONS));
  });
});

describe('a stick', () => {
  it('ignores drift inside the dead zone and ramps smoothly outside it', () => {
    assert.deepEqual(stick(0.1, -0.1), { x: 0, y: 0 });
    assert.deepEqual(stick(1, 0), { x: 1, y: 0 });
    near(stick(0.5, 0).x, RAMP, 'half way');
    const diag = stick(0.9, 0.9); // beyond the unit circle: capped at length 1
    near(Math.hypot(diag.x, diag.y), 1, 'diagonal');
    assert.deepEqual(stick(), { x: 0, y: 0 });
    assert.deepEqual(stick(0.5), { x: RAMP, y: 0 }, 'a missing axis');
  });

  it('takes another dead zone', () => {
    assert.deepEqual(stick(0.3, 0, 0.4), { x: 0, y: 0 });
    near(stick(0.7, 0, 0.4).x, 0.5, 'half way past 0.4');
    assert.deepEqual(stick(0.1, 0, 0), { x: 0.1, y: 0 });
  });

  it('writes into out, allocating nothing', () => {
    const out = { x: 9, y: 9 };
    assert.equal(stick(0, -1, DEADZONE, out), out);
    assert.deepEqual(out, { x: 0, y: -1 });
    assert.equal(stick(0.05, 0.05, DEADZONE, out), out);
    assert.deepEqual(out, { x: 0, y: 0 });
  });
});

describe('a button', () => {
  it('is held pressed, or an analogue one more than half way; a missing one is not', () => {
    const p = pad([], [BUTTON.a]);
    assert.equal(held(p, BUTTON.a), true);
    assert.equal(held(p, BUTTON.b), false);
    p.buttons[7] = { pressed: false, value: 0.6 };
    assert.equal(held(p, 7), true);
    p.buttons[7] = { pressed: false, value: 0.5 };
    assert.equal(held(p, 7), false);
    assert.equal(held({ axes: [], buttons: [] }, 0), false);
    assert.equal(held({ axes: [], buttons: [null] }, 0), false);
  });
});

describe('readPad (the Hallway\'s)', () => {
  it('asks for nothing with sticks at rest, or resting a little off centre', () => {
    const s = readPad(pad([0.1, -0.12, DEADZONE * 0.9, 0]));
    assert.deepEqual(s, { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, use: false, back: false });
  });

  it('reaches 1 at full tilt, diagonally too, and no further; past the dead zone it is linear, as stick is', () => {
    let s = readPad(pad([0, -1, 1, 0]));
    near(s.moveY, -1, 'forward');
    near(s.lookX, 1, 'look right');
    s = readPad(pad([Math.SQRT1_2, Math.SQRT1_2, 0, 0]));
    near(Math.hypot(s.moveX, s.moveY), 1, 'diagonal');
    s = readPad(pad([1, 1, 0, 0])); // some pads report a square
    near(Math.hypot(s.moveX, s.moveY), 1, 'square corner');
    s = readPad(pad([0.5, 0, 0.5, 0]));
    near(s.moveX, RAMP, 'walking');
    near(s.lookX, RAMP, 'looking');
    const p = pad([0.3, -0.7, -0.6, 0.25]);
    s = readPad(p);
    assert.deepEqual([s.moveX, s.moveY, s.lookX, s.lookY], [...Object.values(stick(0.3, -0.7)), ...Object.values(stick(-0.6, 0.25))]);
  });

  it('uses A, goes back with B or Back, hurries with the left stick clicked in; analogue buttons count past half way', () => {
    let s = readPad(pad([0, 0, 0, 0], [BUTTON.a, BUTTON.leftStick]));
    assert.deepEqual([s.use, s.back, s.run], [true, false, true]);
    assert.equal(readPad(pad([0, 0, 0, 0], [BUTTON.b])).back, true);
    assert.equal(readPad(pad([0, 0, 0, 0], [BUTTON.back])).back, true);
    const half = pad([0, 0, 0, 0]);
    half.buttons[BUTTON.a] = { pressed: false, value: 0.6 };
    assert.equal(readPad(half).use, true);
    // A pad with one stick only walks.
    s = readPad({ axes: [0.9, 0], buttons: [] });
    assert.ok(s.moveX > 0.8);
    assert.equal(s.lookX, 0);
    assert.equal(s.use, false);
  });

  it('writes into out, allocating nothing', () => {
    const out = { moveX: 9, moveY: 9, lookX: 9, lookY: 9, run: true, use: true, back: true };
    assert.equal(readPad(pad([0, 0, 0, 0]), out), out);
    assert.deepEqual(out, { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, use: false, back: false });
  });
});

describe('the first pad', () => {
  it('is the first connected one, one with the standard mapping first', () => {
    const odd = pad([], [], { mapping: '' }), std = pad([]), gone = pad([], [], { connected: false });
    assert.equal(firstPad([null, gone, odd, std]), std);
    assert.equal(firstPad([odd, null]), odd);
    assert.equal(firstPad([odd, pad([], [], { mapping: '', connected: false })]), odd);
    assert.equal(firstPad([null, gone]), null);
    assert.equal(firstPad([]), null);
    assert.equal(firstPad(undefined), null);
    assert.equal(firstPad(null), null);
  });
});

describe('vrlbry\'s reader, built on stick, held and BUTTONS', () => {
  /** vrlbry's readPad (its xr/gamepad.js): every button, the triggers, and the edges since prev. */
  function readAll(gp, prev = {}) {
    const buttons = {};
    BUTTONS.forEach((name, i) => { buttons[name] = held(gp, i); });
    return {
      move: stick(gp.axes[0], gp.axes[1]),
      look: stick(gp.axes[2], gp.axes[3]),
      lt: gp.buttons[6]?.value ?? 0,
      rt: gp.buttons[7]?.value ?? 0,
      buttons,
      down: BUTTONS.filter((n) => buttons[n] && !prev[n]),
      up: BUTTONS.filter((n) => !buttons[n] && prev[n]),
    };
  }

  it('reads sticks, triggers and button edges', () => {
    let s = readAll(namedPad({ axes: [0, -1, 0.6, 0], pressed: ['a'], rt: 0.7 }));
    assert.deepEqual(s.move, { x: 0, y: -1 });
    assert.ok(s.look.x > 0.4);
    assert.equal(s.rt, 0.7);
    assert.equal(s.buttons.rt, true, 'a trigger past half counts as pressed');
    assert.deepEqual(s.down, ['a', 'rt']);
    // Held: no new edge. Released: an up edge.
    s = readAll(namedPad({ pressed: ['a'], rt: 0.7 }), s.buttons);
    assert.deepEqual(s.down, []);
    s = readAll(namedPad({ pressed: ['b'] }), s.buttons);
    assert.deepEqual(s.down, ['b']);
    assert.deepEqual(s.up, ['a', 'rt']);
  });

  it('copes with pads that have fewer buttons or axes', () => {
    const s = readAll({ axes: [0.5], buttons: [{ pressed: true, value: 1 }], connected: true });
    assert.ok(s.move.x > 0);
    assert.deepEqual(s.look, { x: 0, y: 0 });
    assert.deepEqual(s.down, ['a']);
    assert.equal(s.rt, 0);
  });

  it('agrees with readPad on the same pad', () => {
    const p = namedPad({ axes: [0.4, -0.9, 0.2, 0.7], pressed: ['a', 'ls', 'back'] });
    const all = readAll(p), s = readPad(p);
    assert.deepEqual([s.moveX, s.moveY, s.lookX, s.lookY], [all.move.x, all.move.y, all.look.x, all.look.y]);
    assert.deepEqual([s.use, s.run, s.back], [all.buttons.a, all.buttons.ls, all.buttons.b || all.buttons.back]);
  });
});
