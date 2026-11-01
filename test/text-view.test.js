// The text view's shell (src/text-view.js) over a stand-in DOM (test/dom.js), and a subclass whose
// book has two parts of 20 blocks, its pages two blocks each, that counts each call of the site's
// methods: opening at the place and closing at it, the keys, a rest sharing the place, a size and
// Back brought there first, a theme, a change of width, a link aimed, the parts, the contents and
// its focus, the headroom on a short screen, the TV's methods, and the CSS put in once and first.
// Each over a book that answers at once (outside's) and one that answers later (vrlbry's).

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { TEXT_VIEW_CSS, TextView } from '../src/text-view.js';
import { Doc, Ev } from './dom.js';

const BLOCKS = 20; // a part's
const BLOCK = 100; // a block's height, at text size 1
const BODY = 200; // where the part's text begins, in the view's content
const BAR = 60; // the toolbar's height
const VIEW = 600; // the view's

/** Where the view is scrolled to with block b just below the toolbar, at a text size. */
const at = (b, scale = 1) => Math.round(BODY + b * BLOCK * scale - BAR);
/** A block's box (and its link's), at a text size: as the page lays it out. */
function lay(p, scale) {
  const b = Number(p.getAttribute('data-b'));
  p.box = { top: BODY + b * BLOCK * scale, height: BLOCK * scale };
  const a = p.querySelector('a');
  if (a) a.box = { top: p.box.top + 40 * scale, height: 20 * scale };
}

/** The text 640 px wide, the observer's first sight of it left to the test: the observer's callback. */
function observed(doc, view) {
  const body = view.$('.tv-body');
  body.box = { top: BODY, height: BLOCKS * BLOCK, width: 640 };
  return doc.observed.find((o) => o.el === body).fn;
}

/** The text laid out again at another width (a phone turned, a window resized): each block `tall` times as high. */
function reflow(view, width, tall) {
  view.tall = tall;
  view.$('.tv-body').box.width = width;
  view.layOut();
}

/** The block at the toolbar's foot. */
const topBlock = (view) => view.placeAt(view._top()).b;

/** Runs what is waiting: promises, scroll events, the book's answers. */
async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
}

/** A key pressed on target, bubbling. */
function key(target, name, init = {}) {
  const e = new Ev('keydown', { key: name, bubbles: true, ...init });
  target.dispatchEvent(e);
  return e;
}

/** The 3D book: two parts, its pages two blocks each; it answers at once, or (later) a microtask on. */
class Book {
  constructor(later) {
    this.later = later;
    this.open = true;
    this.vr = false;
    this.key = 'walden';
    this.title = 'Walden';
    /** The open page, by its first block. */
    this.at = { c: 0, b: 4 };
    this.theme = 'paper';
    this.scale = 1;
    this.trail = 0;
    this.reduced = false;
    /** After each turn or jump (the site's: the view follows). */
    this.onShow = () => {};
  }

  pageOf({ c, b }) { return { c, b: b - (b % 2) }; }

  shows(place) {
    const p = this.pageOf(place);
    return p.c === this.at.c && p.b === this.at.b;
  }

  /** The open page's number, from 0. */
  page() { return this.at.c * BLOCKS + this.at.b; }

  _do(fn) { return this.later ? Promise.resolve().then(fn) : fn(); }

  _show(page) {
    this.at = page;
    this.onShow();
  }

  jumpTo(place) {
    return this._do(() => {
      if (this.shows(place)) return false;
      this._show(this.pageOf(place));
      return true;
    });
  }

  turn(dir) {
    return this._do(() => {
      const n = Math.max(0, Math.min(2 * BLOCKS - 2, this.page() + 2 * dir));
      this._show({ c: Math.floor(n / BLOCKS), b: n % BLOCKS });
    });
  }

  toProgress(f) {
    return this._do(() => {
      const n = Math.min(2 * BLOCKS - 1, Math.round(f * 2 * BLOCKS));
      this._show(this.pageOf({ c: Math.floor(n / BLOCKS), b: n % BLOCKS }));
    });
  }

  changeFont(step) {
    return this._do(() => {
      this.scale = Math.round((this.scale + step / 10) * 10) / 10;
      this.onShow();
    });
  }

  setTheme(name) {
    return this._do(() => {
      this.theme = name;
      this.onShow();
    });
  }
}

/** A site's view: the book's, each call of a site's method counted, the book's actions logged. */
class View extends TextView {
  counts = {};
  calls = [];
  word = 'part';
  /** While set, a part is built once it resolves (a fetch under way). */
  gate = null;
  /** How many times as high the text is at the view's width as at 640 px (reflow). */
  tall = 1;

  constructor({ book, contents = [], ...options }) {
    super(options);
    this.book = book;
    this.toc = contents;
  }

  did(name) { this.counts[name] = (this.counts[name] ?? 0) + 1; }

  log(name, ...args) {
    this.did(name);
    this.calls.push([name, ...args]);
  }

  /** The page lays its text out again at its size, as a browser does when --tv-scale changes. */
  _style() {
    super._style();
    this.layOut();
  }

  /** The text laid out at its size and the view's width. */
  layOut() {
    const scale = Number(this.el.style.getPropertyValue('--tv-scale'));
    for (const p of this.$('.tv-body').children) lay(p, scale * this.tall);
  }

  bookOpen() { this.did('bookOpen'); return this.book.open; }
  presenting() { this.did('presenting'); return this.book.vr; }
  bookKey() { this.did('bookKey'); return this.book.key; }
  partCount() { this.did('partCount'); return 2; }
  partOf(place) { this.did('partOf'); return place.c; }
  partStart(part) { this.did('partStart'); return { c: part, b: 0 }; }

