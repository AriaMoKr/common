// Accessibility settings (src/access.js): kept as nav.js keeps the movement choice, reduced motion
// against a stand-in for the media query, the vignette in Node with three, and the seated lift.

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import * as THREE from 'three';
import {
  ACCESS_DEFAULTS, ACCESS_KEY, REDUCED_MOTION, SEATED_LIFT, VIGNETTE, Vignette, eyeLift, loadAccess, motionQuery,
  normalizeAccess, reduceMotion, saveAccess, watchMotion,
} from '../src/access.js';

/** A localStorage stand-in: a Map behind getItem / setItem, or one that refuses. */
const store = (entries = {}, { blocked = false } = {}) => {
  const m = new Map(Object.entries(entries));
  return {
    m,
    getItem: (k) => {
      if (blocked) throw new Error('SecurityError');
      return m.has(k) ? m.get(k) : null;
    },
    setItem: (k, v) => {
      if (blocked) throw new Error('QuotaExceededError');
      m.set(k, String(v));
    },
  };
};

/** A stand-in for matchMedia(REDUCED_MOTION): its matches, and change events. */
const mediaQuery = (matches, { legacy = false } = {}) => {
  const listeners = new Set();
  const q = {
    matches,
    listeners,
    /** The system's setting changes. */
    flip(to) {
      q.matches = to;
      for (const fn of [...listeners]) fn({ matches: to });
    },
  };
  if (legacy) {
    q.addListener = (fn) => listeners.add(fn);
    q.removeListener = (fn) => listeners.delete(fn);
  } else {
    q.addEventListener = (type, fn) => type === 'change' && listeners.add(fn);
    q.removeEventListener = (type, fn) => type === 'change' && listeners.delete(fn);
  }
  return q;
};

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);
const DEG = Math.PI / 180;

describe('the settings', () => {
  it('are the Hallway\'s key and defaults', () => {
    assert.equal(ACCESS_KEY, 'hallway.access');
    assert.deepEqual(ACCESS_DEFAULTS, { motion: 'system', vignette: true, seated: false });
    assert.ok(Object.isFrozen(ACCESS_DEFAULTS));
  });

  it('keep valid values, and make anything else the defaults, value by value', () => {
    assert.deepEqual(normalizeAccess({ motion: 'reduce', vignette: false, seated: true }), { motion: 'reduce', vignette: false, seated: true });
    assert.deepEqual(normalizeAccess({ motion: 'full' }), { motion: 'full', vignette: true, seated: false });
    assert.deepEqual(normalizeAccess({ motion: 'slow', vignette: 'no', seated: 1, extra: 1 }), ACCESS_DEFAULTS);
    for (const bad of [null, undefined, 'reduce', ['reduce'], 7, {}]) assert.deepEqual(normalizeAccess(bad), ACCESS_DEFAULTS, JSON.stringify(bad));
    assert.deepEqual(normalizeAccess({ seated: true }, { motion: 'reduce', vignette: false, seated: false }), { motion: 'reduce', vignette: false, seated: true });
    const out = normalizeAccess(null);
    out.seated = true;
    assert.equal(ACCESS_DEFAULTS.seated, false, 'a copy, not the defaults');
  });

  it('are read from the Hallway\'s key, falling back to the defaults', () => {
    assert.deepEqual(loadAccess(store({ 'hallway.access': '{"motion":"reduce","vignette":false,"seated":true}' })), { motion: 'reduce', vignette: false, seated: true });
    assert.deepEqual(loadAccess(store({ 'hallway.access': '{"seated":true}' })), { motion: 'system', vignette: true, seated: true });
    assert.deepEqual(loadAccess(store()), ACCESS_DEFAULTS);
    assert.deepEqual(loadAccess(null), ACCESS_DEFAULTS, 'no storage');
    assert.deepEqual(loadAccess(store({}, { blocked: true })), ACCESS_DEFAULTS, 'storage refused');
    assert.deepEqual(loadAccess(store({ 'hallway.access': 'not json' })), ACCESS_DEFAULTS);
    const mine = { motion: 'full', vignette: false, seated: false };
    assert.deepEqual(loadAccess(store(), mine), mine, 'a site\'s own defaults');
    assert.notEqual(loadAccess(null, mine), mine, 'a copy');
  });

  it('are kept under the Hallway\'s key, complete and valid', () => {
    const s = store();
    assert.equal(saveAccess({ motion: 'reduce', vignette: 'sometimes', extra: 1 }, s), true);
    assert.deepEqual(JSON.parse(s.m.get('hallway.access')), { motion: 'reduce', vignette: true, seated: false });
    assert.deepEqual(loadAccess(s), { motion: 'reduce', vignette: true, seated: false });
    assert.equal(saveAccess({ seated: true }, store({}, { blocked: true })), false);
    assert.equal(saveAccess({ seated: true }, null), false);
  });

  it('without localStorage (Node, a blocked browser) load the defaults', () => {
    assert.deepEqual(loadAccess(), ACCESS_DEFAULTS);
  });

  it('live beside the movement choice, not in it', () => {
    const s = store({ 'hallway.nav': '{"move":"teleport","turn":"snap"}' });
    saveAccess({ seated: true }, s);
    assert.deepEqual([...s.m.keys()], ['hallway.nav', 'hallway.access']);
    assert.equal(s.m.get('hallway.nav'), '{"move":"teleport","turn":"snap"}');
  });
});

