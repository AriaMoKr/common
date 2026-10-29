// The walking controls in Node, over stand-ins as tv.test.js tests the remote: three's own camera,
// rig and controllers (no WebGL needed), a renderer whose xr gives the controllers and the session's
// events, a view that takes pointer events, the window's keys, a gamepad, and a box of a room as a
// site's subclass gives it, which counts each of its methods called.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { Controls, KEYS } from '../src/controls.js';

// ── Stand-ins ────────────────────────────────────────────────────────────────

class Listeners {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }

  emit(type, fields = {}) {
    const e = event({ type, ...fields });
    for (const fn of this.listeners[type] ?? []) fn(e);
    return e;
  }
}

const event = (fields) => ({
  defaultPrevented: false,
  preventDefault() {
    this.defaultPrevented = true;
  },
  timeStamp: 0,
  ...fields,
});

/** The view: the renderer's canvas, 800 × 600 at the page's top left. */
class View extends Listeners {
  constructor() {
    super();
    this.style = {};
    this.captured = [];
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }

  setPointerCapture(id) {
    this.captured.push(id);
  }
}

/** An element a key goes to: a tag, attributes, a parent, and closest() for the selectors asked. */
class El {
  constructor(tag, attrs = {}, parent = null) {
    this.tag = tag;
    this.attrs = attrs;
    this.parent = parent;
  }

  matches(selectors) {
    return selectors.split(',').some((s) => {
      const [, tag, attr] = /^([a-z]*)(?:\[([a-z-]+)\])?$/.exec(s.trim());
      return (!tag || this.tag === tag) && (!attr || attr in this.attrs);
    });
  }

  closest(selectors) {
    for (let el = this; el; el = el.parent) if (el.matches(selectors)) return el;
    return null;
  }
}

class XR extends THREE.EventDispatcher {
  constructor() {
    super();
    this.isPresenting = false;
    this.controllers = [new THREE.Group(), new THREE.Group()];
  }

  getController(i) {
    return this.controllers[i];
  }
}

/** A standard gamepad at rest. */
const gamepad = () => ({
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});

// ── A room ───────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** 6 m wide (x -3…3), 6 m deep (z 0…-6), 2.5 m high; the doorway in the middle of the z = 0 wall, its reveal 0.3 m deep; a button on the far wall. */
const BOX = { x0: -3, x1: 3, z1: -6, height: 2.5, door: { width: 1.1, height: 2.2, reveal: 0.3 }, button: { y: 1.6, half: 0.3 } };
const MARGIN = 0.3;

/** A site's subclass: the template's room, much simplified, with knobs, counting each method called. */
class Room extends Controls {
  // Set after super(): the base's constructor mustn't need any of them.
  layout = BOX;
  calls = {};
  used = [];
  took = [];
  hoverButton = false;
  onButton = () => {};
  sitting = false;
  raised = 0; // the ground beyond x = 1.5 is this high
  via = null; // the corner a route turns at
  reading = false; // the site's own takes the keys (Home, the arrows), B, the hands, swipes, pinches, the wheel and grips
  normal = 1; // how long the floor's normal is
  nothing = false; // a ray meets nothing

  count(name) {
    this.calls[name] = (this.calls[name] ?? 0) + 1;
  }

  castRay(ox, oy, oz, dx, dy, dz, out) {
    this.count('castRay');
    if (this.nothing) return null;
    const L = this.layout;
    let t = Infinity, plane = '';
    const near = oz > 0 ? L.door.reveal : 0;
    const meet = (s, p) => {
      if (s > 0 && s < t) {
        t = s;
        plane = p;
      }
    };
    if (dx < 0) meet((L.x0 - ox) / dx, 'left');
    if (dx > 0) meet((L.x1 - ox) / dx, 'right');
    if (dy < 0) meet(-oy / dy, 'floor');
    if (dy > 0) meet((L.height - oy) / dy, 'ceiling');
    if (dz < 0) meet((L.z1 - oz) / dz, 'far');
    if (dz > 0) meet((near - oz) / dz, 'near');
    if (t === Infinity) return null;
    out.t = t;
    out.x = ox + dx * t;
    out.y = oy + dy * t;
    out.z = oz + dz * t;
    out.nx = out.ny = out.nz = 0;
    out.walkable = false;
    if (plane === 'floor') {
      out.kind = 'floor';
      out.ny = this.normal;
      out.walkable = out.x >= L.x0 + MARGIN && out.x <= L.x1 - MARGIN && out.z >= L.z1 + MARGIN && out.z <= -MARGIN;
    } else if (plane === 'ceiling') {
      out.kind = 'ceiling';
      out.ny = -1;
    } else if (plane === 'near') {
      out.nz = -1;
      out.kind = Math.abs(out.x) < L.door.width / 2 && out.y < L.door.height ? 'door' : 'wall';
    } else if (plane === 'far') {
      out.nz = 1;
      out.kind = Math.abs(out.x) < L.button.half && Math.abs(out.y - L.button.y) < L.button.half ? 'button' : 'wall';
    } else {
      out.nx = plane === 'left' ? 1 : -1;
      out.kind = 'wall';
    }
    return out;
  }

  /** The template's: inside the walls, MARGIN from them, or in the doorway between its jambs. */
  clampWalk(fx, fz, x, z, out) {
    this.count('clampWalk');
    const L = this.layout, m = MARGIN;
    x = clamp(x, L.x0 + m, L.x1 - m);
    z = Math.max(z, L.z1 + m);
    const jamb = L.door.width / 2 - 0.2;
    if (z > -m) {
      if (Math.abs(x) < jamb || (fz > -m && Math.abs(fx) <= jamb + 1e-6)) {
        x = clamp(x, -jamb, jamb);
        z = Math.min(z, L.door.reveal + 0.1);
      } else z = -m;
    }
    out.x = x;
    out.z = z;
    return out;
  }

  groundAt(x, z) {
    this.count('groundAt');
    return x > 1.5 ? this.raised : 0;
  }

  route(fx, fz, x, z) {
    this.count('route');
    return this.via ? [this.via, [x, z]] : super.route(fx, fz, x, z);
  }

  usable(hit) {
    this.count('usable');
    return hit?.kind === 'button' ? 'button' : super.usable(hit);
  }

  use(hit, how) {
    this.count('use');
    this.used.push([hit?.kind ?? null, how]);
    if (hit?.kind === 'button') this.onButton(how);
    else super.use(hit, how);
  }

  _setHover(usable, hit) {
    this.count('_setHover');
    super._setHover(usable, hit);
    this.hoverButton = usable === 'button';
  }

