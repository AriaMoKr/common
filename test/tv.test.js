// tv.js: the hallway's cases (isTV, focusStops, nextStop), tvMode, keyOf and the spare keys, the
// controls that keep their keys, and the Remote over a stand-in DOM (an event's path from the window
// down and back up, focus and focusout, a selector or two). With CHROME_TEST=1, a real Chrome too.

import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Page, launchChrome, sleep } from '../tools/chrome.mjs';
import { serve } from '../tools/serve.mjs';
import { Remote, SPARE_KEYS, focusStops, isTV, keepsKey, keyOf, nextStop, tvMode } from '../src/tv.js';

const BRAVIA = 'Mozilla/5.0 (Linux; Android 12; BRAVIA 4K VH21 Build/STT2.230505.001.S136; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/155.0.8059.43 Mobile Safari/537.36';

describe('isTV', () => {
  it("is the TV app's WebView, by the end of its user agent", () => {
    assert.equal(isTV(`${BRAVIA} HallwayTV/1.0.0`), true);
    assert.equal(isTV(`${BRAVIA} HallwayTV/0.0.0-dev`), true);
  });

  it("is nothing else: another app's WebView on the same TV, a desktop, a lookalike, nothing", () => {
    assert.equal(isTV(BRAVIA), false);
    assert.equal(isTV('Mozilla/5.0 (X11; Linux x86_64) Chrome/155.0 Safari/537.36'), false);
    assert.equal(isTV('NotHallwayTV/1.0'), false);
    assert.equal(isTV(`${BRAVIA} HallwayTV/`), false);
    assert.equal(isTV(undefined), false);
    assert.equal(isTV(null), false);
  });
});

describe('tvMode', () => {
  it('is the TV app, or ?tv=emulate in any browser', () => {
    assert.equal(tvMode({ userAgent: `${BRAVIA} HallwayTV/1.0.0`, search: '' }), true);
    assert.equal(tvMode({ userAgent: BRAVIA, search: '?tv=emulate' }), true);
    assert.equal(tvMode({ userAgent: 'Mozilla/5.0 Chrome/155.0', search: '?from=hallway&tv=emulate' }), true);
    assert.equal(tvMode({ userAgent: 'Mozilla/5.0 Chrome/155.0', search: 'tv=emulate' }), true);
  });

  it('is not, without either', () => {
    assert.equal(tvMode({ userAgent: BRAVIA, search: '' }), false);
    assert.equal(tvMode({ userAgent: BRAVIA, search: '?tv=1' }), false);
    assert.equal(tvMode({ userAgent: BRAVIA, search: '?tv=Emulate' }), false);
    assert.equal(tvMode({}), false, "Node's own user agent, and no address");
    assert.equal(tvMode(), false);
  });
});

describe('keyOf', () => {
  it("is a key's code, else its key: OK and adb's keys come without a code", () => {
    assert.equal(keyOf({ code: 'KeyW', key: 'w' }), 'KeyW');
    assert.equal(keyOf({ code: 'KeyW', key: 'z' }), 'KeyW', 'where the key is, whatever the layout');
    assert.equal(keyOf({ code: 'ArrowUp', key: 'ArrowUp' }), 'ArrowUp');
    assert.equal(keyOf({ code: '', key: 'Enter' }), 'Enter');
    assert.equal(keyOf({ code: '', key: 'ArrowLeft' }), 'ArrowLeft');
    assert.equal(keyOf({ key: 'Escape' }), 'Escape');
    assert.equal(keyOf({}), '');
  });

  it('reads the channel keys as up and down, rewind and fast-forward as left and right', () => {
    assert.deepEqual(SPARE_KEYS, { ChannelUp: 'ArrowUp', ChannelDown: 'ArrowDown', MediaRewind: 'ArrowLeft', MediaFastForward: 'ArrowRight' });
    assert.ok(Object.isFrozen(SPARE_KEYS));
    for (const [spare, arrow] of Object.entries(SPARE_KEYS)) {
      assert.equal(keyOf({ code: '', key: spare }), arrow, spare);
      assert.equal(keyOf({ code: spare, key: spare }), arrow, `${spare} as a code too`);
    }
    assert.equal(keyOf({ code: 'Unidentified', key: 'ChannelDown' }), 'ArrowDown');
  });

  it('leaves play and pause, stop, next and the rest alone', () => {
    for (const k of ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious', 'ChannelNumber']) {
      assert.equal(keyOf({ code: '', key: k }), k);
    }
    assert.equal(keyOf({ code: 'toString', key: 'toString' }), 'toString', 'only its own entries');
  });
});