  renderPart(body, part, { onLink }) {
    this.log('renderPart', part);
    for (let b = 0; b < BLOCKS; b++) {
      const p = this.doc.createElement('p');
      p.setAttribute('data-b', String(b));
      p.append(`${this.book.key} ${part}.${b} `);
      if (b === 2 || b === 12) {
        const a = this.doc.createElement('a');
        a.setAttribute('href', `#tv-${1 - part}-5`);
        a.append('a link');
        a.addEventListener('click', (e) => {
          e.preventDefault();
          onLink({ c: 1 - part, b: 5 });
        });
        p.append(a);
      }
      lay(p, this.book.scale * this.tall);
      body.append(p);
    }
    const shown = { title: this.book.title, subtitle: part === 1 ? 'Part the second' : '' };
    if (this.gate) return this.gate.then(() => shown);
    return this.book.later ? Promise.resolve().then(() => shown) : shown;
  }

  placeShown() { this.did('placeShown'); return this.book.at; }
  showsPlace(place) { this.did('showsPlace'); return this.book.shows(place); }

  placeTop(place) {
    this.did('placeTop');
    const el = place.b > 0 ? this.$('.tv-body').querySelector(`[data-b="${place.b}"]`) : null;
    return el ? el.getBoundingClientRect().top : null;
  }

  placeAt(top) {
    this.did('placeAt');
    for (const el of this.$('.tv-body').querySelectorAll('[data-b]')) {
      if (el.getBoundingClientRect().bottom > top + 1) return { c: this.part, b: Number(el.getAttribute('data-b')) };
    }
    return null;
  }

  jumpTo(place, options) { this.log('jumpTo', place, options); return this.book.jumpTo(place); }
  turnPage(dir) { this.log('turnPage', dir); return this.book.turn(dir); }
  jumpToProgress(f) { this.log('jumpToProgress', f); return this.book.toProgress(f); }
  changeFont(step) { this.log('changeFont', step); return this.book.changeFont(step); }
  setTheme(name) { this.log('setTheme', name); return this.book.setTheme(name); }
  goBack() { this.log('goBack'); }
  putBack() { this.log('putBack'); }

  /** As vrlbry's interaction does: the place aimed at while the book goes there. */
  async followLink(link) {
    this.log('followLink', link);
    this.aim(link);
    try {
      await this.book.jumpTo(link);
    } finally {
      this.aim(null);
    }
  }

  contents() { this.log('contents'); return this.toc; }
  useContents(entry) { this.log('useContents', entry.title); return super.useContents(entry); }
  label() { this.did('label'); return `${this.book.page() + 1} / ${2 * BLOCKS}`; }
  progress() { this.did('progress'); return this.book.page() / (2 * BLOCKS); }
  hasTrail() { this.did('hasTrail'); return this.book.trail > 0; }
  partWord() { this.did('partWord'); return this.word; }
  theme() { this.did('theme'); return this.book.theme; }
  fontScale() { this.did('fontScale'); return this.book.scale; }
  reduced() { this.did('reduced'); return this.book.reduced; }
}

/**
 * A page: its style.css in <head>, the view in <main>, the site's "Text view" and "Read the book"
 * buttons (where the focus goes back to), a window 600 px high (short: 400). The view is laid out:
 * 600 px high, its toolbar 60, the text from 200.
 */
function page({ later = false, short = false, tv = false, step, contents } = {}) {
  const doc = new Doc({ short, innerHeight: VIEW });
  const css = doc.createElement('link');
  css.setAttribute('rel', 'stylesheet');
  doc.head.append(css);
  const main = doc.createElement('main');
  const textButton = doc.createElement('button');
  const readButton = doc.createElement('button');
  doc.body.append(main, textButton, readButton);
  const book = new Book(later);
  const opened = [];
  const view = new View({ root: main, book, tv, step, contents, returnFocus: (away) => (away ? readButton : textButton), onOpen: () => opened.push('open'), onClose: () => opened.push('close') });
  book.onShow = () => view.follow();
  view.el.scrolls = true;
  view.el.box = { top: 0, height: VIEW };
  const bar = view.$('.tv-bar');
  bar.box = { top: 0, height: BAR, sticky: true };
  for (const c of bar.querySelectorAll('button, select, input')) c.box = { top: 10, height: 40, sticky: true };
  return { doc, view, book, bar, opened, textButton, readButton };
}

const TOC = [
  { title: 'One', place: { c: 0, b: 0 } },
  { title: 'One, later', place: { c: 0, b: 10 }, level: 2 },
  { title: 'Two', place: { c: 1, b: 0 }, after: ' · Thoreau' },
  { title: 'Two, later', place: { c: 1, b: 8 }, level: 9, href: '#tv-1-8' },
];

let warned;
beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] });
  warned = mock.method(console, 'warn', () => {});
});
afterEach(() => {
  mock.timers.reset();
  const warnings = warned.mock.calls.map((c) => c.arguments);
  mock.restoreAll();
  assert.deepEqual(warnings, [], 'no part failed to show');
});