describe('the settings in this browser\'s localStorage, when no storage is passed', () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const put = (t, descriptor) => {
    if (before && !before.configurable) t.skip('this Node has a localStorage that cannot be replaced');
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descriptor });
    return !(before && !before.configurable);
  };
  afterEach(() => {
    if (before) Object.defineProperty(globalThis, 'localStorage', before);
    else delete globalThis.localStorage;
  });

  it('reads and writes it', (t) => {
    const s = store({ 'hallway.access': '{"motion":"full"}' });
    if (!put(t, { value: s, writable: true })) return;
    assert.deepEqual(loadAccess(), { motion: 'full', vignette: true, seated: false });
    assert.equal(saveAccess({ motion: 'full', seated: true }), true);
    assert.equal(s.m.get('hallway.access'), '{"motion":"full","vignette":true,"seated":true}');
  });

  it('does without it where reading it throws', (t) => {
    if (!put(t, { get() { throw new Error('SecurityError'); } })) return;
    assert.deepEqual(loadAccess(), ACCESS_DEFAULTS);
    assert.equal(saveAccess({ seated: true }), false);
  });
});

describe('reduced motion', () => {
  it('is the visitor\'s choice, or the system\'s with \'system\'', () => {
    for (const system of [true, false]) {
      const q = mediaQuery(system);
      assert.equal(reduceMotion({ motion: 'reduce' }, q), true, `reduce, system ${system}`);
      assert.equal(reduceMotion({ motion: 'full' }, q), false, `full, system ${system}`);
      assert.equal(reduceMotion({ motion: 'system' }, q), system, `system, system ${system}`);
      assert.equal(reduceMotion(ACCESS_DEFAULTS, q), system, 'the default follows the system');
      assert.equal(reduceMotion({ motion: 'sometimes' }, q), system, 'anything else follows the system');
      assert.equal(reduceMotion(null, q), system, 'no settings');
    }
  });

  it('is full without a system setting to read (Node, no matchMedia)', () => {
    assert.equal(motionQuery(), null);
    assert.equal(reduceMotion({ motion: 'system' }), false);
    assert.equal(reduceMotion({ motion: 'system' }, null), false);
    assert.equal(reduceMotion({ motion: 'reduce' }, null), true);
  });

  it('asks the system with prefers-reduced-motion, by default', () => {
    const asked = [];
    globalThis.matchMedia = (q) => {
      asked.push(q);
      return mediaQuery(true);
    };
    try {
      assert.equal(REDUCED_MOTION, '(prefers-reduced-motion: reduce)');
      assert.equal(reduceMotion({ motion: 'system' }), true);
      assert.equal(motionQuery().matches, true);
      assert.deepEqual(asked, [REDUCED_MOTION, REDUCED_MOTION]);
      globalThis.matchMedia = () => { throw new Error('not here'); };
      assert.equal(motionQuery(), null);
    } finally {
      delete globalThis.matchMedia;
    }
  });

  it('follows the system\'s setting as it changes, until stopped', () => {
    for (const legacy of [false, true]) {
      const q = mediaQuery(false, { legacy });
      const access = { motion: 'system' };
      const seen = [];
      const stop = watchMotion((reduce) => seen.push([reduce, reduceMotion(access, q)]), q);
      q.flip(true);
      q.flip(false);
      stop();
      q.flip(true);
      assert.deepEqual(seen, [[true, true], [false, false]], legacy ? 'addListener' : 'addEventListener');
      assert.equal(q.listeners.size, 0, 'stopped');
    }
    assert.equal(typeof watchMotion(() => {}, null), 'function', 'nothing to follow');
    assert.doesNotThrow(watchMotion(() => {}));
  });
});