describe('keepsKey', () => {
  const el = (props, attrs = {}) => ({ getAttribute: (n) => attrs[n] ?? null, ...props });

  it('an open combobox keeps up, down and Escape; a closed one, and a disclosure button, none', () => {
    const open = el({ type: 'text', value: 'ki', selectionStart: 2, selectionEnd: 2 }, { role: 'combobox', 'aria-expanded': 'true' });
    for (const k of ['ArrowUp', 'ArrowDown', 'Escape']) assert.equal(keepsKey(open, k), true, k);
    assert.equal(keepsKey(open, 'Enter'), false);
    const closed = el({ type: 'text', value: '' }, { role: 'combobox', 'aria-expanded': 'false' });
    for (const k of ['ArrowUp', 'ArrowDown', 'Escape']) assert.equal(keepsKey(closed, k), false, k);
    const disclosure = el({ type: 'button' }, { 'aria-expanded': 'true' });
    for (const k of ['ArrowUp', 'ArrowDown', 'Escape']) assert.equal(keepsKey(disclosure, k), false, k);
  });

  it('a range keeps left and right, not up and down', () => {
    const range = el({ type: 'range', value: '5' });
    assert.equal(keepsKey(range, 'ArrowLeft'), true);
    assert.equal(keepsKey(range, 'ArrowRight'), true);
    assert.equal(keepsKey(range, 'ArrowUp'), false);
    assert.equal(keepsKey(range, 'ArrowDown'), false);
  });

  it("a text box's caret keeps left and right until it is at that end", () => {
    const at = (type, caret, value = 'abc') => el({ type, value, selectionStart: caret, selectionEnd: caret });
    for (const type of ['text', 'search', 'url', 'textarea']) {
      assert.equal(keepsKey(at(type, 1), 'ArrowLeft'), true, type);
      assert.equal(keepsKey(at(type, 1), 'ArrowRight'), true, type);
      assert.equal(keepsKey(at(type, 0), 'ArrowLeft'), false, `${type} at its start`);
      assert.equal(keepsKey(at(type, 0), 'ArrowRight'), true, type);
      assert.equal(keepsKey(at(type, 3), 'ArrowRight'), false, `${type} at its end`);
      assert.equal(keepsKey(at(type, 3), 'ArrowLeft'), true, type);
    }
    assert.equal(keepsKey(at('text', 0, ''), 'ArrowLeft'), false, 'empty');
    assert.equal(keepsKey(at('text', 0, ''), 'ArrowRight'), false, 'empty');
    assert.equal(keepsKey(el({ type: 'text', value: 'abc', selectionStart: 0, selectionEnd: 3 }), 'ArrowLeft'), false, 'a selection');
    assert.equal(keepsKey(el({ type: 'number', value: '12', selectionStart: null, selectionEnd: null }), 'ArrowLeft'), false, 'no caret to read');
    const throws = el({ type: 'email', value: 'a@b' });
    Object.defineProperty(throws, 'selectionStart', { get: () => { throw new Error('InvalidStateError'); } });
    assert.equal(keepsKey(throws, 'ArrowLeft'), false);
  });

  it('nothing else keeps a key', () => {
    for (const type of ['checkbox', 'radio', 'button', 'submit', 'select-one']) {
      for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'Enter']) assert.equal(keepsKey(el({ type }), k), false, `${type} ${k}`);
    }
    assert.equal(keepsKey(null, 'ArrowUp'), false);
    assert.equal(keepsKey(undefined, 'ArrowLeft'), false);
  });
});

describe('focusStops', () => {
  it('stops once per choice, at its checked option', () => {
    const items = [
      { radio: '' }, // Doors
      { radio: '' }, // Together
      { radio: 'nav-move', checked: false },
      { radio: 'nav-move', checked: true },
      { radio: 'nav-turn', checked: false },
      { radio: 'nav-turn', checked: false },
      { radio: '' }, // seated
      { radio: 'nav-motion', checked: true },
      { radio: 'nav-motion', checked: false },
      { radio: 'nav-motion', checked: false },
      { radio: '' }, // vignette
    ];
    assert.deepEqual(focusStops(items), [0, 1, 3, 4, 6, 7, 10]);
    assert.deepEqual(focusStops([]), []);
  });
});

describe('nextStop', () => {
  it('goes on from the first or the last, and stays at the ends', () => {
    assert.equal(nextStop(5, -1, 1), 0);
    assert.equal(nextStop(5, -1, -1), 4);
    assert.equal(nextStop(5, 2, 1), 3);
    assert.equal(nextStop(5, 2, -1), 1);
    assert.equal(nextStop(5, 4, 1), 4);
    assert.equal(nextStop(5, 0, -1), 0);
    assert.equal(nextStop(0, -1, 1), -1);
  });
});

// A stand-in DOM: elements in a tree, an event's path (the window's capture, the target, the way
// back up), focus with its focusout, and the few selectors tv.js asks for.

class Ev {
  constructor(type, init = {}) {
    Object.assign(this, { type, bubbles: false, cancelable: false, key: '', code: '', repeat: false, ctrlKey: false, altKey: false, metaKey: false, relatedTarget: null }, init);
    this.target = null;
    this.defaultPrevented = false;
    this.stopped = false;
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }

  stopPropagation() {
    this.stopped = true;
  }
}

const dom = { activeElement: null, body: null };
const TYPES = { INPUT: 'text', BUTTON: 'submit', SELECT: 'select-one', TEXTAREA: 'textarea' };

class El {
  constructor(tag, props = {}, kids = []) {
    this.tagName = tag.toUpperCase();
    this.attrs = {};
    this.parent = null;
    this.children = [];
    this.listeners = [];
    this.hidden = false;
    this.disabled = false;
    this.type = TYPES[this.tagName];
    const { attrs = {}, ...rest } = props;
    Object.assign(this.attrs, attrs);
    Object.assign(this, rest);
    kids.forEach((k) => this.append(k));
  }

  set tabIndex(v) {
    this.attrs.tabindex = String(v);
  }

  get tabIndex() {
    return Number(this.attrs.tabindex ?? -1);
  }

  append(k) {
    k.parent = this;
    this.children.push(k);
    return k;
  }

  getAttribute(n) {
    return this.attrs[n] ?? null;
  }

  setAttribute(n, v) {
    this.attrs[n] = String(v);
  }

  removeAttribute(n) {
    delete this.attrs[n];
  }

  contains(o) {
    for (let n = o; n; n = n.parent) if (n === this) return true;
    return false;
  }

  *descendants() {
    for (const k of this.children) {
      yield k;
      yield* k.descendants();
    }
  }

  querySelectorAll(sel) {
    return [...this.descendants()].filter((e) => matches(e, sel));
  }

  checkVisibility() {
    for (let n = this; n; n = n.parent) if (n.hidden) return false;
    return true;
  }

  addEventListener(type, fn, capture = false) {
    this.listeners.push({ type, fn, capture: capture === true });
  }

  dispatchEvent(ev) {
    return dispatch(this, ev);
  }

  focus() {
    focusOn(this);
    this.focused = (this.focused ?? 0) + 1;
  }

  blur() {
    if (dom.activeElement === this) focusOn(dom.body);
  }

  click() {
    if (this.disabled) return;
    if (this.type === 'checkbox') this.checked = !this.checked;
    if (this.type === 'radio') {
      for (const r of dom.body.querySelectorAll('input[type=radio]')) if (r.name === this.name) r.checked = false;
      this.checked = true;
    }
    dispatch(this, new Ev('click', { bubbles: true }));
  }

  stepUp() {
    this.value = String(Math.min(Number(this.max), Number(this.value) + 1));
  }