describe('TextView: its markup and its CSS', () => {
  it('is an article of its own class and markup, built without calling any of the site\'s methods', () => {
    const { doc, view } = page();
    assert.deepEqual(view.counts, {}, 'none while it is built: a subclass\'s fields are set after super()');
    const el = view.el;
    assert.equal(el.tagName, 'ARTICLE');
    assert.equal(el.className, 'tv-view', 'its own class: tv is TV mode\'s, on <html>');
    assert.equal(el.hidden, true);
    assert.equal(el.getAttribute('tabindex'), '-1');
    assert.equal(el.getAttribute('aria-labelledby'), 'tv-title');
    assert.equal(el.hasAttribute('data-own-keys'), true, 'the walking controls leave its keys alone');
    assert.equal(doc.getElementById('tv-title'), view.$('.tv-title'));
    assert.deepEqual(['.tv-smaller', '.tv-bigger'].map((s) => [view.$(s).textContent, view.$(s).getAttribute('aria-label')]), [['A−', 'A− smaller text'], ['A+', 'A+ larger text']], 'named with what they show (music\'s)');
    assert.equal(view.$('.tv-sub').hidden, true, 'no subtitle yet');
    assert.equal(view.$('.tv-partno').hidden, true);
    assert.equal(view.$('.tv-back').hidden, true);
    assert.equal(view.$('.tv-toc').hidden, true);
    assert.equal(view.el.querySelectorAll('.tv-prev').length, 2, 'at the toolbar\'s start and the text\'s end');
    assert.equal(view.el.querySelectorAll('.tv-next').length, 2);
    assert.deepEqual(view.$('.tv-theme-sel').querySelectorAll('option').map((o) => o.getAttribute('value')), ['paper', 'sepia', 'night']);
    assert.equal(view.isOpen, false);
    assert.equal(view.part, -1);
  });

  it('puts its rules in a <style> first in <head>, once a document', () => {
    const { doc } = page();
    const first = doc.head.children[0];
    assert.equal(first.tagName, 'STYLE', 'before the site\'s own style.css, which overrides it');
    assert.equal(first.id, 'tv-view-style');
    assert.equal(first.textContent, TEXT_VIEW_CSS);
    new View({ root: doc.body, book: new Book(false) });
    assert.equal(doc.head.querySelectorAll('style').length, 1, 'once a document');
    const other = new Doc();
    new View({ root: other.body, book: new Book(false) });
    assert.equal(other.head.children[0].textContent, TEXT_VIEW_CSS, 'each document its own');
  });

  it('has the shell\'s rules: the themes and their color-scheme, the toolbar sliding away; the text\'s are the sites\'', () => {
    assert.match(TEXT_VIEW_CSS, /\.tv-view \{[^}]*color-scheme: light;/);
    assert.match(TEXT_VIEW_CSS, /\.tv-view\[data-theme="night"\] \{[^}]*color-scheme: dark; \}/);
    assert.match(TEXT_VIEW_CSS, /\.tv-view\[data-theme="sepia"\] \{/);
    assert.match(TEXT_VIEW_CSS, /\.tv-view\[hidden\] \{ display: none; \}/);
    assert.match(TEXT_VIEW_CSS, /\.tv-bar \{ position: sticky; top: 0;/);
    assert.match(TEXT_VIEW_CSS, /\.tv-bar\.tv-away \{ transform: translateY\(-100%\); \}/);
    assert.match(TEXT_VIEW_CSS, /\.tv-view\[data-motion="full"\] \.tv-bar \{ transition: transform \.2s ease; \}/);
    assert.match(TEXT_VIEW_CSS, /\.tv-toc \{ position: fixed;/);
    assert.match(TEXT_VIEW_CSS, /\.tv-col \* \{ scroll-margin-top: var\(--tv-bar-h, 0px\); \}/);
    assert.match(TEXT_VIEW_CSS, /\.tv-title:focus-visible \{\n {2}outline: 2px solid var\(--tv-link\)/);
    assert.match(TEXT_VIEW_CSS, /@media \(max-width: 640px\) \{[^@]*\.tv-bar \.tv-wide \{ display: none; \}/);
    assert.match(TEXT_VIEW_CSS, /\.tv-col > \.tv-sub \{/, 'the line under the title, not a site\'s .tv-sub in its text (outside\'s)');
    assert.doesNotMatch(TEXT_VIEW_CSS, /\.tv-body|\.tv-list|\.tv-verse|html\.tv/, 'the text\'s own rules, and a TV\'s, stay in the sites');
    assert.equal(TEXT_VIEW_CSS.match(/\{/g).length, TEXT_VIEW_CSS.match(/\}/g).length);
  });
});

for (const later of [false, true]) {
  describe(`TextView over a book that answers ${later ? 'later (vrlbry\'s)' : 'at once (outside\'s)'}`, () => {
    it('opens at the 3D book\'s place, just below the toolbar, the focus on its title', async () => {
      const { doc, view, opened } = page({ later });
      await view.open();
      assert.equal(view.isOpen, true);
      assert.equal(view.el.hidden, false);
      assert.deepEqual(view.calls, [['renderPart', 0]]);
      assert.equal(view.part, 0);
      assert.equal(view.$('.tv-title').textContent, 'Walden');
      assert.equal(view.$('.tv-sub').hidden, true, 'an empty subtitle hidden');
      assert.deepEqual(view.$('.tv-body').children.map((p) => p.getAttribute('data-b')), Array.from({ length: BLOCKS }, (_, b) => String(b)));
      assert.equal(view.el.scrollTop, at(4), 'block 4 at the toolbar\'s foot');
      assert.equal(view.el.style.getPropertyValue('--tv-bar-h'), `${BAR}px`);
      assert.equal(doc.activeElement, view.$('.tv-title'));
      assert.deepEqual(view.$('.tv-title').focused.at(-1), { preventScroll: true });
      assert.deepEqual(opened, ['open']);
      assert.equal(view.el.getAttribute('data-theme'), 'paper');
      assert.equal(view.el.getAttribute('data-motion'), 'full');
      assert.equal(view.el.style.getPropertyValue('--tv-scale'), '1');
      assert.equal(view.$('.tv-theme-sel').value, 'paper');
      await view.open();
      assert.deepEqual(view.calls, [['renderPart', 0]], 'open already: nothing');
    });

    it('closes leaving the book at the place at its top, and opens there again while the book shows it', async () => {
      const { doc, view, book, opened, textButton } = page({ later });
      await view.open();
      view.el.scrollTop = at(9) + 50; // block 9 half under the toolbar
      await settle();
      view.calls.length = 0;
      await view.close();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 9 }, { inPlace: true }]]);
      assert.deepEqual(book.at, { c: 0, b: 8 });
      assert.equal(view.el.hidden, true);
      assert.deepEqual(opened, ['open', 'close']);
      assert.equal(doc.activeElement, textButton);
      view.calls.length = 0;
      await view.open();
      assert.deepEqual(view.calls, [], 'the part shown: not built again');
      assert.equal(view.el.scrollTop, at(9), 'its own place, which the book still shows');
      await view.close();
      await book.turn(1); // meanwhile the 3D book turns
      assert.deepEqual(book.at, { c: 0, b: 10 });
      await view.open();
      assert.equal(view.el.scrollTop, at(10), 'the book\'s, which no longer shows the view\'s');
      assert.equal(view.toggle() instanceof Promise, true);
      await settle();
      assert.equal(view.isOpen, false, 'toggled shut');
      await view.toggle();
      assert.equal(view.isOpen, true);
    });

    it('opens neither in VR nor without a book; closes in VR at its place, and put back without one', async () => {
      const { doc, view, book, opened, readButton } = page({ later });
      book.vr = true;
      await view.open();
      assert.equal(view.isOpen, false);
      book.vr = false;
      book.open = false;
      await view.open();
      assert.equal(view.isOpen, false);
      assert.equal(view.el.hidden, true);
      book.open = true;
      await view.open();
      view.el.scrollTop = at(13);
      await settle();
      view.calls.length = 0;
      book.vr = true; // VR begins, and the site closes the view
      await view.close();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 13 }, { inPlace: true }]], 'its place shared all the same');
      book.vr = false;
      await view.open();
      assert.equal(view.el.scrollTop, at(13));
      view.el.scrollTop = at(15) - 100;
      await settle();
      view.calls.length = 0;
      await view.close({ keepPlace: false });
      assert.deepEqual(view.calls, [], 'put back: no place to keep');
      assert.equal(doc.activeElement, readButton);
      assert.deepEqual(opened, ['open', 'close', 'open'], 'onClose only with the book still open');
    });

    it('scrolls to its place again once it is drawn, unless the reader has scrolled', async () => {
      const { doc, view } = page({ later });
      await view.open();
      assert.equal(doc.frames.length, 1);
      for (const p of view.$('.tv-body').children) p.box.top += 30; // a late change of layout above the place
      doc.frame();
      assert.equal(view.el.scrollTop, at(4) + 30);
      await view.close();
      await view.open();
      for (const p of view.$('.tv-body').children) p.box.top += 30;
      view.el.scrollTop = 100;
      await settle();
      doc.frame();
      assert.equal(view.el.scrollTop, 100);
    });

    it('shares the place once the reader\'s scrolling rests a quarter second; its own scrolls are not reading', async () => {
      const { view, book } = page({ later });
      await view.open();
      await settle();
      view.calls.length = 0;
      mock.timers.tick(250);
      await settle();
      assert.deepEqual(view.calls, [], 'the view put itself there');
      view.el.scrollTop = at(11);
      await settle();
      mock.timers.tick(200);
      view.el.scrollTop = at(13);
      await settle();
      mock.timers.tick(200);
      await settle();
      assert.deepEqual(view.calls, [], 'not at rest yet');
      mock.timers.tick(50);
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 13 }, { inPlace: true }]]);
      assert.deepEqual(book.at, { c: 0, b: 12 });
      assert.equal(view.el.scrollTop, at(13), 'the book came to the view\'s place: the view stays');
      view.calls.length = 0;
      await book.turn(1); // the 3D book's own keys
      await settle();
      assert.deepEqual(view.el.scrolled.at(-1), { top: at(14), behavior: 'smooth' }, 'the view follows, smoothly');
      mock.timers.tick(250);
      await settle();
      assert.deepEqual(view.calls, [], 'a smooth scroll of its own is not reading either');
      book.reduced = true;
      await book.turn(1);
      await settle();
      assert.deepEqual(view.el.scrolled.at(-1), { top: at(16), behavior: 'auto' }, 'less motion: at once');
    });

    it('keeps its place through a size, the book brought there first, and through a theme', async () => {
      const { view } = page({ later });
      await view.open();
      view.el.scrollTop = at(13);
      await settle();
      view.calls.length = 0;
      view.$('.tv-bigger').click();
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 13 }, { inPlace: true }], ['changeFont', 1]]);
      assert.equal(view.el.style.getPropertyValue('--tv-scale'), '1.1');
      assert.equal(view.el.scrollTop, at(13, 1.1), 'block 13 still at the toolbar\'s foot, the text larger');
      view.calls.length = 0;
      view.$('.tv-smaller').click();
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 13 }, { inPlace: true }], ['changeFont', -1]]);
      assert.equal(view.el.scrollTop, at(13));
      view.calls.length = 0;
      const theme = view.$('.tv-theme-sel');
      theme.value = 'night';
      theme.dispatchEvent(new Ev('change', { bubbles: true }));
      await settle();
      assert.deepEqual(view.calls, [['setTheme', 'night']]);
      assert.equal(view.el.getAttribute('data-theme'), 'night');
      assert.equal(view.el.scrollTop, at(13), 'the colours change, not the place');
    });

    it('keeps its place through a change of width, the 3D book left where it is; a height alone changes nothing', async () => {
      const { doc, view, book } = page({ later });
      const resized = observed(doc, view);
      await view.open();
      resized(); // shown: the observer's first sight of it
      view.el.scrollTop = at(9) + 50; // block 9 half under the toolbar
      await settle();
      mock.timers.tick(250);
      await settle();
      assert.deepEqual(book.at, { c: 0, b: 8 });
      view.calls.length = 0;
      // A phone turned: the text 375 px wide, each block 2.5 times as high, and the scroll where it
      // was, which shows block 3 at the top.
      reflow(view, 375, 2.5);
      resized();
      assert.equal(view.el.scrollTop, Math.round(BODY + 9 * BLOCK * 2.5 - BAR), 'block 9 at the toolbar\'s foot again');
      assert.equal(topBlock(view), 9);
      await settle();
      mock.timers.tick(250);
      await settle();
      assert.deepEqual(view.calls, [], 'the view\'s own scroll: not reading, and the 3D book not asked to jump');
      assert.deepEqual(book.at, { c: 0, b: 8 });
      reflow(view, 640, 1); // and back
      resized();
      assert.equal(view.el.scrollTop, at(9));
      await settle();
      view.el.box.height = 360; // the height alone: the text as it was
      resized();
      await settle();
      mock.timers.tick(250);
      await settle();
      assert.equal(view.el.scrollTop, at(9));
      assert.deepEqual(view.calls, []);
    });

    it('takes the reader\'s place before the text reflows, as they scroll, not what the reflow brings to the top', async () => {
      const { doc, view } = page({ later });
      const resized = observed(doc, view);
      await view.open();
      resized();
      view.calls.length = 0;
      // The width changes before the reader's scrolling rests, and the observer sees it only after:
      // their place is block 13, not block 4, shared last, nor block 5, at the top once reflowed.
      view.el.scrollTop = at(13) + 30;
      await settle();
      reflow(view, 375, 2.5);
      mock.timers.tick(250);
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 13 }, { inPlace: true }]], 'shared as it rests');
      resized();
      assert.equal(view.el.scrollTop, Math.round(BODY + 13 * BLOCK * 2.5 - BAR));
      assert.equal(topBlock(view), 13);
      await settle();
      view.calls.length = 0;
      // Wider, the text is shorter, and the browser brings the scroll within its end before the
      // observer sees the width: not reading.
      reflow(view, 640, 1);
      view.el.scrollTop = view.el.scrollTop;
      assert.equal(view.el.scrollTop, BODY + BLOCKS * BLOCK - VIEW, 'held within the end');
      await settle();
      resized();
      assert.equal(view.el.scrollTop, at(13));
      mock.timers.tick(250);
      await settle();
      assert.deepEqual(view.calls, []);
    });

    it('keeps its place when the toolbar wraps onto another row, the browser\'s scroll neither reading nor sliding it away', async () => {
      const { doc, view, bar } = page({ later, short: true });
      const resized = observed(doc, view);
      await view.open();
      resized();
      view.el.scrollTop = at(9) + 40;
      await settle();
      view.el.scrollTop = at(9); // reading up: the toolbar back, block 9 at its foot
      await settle();
      mock.timers.tick(250);
      await settle();
      assert.equal(bar.classList.contains('tv-away'), false);
      view.calls.length = 0;
      // Narrower, the text as wide (its column at its widest) but the toolbar on two rows: the text
      // begins 27 px lower, and the browser keeps it in sight (scroll anchoring) before the observers
      // see the change.
      bar.box.height = BAR + 27;
      for (const p of view.$('.tv-body').children) p.box.top += 27;
      view.el.scrollTop += 27;
      await settle();
      assert.equal(bar.classList.contains('tv-away'), false, 'not reading down');
      doc.observed[0].fn(); // the toolbar's observer
      assert.equal(view.el.scrollTop, at(9), 'block 9 at the foot of the taller toolbar');
      assert.equal(topBlock(view), 9);
      await settle();
      mock.timers.tick(250);
      await settle();
      assert.deepEqual(view.calls, [], 'not reading: the 3D book not asked to jump');
    });

    it('brings the book to the reader\'s place before Back and Put back; the slider jumps', async () => {
      const { view, book } = page({ later });
      book.trail = 1;
      await view.open();
      assert.equal(view.$('.tv-back').hidden, false);
      view.el.scrollTop = at(3);
      await settle();
      view.calls.length = 0;
      view.$('.tv-back').click();
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 3 }, { inPlace: true }], ['goBack']]);
      view.calls.length = 0;
      view.$('.tv-putback').click();
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 3 }, { inPlace: true }], ['putBack']]);
      view.calls.length = 0;
      const slider = view.$('.tv-slider');
      slider.value = '500';
      slider.dispatchEvent(new Ev('change', { bubbles: true }));
      await settle();
      assert.deepEqual(view.calls, [['jumpToProgress', 0.5], ['renderPart', 1]]);
      assert.equal(view.part, 1);
    });

    it('the keys: ← → turn from the reader\'s place; Esc and T close it, Esc the contents first; a field keeps its own', async () => {
      const { doc, view, book } = page({ later, contents: TOC });
      await view.open();
      view.el.scrollTop = at(7);
      await settle();
      view.calls.length = 0;
      assert.equal(key(view.el, 'ArrowRight').defaultPrevented, true);
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 7 }, { inPlace: true }], ['turnPage', 1]]);
      assert.deepEqual(book.at, { c: 0, b: 8 });
      view.calls.length = 0;
      key(view.$('.tv-title'), 'ArrowLeft'); // from inside the view
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 8 }, { inPlace: true }], ['turnPage', -1]]);
      view.calls.length = 0;
      for (const [target, name, init] of [
        [view.$('.tv-slider'), 'ArrowRight'],
        [view.$('.tv-theme-sel'), 'ArrowLeft'],
        [view.$('.tv-slider'), 't', { code: 'KeyT' }],
        [view.el, 'ArrowRight', { ctrlKey: true }],
        [view.el, 'ArrowLeft', { altKey: true }],
        [view.el, 'ArrowRight', { metaKey: true }],
        [view.el, 'ArrowDown'],
      ]) assert.equal(key(target, name, init).defaultPrevented, false, `${name} on ${target.className}`);
      await settle();
      assert.deepEqual(view.calls, [], 'a field\'s keys, a modifier\'s, and ↓ off a TV');
      assert.equal(view.isOpen, true);
      view.$('.tv-toc-btn').click();
      assert.equal(view.tocOpen, true);
      assert.equal(key(doc.activeElement, 'Escape').defaultPrevented, true);
      assert.equal(view.tocOpen, false);
      assert.equal(doc.activeElement, view.$('.tv-toc-btn'), 'closed from inside: the focus on its button');
      assert.equal(view.isOpen, true);
      key(view.el, 'Escape');
      await settle();
      assert.equal(view.isOpen, false);
      await view.open();
      assert.equal(key(view.el, 't', { code: 'KeyT' }).defaultPrevented, true);
      await settle();
      assert.equal(view.isOpen, false, 'T');
      await view.open();
      view.$('.tv-close').click();
      await settle();
      assert.equal(view.isOpen, false, 'its Close');
    });

    it('follows a link: the place shared first, then the place it aims at shown, the focus on the new part\'s title', async () => {
      const { doc, view, book } = page({ later });
      await view.open();
      view.el.scrollTop = at(2);
      await settle();
      const link = view.$('.tv-body').querySelector('a');
      link.focus();
      view.calls.length = 0;
      link.click();
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 2 }, { inPlace: true }], ['followLink', { c: 1, b: 5 }], ['renderPart', 1]]);
      assert.deepEqual(book.at, { c: 1, b: 4 });
      assert.equal(view.part, 1);
      assert.equal(view.el.scrollTop, at(5), 'at the place aimed at, not its page\'s first');
      assert.equal(doc.activeElement, view.$('.tv-title'));
      assert.equal(view.$('.tv-sub').textContent, 'Part the second');
      assert.equal(view.$('.tv-sub').hidden, false);
    });

    it('shows what placeAimed makes of a place aimed at (vrlbry\'s: an element the 3D page found)', async () => {
      const { view, book } = page({ later });
      view.placeAimed = (aim) => (aim.f ? book.at : aim);
      await view.open();
      view.aim({ c: 0, b: 13, f: 'note-3' });
      await book.jumpTo({ c: 0, b: 13 });
      await settle();
      assert.equal(view.el.scrollTop, at(12), 'the page\'s place');
      view.aim({ c: 0, b: 11 });
      await book.jumpTo({ c: 0, b: 11 });
      await settle();
      assert.equal(view.el.scrollTop, at(11));
      await book.jumpTo({ c: 0, b: 7 });
      await settle();
      assert.equal(view.el.scrollTop, at(6), 'once: aimed at nothing now');
    });

    it('goes to the part before or after from its start, even when the spread shows it already', async () => {
      const { doc, view, book } = page({ later });
      await view.open();
      const buttons = [...view.el.querySelectorAll('.tv-prev'), ...view.el.querySelectorAll('.tv-next')];
      assert.deepEqual(buttons.map((b) => b.disabled), [true, true, false, false]);
      view.calls.length = 0;
      buttons[3].click();
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 1, b: 0 }, { inPlace: false }], ['renderPart', 1]]);
      assert.equal(view.part, 1);
      assert.equal(view.el.scrollTop, 0, 'its top, the title in sight');
      assert.deepEqual(buttons.map((b) => b.disabled), [false, false, true, true]);
      assert.equal(doc.activeElement, view.$('.tv-title'));
      buttons[0].click();
      await settle();
      assert.equal(view.part, 0);
      assert.equal(view.el.scrollTop, 0);
      book.at = { c: 1, b: 0 }; // a spread whose right page begins the next part
      view.calls.length = 0;
      buttons[2].click();
      await settle();
      assert.deepEqual(view.calls, [['jumpTo', { c: 1, b: 0 }, { inPlace: false }], ['renderPart', 1]], 'the book did not move: the view went all the same');
      assert.equal(view.part, 1);
    });

    it('says where the reader is, Back while there is a trail, and the parts by their word', async () => {
      const { view, book } = page({ later });
      await view.open();
      const slider = view.$('.tv-slider');
      const [prevBar, prevEnd] = view.el.querySelectorAll('.tv-prev');
      const [nextBar, nextEnd] = view.el.querySelectorAll('.tv-next');
      assert.equal(view.$('.tv-label').textContent, '5 / 40');
      assert.equal(slider.value, '100');
      assert.equal(slider.getAttribute('aria-valuetext'), 'Page 5 of 40');
      assert.equal(view.$('.tv-back').hidden, true);
      assert.equal(view.$('.tv-partno').textContent, 'Part 1 of 2');
      assert.equal(view.$('.tv-partno').hidden, false);
      assert.deepEqual([prevBar, prevEnd, nextBar, nextEnd].map((b) => [b.getAttribute('aria-label'), b.querySelector('.tv-wide').textContent]), [
        ['Previous part', ' Previous part'], ['Previous part', ' Previous part'], ['Next part', 'Next part '], ['Next part', 'Next part '],
      ]);
      view.word = 'article';
      view.label = () => 'Contents';
      book.trail = 2;
      book.reduced = true;
      view.follow();
      await settle();
      assert.equal(view.$('.tv-partno').textContent, 'Article 1 of 2');
      assert.deepEqual([prevEnd, nextBar].map((b) => [b.getAttribute('aria-label'), b.querySelector('.tv-wide').textContent]), [['Previous article', ' Previous article'], ['Next article', 'Next article ']]);
      assert.equal(slider.getAttribute('aria-valuetext'), 'Contents', 'a page called by its name');
      assert.equal(view.$('.tv-back').hidden, false);
      assert.equal(view.el.getAttribute('data-motion'), 'less');
      view.partCount = () => 1;
      view.follow();
      await settle();
      assert.equal(view.$('.tv-partno').hidden, true);
      assert.equal(view.$('.tv-partno').textContent, '');
      assert.deepEqual([prevBar, prevEnd, nextBar, nextEnd].map((b) => b.disabled), [true, true, true, true]);
    });

    it('opens its contents under the toolbar, the focus on where the reader is; an entry goes there; filled once a book', async () => {
      const { doc, view, book } = page({ later, contents: TOC });
      await view.open();
      const btn = view.$('.tv-toc-btn');
      const nav = view.$('.tv-toc');
      btn.click();
      assert.equal(view.tocOpen, true);
      assert.equal(nav.hidden, false);
      assert.equal(btn.getAttribute('aria-expanded'), 'true');
      assert.equal(nav.style.top, `${BAR}px`);
      assert.equal(nav.style.maxHeight, `min(60vh, ${VIEW - BAR - 8}px)`);
      const items = view.$('.tv-toc-list').children;
      assert.deepEqual(items.map((li) => [li.className, li.textContent]), [['tv-toc-l1', 'One'], ['tv-toc-l2', 'One, later'], ['tv-toc-l1', 'Two · Thoreau'], ['tv-toc-l6', 'Two, later']]);
      assert.deepEqual(items.map((li) => li.querySelector('a').getAttribute('href')), ['#', '#', '#', '#tv-1-8']);
      assert.equal(doc.activeElement, items[1].querySelector('a'), 'the last entry in the part shown');
      view.calls.length = 0;
      items[3].querySelector('a').click();
      await settle();
      assert.equal(view.tocOpen, false);
      assert.equal(btn.getAttribute('aria-expanded'), 'false');
      assert.deepEqual(view.calls, [['useContents', 'Two, later'], ['jumpTo', { c: 1, b: 8 }, { inPlace: false }], ['renderPart', 1]]);
      assert.equal(view.el.scrollTop, at(8));
      assert.equal(doc.activeElement, view.$('.tv-title'));
      btn.click();
      assert.equal(doc.activeElement, view.$('.tv-toc-list').children[3].querySelector('a'), 'in part 2 now');
      assert.equal(view.counts.contents, 1, 'filled once');
      btn.click();
      assert.equal(view.tocOpen, false);
      assert.equal(doc.activeElement, btn);
      book.key = 'cranford';
      view.follow();
      await settle();
      btn.click();
      assert.equal(view.counts.contents, 2, 'another book\'s');
      await view.close();
      assert.equal(view.tocOpen, false, 'closed with the view');
      assert.equal(nav.hidden, true);
    });

    it('builds the part again for another book, its own place forgotten', async () => {
      const { view, book } = page({ later });
      await view.open();
      view.el.scrollTop = at(13);
      await settle();
      await view.close();
      assert.deepEqual(book.at, { c: 0, b: 12 });
      book.key = 'cranford'; // another book, open at the same page
      view.calls.length = 0;
      await view.open();
      assert.deepEqual(view.calls, [['renderPart', 0]]);
      assert.equal(view.el.scrollTop, at(12), 'at the book\'s place: the view\'s was the other book\'s');
      assert.match(view.$('.tv-body').textContent, /^cranford 0\.0 /);
    });
  });
}