describe('the vignette', () => {
  const camera = () => new THREE.PerspectiveCamera();
  /** The clear view's half-angle at a strength. */
  const inner = (s) => VIGNETTE.open + (VIGNETTE.closed - VIGNETTE.open) * s;

  it('is a ring on the camera, under the fade, open at first', () => {
    const cam = camera();
    const v = new Vignette(cam);
    assert.equal(v.mesh.parent, cam);
    assert.deepEqual([v.mesh.name, v.mesh.renderOrder, v.mesh.frustumCulled], ['vignette', 1e6 - 1, false]);
    assert.deepEqual([v.material.side, v.material.transparent, v.material.depthTest, v.material.depthWrite], [THREE.BackSide, true, false, false]);
    assert.deepEqual([v.enabled, v.strength, v.mesh.visible], [true, 0, false]);
    near(v.material.uniforms.uInner.value, VIGNETTE.open, 'open');
    near(v.material.uniforms.uFeather.value, VIGNETTE.feather, 'feather');
    assert.equal(new Vignette(cam, false).enabled, false);
  });

  it('closes in while the visitor moves smoothly in VR, and opens when they stop', () => {
    const v = new Vignette(camera());
    v.update(0.05, VIGNETTE.fullSpeed, 0, true); // walking at full stick
    near(v.strength, 0.05 * VIGNETTE.rise, 'closing');
    assert.equal(v.mesh.visible, true);
    near(v.material.uniforms.uInner.value, inner(v.strength), 'uInner follows');
    v.update(0.2, VIGNETTE.fullSpeed, 0, true);
    assert.equal(v.strength, 1, 'fully closed within 0.15 s');
    near(v.material.uniforms.uInner.value, VIGNETTE.closed, 'closed');
    v.update(1, VIGNETTE.fullSpeed * 3, 0, true);
    assert.equal(v.strength, 1, 'no further when running');
    v.update(0.1, 0, 0, true); // stopped
    near(v.strength, 1 - 0.1 * VIGNETTE.fall, 'opening, more slowly');
    v.update(0.5, 0, 0, true);
    assert.deepEqual([v.strength, v.mesh.visible], [0, false]);
  });

  it('closes as far as the speed or the turning asks, whichever is more', () => {
    const settle = (speed, turn) => {
      const v = new Vignette(camera());
      for (let i = 0; i < 60; i++) v.update(1 / 60, speed, turn, true);
      return v.strength;
    };
    near(settle(VIGNETTE.fullSpeed / 2, 0), 0.5, 'half speed');
    near(settle(0, VIGNETTE.fullTurn / 4), 0.25, 'turning slowly');
    near(settle(0, -VIGNETTE.fullTurn), 1, 'turning the other way');
    near(settle(-VIGNETTE.fullSpeed / 2, VIGNETTE.fullTurn * 0.8), 0.8, 'both: the turning');
    near(settle(0.3 * VIGNETTE.fullSpeed, 0.1 * VIGNETTE.fullTurn), 0.3, 'both: the walking');
    assert.equal(settle(NaN, undefined), 0, 'nonsense is no motion');
    // From part way to more, and back to less.
    const v = new Vignette(camera());
    for (let i = 0; i < 60; i++) v.update(1 / 60, VIGNETTE.fullSpeed * 0.4, 0, true);
    for (let i = 0; i < 60; i++) v.update(1 / 60, VIGNETTE.fullSpeed * 0.9, 0, true);
    near(v.strength, 0.9, 'up to more');
    for (let i = 0; i < 60; i++) v.update(1 / 60, VIGNETTE.fullSpeed * 0.2, 0, true);
    near(v.strength, 0.2, 'down to less');
  });

  it('stays open when the visitor turns it off, or outside VR, and opens at once then', () => {
    const off = new Vignette(camera(), false);
    for (let i = 0; i < 30; i++) off.update(1 / 30, VIGNETTE.fullSpeed, VIGNETTE.fullTurn, true);
    assert.deepEqual([off.strength, off.mesh.visible], [0, false], 'off');
    const flat = new Vignette(camera());
    for (let i = 0; i < 30; i++) flat.update(1 / 30, VIGNETTE.fullSpeed, VIGNETTE.fullTurn, false);
    assert.deepEqual([flat.strength, flat.mesh.visible], [0, false], 'outside VR');
    const v = new Vignette(camera());
    v.update(1, VIGNETTE.fullSpeed, 0, true);
    assert.equal(v.strength, 1);
    v.update(1 / 72, VIGNETTE.fullSpeed, 0, false);
    assert.deepEqual([v.strength, v.mesh.visible], [0, false], 'leaving VR');
    v.update(1, VIGNETTE.fullSpeed, 0, true);
    v.enabled = false;
    v.update(1 / 72, VIGNETTE.fullSpeed, 0, true);
    assert.deepEqual([v.strength, v.mesh.visible], [0, false], 'turned off while closed');
  });

  it('can be set at once, within 0 and 1', () => {
    const v = new Vignette(camera());
    v.set(0.5);
    near(v.material.uniforms.uInner.value, inner(0.5), 'half');
    assert.equal(v.mesh.visible, true);
    v.set(4);
    assert.equal(v.strength, 1);
    v.set(-1);
    assert.deepEqual([v.strength, v.mesh.visible], [0, false]);
  });

  it('allocates nothing per frame', () => {
    const v = new Vignette(camera());
    const uniforms = v.material.uniforms, inner = uniforms.uInner;
    for (let i = 0; i < 100; i++) v.update(1 / 72, (i % 20) / 10, 0, true);
    assert.equal(v.material.uniforms, uniforms);
    assert.equal(v.material.uniforms.uInner, inner);
  });

  it('is at infinity in each eye: its shader measures from the eye being drawn, against the head\'s straight ahead', () => {
    const { vertexShader, fragmentShader } = new Vignette(camera()).material;
    assert.match(vertexShader, /vAhead = -modelMatrix\[2\]\.xyz;/);
    assert.match(fragmentShader, /acos\(clamp\(dot\(normalize\(vWorld - cameraPosition\), normalize\(vAhead\)\), -1\.0, 1\.0\)\)/);
    assert.match(fragmentShader, /smoothstep\(uInner, uInner \+ uFeather, a\)/);
    const declared = [...`${vertexShader}\n${fragmentShader}`.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((x) => x[1]);
    assert.deepEqual(declared.sort(), ['uFeather', 'uInner']);
  });

  it('closes from 60° to 30° of clear view, with a 15° soft edge, in 0.15 s, and opens in 0.4 s', () => {
    near(VIGNETTE.open, 60 * DEG, 'open');
    near(VIGNETTE.closed, 30 * DEG, 'closed');
    near(VIGNETTE.feather, 15 * DEG, 'feather');
    near(1 / VIGNETTE.rise, 0.15, 'rise');
    near(1 / VIGNETTE.fall, 0.4, 'fall');
    assert.deepEqual([VIGNETTE.fullSpeed, VIGNETTE.fullTurn], [1.8, 1.6]);
    assert.ok(Object.isFrozen(VIGNETTE));
  });
});

describe('seated', () => {
  it('raises the eyes about 0.45 m in VR when seated, and not otherwise', () => {
    assert.equal(SEATED_LIFT, 0.45);
    assert.equal(eyeLift({ seated: true }), 0.45);
    assert.equal(eyeLift({ ...ACCESS_DEFAULTS, seated: true }), SEATED_LIFT);
    assert.equal(eyeLift(ACCESS_DEFAULTS), 0);
    assert.equal(eyeLift({ seated: 'yes' }), 0);
    assert.equal(eyeLift(null), 0);
    assert.equal(eyeLift(undefined), 0);
  });
});