  stepDown() {
    this.value = String(Math.max(Number(this.min), Number(this.value) - 1));
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  showPicker() {
    this.picked = (this.picked ?? 0) + 1;
  }
}

const win = new El('window');

/** `tag`, `tag[attr]`, `tag[attr=value]` and `[attr]:not([attr="value"])`, comma-separated. */
function matches(e, sel) {
  return sel.split(',').some((part) => {
    const m = part.trim().match(/^([a-z]*)(?:\[([a-z-]+)(?:=["']?([^"'\]]*)["']?)?\])?(?::not\(\[([a-z-]+)=["']?([^"'\]]*)["']?\]\))?$/);
    if (!m) throw new Error(`the stand-in can't match ${part}`);
    const [, tag, attr, value, notAttr, notValue] = m;
    const of = (n) => (n === 'type' && e.tagName === 'INPUT' ? e.type : e.getAttribute(n));
    if (tag && e.tagName !== tag.toUpperCase()) return false;
    if (attr && (of(attr) == null || (value !== undefined && of(attr) !== value))) return false;
    return !(notAttr && of(notAttr) === notValue);
  });
}

function dispatch(target, ev) {
  ev.target = target;
  const path = [];
  for (let n = target; n; n = n.parent) path.push(n);
  path.push(win);
  const run = (node, capture) => {
    for (const l of node.listeners) if (l.type === ev.type && (capture === null || l.capture === capture)) l.fn(ev);
  };
  for (let i = path.length - 1; i > 0 && !ev.stopped; i--) run(path[i], true);
  if (!ev.stopped) run(target, null);
  if (ev.bubbles) for (let i = 1; i < path.length && !ev.stopped; i++) run(path[i], false);
  return !ev.defaultPrevented;
}

function focusOn(el) {
  const was = dom.activeElement;
  if (was === el) return;
  dom.activeElement = el;
  if (was && was !== dom.body) dispatch(was, new Ev('focusout', { bubbles: true, relatedTarget: el === dom.body ? null : el }));
}

/** A key pressed on whatever has the focus, as the TV sends it: no code unless given. */
function press(key, init = {}) {
  const ev = new Ev('keydown', { key, code: '', bubbles: true, cancelable: true, ...init });
  dispatch(dom.activeElement, ev);
  return ev;
}

const settle = () => new Promise((r) => setImmediate(r));

const globals = ['document', 'addEventListener', 'Event', 'KeyboardEvent', 'history', 'navigation', 'hallwayTV'];
const saved = {};

/**
 * A page like the hallway's: the view, and a card of a link, a button, a choice, a checkbox, a range,
 * a select, a combobox and a text area, with a hidden and a disabled button and a span out of the
 * tab order. `walked` is what reaches the site's own listener on the window.
 */
function page({ step, first, rootIsBody = false, empty = false, lead = [] } = {}) {
  win.listeners = [];
  const body = new El('body');
  dom.body = body;
  dom.activeElement = body;
  const view = body.append(new El('canvas'));
  const e = {};
  const card = body.append(new El('div'));
  for (const el of lead) e[el.id] = card.append(el);
  if (!empty) {
    e.doors = card.append(new El('a', { id: 'doors', attrs: { href: '#doors' } }));
    e.together = card.append(new El('button', { id: 'together' }));
    e.moveA = card.append(new El('input', { id: 'moveA', type: 'radio', name: 'move', checked: false }));
    e.moveB = card.append(new El('input', { id: 'moveB', type: 'radio', name: 'move', checked: true }));
    e.moveC = card.append(new El('input', { id: 'moveC', type: 'radio', name: 'move', checked: false, disabled: true }));
    e.seated = card.append(new El('input', { id: 'seated', type: 'checkbox', checked: false }));
    e.size = card.append(new El('input', { id: 'size', type: 'range', value: '5', min: '0', max: '10' }));
    e.theme = card.append(new El('select', { id: 'theme', selectedIndex: 0, multiple: false, options: [{ value: 'light' }, { value: 'dim', disabled: true }, { value: 'dark' }] }));
    e.search = card.append(new El('input', { id: 'search', type: 'search', value: 'abc', selectionStart: 3, selectionEnd: 3, attrs: { role: 'combobox', 'aria-expanded': 'false' } }));
    e.notes = card.append(new El('textarea', { id: 'notes', value: '', selectionStart: 0, selectionEnd: 0 }));
    card.append(new El('div', { hidden: true }, [(e.hidden = new El('button', { id: 'hidden' }))]));
    e.off = card.append(new El('button', { id: 'off', disabled: true }));
    e.span = card.append(new El('span', { id: 'span', attrs: { tabindex: '-1' } }));
  }
  const walked = [];
  addEventListener('keydown', (ev) => walked.push(keyOf(ev)));
  const own = [];
  for (const k of ['size', 'search', 'notes']) e[k]?.addEventListener('keydown', (ev) => own.push(`${k} ${ev.key}`));
  const changes = [];
  e.theme?.addEventListener('input', () => changes.push(`input ${e.theme.selectedIndex}`));
  e.theme?.addEventListener('change', () => changes.push(`change ${e.theme.selectedIndex}`));
  e.size?.addEventListener('input', () => changes.push(`input ${e.size.value}`));
  e.size?.addEventListener('change', () => changes.push(`change ${e.size.value}`));
  const used = [];
  const modes = [];
  const remote = new Remote({ root: rootIsBody ? body : card, view, use: () => used.push(dom.activeElement), step, first });
  remote.onMode = (inCard) => modes.push(inCard);
  return { remote, view, card, body, e, walked, own, changes, used, modes };
}

const at = () => dom.activeElement.id ?? dom.activeElement.tagName.toLowerCase();

describe('Remote, over a stand-in DOM', () => {
  before(() => {
    for (const g of globals) saved[g] = Object.getOwnPropertyDescriptor(globalThis, g);
    Object.assign(globalThis, {
      document: dom,
      addEventListener: (type, fn, capture) => win.addEventListener(type, fn, capture),
      Event: Ev,
      KeyboardEvent: class extends Ev {},
    });
  });

  after(() => {
    for (const g of globals) {
      if (saved[g]) Object.defineProperty(globalThis, g, saved[g]);
      else delete globalThis[g];
    }
  });

  beforeEach(() => {
    delete globalThis.hallwayTV;
    delete globalThis.navigation;
    delete globalThis.history;
  });

  describe('walking', () => {
    it('gives the view the focus, in the tab order', () => {
      const p = page();
      assert.equal(dom.activeElement, p.view);
      assert.equal(p.view.tabIndex, 0);
      assert.equal(p.remote.inCard, false);
    });

    it('leaves the arrows to the site, and the spare keys, read through keyOf', () => {
      const p = page();
      for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ChannelUp', 'MediaFastForward']) {
        assert.equal(press(k).defaultPrevented, false, k);
      }
      assert.equal(press('w', { code: 'KeyW' }).defaultPrevented, false);
      assert.deepEqual(p.walked, ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowRight', 'KeyW']);
      assert.equal(p.remote.inCard, false);
    });

    it('uses the middle of the view on OK (Enter, no code), once per press', () => {
      const p = page();
      assert.equal(press('Enter').defaultPrevented, true, 'not a click on the focused view');
      assert.equal(press('Enter', { repeat: true }).defaultPrevented, true);
      assert.equal(press('Enter', { code: 'NumpadEnter' }).defaultPrevented, true);
      assert.equal(p.used.length, 2);
      assert.equal(press('Enter', { ctrlKey: true }).defaultPrevented, false, 'a modifier: not the remote');
      assert.equal(p.used.length, 2);
    });
  });

  describe('Menu and the card', () => {
    it('Menu goes into the card and out, back to the control it left', () => {
      const p = page();
      assert.equal(p.remote.menu(), true);
      assert.equal(at(), 'doors');
      assert.equal(p.remote.inCard, true);
      press('ArrowDown');
      assert.equal(at(), 'together');
      assert.equal(p.remote.menu(), true);
      assert.equal(dom.activeElement, p.view);
      assert.equal(p.remote.menu(), true);
      assert.equal(at(), 'together');
      assert.deepEqual(p.modes, [true, false, true]);
    });

    it('up and down go from stop to stop, a choice one stop, staying at the ends', () => {
      const p = page();
      p.remote.menu();
      const seen = [at()];
      for (let i = 0; i < 9; i++) {
        const ev = press('ArrowDown');
        assert.equal(ev.defaultPrevented, true);
        seen.push(at());
      }
      assert.deepEqual(seen, ['doors', 'together', 'moveB', 'seated', 'size', 'theme', 'search', 'notes', 'notes', 'notes']);
      press('ArrowUp');
      assert.equal(at(), 'search');
      for (let i = 0; i < 9; i++) press('ChannelUp');
      assert.equal(at(), 'doors', 'the channel keys too');
      assert.deepEqual(p.walked, [], 'none reached the site');
    });

    it('left and right go through a choice, choosing each option reached, past the disabled', () => {
      const p = page();
      p.remote.menu();
      press('ArrowDown');
      press('ArrowDown');
      assert.equal(at(), 'moveB');
      press('ArrowLeft');
      assert.equal(at(), 'moveA');
      assert.deepEqual([p.e.moveA.checked, p.e.moveB.checked], [true, false]);
      press('ArrowLeft');
      assert.equal(at(), 'moveA', 'at the first option');
      press('MediaFastForward');
      press('ArrowRight');
      assert.equal(at(), 'moveB', 'not the disabled one');
      assert.equal(p.e.moveB.checked, true);
      press('ArrowLeft');
      press('ArrowDown');
      assert.equal(at(), 'seated', 'down from any of the choice');
      press('ArrowUp');
      assert.equal(at(), 'moveA', 'the choice is its checked option');
      assert.deepEqual(p.walked, []);
    });

    it('left and right go through a select too, past disabled options, with input and change', () => {
      const p = page();
      p.remote.menu();
      while (at() !== 'theme') press('ArrowDown');
      assert.equal(press('ArrowRight').defaultPrevented, true);
      assert.equal(p.e.theme.selectedIndex, 2);
      press('ArrowRight');
      assert.equal(p.e.theme.selectedIndex, 2, 'at the last');
      press('MediaRewind');
      assert.equal(p.e.theme.selectedIndex, 0);
      assert.deepEqual(p.changes, ['input 2', 'change 2', 'input 0', 'change 0']);
      assert.equal(press('Enter').defaultPrevented, true);
      assert.equal(p.e.theme.picked, 1, 'OK opens its list');
      assert.equal(at(), 'theme');
    });

    it('keeps the focus in the card on left and right anywhere else', () => {
      const p = page();
      p.remote.menu();
      assert.equal(press('ArrowRight').defaultPrevented, true, 'not to the spatial navigation');
      assert.equal(press('ArrowLeft').defaultPrevented, true);
      assert.equal(at(), 'doors');
      assert.deepEqual(p.walked, []);
    });

    it('OK ticks a checkbox, and leaves a link or a button to its own default', () => {
      const p = page();
      p.remote.menu();
      assert.equal(press('Enter').defaultPrevented, false, 'the link follows itself');
      while (at() !== 'seated') press('ArrowDown');
      assert.equal(press('Enter').defaultPrevented, true);
      assert.equal(p.e.seated.checked, true);
      press('Enter');
      assert.equal(p.e.seated.checked, false);
      assert.deepEqual(p.used, [], 'OK in the card is not the view');
    });

    it('Escape walks again', () => {
      const p = page();
      p.remote.menu();
      press('ArrowDown');
      assert.equal(press('Escape').defaultPrevented, true);
      assert.equal(dom.activeElement, p.view);
      assert.deepEqual(p.modes, [true, false]);
      assert.deepEqual(p.walked, []);
    });

    it('stays walking when the card has nothing to stop at', () => {
      const p = page({ empty: true });
      assert.equal(p.remote.menu(), true);
      assert.equal(dom.activeElement, p.view);
      assert.deepEqual(p.modes, []);
    });

    it('never stops at the view, when the card is the whole page', () => {
      const p = page({ rootIsBody: true });
      p.remote.menu();
      assert.equal(at(), 'doors');
      for (let i = 0; i < 9; i++) press('ArrowUp');
      assert.equal(at(), 'doors');
      p.remote.walk();
      assert.equal(p.remote.inCard, false, 'the view, though in the root');
    });
  });

  describe('controls that keep their keys', () => {
    it('a range keeps left and right, up to its own listener and no further', () => {
      const p = page();
      p.remote.menu();
      while (at() !== 'size') press('ArrowDown');
      assert.equal(press('ArrowLeft').defaultPrevented, false, 'its own step');
      assert.equal(press('ArrowRight').defaultPrevented, false);
      assert.deepEqual(p.own, ['size ArrowLeft', 'size ArrowRight']);
      assert.deepEqual(p.walked, []);
      assert.equal(at(), 'size');
      press('ArrowDown');
      assert.equal(at(), 'theme', 'up and down still move on');
    });

    it('a spare key steps a range as its arrow would', () => {
      const p = page();
      p.remote.menu();
      while (at() !== 'size') press('ArrowDown');
      assert.equal(press('MediaRewind').defaultPrevented, true);
      assert.equal(p.e.size.value, '4');
      press('MediaFastForward');
      press('MediaFastForward');
      assert.equal(p.e.size.value, '6');
      p.e.size.value = '10';
      press('MediaFastForward');
      assert.deepEqual(p.changes, ['input 4', 'change 4', 'input 5', 'change 5', 'input 6', 'change 6'], 'none at its end');
      assert.deepEqual(p.own, []);
      assert.deepEqual(p.walked, []);
    });

    it("a text box's caret keeps left and right until it is at an end", () => {
      const p = page();
      p.remote.menu();
      while (at() !== 'search') press('ArrowDown');
      assert.equal(press('ArrowRight').defaultPrevented, true, 'at its end');
      assert.equal(at(), 'search');
      assert.equal(press('ArrowLeft').defaultPrevented, false, 'the caret moves');
      assert.deepEqual(p.own, ['search ArrowLeft']);
      p.e.search.setSelectionRange(1, 1);
      press('MediaFastForward');
      assert.deepEqual([p.e.search.selectionStart, p.e.search.selectionEnd], [2, 2], 'a spare key moves the caret');
      assert.deepEqual(p.walked, []);
    });

    it('an open combobox keeps up and down; closed, they move on', () => {
      const p = page();
      p.remote.menu();
      while (at() !== 'search') press('ArrowDown');
      p.e.search.setAttribute('aria-expanded', 'true');
      assert.equal(press('ArrowDown').defaultPrevented, false);
      assert.equal(press('ArrowUp').defaultPrevented, false);
      assert.equal(press('ChannelDown').defaultPrevented, true);
      assert.deepEqual(p.own, ['search ArrowDown', 'search ArrowUp', 'search ArrowDown'], 'a spare key sent as its arrow');
      assert.equal(at(), 'search');
      p.e.search.setAttribute('aria-expanded', 'false');
      press('ArrowDown');
      assert.equal(at(), 'notes');
      assert.deepEqual(p.walked, []);
    });

    it("an open combobox's Escape is its own; when it lets the focus go, walking", async () => {
      const p = page();
      p.e.search.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        p.e.search.setAttribute('aria-expanded', 'false');
        p.e.search.blur();
      });
      p.remote.menu();
      while (at() !== 'search') press('ArrowDown');
      p.e.search.setAttribute('aria-expanded', 'true');
      press('Escape');
      assert.equal(p.e.search.getAttribute('aria-expanded'), 'false');
      await settle();
      assert.equal(dom.activeElement, p.view);
      assert.deepEqual(p.modes, [true, false]);
      p.remote.menu();
      assert.equal(at(), 'search', 'back to it');
    });

    it('a move from control to control is not a fall to nowhere', async () => {
      const p = page();
      p.remote.menu();
      press('ArrowDown');
      await settle();
      assert.equal(at(), 'together');
      assert.deepEqual(p.modes, [true]);
    });
  });