describe('TextView: parts built in turn', () => {
  it('shows a part once the one before is shown; one built after the view closed is built again', async () => {
    const { view, book } = page({ later: true });
    await view.open();
    view.calls.length = 0;
    book.at = { c: 1, b: 6 };
    view.follow();
    book.at = { c: 0, b: 2 };
    view.follow();
    await settle();
    assert.deepEqual(view.calls, [['renderPart', 1], ['renderPart', 0]]);
    assert.equal(view.part, 0);
    assert.equal(view.el.scrollTop, at(2));
    let release;
    view.gate = new Promise((r) => { release = r; });
    book.at = { c: 1, b: 6 };
    view.follow();
    await settle();
    assert.deepEqual(view.calls.at(-1), ['renderPart', 1], 'being built');
    await view.close({ keepPlace: false });
    release();
    view.gate = null;
    await settle();
    assert.equal(view.part, -1, 'not put in: built again when next shown');
    assert.match(view.$('.tv-body').textContent, /^walden 0\.0 /, 'the part before left as it was');
    view.calls.length = 0;
    await view.open();
    assert.deepEqual(view.calls, [['renderPart', 1]]);
    assert.equal(view.el.scrollTop, at(6));
  });
});

describe('TextView: a short screen', () => {
  it('slides the toolbar away reading down, and back reading up, for a jump, or reached with Tab', async () => {
    const { view, book, bar } = page({ short: true });
    await view.open();
    await settle();
    view.el.scrollTop = at(4) + 100;
    await settle();
    assert.equal(bar.classList.contains('tv-away'), true, 'reading down');
    assert.equal(view._barH(), 0);
    view.el.scrollTop -= 1;
    await settle();
    assert.equal(bar.classList.contains('tv-away'), true, 'a pixel is not reading up');
    view.el.scrollTop -= 40;
    await settle();
    assert.equal(bar.classList.contains('tv-away'), false, 'reading up');
    view.el.scrollTop = at(9) + 50;
    await settle();
    assert.equal(bar.classList.contains('tv-away'), true);
    view.calls.length = 0;
    mock.timers.tick(250);
    await settle();
    assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 8 }, { inPlace: true }]], 'the toolbar away: the block at the view\'s very top');
    // Tab to its button: the browser has scrolled the text towards it, before the scroll's event.
    const y = view.el.scrollTop;
    view.el.scrollTop = 0;
    view.$('.tv-bigger').focus();
    assert.equal(bar.classList.contains('tv-away'), false);
    assert.equal(view.el.scrollTop, y, 'the text back where the reader was');
    await settle();
    assert.equal(bar.classList.contains('tv-away'), false);
    view.calls.length = 0;
    mock.timers.tick(250);
    await settle();
    assert.deepEqual(view.calls, [], 'the text put back is not the reader\'s');
    view.el.scrollTop = at(14);
    await settle();
    assert.equal(bar.classList.contains('tv-away'), true);
    await book.jumpTo({ c: 0, b: 6 });
    await settle();
    assert.equal(bar.classList.contains('tv-away'), false, 'back for a jump');
    assert.equal(view.el.scrollTop, at(6), 'the place below it');
    view.$('.tv-toc-btn').click();
    view.el.scrollTop = at(10);
    await settle();
    assert.equal(bar.classList.contains('tv-away'), false, 'the contents open: it stays');
  });

  it('keeps the toolbar on a screen tall enough', async () => {
    const { view, bar } = page();
    await view.open();
    view.el.scrollTop = at(10);
    await settle();
    assert.equal(bar.classList.contains('tv-away'), false);
    assert.equal(view._barH(), BAR);
  });

  it('keeps --tv-bar-h, what Tab scrolls to stops below, at the toolbar\'s height as it changes', async () => {
    const { doc, view, bar } = page();
    assert.deepEqual(doc.observed.map((o) => o.el.className), ['tv-bar', 'tv-body'], 'and the text, whose width it keeps its place through');
    assert.equal(doc.observed[0].el, bar);
    await view.open();
    assert.equal(view.el.style.getPropertyValue('--tv-bar-h'), `${BAR}px`);
    bar.box.height = 87; // two rows, at 320 px
    doc.observed[0].fn();
    assert.equal(view.el.style.getPropertyValue('--tv-bar-h'), '87px');
  });
});