  /** The template's: up to the front of the doorway, then through it, facing back into the room. */
  walkInto() {
    this.count('walkInto');
    this.stand();
    const p = this.rig.position, L = this.layout;
    const jamb = L.door.width / 2 - 0.25;
    const x = clamp(p.x, -jamb, jamb);
    this._startWalk(p.z > -1.2 && Math.abs(p.x) < jamb ? [[x, L.door.reveal]] : [[x, -1], [x, L.door.reveal]], Math.PI);
  }

  stand() {
    this.count('stand');
    const was = this.sitting;
    this.sitting = false;
    return was;
  }

  _riseXR() {
    this.count('_riseXR');
    return super._riseXR();
  }

  reticleScale(use, hit) {
    this.count('reticleScale');
    return use === 'button' ? 1.3 : super.reticleScale(use, hit);
  }

  takeKey(e, name) {
    this.count('takeKey');
    if (!this.reading || !(name === 'Home' || name.startsWith('Arrow'))) return false;
    this.took.push(['key', name]);
    return true;
  }

  takePad(pad, dt, press) {
    this.count('takePad');
    if (!this.reading || !press.back) return false;
    press.back = false;
    this.took.push(['pad', 'back']);
    return true;
  }

  takeHand(hand, pad, ax, ay) {
    this.count('takeHand');
    if (!this.reading) return false;
    this.took.push(['hand', ax, ay]);
    return true;
  }

  takeSwipe(dx, dy, ms, touch) {
    this.count('takeSwipe');
    this.took.push(['swipe', dx, dy, ms, touch]);
    return this.reading;
  }

  takePinch(apart) {
    this.count('takePinch');
    this.took.push(['pinch', apart]);
    return this.reading;
  }

  takeWheel(dy) {
    this.count('takeWheel');
    this.took.push(['wheel', dy]);
    return this.reading;
  }

  takeGrip(hand, on) {
    this.count('takeGrip');
    this.took.push(['grip', hand, on]);
    return this.reading;
  }
}

function setup({ Kind = Room, ...options } = {}) {
  const xr = new XR();
  const camera = new THREE.PerspectiveCamera(70, 800 / 600, 0.05, 100);
  const rig = new THREE.Group();
  rig.add(camera);
  const scene = new THREE.Scene();
  scene.add(rig);
  const view = new View();
  const win = new Listeners();
  const pads = [];
  const c = new Kind({ renderer: { xr }, camera, rig, scene, dom: view, window: win, getGamepads: () => pads, ...options });
  const log = [];
  c.onActivity = () => log.push('activity');
  c.onDoor = (how, hit) => log.push(['door', how, hit.kind]);
  c.onButton = (how) => log.push(['button', how]);
  c.onPadActive = (on) => log.push(['pad', on]);
  c.onPadBack = () => log.push('back');
  c.onSqueeze = (hand) => log.push(['squeeze', c.hands.indexOf(hand)]);
  c.onTeleport = (move) => {
    log.push('teleport');
    move();
  };
  return { c, xr, camera, rig, scene, view, win, pads, log };
}

const body = new El('body');
const key = (win, type, fields) => win.emit(type, { code: '', key: '', target: body, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...fields });
const down = (win, code, fields = {}) => key(win, 'keydown', { code, ...fields });
const up = (win, code, fields = {}) => key(win, 'keyup', { code, ...fields });
const press = (view, type, { id = 1, kind = 'mouse', x = 400, y = 300, t = 0, button = 0, mx = 0, my = 0 } = {}) =>
  view.emit(type, { pointerId: id, pointerType: kind, clientX: x, clientY: y, timeStamp: t, button, movementX: mx, movementY: my });