  describe('a text box the remote steps onto', () => {
    const box = (id, attrs = {}) => new El('input', { id, type: 'text', value: '', selectionStart: 0, selectionEnd: 0, attrs });
    const mode = (el) => el.getAttribute('inputmode');

    it('keeps the keyboard down while stepping onto it and past it', () => {
      const p = page();
      p.remote.menu();
      while (at() !== 'search') press('ArrowDown');
      assert.equal(mode(p.e.search), 'none');
      press('ArrowDown');
      assert.equal(at(), 'notes');
      assert.equal(mode(p.e.search), null, 'its own back: none');
      assert.equal(mode(p.e.notes), 'none', 'a text area too');
      press('ChannelUp');
      assert.equal(mode(p.e.search), 'none');
      assert.equal(mode(p.e.notes), null);
      assert.equal(press('ArrowLeft').defaultPrevented, false, 'its caret still keeps left and right');
      assert.deepEqual(p.own, ['search ArrowLeft']);
      press('ArrowUp');
      assert.equal(at(), 'theme');
      assert.equal(mode(p.e.search), null);
      for (const k of ['size', 'theme', 'doors', 'together']) assert.equal(mode(p.e[k]), null, `${k}: not a text box`);
    });

    it("gives a box its own inputmode back, however the focus leaves it", () => {
      const p = page({ lead: [box('room', { inputmode: 'latin' })] });
      p.remote.menu();
      press('ArrowUp');
      assert.equal(at(), 'room');
      assert.equal(mode(p.e.room), 'none');
      press('ArrowDown');
      assert.equal(mode(p.e.room), 'latin', 'stepped past');
      press('ArrowUp');
      press('Escape');
      assert.equal(mode(p.e.room), 'latin', 'Escape');
      p.remote.menu();
      assert.equal(at(), 'room', 'Menu comes back to it');
      assert.equal(mode(p.e.room), 'none', 'held again');
      p.remote.back();
      assert.equal(mode(p.e.room), 'latin', 'Back');
      p.remote.menu();
      p.remote.menu();
      assert.equal(mode(p.e.room), 'latin', 'Menu');
      assert.equal(dom.activeElement, p.view);
    });

    it("brings the keyboard up on OK: its inputmode back and the focus given again, not the form's Enter", async () => {
      const p = page();
      p.remote.menu();
      while (at() !== 'search') press('ArrowDown');
      const focused = p.e.search.focused;
      assert.equal(press('Enter').defaultPrevented, true, 'no submit');
      assert.equal(mode(p.e.search), null);
      assert.equal(p.e.search.focused, focused + 1, 'focused again');
      assert.equal(at(), 'search');
      await settle();
      assert.equal(at(), 'search', 'the blur in between is not a fall to nowhere');
      assert.deepEqual(p.modes, [true]);
      assert.deepEqual(p.own, [], "the OK was the remote's");
      assert.equal(press('Enter').defaultPrevented, false, "the next is the box's own");
      assert.deepEqual(p.own, ['search Enter']);
      press('ArrowDown');
      press('ArrowUp');
      assert.equal(mode(p.e.search), 'none', 'stepped onto again, held again');
    });

    it('holds only what the remote steps onto: a box the site focuses itself is its own', () => {
      const p = page();
      p.remote.menu();
      p.e.search.focus();
      assert.equal(mode(p.e.search), null);
      assert.equal(press('Enter').defaultPrevented, false);
      assert.deepEqual(p.own, ['search Enter']);
    });
  });