describe('TextView: a TV', () => {
  it('holds the focus while reading (tv), ↑ ↓ on it scrolling 0.4 of what shows below the toolbar', async () => {
    const { doc, view, book } = page({ tv: true });
    await view.open();
    assert.equal(doc.activeElement, view.el);
    view.el.scrolled.length = 0;
    assert.equal(key(view.el, 'ArrowDown').defaultPrevented, true);
    key(view.el, 'ArrowUp', { repeat: true });
    book.reduced = true;
    key(view.el, 'ArrowDown');
    const step = Math.round((VIEW - BAR) * 0.4);
    assert.deepEqual(view.el.scrolled, [{ by: step, behavior: 'smooth' }, { by: -step, behavior: 'auto' }, { by: step, behavior: 'auto' }]);
    assert.equal(key(view.$('.tv-close'), 'ArrowDown').defaultPrevented, false, 'on a control: the remote\'s');
  });

  it('gives a remote its card: the contents or the view, the toolbar\'s control to start from, the link on the screen', async () => {
    const { view } = page({ tv: true, contents: TOC });
    await view.open();
    assert.equal(view.layer(), view.el);
    assert.equal(view.cardStart(), view.$('.tv-close'), 'the first that can be used: Previous is disabled');
    view.$('.tv-bigger').focus();
    assert.equal(view.cardStart(), view.$('.tv-bigger'), 'the one used last');
    view.$('.tv-bigger').disabled = true;
    assert.equal(view.cardStart(), view.$('.tv-close'));
    assert.equal(view.inBar(view.$('.tv-smaller')), true);
    assert.equal(view.inBar(view.$('.tv-title')), false);
    assert.equal(view.inBar(null), false);
    const [two, twelve] = view.$('.tv-body').querySelectorAll('a');
    assert.equal(view.linkHere(), null, 'block 2\'s above, block 12\'s below');
    view.el.scrollTop = at(11);
    await settle();
    assert.equal(view.onScreen(twelve), true);
    assert.equal(view.onScreen(two), false);
    assert.equal(view.linkHere(), twelve);
    view.el.scrollTop = at(12) + 100;
    await settle();
    assert.equal(view.onScreen(twelve), false, 'under the toolbar');
    assert.equal(view.linkHere(), null);
    view.$('.tv-toc-btn').click();
    assert.equal(view.tocOpen, true);
    assert.equal(view.layer(), view.$('.tv-toc'));
    view.closeToc();
    assert.equal(view.tocOpen, false);
    assert.equal(view.layer(), view.el);
  });

  it('turns and scrolls for a remote that leaves the focus on the 3D view, by the site\'s step (outside\'s)', async () => {
    const { view, book } = page({ step: (h) => Math.max(40, h * 0.75) });
    await view.open();
    view.el.scrolled.length = 0;
    view.scrollStep(1);
    view.scrollStep(-1, true);
    assert.deepEqual(view.el.scrolled, [{ by: 405, behavior: 'smooth' }, { by: -405, behavior: 'auto' }]);
    await settle();
    view.calls.length = 0;
    await view.turn(1);
    assert.deepEqual(view.calls, [['jumpTo', { c: 0, b: 4 }, { inPlace: true }], ['turnPage', 1]]);
    assert.deepEqual(book.at, { c: 0, b: 6 });
    await view.close();
    view.el.scrolled.length = 0;
    view.scrollStep(1);
    assert.deepEqual(view.el.scrolled, [], 'closed: nothing');
  });
});
