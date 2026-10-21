// How the visitor moves in VR (src/nav.js), shared through the Hallway's key. The cases come from
// hallway's test/settings.test.js and vrlbry's test/client-nav.test.js.

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { NAV_DEFAULTS, NAV_KEY, loadNav, normalizeNav, saveNav } from '../src/nav.js';

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

/** vrlbry's older setting decides how to move until the Hallway's choice is stored. */
const TELEPORTING = { move: 'teleport', turn: 'snap' };

describe('the movement choice', () => {
  it('is the Hallway\'s key and defaults', () => {
    assert.equal(NAV_KEY, 'hallway.nav');
    assert.deepEqual(NAV_DEFAULTS, { move: 'smooth', turn: 'snap' });
    assert.ok(Object.isFrozen(NAV_DEFAULTS));
  });

  it('keeps valid values, and makes anything else the defaults', () => {
    assert.deepEqual(normalizeNav({ move: 'teleport', turn: 'smooth' }), { move: 'teleport', turn: 'smooth' });
    assert.deepEqual(normalizeNav({ move: 'fly', turn: 'smooth', extra: 1 }), { move: NAV_DEFAULTS.move, turn: 'smooth' });
    for (const bad of [null, undefined, 'teleport', ['teleport'], 7, {}]) assert.deepEqual(normalizeNav(bad), NAV_DEFAULTS, JSON.stringify(bad));
    assert.deepEqual(normalizeNav({ turn: 'smooth' }, TELEPORTING), { move: 'teleport', turn: 'smooth' });
    const out = normalizeNav(null);
    out.move = 'teleport';
    assert.equal(NAV_DEFAULTS.move, 'smooth', 'a copy, not the defaults');
  });

  it('is read from the Hallway\'s key, as the Hallway writes it', () => {
    assert.deepEqual(loadNav(store({ 'hallway.nav': '{"move":"teleport","turn":"smooth"}' })), { move: 'teleport', turn: 'smooth' });
    // The stored choice wins over a site's own defaults.
    assert.deepEqual(loadNav(store({ 'hallway.nav': '{"move":"smooth","turn":"snap"}' }), TELEPORTING), { move: 'smooth', turn: 'snap' });
  });

  it('falls back to the site\'s defaults, then to the Hallway\'s, value by value', () => {
    assert.deepEqual(loadNav(store()), { move: 'smooth', turn: 'snap' });
    assert.deepEqual(loadNav(store(), TELEPORTING), TELEPORTING);
    assert.deepEqual(loadNav(null, TELEPORTING), TELEPORTING, 'no storage');
    assert.deepEqual(loadNav(store({}, { blocked: true })), NAV_DEFAULTS, 'storage refused');
    assert.deepEqual(loadNav(store({ 'hallway.nav': 'not json' }), TELEPORTING), TELEPORTING);
    assert.deepEqual(loadNav(store({ 'hallway.nav': '{"move":"fly"}' }), TELEPORTING), TELEPORTING);
    assert.deepEqual(loadNav(store({ 'hallway.nav': '{"turn":"smooth"}' })), { move: 'smooth', turn: 'smooth' });
    assert.notEqual(loadNav(null, TELEPORTING), TELEPORTING, 'a copy');
  });

  it('is kept under the Hallway\'s key, complete and valid', () => {
    const s = store();
    assert.equal(saveNav({ move: 'teleport', turn: 'sideways', extra: 1 }, s), true);
    assert.deepEqual(JSON.parse(s.m.get('hallway.nav')), { move: 'teleport', turn: 'snap' });
    assert.deepEqual(loadNav(s), { move: 'teleport', turn: 'snap' });
    assert.equal(saveNav({ move: 'teleport' }, store({}, { blocked: true })), false);
    assert.equal(saveNav({ move: 'teleport' }, null), false);
  });

  it('without localStorage (Node, a blocked browser) loads the defaults', () => {
    assert.deepEqual(loadNav(), NAV_DEFAULTS);
  });
});

describe('the movement choice in this browser\'s localStorage, when no storage is passed', () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  /** Puts a localStorage on globalThis for one test, as a value or as a getter. */
  const put = (t, descriptor) => {
    if (before && !before.configurable) t.skip('this Node has a localStorage that cannot be replaced');
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descriptor });
    return !(before && !before.configurable);
  };
  afterEach(() => {
    if (before) Object.defineProperty(globalThis, 'localStorage', before);
    else delete globalThis.localStorage;
  });

  it('reads and writes it, as the Hallway\'s loadNav() and saveNav(nav) did', (t) => {
    const s = store({ 'hallway.nav': '{"move":"teleport","turn":"smooth"}' });
    if (!put(t, { value: s, writable: true })) return;
    assert.deepEqual(loadNav(), { move: 'teleport', turn: 'smooth' });
    assert.equal(saveNav({ move: 'smooth', turn: 'smooth' }), true);
    assert.equal(s.m.get('hallway.nav'), '{"move":"smooth","turn":"smooth"}');
  });

  it('does without it where reading it throws, as in a browser that blocks storage', (t) => {
    if (!put(t, { get() { throw new Error('SecurityError'); } })) return;
    assert.deepEqual(loadNav(), NAV_DEFAULTS);
    assert.equal(saveNav({ move: 'teleport' }), false);
  });
});