  describe('where Menu lands', () => {
    const box = (id) => new El('input', { id, type: 'search', value: '', selectionStart: 0, selectionEnd: 0 });

    it('without first(), at the first stop that is not a text box', () => {
      const p = page({ lead: [box('find')] });
      p.remote.menu();
      assert.equal(at(), 'doors');
      assert.equal(p.e.find.getAttribute('inputmode'), null, 'never stepped onto');
      press('ArrowUp');
      assert.equal(at(), 'find', 'still a stop');
      assert.equal(p.e.find.getAttribute('inputmode'), 'none');
    });

    it('in a card of text boxes alone, at the first, its keyboard down', () => {
      const p = page({ empty: true, lead: [box('room'), box('name')] });
      p.remote.menu();
      assert.equal(at(), 'room');
      assert.equal(p.e.room.getAttribute('inputmode'), 'none');
    });

    it("with first(), at its stop: itself, the first inside it, or its choice's", () => {
      const land = (pick) => {
        const p = page({ lead: [box('find')], first: () => pick(p) });
        p.book = p.card.append(new El('div', { id: 'book' }, [new El('span', { id: 'title' }), new El('button', { id: 'putBack' }), new El('button', { id: 'next' })]));
        p.remote.menu();
        return at();
      };
      assert.equal(land((p) => p.e.seated), 'seated');
      assert.equal(land((p) => p.book), 'putBack', "a part of the card: its first stop");
      assert.equal(land((p) => p.e.moveA), 'moveB', "an option: its choice's stop, the checked one");
      assert.equal(land((p) => p.e.search), 'search', 'a text box, if asked for');
      assert.equal(land(() => null), 'doors', 'none');
      assert.equal(land(() => undefined), 'doors');
      assert.equal(land((p) => p.e.hidden), 'doors', 'hidden: not a stop');
      assert.equal(land((p) => p.e.off), 'doors', 'disabled');
      assert.equal(land((p) => p.view), 'doors', 'outside the card');
      assert.equal(land((p) => p.e.span), 'doors', 'out of the tab order');
    });

    it('asks first() only when there is no control to come back to', () => {
      let asked = 0;
      const p = page({ first: () => (asked++, p.e.seated) });
      p.remote.menu();
      assert.equal(at(), 'seated');
      press('ArrowDown');
      p.remote.menu();
      p.remote.menu();
      assert.equal(at(), 'size', 'back to the control left');
      assert.equal(asked, 1);
      p.remote.menu();
      p.e.size.hidden = true;
      p.remote.menu();
      assert.equal(at(), 'seated', 'that control gone');
      assert.equal(asked, 2);
    });

    it('forgets the control left when the site says, so first() is asked again', () => {
      let asked = 0;
      const p = page({ first: () => (asked++, p.e.seated) });
      p.remote.menu();
      press('ArrowDown');
      assert.equal(p.remote.back(), true);
      assert.equal(dom.activeElement, p.view, 'walking, the range left');
      p.remote.forget();
      assert.equal(dom.activeElement, p.view, 'the focus as it was');
      p.remote.menu();
      assert.equal(at(), 'seated', "first()'s, not the control left");
      assert.equal(asked, 2);
      press('ArrowDown');
      p.remote.forget(); // in the card: leaving it remembers the control left then
      p.remote.menu();
      p.remote.menu();
      assert.equal(at(), 'size');
      assert.equal(asked, 2);

      const q = page();
      q.remote.menu();
      press('ArrowDown');
      q.remote.menu();
      q.remote.forget();
      q.remote.menu();
      assert.equal(at(), 'doors', 'without first(): the first stop that is not a text box');
    });
  });