const run = (c, seconds, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) c.update(dt);
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b} (± ${eps})`);
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const head = (camera) => camera.getWorldPosition(new THREE.Vector3());
const headYaw = (camera) => {
  const d = camera.getWorldDirection(new THREE.Vector3());
  return Math.atan2(-d.x, -d.z);
};

/** A hand's controller connected, as a headset's: its gamepad's sticks in axes 2 and 3. */
function connect(xr, i, handedness, { axes = [0, 0, 0, 0], mode = 'tracked-pointer' } = {}) {
  const source = { handedness, targetRayMode: mode, gamepad: { axes, buttons: [] } };
  xr.controllers[i].dispatchEvent({ type: 'connected', data: source });
  return source;
}

/** Into VR, the headset where the camera is put, and lined up a frame later. */
function enterVR(t, { x = 0, y = 1.7, z = 0, yaw = 0 } = {}) {
  t.camera.position.set(x, y, z);
  t.camera.rotation.set(0, yaw, 0);
  t.xr.isPresenting = true;
  t.xr.dispatchEvent({ type: 'sessionstart' });
  t.c.update(1 / 72);
  t.c.update(1 / 72);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('KEYS', () => {
  it('names what each key does, by keyOf\'s name, and stays as it is', () => {
    assert.deepEqual({ ...KEYS }, {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', KeyD: 'right',
      ArrowLeft: 'turnLeft', KeyQ: 'turnLeft',
      ArrowRight: 'turnRight', KeyE: 'turnRight',
      ShiftLeft: 'run', ShiftRight: 'run',
    });
    assert.ok(Object.isFrozen(KEYS));
    assert.throws(() => {
      KEYS.KeyW = 'back';
    }, TypeError);
  });
});

describe('Controls, made', () => {
  it('calls none of the site\'s methods while it is made: a subclass\'s fields come after super()', () => {
    const { c } = setup();
    assert.deepEqual(c.calls, {});
    assert.equal(c.layout, BOX);
  });

  it('puts the eye at 1.6 m, or the eye asked for, turning as a head does', () => {
    const { c, camera } = setup();
    assert.deepEqual(camera.position.toArray(), [0, 1.6, 0]);
    assert.equal(camera.rotation.order, 'YXZ');
    assert.equal(c.eye, 1.6);
    const tall = setup({ eye: 1.75 });
    assert.equal(tall.camera.position.y, 1.75);
  });

  it('gives two hands, their controllers in the rig and their reticles in the scene, hidden', () => {
    const { c, xr, rig, scene } = setup();
    assert.equal(c.hands.length, 2);
    c.hands.forEach((h, i) => {
      assert.equal(h.controller, xr.controllers[i]);
      assert.equal(h.controller.parent, rig);
      assert.equal(h.reticle.parent, scene);
      assert.equal(h.laser.parent, h.controller);
      assert.equal(h.tip.parent, h.controller);
      assert.equal(h.laser.visible || h.reticle.visible, false);
      assert.equal(h.source, null);
      assert.equal(h.last, null);
    });
    assert.notEqual(c.hands[0].hit, c.hands[1].hit);
  });

  it('writes the hits into the site\'s own shape, given', () => {
    const blank = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, walkable: false, piece: -1 });
    const { c } = setup({ hit: blank });
    assert.equal(c._hit.piece, -1);
    assert.equal(c.hands[0].hit.piece, -1);
    assert.notEqual(c.hands[0].hit, c._hit);
    // Without one, common's own.
    assert.deepEqual(setup().c._hit, { t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, walkable: false });
  });

  it('meets nothing, walls nothing in and walks straight, before a site says otherwise', () => {
    const c = new Controls({ renderer: { xr: new XR() }, camera: new THREE.PerspectiveCamera(), rig: new THREE.Group(), scene: new THREE.Scene(), dom: new View(), window: new Listeners(), getGamepads: () => [] });
    assert.equal(c.castRay(0, 1, 0, 0, -1, 0, c._hit), null);
    assert.deepEqual(c.clampWalk(0, 0, 9, -9, { x: 0, z: 0 }), { x: 9, z: -9 });
    assert.equal(c.groundAt(3, 4), 0);
    assert.deepEqual(c.route(0, 0, 2, -3), [[2, -3]]);
    assert.equal(c.usable(null), null);
    assert.equal(c.usable({ kind: 'door' }), 'door');
    assert.equal(c.usable({ kind: 'wall' }), null);
    assert.equal(c.stand(), false);
    assert.equal(c.walkInto(), undefined);
    for (const take of ['takeKey', 'takePad', 'takeHand', 'takeSwipe', 'takePinch', 'takeWheel', 'takeGrip']) assert.equal(c[take](), false, take);
    assert.equal(c.reticleScale('door'), 1.8);
    assert.equal(c.reticleScale('button'), 0.7);
    assert.equal(c.reticleScale(null), 1);
  });
});

describe('setPose', () => {
  it('puts the visitor on the ground there, facing yaw, at restPitch unless told', () => {
    const { c, rig, camera } = setup();
    c.raised = 0.4;
    c.setPose(2, -3, 0.5);
    assert.deepEqual(rig.position.toArray(), [2, 0.4, -3]);
    assert.equal(rig.rotation.y, 0.5);
    assert.equal(camera.rotation.x, 0);
    c.restPitch = -0.2;
    c.setPose(0, -3, 0);
    near(camera.rotation.x, -0.2);
    c.setPose(0, -3, 0, 0.3);
    near(camera.rotation.x, 0.3);
    c.setPose(0, -3, 0, 4);
    near(c.pitch, 1.35, 1e-12);
  });
});

describe('the keys', () => {
  it('walk, run and turn as KEYS says, through keyOf', () => {
    const { c, win, rig, log } = setup();
    c.setPose(0, -1, 0);
    const w = down(win, 'KeyW');
    assert.equal(w.defaultPrevented, false);
    run(c, 0.5);
    near(rig.position.z, -1 - 1.9 * 0.5, 1e-9);
    near(rig.position.x, 0, 1e-12);
    down(win, 'ShiftLeft');
    run(c, 0.5);
    near(rig.position.z, -1 - 1.9 * 0.5 - 3.8 * 0.5, 1e-9);
    up(win, 'KeyW');
    up(win, 'ShiftLeft');
    assert.equal(c.keys.size, 0);
    // The arrows: the page doesn't scroll (nor a TV's spatial navigation take them).
    const left = down(win, 'ArrowLeft');
    assert.equal(left.defaultPrevented, true);
    run(c, 0.5);
    near(c.yaw, 1.9 * 0.5, 1e-9);
    up(win, 'ArrowLeft');
    // A TV remote's keys come without a code: by their key, and the spare ones as the arrows.
    down(win, '', { key: 'ChannelUp' });
    assert.deepEqual([...c.keys], ['forward']);
    up(win, '', { key: 'ChannelUp' });
    down(win, 'KeyD');
    win.emit('blur');
    assert.equal(c.keys.size, 0, 'a blur lets go of every key');
    assert.ok(log.includes('activity'));
  });

  it('stop at the walls', () => {
    const { c, win, rig } = setup();
    c.setPose(0, -3, 0);
    down(win, 'KeyW');
    run(c, 3);
    near(rig.position.z, BOX.z1 + MARGIN, 1e-12);
    assert.ok(c.calls.clampWalk > 0);
    assert.ok(c.calls.stand > 0, 'walking gets up first');
  });

  it('leave the page its own: form controls, text views, Space and Enter on a button or link, and keys already used', () => {
    const { c, win } = setup();
    const form = new El('form');
    for (const target of [new El('input', {}, form), new El('textarea'), new El('select'), new El('span', {}, new El('div', { contenteditable: '' })), new El('p', {}, new El('div', { 'data-own-keys': '' }))]) {
      const e = down(win, 'ArrowUp', { target });
      assert.equal(e.defaultPrevented, false, target.tag);
      assert.equal(c.keys.size, 0, target.tag);
    }
    for (const target of [new El('button'), new El('span', {}, new El('a', { href: '#' }))]) {
      for (const code of ['Space', 'Enter', 'NumpadEnter']) down(win, code, { target });
      down(win, '', { key: ' ', target });
      down(win, '', { key: 'Enter', target });
      assert.equal(c.keys.size, 0, target.tag);
      // Walking's keys still walk on a button.
      down(win, 'KeyW', { target });
      assert.ok(c.keys.has('forward'));
      up(win, 'KeyW');
    }
    // An <a> without an href is no link.
    down(win, 'ShiftLeft', { target: new El('a') });
    assert.ok(c.keys.has('run'));
    up(win, 'ShiftLeft');
    assert.equal(c.calls.takeKey, 3, 'only the keys that walked were offered to the site');
    for (const mod of ['ctrlKey', 'metaKey', 'altKey']) down(win, 'KeyW', { [mod]: true });
    assert.equal(c.keys.size, 0, 'with a modifier, a shortcut');
    const used = event({ code: 'ArrowUp' });
    used.preventDefault();
    key(win, 'keydown', used);
    assert.equal(c.keys.size, 0, 'a key a page control has used');
    assert.equal(c.calls.takeKey, 3, 'nor these');
  });

  it('go to the site first, before walking: what it takes doesn\'t walk', () => {
    const { c, win, rig } = setup();
    c.setPose(0, -3, 0);
    c.reading = true;
    const e = down(win, 'ArrowUp');
    assert.equal(e.defaultPrevented, false, 'the site prevents what it wants to');
    down(win, 'Home');
    assert.deepEqual(c.took, [['key', 'ArrowUp'], ['key', 'Home']]);
    assert.equal(c.keys.size, 0);
    down(win, 'KeyW');
    assert.ok(c.keys.has('forward'), 'only WASD walks while reading');
    run(c, 0.1);
    assert.ok(rig.position.z < -3);
  });

  it('end a walk under way, but Shift doesn\'t', () => {
    const { c, win } = setup();
    c.setPose(0, -3, 0);
    c.walkTo(1, -4);
    down(win, 'ShiftLeft');
    assert.ok(c.auto);
    down(win, 'KeyA');
    assert.equal(c.auto, null);
  });
});

describe('the view', () => {
  it('looks about with a drag: the mouse turns the view, a finger drags the scene', () => {
    const { c, view, log } = setup();
    press(view, 'pointerdown');
    assert.deepEqual(view.captured, [1]);
    press(view, 'pointermove', { x: 403 });
    assert.equal(c.yaw, 0, 'not yet a drag');
    press(view, 'pointermove', { x: 500, y: 400 });
    near(c.yaw, -97 * 0.0045, 1e-12);
    near(c.pitch, -100 * 0.0045, 1e-12);
    c.update(1 / 60);
    assert.equal(view.style.cursor, 'grabbing');
    press(view, 'pointerup', { x: 500, y: 400 });
    c.update(1 / 60);
    assert.equal(view.style.cursor, '');
    assert.equal(c.calls.use, undefined, 'a drag is no click');
    assert.equal(c.calls.takeSwipe, 1);
    assert.deepEqual(log, ['activity']);

    c.yaw = c.pitch = 0;
    press(view, 'pointerdown', { id: 2, kind: 'touch' });
    press(view, 'pointermove', { id: 2, kind: 'touch', x: 408 });
    assert.equal(c.yaw, 0, 'a finger has 10 px before it drags');
    press(view, 'pointermove', { id: 2, kind: 'touch', x: 500, y: 200 });
    near(c.yaw, 92 * 0.0045 * 1.15, 1e-12);
    near(c.pitch, -100 * 0.0045 * 1.15, 1e-12);
    press(view, 'pointermove', { id: 2, kind: 'touch', x: 500, y: 5000 });
    near(c.pitch, 1.35, 1e-12, 'the scene dragged down: looking up, as far as it goes');
    press(view, 'pointercancel', { id: 2, kind: 'touch' });
    assert.equal(c._down, null);
  });

  it('uses what a click or a tap is on: the site\'s, the doorway, or the floor to walk to', () => {
    const { c, view, log, rig } = setup();
    c.setPose(0, -3, 0);
    press(view, 'pointerdown');
    press(view, 'pointerup');
    assert.deepEqual(c.used, [['button', 'screen']]);
    assert.deepEqual(log.at(-1), ['button', 'screen']);
    c.setPose(0, -1.5, Math.PI);
    press(view, 'pointerdown', { kind: 'touch' });
    press(view, 'pointerup', { kind: 'touch' });
    assert.deepEqual(log.at(-1), ['door', 'screen', 'door']);
    // Down at the floor: a walk there.
    c.setPose(0, -1, 0, -0.5);
    press(view, 'pointerdown');
    press(view, 'pointerup');
    assert.deepEqual(c.used.at(-1), ['floor', 'screen']);
    assert.ok(c.auto);
    const [[x, z]] = c.auto.points;
    near(x, 0, 1e-9);
    near(z, -1 - 1.6 / Math.tan(0.5), 1e-6);
    run(c, 2);
    assert.equal(c.auto, null);
    near(rig.position.z, z, 1e-9);
    // A right click is not one.
    press(view, 'pointerdown', { button: 2 });
    press(view, 'pointerup', { button: 2 });
    assert.equal(c.used.length, 3);
    assert.equal(view.emit('contextmenu').defaultPrevented, true);
  });

  it('shows what the mouse is over: pointer, hover, the site\'s own, and the cursor', () => {
    const { c, view } = setup();
    c.setPose(0, -3, 0);
    assert.equal(c.pointer, null);
    press(view, 'pointermove', { x: 400, y: 300 });
    assert.deepEqual(c.pointer, { x: 400, y: 300 });
    c.update(1 / 60);
    assert.equal(c.hover, 'button');
    assert.equal(c.hoverButton, true);
    assert.equal(c.hoverDoor, false);
    assert.equal(view.style.cursor, 'pointer');
    press(view, 'pointermove', { x: 400, y: 20 });
    c.update(1 / 60);
    assert.equal(c.hover, null);
    assert.equal(view.style.cursor, '');
    press(view, 'pointermove', { kind: 'touch', x: 10, y: 10 });
    assert.deepEqual(c.pointer, { x: 400, y: 20 }, 'a finger is no pointer');
    press(view, 'pointerleave');
    assert.equal(c.pointer, null);
    c.setPose(0, -1.5, Math.PI);
    c.aimMiddle = true;
    c.update(1 / 60);
    assert.equal(c.hover, 'door', 'a TV aims from the middle');
    assert.equal(c.hoverDoor, true);
    assert.ok(c.calls.usable > 0 && c.calls._setHover > 0 && c.calls.castRay > 0);
  });

  it('gives a swipe to the site first, and the view goes back where it was when it takes it', () => {
    const { c, view } = setup();
    c.reading = true;
    press(view, 'pointerdown', { kind: 'touch', x: 600, t: 1000 });
    press(view, 'pointermove', { kind: 'touch', x: 400, t: 1100 });
    assert.notEqual(c.yaw, 0);
    press(view, 'pointerup', { kind: 'touch', x: 400, t: 1200 });
    assert.deepEqual(c.took, [['swipe', -200, 0, 200, true]]);
    assert.equal(c.yaw, 0);
    assert.equal(c.pitch, 0);
  });

  it('makes two fingers a pinch, the site\'s: no look and no tap', () => {
    const { c, view } = setup();
    c.setPose(0, -3, 0);
    press(view, 'pointerdown', { id: 1, kind: 'touch', x: 300 });
    press(view, 'pointerdown', { id: 2, kind: 'touch', x: 500 });
    press(view, 'pointermove', { id: 2, kind: 'touch', x: 520 });
    press(view, 'pointermove', { id: 1, kind: 'touch', x: 290 });
    assert.deepEqual(c.took, [['pinch', 20], ['pinch', 30]], 'not taken: from where they began');
    c.reading = true;
    press(view, 'pointermove', { id: 2, kind: 'touch', x: 530 });
    press(view, 'pointermove', { id: 2, kind: 'touch', x: 525 });
    assert.deepEqual(c.took.slice(2), [['pinch', 40], ['pinch', -5]], 'taken: from the last one taken');
    assert.equal(c.yaw, 0);
    press(view, 'pointerup', { id: 2, kind: 'touch', x: 525 });
    press(view, 'pointerup', { id: 1, kind: 'touch', x: 290 });
    assert.equal(c.calls.use, undefined);
    assert.equal(c._touches.size, 0);
  });

  it('gives the wheel to the site, the page not scrolling when it takes it', () => {
    const { c, view } = setup();
    assert.equal(view.emit('wheel', { deltaY: 100, deltaMode: 0 }).defaultPrevented, false);
    c.reading = true;
    assert.equal(view.emit('wheel', { deltaY: 3, deltaMode: 1 }).defaultPrevented, true);
    assert.equal(view.emit('wheel', { deltaY: -1, deltaMode: 2 }).defaultPrevented, true);
    assert.deepEqual(c.took, [['wheel', 100], ['wheel', 99], ['wheel', -600]]);
  });
});

describe('a gamepad', () => {
  it('takes over when used, and the mouse takes it back', () => {
    const { c, win, view, pads, rig, log } = setup();
    c.setPose(0, -3, 0);
    const pad = gamepad();
    pads.push(pad);
    win.emit('gamepadconnected');
    assert.equal(c.hasPad, true);
    run(c, 0.1);
    assert.equal(c.padActive, false, 'not until it is used');
    pad.axes[1] = -1;
    run(c, 0.5);
    assert.equal(c.padActive, true);
    near(rig.position.z, -3 - 1.9 * 0.5, 1e-9);
    assert.deepEqual(log.slice(0, 2), [['pad', true], 'activity']);
    pad.axes[1] = 0;
    pad.axes[2] = 1;
    c.update(0.5);
    near(c.yaw, -2.4 * 0.5, 1e-9);
    pad.axes[2] = 0;
    press(view, 'pointermove', { mx: 0 });
    assert.equal(c.padActive, true, 'the mouse moving no distance');
    press(view, 'pointermove', { mx: 3 });
    assert.equal(c.padActive, false);
    assert.deepEqual(log.at(-1), ['pad', false]);
    pad.axes[0] = 1;
    c.update(0.1);
    assert.equal(c.padActive, true);
    press(view, 'pointerdown');
    assert.equal(c.padActive, false);
    press(view, 'pointerup');
    win.emit('gamepaddisconnected');
    assert.equal(c.hasPad, false);
  });

  it('uses the middle of the view with A and calls onPadBack with B, once a press', () => {
    const { c, win, pads, log } = setup();
    c.setPose(0, -3, 0);
    const pad = gamepad();
    pads.push(pad);
    win.emit('gamepadconnected');
    pad.buttons[0].pressed = true;
    run(c, 0.1);
    assert.deepEqual(c.used, [['button', 'screen']]);
    assert.equal(c.padActive, true);
    pad.buttons[0].pressed = false;
    c.update(0.01);
    pad.buttons[0].pressed = true;
    c.update(0.01);
    assert.equal(c.used.length, 2);
    pad.buttons[1].pressed = true;
    run(c, 0.1);
    pad.buttons[1].pressed = false;
    c.update(0.01);
    pad.buttons[8].pressed = true;
    run(c, 0.1);
    assert.equal(log.filter((x) => x === 'back').length, 2, 'B, then Back');
  });

  it('gives its buttons to the site first, which may take B', () => {
    const { c, win, pads, log } = setup();
    const pad = gamepad();
    pads.push(pad);
    win.emit('gamepadconnected');
    c.reading = true;
    pad.buttons[1].pressed = true;
    c.update(0.01);
    assert.deepEqual(c.took, [['pad', 'back']]);
    assert.equal(c.padActive, true, 'the site\'s use takes over too');
    assert.ok(!log.includes('back'));
    // Still held when the site no longer takes it: the press was its.
    c.reading = false;
    run(c, 0.1);
    assert.ok(!log.includes('back'));
    pad.buttons[1].pressed = false;
    c.update(0.01);
    pad.buttons[1].pressed = true;
    c.update(0.01);
    assert.ok(log.includes('back'));
    const asked = c.calls.takePad;
    run(c, 0.1);
    assert.equal(c.calls.takePad, asked + 6, 'each frame');
  });

  it('hands back when it is gone', () => {
    const { c, win, pads } = setup();
    const pad = gamepad();
    pads.push(pad);
    win.emit('gamepadconnected');
    pad.axes[1] = -1;
    c.update(0.1);
    assert.equal(c.padActive, true);
    pads.length = 0;
    c.update(0.1);
    assert.equal(c.padActive, false);
    win.emit('gamepadconnected');
    win.emit('gamepaddisconnected');
    assert.equal(c.hasPad, true, 'one left');
    win.emit('gamepaddisconnected');
    assert.equal(c.hasPad, false);
    win.emit('gamepaddisconnected');
    assert.equal(c._pads, 0);
  });

  it('aims from the middle while it is used', () => {
    const { c, win, pads } = setup();
    c.setPose(0, -3, 0);
    const pad = gamepad();
    pads.push(pad);
    win.emit('gamepadconnected');
    pad.axes[0] = 0.5;
    c.update(0.01);
    assert.equal(c.hover, 'button');
  });
});

describe('walks', () => {
  it('go to a point, then turn to face it and call then, at restPitch', () => {
    const { c, rig } = setup();
    c.setPose(0, -1, 0);
    c.restPitch = -0.2;
    let done = 0;
    c.walkTo(1, -3, { face: 2, then: () => done++ });
    assert.deepEqual(c.auto.points, [[1, -3]]);
    near(c.auto.speed, 2.2);
    run(c, 0.5);
    assert.equal(done, 0);
    run(c, 2);
    assert.equal(done, 1);
    assert.equal(c.auto, null);
    near(rig.position.x, 1, 1e-9);
    near(rig.position.z, -3, 1e-9);
    near(c.yaw, 2, 0.01);
    near(c.pitch, -0.2, 0.01);
    assert.equal(c.calls.route, 1);
    assert.ok(c.calls.stand >= 1, 'gets up first');
  });

  it('end at the point without a face, and go faster when long', () => {
    const { c } = setup();
    c.setPose(-2.7, -0.3, 0);
    let done = 0;
    c.walkTo(2.7, -5.7, { then: () => done++ });
    near(c.auto.speed, Math.hypot(5.4, 5.4) / 1.5);
    run(c, 1.5);
    assert.equal(done, 1);
    assert.equal(c.yaw, 0, 'a walk to one point doesn\'t turn');
  });

  it('go through the doorway (the site\'s walkInto), facing back into the room', () => {
    const { c, rig } = setup();
    c.setPose(2, -3, 0);
    c.walkInto();
    const jamb = BOX.door.width / 2 - 0.25;
    assert.deepEqual(c.auto.points, [[jamb, -1], [jamb, 0.3]]);
    near(jamb, 0.3, 1e-12);
    run(c, 3);
    assert.equal(c.auto, null);
    near(rig.position.x, 0.3, 1e-9);
    near(rig.position.z, 0.3, 1e-9);
    near(angle(c.yaw - Math.PI), 0, 0.01);
  });

  it('look where they go along a route, then turn to face', () => {
    const { c, rig } = setup();
    c.setPose(0, -1, 0);
    c.via = [-2, -3];
    let done = 0;
    c.walkTo(2, -5, { face: -Math.PI / 2, then: () => done++ });
    assert.equal(c.auto.turn, true);
    run(c, 0.3);
    near(c.yaw, Math.PI / 4, 0.25);
    assert.ok(c.pitch < -0.05, 'looking down a little, along the way');
    run(c, 3);
    assert.equal(done, 1);
    near(rig.position.x, 2, 1e-9);
    near(rig.position.z, -5, 1e-9);
    near(c.yaw, -Math.PI / 2, 0.01);
  });

  it('jump with less motion, onto the ground there, facing, then calling then', () => {
    const { c, rig, camera } = setup();
    c.setPose(0, -1, 0);
    c.reduceMotion = true;
    c.raised = 0.5;
    c.restPitch = -0.1;
    let done = 0;
    c.walkTo(2, -3, { face: 1, then: () => done++ });
    assert.equal(c.auto, null);
    assert.deepEqual(rig.position.toArray(), [2, 0.5, -3]);
    assert.equal(c.yaw, 1);
    assert.equal(rig.rotation.y, 1);
    near(camera.rotation.x, -0.1);
    assert.equal(done, 1);
    c.walkInto();
    near(rig.position.z, 0.3, 1e-9);
    near(c.yaw, Math.PI);
    // Where one may be at the end, not stopped on the way (outside's route crosses water).
    c.setPose(-2, -3, 0);
    c.walkTo(2, -9);
    assert.deepEqual([rig.position.x, rig.position.z], [2, BOX.z1 + MARGIN]);
  });

  it('end at a wall, without then', () => {
    const { c, rig } = setup();
    c.setPose(0, -5, 0);
    let done = 0;
    c.walkTo(0, -9, { then: () => done++ });
    run(c, 3);
    assert.equal(c.auto, null);
    assert.equal(done, 0);
    near(rig.position.z, BOX.z1 + MARGIN, 1e-12);
  });

  it('end when the visitor drags the view', () => {
    const { c, view } = setup();
    c.setPose(0, -1, 0);
    c.walkTo(0, -4);
    press(view, 'pointerdown');
    press(view, 'pointermove', { x: 450 });
    assert.equal(c.auto, null);
  });

  it('step up and down onto the ground as they go', () => {
    const { c, rig } = setup();
    c.setPose(1, -3, 0);
    c.raised = 0.3;
    c.walkTo(2.5, -3);
    run(c, 1.5);
    near(rig.position.y, 0.3, 1e-3);
    c.walkTo(1, -3);
    run(c, 0.05);
    assert.ok(rig.position.y > 0 && rig.position.y < 0.3, 'easing down');
    run(c, 1.5);
    near(rig.position.y, 0, 1e-3);
  });
});

describe('the site\'s methods', () => {
  it('use a press that meets nothing too, as null: a click, A, or a trigger', () => {
    const t = setup();
    const { c, view, win, pads, xr } = t;
    c.nothing = true;
    press(view, 'pointerdown');
    press(view, 'pointerup');
    const pad = gamepad();
    pads.push(pad);
    win.emit('gamepadconnected');
    pad.buttons[0].pressed = true;
    c.update(0.01);
    enterVR(t);
    connect(xr, 0, 'left');
    c.update(1 / 72);
    xr.controllers[0].dispatchEvent({ type: 'select' });
    assert.deepEqual(c.used, [[null, 'screen'], [null, 'screen'], [null, 'xr']]);
    assert.equal(c.hands[0].laser.scale.z, 4, 'the laser 4 m long, into nothing');
  });

  it('get the visitor up before every move: a walk, the keys, the pad, the stick, a teleport; not a turn', () => {
    const t = setup();
    const { c, win, pads, xr } = t;
    c.setPose(0, -3, 0);
    const moves = {
      walk: () => c.walkTo(1, -4),
      turn: () => {
        down(win, 'KeyQ');
        c.update(0.1);
        up(win, 'KeyQ');
      },
      keys: () => {
        down(win, 'KeyS');
        c.update(0.1);
        up(win, 'KeyS');
      },
      pad: () => {
        const pad = gamepad();
        pad.axes[0] = 1;
        pads.push(pad);
        win.emit('gamepadconnected');
        c.update(0.1);
        pads.length = 0;
        win.emit('gamepaddisconnected');
      },
    };
    for (const [name, move] of Object.entries(moves)) {
      c.sitting = true;
      move();
      assert.equal(c.sitting, name === 'turn', name);
    }
    enterVR(t);
    const left = connect(xr, 0, 'left');
    c.sitting = true;
    left.gamepad.axes[3] = -1;
    c.update(0.1);
    assert.equal(c.sitting, false, 'the stick');
    left.gamepad.axes[3] = 0;
    c.sitting = true;
    c._teleport(1, -4);
    assert.equal(c.sitting, false, 'a teleport');
    near(head(t.camera).z, -4, 1e-9);
  });
});

describe('VR', () => {
  it('lines the headset up with where the visitor stood and looked, and carries on from the head after', () => {
    const t = setup();
    const { c, camera, rig } = t;
    c.setPose(1, -2, 0.5, -0.3);
    c.eyeLift = 0.45;
    enterVR(t, { x: 0.2, y: 1.2, z: 0.1, yaw: 0.3 });
    near(rig.position.y, 0.45, 1e-12);
    const h = head(camera);
    near(h.x, 1, 1e-9);
    near(h.z, -2, 1e-9);
    near(headYaw(camera), 0.5, 1e-9);
    assert.ok(c.calls._riseXR >= 2);
    // Looking about and moving in the room, then out.
    camera.position.set(-0.4, 1.1, 0.3);
    camera.rotation.set(0.2, 0.9, 0);
    c.update(1 / 72);
    const was = head(camera), wasYaw = headYaw(camera);
    t.xr.isPresenting = false;
    t.xr.dispatchEvent({ type: 'sessionend' });
    assert.deepEqual(camera.position.toArray(), [0, 1.6, 0]);
    assert.deepEqual(camera.quaternion.toArray(), [0, 0, 0, 1]);
    near(rig.position.x, was.x, 1e-9);
    near(rig.position.z, was.z, 1e-9);
    assert.equal(rig.position.y, 0);
    near(c.yaw, wasYaw, 1e-9);
    assert.equal(c.pitch, 0);
    for (const hand of c.hands) assert.equal(hand.laser.visible || hand.reticle.visible || hand.aiming, false);
  });

  it('raises the rig by setEyeLift at once in VR, and only in VR', () => {
    const t = setup();
    const { c, rig } = t;
    c.setPose(0, -3, 0);
    c.setEyeLift(0.45);
    assert.equal(rig.position.y, 0);
    enterVR(t);
    near(rig.position.y, 0.45, 1e-12);
    c.setEyeLift(0);
    assert.equal(rig.position.y, 0);
    c.raised = 0.2;
    c.setPose(2, -3, 0);
    near(rig.position.y, 0.2, 1e-12);
    c.setEyeLift(0.45);
    near(rig.position.y, 0.65, 1e-12);
  });

  it('turns with the right stick: a step a push (snap), or smoothly', () => {
    const t = setup();
    const { c, xr, camera } = t;
    c.setPose(0, -3, 0);
    enterVR(t, { x: 0.3, z: 0.2 });
    const right = connect(xr, 1, 'right');
    const at = head(camera);
    right.gamepad.axes[2] = 1;
    c.update(1 / 72);
    near(headYaw(camera), -Math.PI / 6, 1e-9);
    run(c, 0.5, 1 / 72);
    near(headYaw(camera), -Math.PI / 6, 1e-9, 'held: one step');
    right.gamepad.axes[2] = 0.4;
    c.update(1 / 72);
    right.gamepad.axes[2] = -0.8;
    c.update(1 / 72);
    near(headYaw(camera), -Math.PI / 6, 1e-9, 'not let go enough to step again');
    right.gamepad.axes[2] = 0;
    c.update(1 / 72);
    right.gamepad.axes[2] = -0.8;
    c.update(1 / 72);
    near(headYaw(camera), 0, 1e-9);
    const now = head(camera);
    near(now.x, at.x, 1e-9, 'turning in place');
    near(now.z, at.z, 1e-9);
    assert.equal(c.turnRate, 0, 'a snap is no turning for the vignette');
    c.setNav({ move: 'smooth', turn: 'smooth' });
    right.gamepad.axes[2] = 0.5;
    c.update(0.1);
    near(headYaw(camera), -0.5 * 1.6 * 0.1, 1e-9);
    near(c.turnRate, 0.8, 1e-12);
    right.gamepad.axes[2] = 0.1;
    c.update(0.1);
    assert.equal(c.turnRate, 0, 'inside the dead zone');
  });

  it('walks with the left stick the way the head faces', () => {
    const t = setup();
    const { c, xr, camera } = t;
    c.setPose(0, -3, Math.PI / 2);
    enterVR(t, { yaw: 0.4 });
    near(headYaw(camera), Math.PI / 2, 1e-9);
    const left = connect(xr, 0, 'left');
    const at = head(camera);
    left.gamepad.axes[3] = -1;
    c.update(0.5);
    const now = head(camera);
    near(now.x, at.x - 1.8 * 0.5, 1e-9);
    near(now.z, at.z, 1e-9);
    left.gamepad.axes[2] = 1;
    left.gamepad.axes[3] = 0;
    c.update(0.5);
    near(head(camera).z, at.z - 1.8 * 0.5, 1e-9, 'and to the right of it');
    near(c.moveSpeed, 1.8, 1e-12);
    assert.ok(c.calls.stand > 0);
    left.gamepad.axes[2] = 0.1;
    c.update(0.1);
    assert.equal(c.moveSpeed, 0, 'inside the dead zone');
  });

  it('teleports with the left stick: pushed it aims, let go it goes, if it is ground to stand on', () => {
    const t = setup();
    const { c, xr, camera, log } = t;
    c.setPose(0, -3, 0);
    enterVR(t);
    c.setNav({ move: 'teleport', turn: 'snap' });
    const left = connect(xr, 0, 'left');
    const hand = c.hands[0];
    hand.controller.position.set(0.2, 1.2, -0.3);
    hand.controller.rotation.set(-Math.PI / 3, 0, 0);
    left.gamepad.axes[3] = -1;
    c.update(1 / 72);
    assert.equal(hand.aiming, true);
    assert.equal(hand.last.kind, 'floor');
    assert.equal(hand.reticle.visible, true);
    near(hand.reticle.scale.x, 3.2);
    assert.equal(hand.reticle.material.color.getHex(), 0xe8c47c);
    const to = { x: hand.last.x, z: hand.last.z };
    near(to.x, 0.2, 1e-9);
    near(to.z, -3.3 - 1.2 / Math.tan(Math.PI / 3), 1e-9);
    left.gamepad.axes[3] = 0;
    c.update(1 / 72);
    assert.equal(hand.aiming, false);
    assert.deepEqual(log.filter((x) => x === 'teleport'), ['teleport']);
    const h = head(camera);
    near(h.x, to.x, 1e-9);
    near(h.z, to.z, 1e-9);
    // Not where one can't stand: a wall, or the floor against one.
    hand.controller.rotation.set(0, 0, 0);
    left.gamepad.axes[3] = -1;
    c.update(1 / 72);
    assert.equal(hand.last.kind, 'wall');
    near(hand.reticle.scale.x, 1);
    left.gamepad.axes[3] = 0;
    c.update(1 / 72);
    c.setPose(0, -5.4, 0);
    hand.controller.rotation.set((-Math.PI * 4) / 9, 0, 0);
    left.gamepad.axes[3] = -1;
    c.update(1 / 72);
    assert.equal(hand.last.kind, 'floor');
    assert.equal(hand.last.walkable, false);
    near(hand.reticle.scale.x, 3.2);
    assert.equal(hand.reticle.material.color.getHex(), 0x8a7f72, 'dim');
    left.gamepad.axes[3] = 0;
    c.update(1 / 72);
    assert.equal(log.filter((x) => x === 'teleport').length, 1);
  });

  it('uses what a hand points at when its trigger is pulled: the doorway, the site\'s, or a teleport', () => {
    const t = setup();
    const { c, xr, camera, log } = t;
    c.setPose(0, -2, Math.PI);
    enterVR(t);
    connect(xr, 1, 'right');
    const hand = c.hands[1];
    hand.controller.position.set(0.2, 1.2, -0.3);
    c.update(1 / 72);
    assert.equal(hand.last.kind, 'door');
    assert.equal(c.hover, 'door');
    assert.equal(c.hoverDoor, true);
    near(hand.reticle.scale.x, 1.8);
    hand.controller.dispatchEvent({ type: 'select' });
    assert.deepEqual(log.at(-1), ['door', 'xr', 'door']);
    assert.ok(log.includes('activity'));
    hand.controller.rotation.set(-Math.PI / 3, 0, 0);
    c.update(1 / 72);
    assert.equal(hand.last.kind, 'floor');
    near(hand.reticle.scale.x, 1);
    assert.equal(hand.reticle.material.color.getHex(), 0xfff0d6);
    const to = { x: hand.last.x, z: hand.last.z };
    hand.controller.dispatchEvent({ type: 'select' });
    assert.equal(log.at(-1), 'teleport');
    near(head(camera).x, to.x, 1e-9);
    near(head(camera).z, to.z, 1e-9);
    c.setPose(0, -3, 0);
    hand.controller.position.set(0.2, 1.6, -0.3);
    hand.controller.rotation.set(0, 0, 0);
    c.update(1 / 72);
    assert.equal(c.hover, 'button');
    near(hand.reticle.scale.x, 1.3, 1e-12, 'the site\'s own size');
    hand.controller.dispatchEvent({ type: 'select' });
    assert.deepEqual(log.at(-1), ['button', 'xr']);
    hand.controller.rotation.set(Math.PI / 2, 0, 0);
    c.update(1 / 72);
    assert.equal(hand.last.kind, 'ceiling');
    assert.equal(hand.reticle.visible, false);
    assert.equal(hand.laser.visible, true);
    assert.equal(c.hover, null);
  });

  it('puts the reticle on the surface, along its normal made unit length', () => {
    const t = setup();
    const { c, xr } = t;
    c.normal = 3;
    c.setPose(0, -3, 0);
    enterVR(t);
    connect(xr, 0, 'left');
    const hand = c.hands[0];
    hand.controller.position.set(0, 1.2, 0);
    hand.controller.rotation.set(-Math.PI / 2, 0, 0);
    c.update(1 / 72);
    assert.equal(hand.last.ny, 3);
    near(hand.reticle.position.y, 0.01, 1e-9);
    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(hand.reticle.quaternion);
    near(facing.y, 1, 1e-9);
  });

  it('shows no laser for a hand that doesn\'t point (a gaze or a screen tap), nor one gone', () => {
    const t = setup();
    const { c, xr } = t;
    c.setPose(0, -3, 0);
    enterVR(t);
    connect(xr, 0, 'left', { mode: 'gaze' });
    connect(xr, 1, 'right');
    c.update(1 / 72);
    assert.equal(c.hands[0].laser.visible, false);
    assert.equal(c.hands[1].laser.visible, true);
    xr.controllers[1].dispatchEvent({ type: 'disconnected' });
    assert.equal(c.hands[1].source, null);
    assert.equal(c.hands[1].laser.visible, false);
    c.update(1 / 72);
    assert.equal(c.hands[1].last, null);
  });

  it('gives each hand\'s stick and buttons to the site first, which takes them from walking and turning', () => {
    const t = setup();
    const { c, xr, camera } = t;
    c.setPose(0, -3, 0);
    enterVR(t);
    c.setNav({ move: 'teleport', turn: 'snap' });
    const left = connect(xr, 0, 'left', { axes: [0, 0, 0, -1] });
    const right = connect(xr, 1, 'right', { axes: [0, 0, 1, 0] });
    c.update(1 / 72);
    assert.equal(c.hands[0].aiming, true);
    near(headYaw(camera), -Math.PI / 6, 1e-9);
    c.reading = true;
    left.gamepad.axes[3] = 0;
    right.gamepad.axes[2] = 0;
    c.update(1 / 72);
    right.gamepad.axes[2] = 1;
    c.update(1 / 72);
    near(headYaw(camera), -Math.PI / 6, 1e-9, 'no turn');
    assert.equal(c.hands[0].aiming, false, 'nor a teleport aimed');
    assert.ok(!t.log.includes('teleport'));
    assert.deepEqual(c.took.at(-1), ['hand', 1, 0]);
  });

  it('gives a grip to the site first; one it leaves is a squeeze', () => {
    const t = setup();
    const { c, xr, log } = t;
    xr.controllers[0].dispatchEvent({ type: 'squeezestart' });
    assert.deepEqual(log.at(-1), ['squeeze', 0]);
    c.reading = true;
    xr.controllers[1].dispatchEvent({ type: 'squeezestart' });
    xr.controllers[1].dispatchEvent({ type: 'squeezeend' });
    assert.deepEqual(log.filter((x) => x[0] === 'squeeze'), [['squeeze', 0]]);
    assert.deepEqual(c.took.map(([what, hand, on]) => [what, c.hands.indexOf(hand), on]), [['grip', 0, true], ['grip', 1, true], ['grip', 1, false]]);
  });

  it('stands on the ground under the head, and walks nowhere by itself', () => {
    const t = setup();
    const { c, rig } = t;
    c.raised = 0.3;
    c.setPose(2, -3, 0);
    enterVR(t, { x: -0.8 });
    near(rig.position.x, 2.8, 1e-9);
    near(rig.position.y, 0.3, 1e-9, 'lined up on the ground under the head, not under the rig');
    c.walkTo(0, -3);
    run(c, 1, 1 / 72);
    near(rig.position.x, 2.8, 1e-9, 'walks are a screen\'s');
    // Stepping off it, the rig comes down after the head.
    t.camera.position.x = -1.5;
    run(c, 0.5, 1 / 72);
    near(rig.position.y, 0, 1e-3);
  });

  it('lets go of the keys and a walk on entering', () => {
    const t = setup();
    const { c, win } = t;
    c.setPose(0, -3, 0);
    down(win, 'KeyW');
    c.walkTo(1, -4);
    enterVR(t);
    assert.equal(c.keys.size, 0);
    assert.equal(c.auto, null);
  });
});
