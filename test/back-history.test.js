// The browser's Back for a book that is out (src/back-history.js): it goes back along the links
// followed, then puts the book away. With a fake history: entries, a current one, and popstate
// delivered later, as a browser does. vrlbry's test/client-back-history.test.js (777138d), its
// fields neutral, and the prefix that names them.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BackHistory } from '../src/back-history.js';

class FakeHistory {
  constructor() {
    this.entries = [{ state: null }];
    this.i = 0;
    this.pending = [];
    this.left = 0; // Backs past the first entry: the browser left the page
  }
  get state() { return this.entries[this.i].state; }
  pushState(state) {
    this.entries.length = this.i + 1;
    this.entries.push({ state: structuredClone(state) });
    this.i++;
  }
  replaceState(state) { this.entries[this.i].state = state; }
  back() { this.go(-1); }
  forward() { this.go(1); }
  go(n) {
    const j = this.i + n;
    if (j < 0) {
      this.left++;
      return;
    }
    if (j >= this.entries.length) return;
    this.i = j;
    this.pending.push(this.entries[j].state);
  }
}

/** Delivers the popstates until none are left (each may cause more). */
async function settle(h, bh) {
  for (let n = 0; n < 50 && h.pending.length; n++) {
    bh.popstate(h.pending.shift());
    await new Promise((r) => setTimeout(r, 0));
  }
}

function setup({ trail = true, history = new FakeHistory(), prefix = undefined } = {}) {
  const h = history;
  const backs = [];
  const aways = [];
  const bh = new BackHistory({ history: h, load: 1, onBack: (d) => { backs.push(d); return trail; }, onAway: () => aways.push(h.i), prefix });
  return { h, bh, backs, aways };
}

describe('the browser\'s Back for a book that is out', () => {
  it('puts the book away, and then leaves the page as before', async () => {
    const { h, bh, aways } = setup();
    bh.bookOut();
    assert.equal(h.entries.length, 2, 'an entry for the book');
    assert.equal(bh.back(), false, 'no link: the toolbar\'s Back has nothing to go through');
    h.back();
    await settle(h, bh);
    assert.deepEqual(aways, [0], 'put away');
    assert.equal(bh.level, 0);
    h.back();
    await settle(h, bh);
    assert.equal(h.left, 1);
  });

  it('goes back one link at a time, by the browser\'s Back or the toolbar\'s, then puts the book away', async () => {
    const { h, bh, backs, aways } = setup();
    bh.bookOut();
    bh.pushed(1);
    bh.pushed(2);
    assert.equal(h.entries.length, 4);
    h.back(); // the browser's Back
    await settle(h, bh);
    assert.deepEqual(backs, [1]);
    assert.equal(bh.back(), true, 'the toolbar\'s Back goes through the history');
    await settle(h, bh);
    assert.deepEqual(backs, [1, 0]);
    assert.equal(bh.back(), false, 'no link\'s entry left: the toolbar does it itself');
    assert.deepEqual(aways, []);
    h.back();
    await settle(h, bh);
    assert.deepEqual(aways, [0], 'past the links: the book is put away');
    assert.deepEqual(backs, [1, 0]);
  });

  it('keeps the state already there (the address\'s), and goes nowhere forward', async () => {
    const { h, bh, backs, aways } = setup();
    h.replaceState({ other: true });
    bh.bookOut();
    bh.pushed(1);
    assert.deepEqual(h.state, { other: true, backBook: 1, backTrail: 1, backLoad: 1 });
    h.back();
    await settle(h, bh);
    h.forward();
    await settle(h, bh);
    assert.deepEqual(backs, [0], 'Forward does not follow the link again');
    assert.equal(bh.level, 2);
    h.go(-2);
    await settle(h, bh);
    h.forward();
    await settle(h, bh);
    assert.deepEqual(aways, [0], 'nor take the book out again');
  });

  it('takes the entries back out when the book is put away otherwise', async () => {
    for (const links of [0, 2]) {
      const { h, bh, backs, aways } = setup();
      bh.bookOut();
      for (let d = 1; d <= links; d++) bh.pushed(d);
      bh.cleared();
      await settle(h, bh);
      assert.deepEqual([backs, aways], [[], []], 'nothing to go back to or put away');
      assert.equal(h.i, 0, `${links} links`);
      assert.equal(bh.back(), false);
      h.back();
      assert.equal(h.left, 1, 'the next Back leaves the page');
    }
  });

  it('keeps the entries when a link swaps another book in', () => {
    const { h, bh } = setup();
    bh.bookOut();
    bh.pushed(1);
    bh.bookOut(); // the link's book comes off its shelf
    assert.equal(h.entries.length, 3);
    assert.equal(bh.level, 2);
  });

  it('adds a book\'s entry once the last one\'s are out, when it came out meanwhile', async () => {
    const { h, bh, aways } = setup();
    bh.bookOut();
    bh.pushed(1);
    bh.cleared(); // put away: its entries go, later
    bh.bookOut(); // another book comes out before they have
    assert.equal(h.entries.length, 3, 'nothing added yet');
    await settle(h, bh);
    assert.equal(h.i, 1);
    assert.equal(h.entries.length, 2, 'the new book\'s entry, the old ones gone');
    h.back();
    await settle(h, bh);
    assert.deepEqual(aways, [0]);
  });

  it('goes back to the book\'s entry when the trail has no such place any more', async () => {
    const { h, bh, backs, aways } = setup({ trail: false });
    bh.bookOut();
    bh.pushed(1);
    bh.pushed(2);
    h.back();
    await settle(h, bh);
    assert.deepEqual(backs, [1]);
    assert.equal(h.i, 1, 'rewound to the book\'s entry');
    assert.equal(bh.level, 1);
    assert.deepEqual(aways, []);
  });

  it('passes over the entries an earlier load of the page left', async () => {
    const { h, bh, backs, aways } = setup();
    h.pushState({ backBook: 1, backTrail: 0, backLoad: 0 });
    h.pushState({ backBook: 1, backTrail: 1, backLoad: 0 }); // then a reload: this load is 1
    h.back();
    await settle(h, bh);
    assert.deepEqual([backs, aways], [[], []]);
    assert.equal(h.i, 0);
  });

  it('makes the entry it was loaded on its page, when that was one of ours', () => {
    const history = new FakeHistory();
    history.replaceState({ other: 1, backBook: 1, backTrail: 2, backLoad: 0 });
    const { h, bh } = setup({ history });
    assert.deepEqual(h.state, { other: 1 });
    assert.equal(bh.level, 0);
    const only = new FakeHistory();
    only.replaceState({ backBook: 1, backTrail: 0, backLoad: 0 });
    setup({ history: only });
    assert.equal(only.state, null);
  });

  it('waits for a promised onBack, and rewinds only if the place is still gone', async () => {
    const h = new FakeHistory();
    let answer;
    const bh = new BackHistory({ history: h, load: 1, onBack: () => new Promise((r) => { answer = r; }), onAway: () => {} });
    bh.bookOut();
    bh.pushed(1);
    bh.pushed(2);
    h.back();
    await settle(h, bh);
    assert.equal(h.i, 2, 'nothing yet');
    answer(false);
    await settle(h, bh);
    assert.equal(h.i, 1, 'then to the book\'s entry');
    assert.equal(bh.level, 1);
  });
});