  describe('Back, step and the app', () => {
    it('in the card, walks again and says so, without a step', () => {
      let steps = 0;
      const p = page({ step: () => (steps++, true) });
      p.remote.menu();
      assert.equal(p.remote.back(), true);
      assert.equal(dom.activeElement, p.view);
      assert.equal(steps, 0);
    });

    it("walking, is the site's step: true when it took one", () => {
      let answer = true;
      let steps = 0;
      const p = page({ step: () => (steps++, answer) });
      assert.equal(p.remote.back(), true);
      answer = false;
      assert.equal(p.remote.back(), false);
      answer = undefined;
      assert.equal(p.remote.back(), false, 'only true');
      answer = 1;
      assert.equal(p.remote.back(), false, 'only true');
      assert.equal(steps, 4);
      assert.equal(p.remote.inCard, false);
    });

    it('walking with no step, is the app\'s', () => {
      const p = page();
      assert.equal(p.remote.back(), false);
      p.remote.step = () => true;
      assert.equal(p.remote.back(), true, 'a step given later');
    });

    it('closes an open list first, then walks', () => {
      const p = page();
      p.e.search.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') p.e.search.setAttribute('aria-expanded', 'false');
      });
      p.remote.menu();
      while (at() !== 'search') press('ArrowDown');
      p.e.search.setAttribute('aria-expanded', 'true');
      assert.equal(p.remote.back(), true);
      assert.equal(p.e.search.getAttribute('aria-expanded'), 'false');
      assert.equal(at(), 'search', 'still in the card');
      assert.deepEqual(p.walked, []);
      assert.equal(p.remote.back(), true);
      assert.equal(dom.activeElement, p.view);
    });

    it("walks when the list won't close, and when it closes with the focus", () => {
      const p = page();
      p.remote.menu();
      while (at() !== 'search') press('ArrowDown');
      p.e.search.setAttribute('aria-expanded', 'true');
      assert.equal(p.remote.back(), true);
      assert.equal(dom.activeElement, p.view, 'no listener closed it');
      assert.deepEqual(p.own, ['search Escape']);
      p.e.search.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          p.e.search.setAttribute('aria-expanded', 'false');
          p.e.search.blur();
        }
      });
      p.remote.menu();
      assert.equal(at(), 'search');
      assert.equal(p.remote.back(), true);
      assert.equal(dom.activeElement, p.view);
      p.remote.menu();
      assert.equal(at(), 'search');
    });

    it("a gamepad's Back goes back a page when nothing else takes it", () => {
      let backs = 0;
      let answer = false;
      globalThis.history = { back: () => backs++ };
      const p = page({ step: () => answer });
      p.remote.padBack();
      assert.equal(backs, 0, 'no page to go back to');
      globalThis.navigation = { canGoBack: true };
      p.remote.padBack();
      assert.equal(backs, 1);
      answer = true;
      p.remote.padBack();
      p.remote.menu();
      p.remote.padBack();
      assert.equal(backs, 1);
      assert.equal(dom.activeElement, p.view);
    });

    it('answers the app in TV mode only', () => {
      const p = page({ step: () => false });
      assert.equal(p.remote.answerApp(false), false);
      assert.equal('hallwayTV' in globalThis, false);
      assert.equal(p.remote.answerApp(), false, 'tvMode() in Node');
      assert.equal('hallwayTV' in globalThis, false);
      assert.equal(p.remote.answerApp(true), true);
      assert.deepEqual(Object.keys(globalThis.hallwayTV), ['menu', 'back']);
      assert.equal(globalThis.hallwayTV.menu(), true);
      assert.equal(p.remote.inCard, true);
      assert.equal(globalThis.hallwayTV.back(), true);
      assert.equal(p.remote.inCard, false);
      assert.equal(globalThis.hallwayTV.back(), false, 'the app goes back a page');
    });
  });
});