describe('its fields in an entry\'s state, named from a prefix', () => {
  it('keeps a site\'s own copy\'s names, so the entries already in a visitor\'s history are its own', async () => {
    const { h, bh, backs, aways } = setup({ prefix: 'vrlbry' });
    bh.bookOut();
    bh.pushed(1);
    assert.deepEqual(h.state, { vrlbryBook: 1, vrlbryTrail: 1, vrlbryLoad: 1 });
    h.back();
    await settle(h, bh);
    h.back();
    await settle(h, bh);
    assert.deepEqual([backs, aways], [[0], [0]]);
    const reloaded = new FakeHistory();
    reloaded.replaceState({ outsideBook: 1, outsideTrail: 0, outsideLoad: 0 });
    setup({ history: reloaded, prefix: 'outside' });
    assert.equal(reloaded.state, null, 'loaded on an entry of outside\'s copy: the page');
  });

  it('leaves other fields, and another prefix\'s, as they are', async () => {
    const history = new FakeHistory();
    history.replaceState({ vrlbryBook: 1, vrlbryTrail: 0, vrlbryLoad: 0, place: 'stacks' });
    const { h, bh, aways } = setup({ history });
    assert.deepEqual(h.state, { vrlbryBook: 1, vrlbryTrail: 0, vrlbryLoad: 0, place: 'stacks' }, 'not its own');
    assert.equal(bh.level, 0);
    bh.bookOut();
    assert.deepEqual(h.state, { vrlbryBook: 1, vrlbryTrail: 0, vrlbryLoad: 0, place: 'stacks', backBook: 1, backTrail: 0, backLoad: 1 });
    h.back();
    await settle(h, bh);
    assert.deepEqual(aways, [0], 'Back to an entry of another prefix\'s: the page\'s, and the book is put away');
    assert.deepEqual(h.state, { vrlbryBook: 1, vrlbryTrail: 0, vrlbryLoad: 0, place: 'stacks' });
  });

  it('cleans only its own fields off an entry it is loaded on, and survives a state that is no object', () => {
    const history = new FakeHistory();
    history.replaceState({ backBook: 1, backTrail: 3, backLoad: 0, vrlbryBook: 1 });
    setup({ history });
    assert.deepEqual(history.state, { vrlbryBook: 1 });
    for (const state of ['a string', 7]) {
      const other = new FakeHistory();
      other.replaceState(state);
      const { bh } = setup({ history: other });
      assert.equal(other.state, state);
      bh.popstate(state);
      assert.equal(bh.level, 0);
    }
  });
});