// A real page in a real Chrome (through launchChrome, so no Windows logon): the real selectors,
// focus and visibility, and the browser's own steps for a range and a caret, pressed through DevTools.
describe('a real Chrome', { skip: process.env.CHROME_TEST ? false : 'set CHROME_TEST=1 to start Chrome' }, () => {
  /** Serves `body` with tv.js, opens it at ?tv=emulate, and runs `test` with the page's helpers. */
  async function withPage(body, test) {
    const site = mkdtempSync(join(tmpdir(), 'common-tv-'));
    copyFileSync(fileURLToPath(new URL('../src/tv.js', import.meta.url)), join(site, 'tv.js'));
    writeFileSync(join(site, 'index.html'), `<!doctype html><meta charset="utf-8"><title>tv</title>\n${body}`);
    const server = await serve(site);
    const url = `http://127.0.0.1:${server.address().port}/?tv=emulate`;
    const chrome = await launchChrome({ url });
    try {
      let target = null;
      for (let i = 0; i < 50 && !target; i++) {
        const list = await (await fetch(`${chrome.endpoint}/json/list`)).json();
        target = list.find((t) => t.type === 'page' && t.url === url);
        if (!target) await sleep(100);
      }
      assert.ok(target, 'the page');
      const page = await Page.connect(target.webSocketDebuggerUrl);
      try {
        for (let i = 0; i < 50 && !(await page.evaluate('window.ready === true')); i++) await sleep(100);
        const js = (expression) => page.evaluate(expression);
        const VK = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Enter: 13, Escape: 27 };
        const key = async (k, code = '') => {
          for (const type of ['rawKeyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: VK[k] ?? 0 });
        };
        // OK as the remote sends it, with its character, so that a form's Enter follows if let.
        const ok = async () => {
          await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: '', windowsVirtualKeyCode: 13, text: '\r' });
          await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: '', windowsVirtualKeyCode: 13 });
        };
        const at = () => js('document.activeElement.id || document.activeElement.tagName');
        const mode = (id) => js(`document.getElementById('${id}').getAttribute('inputmode')`);
        await test({ js, key, ok, at, mode });
      } finally {
        page.close();
      }
    } finally {
      await chrome.close();
      server.close();
      rmSync(site, { recursive: true, force: true });
    }
  }

  it('walks, goes into the card and through it, and answers the app, at ?tv=emulate', async () => {
    await withPage(
      `<canvas id="view" width="320" height="180"></canvas>
<div id="card">
  <a href="#doors" id="doors">Doors</a>
  <button id="together">Together</button>
  <label><input type="radio" name="move" value="a" id="moveA">A</label>
  <label><input type="radio" name="move" value="b" id="moveB" checked>B</label>
  <label><input type="checkbox" id="seated">Seated</label>
  <input type="range" id="size" min="0" max="10" value="5">
  <select id="theme"><option>light</option><option disabled>dim</option><option>dark</option></select>
  <input id="search" type="search" role="combobox" aria-expanded="false" value="abc">
  <textarea id="notes"></textarea>
  <div hidden><button id="hidden">Hidden</button></div>
  <button id="off" disabled>Off</button>
  <span tabindex="-1">out of the tab order</span>
</div>
<script type="module">
  import { Remote, keyOf, tvMode } from './tv.js';
  const log = (window.log = []);
  addEventListener('keydown', (e) => log.push('site ' + keyOf(e)));
  const search = document.getElementById('search');
  search.addEventListener('keydown', (e) => {
    log.push('search ' + e.key);
    if (e.key === 'Escape') {
      search.setAttribute('aria-expanded', 'false');
      search.blur();
    }
  });
  document.getElementById('theme').addEventListener('change', (e) => log.push('change ' + e.target.value));
  document.documentElement.classList.toggle('tv', tvMode());
  Object.assign(window, { used: 0, steps: 0, modes: [] });
  const remote = new Remote({
    root: document.getElementById('card'),
    view: document.getElementById('view'),
    use: () => window.used++,
    step: () => (window.steps++, false),
  });
  remote.onMode = (inCard) => window.modes.push(inCard);
  window.answered = remote.answerApp();
  window.ready = true;
</script>`,
      async ({ js, key, at, mode }) => {
        assert.equal(await js("document.documentElement.classList.contains('tv')"), true);
        assert.equal(await js('window.answered'), true);
        assert.equal(await at(), 'view');
        await key('ArrowUp', 'ArrowUp');
        await key('ChannelDown');
        await key('Enter');
        assert.deepEqual(await js('window.log'), ['site ArrowUp', 'site ArrowDown', 'site Enter']);
        assert.equal(await js('window.used'), 1);

        assert.equal(await js('window.hallwayTV.menu()'), true);
        const seen = [await at()];
        for (let i = 0; i < 8; i++) {
          await key('ArrowDown', 'ArrowDown');
          seen.push(await at());
        }
        assert.deepEqual(seen, ['doors', 'together', 'moveB', 'seated', 'size', 'theme', 'search', 'notes', 'notes']);
        assert.equal(await mode('notes'), 'none', 'its keyboard kept down');
        for (let i = 0; i < 5; i++) await key('ArrowUp', 'ArrowUp');
        assert.equal(await at(), 'moveB');
        assert.equal(await mode('notes'), null, 'and its own inputmode back');
        await key('ArrowLeft', 'ArrowLeft');
        assert.equal(await at(), 'moveA');
        assert.equal(await js("document.querySelector('input[name=move]:checked').id"), 'moveA');

        for (let i = 0; i < 2; i++) await key('ArrowDown', 'ArrowDown');
        assert.equal(await at(), 'size');
        await key('ArrowLeft', 'ArrowLeft');
        await key('ArrowLeft', 'ArrowLeft');
        await key('MediaFastForward');
        assert.equal(await js("document.getElementById('size').value"), '4', "the range's own steps, and a spare key's");

        await key('ArrowDown', 'ArrowDown');
        await key('ArrowRight', 'ArrowRight');
        assert.equal(await js("document.getElementById('theme').value"), 'dark');

        await key('ArrowDown', 'ArrowDown');
        assert.equal(await at(), 'search');
        assert.equal(await mode('search'), 'none');
        await js("document.getElementById('search').setSelectionRange(3, 3)");
        await key('ArrowRight', 'ArrowRight');
        assert.equal(await at(), 'search', 'at its end, still the box');
        await key('ArrowLeft', 'ArrowLeft');
        assert.equal(await js("document.getElementById('search').selectionStart"), 2, 'the caret moved');
        await js("document.getElementById('search').setAttribute('aria-expanded', 'true')");
        await key('ArrowDown', 'ArrowDown');
        assert.equal(await at(), 'search', 'its list has the arrows');
        await key('Escape', 'Escape');
        await sleep(50);
        assert.equal(await at(), 'view', 'its Escape let the focus go: walking');
        assert.equal(await mode('search'), null);

        assert.deepEqual(await js('window.log.slice(3)'), ['change dark', 'search ArrowLeft', 'search ArrowDown', 'search Escape'], 'nothing walked in the card');
        assert.deepEqual(await js('window.modes'), [true, false]);
        assert.equal(await js('window.hallwayTV.back()'), false, 'walking, and the step took none');
        assert.equal(await js('window.steps'), 1);
        assert.equal(await js('window.hallwayTV.menu()'), true);
        assert.equal(await at(), 'search');
        assert.equal(await js('window.hallwayTV.back()'), true);
        assert.equal(await at(), 'view');
      },
    );
  });

  it("lands Menu by first(), else past the text boxes, and keeps a box's keyboard down until OK", async () => {
    await withPage(
      `<canvas id="view" width="320" height="180"></canvas>
<div id="card">
  <input id="find" type="search" placeholder="Search">
  <a href="#doors" id="doors">Doors</a>
  <form id="join"><input id="room" inputmode="text" autocomplete="off"><button id="go">Join</button></form>
  <div id="book"><button id="putBack">Put back</button><button id="next">Next page</button></div>
</div>
<script type="module">
  import { Remote } from './tv.js';
  const log = (window.log = []);
  const room = document.getElementById('room');
  document.getElementById('join').addEventListener('submit', (e) => {
    e.preventDefault();
    log.push('submit ' + room.value);
  });
  room.addEventListener('focus', () => log.push('focus'));
  room.addEventListener('blur', () => log.push('blur'));
  window.reading = true;
  const remote = new Remote({
    root: document.getElementById('card'),
    view: document.getElementById('view'),
    use: () => {},
    first: () => (window.reading ? document.getElementById('book') : null),
  });
  remote.answerApp(true);
  window.ready = true;
</script>`,
      async ({ js, key, ok, at, mode }) => {
        assert.equal(await js('window.hallwayTV.menu()'), true);
        assert.equal(await at(), 'putBack', "first(): the book's first button");
        assert.equal(await js('window.hallwayTV.back()'), true);
        await js("window.reading = false; document.getElementById('book').hidden = true");
        assert.equal(await js('window.hallwayTV.menu()'), true);
        assert.equal(await at(), 'doors', 'the control left is gone and first() gives none: past the search box');
        assert.equal(await mode('find'), null, 'never stepped onto');

        await key('ArrowUp', 'ArrowUp');
        assert.equal(await at(), 'find');
        assert.equal(await mode('find'), 'none');
        await key('ArrowDown', 'ArrowDown');
        await key('ArrowDown', 'ArrowDown');
        assert.equal(await at(), 'room');
        assert.deepEqual([await mode('find'), await mode('room')], [null, 'none'], 'its own back, and the next held');

        await ok();
        assert.equal(await at(), 'room');
        assert.equal(await mode('room'), 'text', 'its own inputmode, for the keyboard');
        assert.deepEqual(await js('window.log'), ['focus', 'blur', 'focus'], 'the focus given again, and no submit');
        await js("document.getElementById('room').value = 'k3vd-q8hn'");
        await ok();
        assert.deepEqual(await js('window.log.slice(3)'), ['submit k3vd-q8hn'], "the next OK is the box's own");

        assert.equal(await js('window.hallwayTV.back()'), true);
        assert.equal(await at(), 'view');
        assert.equal(await mode('room'), 'text');
        assert.equal(await js('window.hallwayTV.menu()'), true);
        assert.equal(await at(), 'room', 'back to the box');
        assert.equal(await mode('room'), 'none', 'held again');
        await key('ArrowDown', 'ArrowDown');
        assert.equal(await at(), 'go');
        assert.equal(await mode('room'), 'text');
      },
    );
  });
});
