// The text view's shell, for each site's own view to extend: on a screen, the open book's part as a
// page of text over the 3D view, for screen readers, the keyboard, zoom and phones. vrlbry's
// public/js/ui/text-view.js (AriaMoKr/vrlbry at eb0dfab) without its book, with what outside's copy
// (fadc2e1) and music's (b906d13) add. The 3D book stays the reading place: the view keeps the place
// shared with it, which is the site's own (vrlbry's { c, b }, outside's [s, b, w]) and which the view
// hands back but never reads. Opening the view scrolls there, turning pages keeps it in step, and
// closing it leaves the book open at the place at the top of the view. Its header is the reader's
// toolbar: the parts before and after, contents, text size, theme, where the reader is, Back, Put
// back. On a TV either the view itself holds the remote's focus while reading (tv: ↑ ↓ scroll it, ← →
// turn the 3D book's pages, and its toolbar and links are the card the site's remote goes into), or a
// remote that leaves the focus on the 3D view calls turn and scrollStep.
//
// What is the site's (its book, its parts and places, what the toolbar does) are methods its subclass
// overrides, and the constructor calls none of them, since a subclass's own fields are set only after
// super(). Each may answer at once or with a promise: the view waits for it. The shell's CSS goes in a
// <style> first in the page's <head>, once a document, so a site's own style.css overrides it; the
// text's own rules stay in the sites. It imports nothing.

/**
 * The shell's rules (vrlbry's style.css): the themes (each its color-scheme, as outside's), the
 * toolbar and how it slides away, the contents, the column, the title, the parts, the focus rings
 * and what a narrow screen leaves out (.tv-wide). The text's own (.tv-body's) are the sites'.
 * @type {string}
 */
export const TEXT_VIEW_CSS = `
.tv-view { --tv-paper: #f6efdf; --tv-ink: #231d16; --tv-link: #24508c; --tv-rule: #b9a78a; --tv-scale: 1;
  position: fixed; inset: 0; z-index: 3; overflow-y: auto; overscroll-behavior: contain; color-scheme: light;
  background: var(--tv-paper); color: var(--tv-ink); font-family: Georgia, "Iowan Old Style", "Times New Roman", serif; }
.tv-view[hidden] { display: none; }
.tv-view[data-theme="sepia"] { --tv-paper: #ecdcbc; --tv-ink: #3b2a17; --tv-link: #2c4c7c; --tv-rule: #a68a5f; }
.tv-view[data-theme="night"] { --tv-paper: #24221f; --tv-ink: #d9d0c0; --tv-link: #93b4dc; --tv-rule: #5f574b; color-scheme: dark; }
.tv-view:focus { outline: none; }
.tv-bar { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center;
  padding: max(8px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 8px max(12px, env(safe-area-inset-left));
  background: var(--tv-paper); border-bottom: 1px solid var(--tv-rule); font: 15px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
.tv-bar button, .tv-parts button, .tv-bar select { font: inherit; color: var(--tv-ink); background: transparent; border: 1px solid var(--tv-rule);
  border-radius: 8px; padding: 4px 10px; min-height: 32px; cursor: pointer; }
.tv-bar label { display: inline-flex; align-items: center; gap: 6px; }
/* Slid away while reading down a short screen (_headroom); sliding only with full motion. */
.tv-bar.tv-away { transform: translateY(-100%); }
.tv-view[data-motion="full"] .tv-bar { transition: transform .2s ease; }
.tv-size { display: inline-flex; gap: 4px; }
.tv-bar .tv-next { margin-left: auto; } /* the parts at the toolbar's two ends */
.tv-view button:disabled { cursor: default; opacity: .5; }
.tv-view button:focus-visible, .tv-view a:focus-visible, .tv-view select:focus-visible, .tv-view input:focus-visible, .tv-title:focus-visible {
  outline: 2px solid var(--tv-link); outline-offset: 2px; }
.tv-where { display: inline-flex; align-items: center; gap: 8px; flex: 1 1 180px; min-width: 0; }
.tv-label { white-space: nowrap; }
.tv-slider { flex: 1; min-width: 80px; accent-color: var(--tv-link); }
/* A panel under the toolbar, over the text (its top set when shown), so the reader's place stays put. */
.tv-toc { position: fixed; left: 0; right: 0; z-index: 2; box-sizing: border-box; width: min(70ch, 100%); max-height: 60vh; overflow-y: auto;
  margin: 0 auto; padding: 8px 20px 12px; background: var(--tv-paper); border: 1px solid var(--tv-rule); border-top: 0;
  box-shadow: 0 8px 24px rgb(0 0 0 / .25); font: 16px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
.tv-toc[hidden] { display: none; }
.tv-toc ol { list-style: none; margin: 0; padding: 0; }
.tv-toc li { padding-block: 2px; }
.tv-toc-l2 { padding-left: 1em; } .tv-toc-l3 { padding-left: 2em; }
.tv-toc-l4, .tv-toc-l5, .tv-toc-l6 { padding-left: 3em; }
.tv-col { max-width: 70ch; margin: 0 auto; padding: 16px 20px 56px; font-size: calc(1.125rem * var(--tv-scale)); line-height: 1.6; overflow-wrap: break-word; }
.tv-col * { scroll-margin-top: var(--tv-bar-h, 0px); } /* below the sticky toolbar (_scrollTo and an observer set it) */
.tv-view a { color: var(--tv-link); text-decoration: underline; text-underline-offset: 2px; }
.tv-title { font-size: 1.6em; line-height: 1.25; margin: .3em 0 .2em; }
.tv-col > .tv-sub { margin: 0 0 1em; font: 15px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
.tv-partno { margin: 0; font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
.tv-parts { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; margin: 8px 0;
  font: 15px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
@media (max-width: 640px) {
  .tv-col { padding: 12px 14px 48px; }
  .tv-bar { font-size: 14px; }
  /* Two rows at 320 px: the part buttons as arrows, "Close", no "Theme" or page label (the names
     stay: aria-label, the slider's value) */
  .tv-bar .tv-wide { display: none; }
  .tv-where { flex-basis: 60px; }
}
`;

/** The id of the <style> the shell's rules are in, once a document. */
const STYLE_ID = 'tv-view-style';

const STATIC = `
  <header class="tv-bar">
    <button type="button" class="tv-prev" aria-label="Previous part">←<span class="tv-wide"> Previous part</span></button>
    <button type="button" class="tv-close" aria-label="Close text view" title="Back to the book in 3D (T or Esc)">Close<span class="tv-wide"> text view</span></button>
    <button type="button" class="tv-toc-btn" aria-expanded="false" aria-controls="tv-toc">Contents</button>
    <span class="tv-size" role="group" aria-label="Text size">
      <button type="button" class="tv-smaller" aria-label="A− smaller text">A−</button><button type="button" class="tv-bigger" aria-label="A+ larger text">A+</button>
    </span>
    <label class="tv-theme"><span class="tv-wide">Theme</span> <select class="tv-theme-sel" aria-label="Theme"><option value="paper">Paper</option><option value="sepia">Sepia</option><option value="night">Night</option></select></label>
    <span class="tv-where"><span class="tv-label tv-wide" aria-hidden="true"></span><input class="tv-slider" type="range" min="0" max="1000" step="1" aria-label="Where in the book"></span>
    <button type="button" class="tv-back" hidden>↩ Back</button>
    <button type="button" class="tv-putback">Put back</button>
    <button type="button" class="tv-next" aria-label="Next part"><span class="tv-wide">Next part </span>→</button>
  </header>
  <nav class="tv-toc" id="tv-toc" aria-label="Contents" hidden><ol class="tv-toc-list"></ol></nav>
  <div class="tv-col">
    <p class="tv-partno" hidden></p>
    <h1 id="tv-title" class="tv-title" tabindex="-1"></h1>
    <p class="tv-sub" hidden></p>
    <div class="tv-body"></div>
    <nav class="tv-parts" aria-label="At the end"><button type="button" class="tv-prev" aria-label="Previous part">←<span class="tv-wide"> Previous part</span></button><button type="button" class="tv-next" aria-label="Next part"><span class="tv-wide">Next part </span>→</button></nav>
  </div>`;

/** Whether a key's target is a field, whose keys are its own. @param {EventTarget | null} t */
const isField = (t) => !!t && /^(INPUT|SELECT|TEXTAREA)$/.test(/** @type {Element} */ (t).tagName); // a key in the view comes from one of its elements

/** Puts the shell's rules in a <style> first in the document's <head>, unless they are there. @param {Document} doc */
function addStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = TEXT_VIEW_CSS;
  doc.head.prepend(style);
}

/**
 * What the view needs of the page; the book is its subclass's.
 * @typedef {object} TextViewOptions
 * @property {HTMLElement} root where the view goes (the overlay, inside the page's <main>)
 * @property {boolean} [tv] a TV's remote that gives the focus to the view (vrlbry's, music's): it
 *   holds the focus while reading, not its title, and ↑ ↓ scroll it
 * @property {(height: number) => number} [step] how far ↑ ↓ and scrollStep scroll, for the height
 *   shown below the toolbar: 0.4 of it (vrlbry, music); outside's 0.75 of it, at least 40 px
 * @property {(away: boolean) => HTMLElement | null | undefined} [returnFocus] where the focus goes
 *   when the view closes (away: the book is being put back)
 * @property {() => void} [onOpen] the view has opened (and has the focus)
 * @property {() => void} [onClose] the view has closed, the 3D book still open
 */

/**
 * A part built for the view (renderPart): what its title says (the book's, or an article's), and
 * the line under it, none when empty.
 * @typedef {{ title?: string, subtitle?: string }} RenderedPart
 */

/**
 * An entry of the contents (contents): its title, the place it leads to, its level (1 the top,
 * indented down to 6), what follows its link (outside's author), and its link's address ('#').
 * @template [P=unknown]
 * @typedef {{ title: string, place: P, level?: number, after?: string, href?: string }} ContentsEntry
 */

/**
 * The text view of the open book, on a screen. The site calls follow() after every page turn or jump
 * of its 3D book, aim(place) before a jump to a place the view should show (a link, Back, the
 * contents), toggle() for T and its "Text view" button, and close() as the book is put back or VR
 * begins. What it gives are the methods below its "The site's" mark, which its subclass overrides:
 * common's know no book.
 * @template [P=unknown] the site's place in its book
 */
export class TextView {
  /** @param {TextViewOptions} options */
  constructor({ root, tv = false, step = (h) => Math.round(h * 0.4), returnFocus = () => null, onOpen = () => {}, onClose = () => {} }) {
    const doc = root.ownerDocument;
    this.doc = doc;
    addStyle(doc);
    const el = doc.createElement('article');
    el.className = 'tv-view';
    el.hidden = true;
    el.tabIndex = -1; // a click on its text keeps the keys here (the controls leave them alone: data-own-keys)
    el.setAttribute('aria-labelledby', 'tv-title');
    el.setAttribute('data-own-keys', '');
    el.innerHTML = STATIC; // the view's own markup only: the book's text goes in as text (renderPart)
    root.append(el);
    this.el = el;
    /** One of the view's own elements, by its selector. @type {(sel: string) => HTMLElement} */
    this.$ = (sel) => /** @type {HTMLElement} */ (el.querySelector(sel)); // STATIC has each one asked for
    this.tv = tv;
    this.step = step;
    this.returnFocus = returnFocus;
    this.onOpen = onOpen;
    this.onClose = onClose;
    /** The part shown, or -1. */
    this.part = -1;
    /** @private */
    this._open = false;
    /** @private A part shown waits for the one before (_show). @type {Promise<void>} */
    this._showing = Promise.resolve();
    // The place shared with the 3D book: where the view put itself, or the place at its top as the
    // reader scrolls (_read), shared once their scrolling rests (_sync). The view's own scrolls are
    // not reading (near a part's end the place aimed at cannot reach the top): _self while a smooth
    // one runs, _selfTop where an instant one left the view (or put the text back: a slid-away
    // toolbar). _moved: the reader has scrolled since the place was shared.
    /** @private @type {P | null} */
    this._at = null;
    /** @private The layout the place is right for (_layout), once the observers have seen one (_reflowed). @type {string | null} */
    this._laid = null;
    /** @private Where a jump is going (aim): the view shows it, not the 3D page's first place. @type {P | null} */
    this._aim = null;
    /** @private */
    this._self = false;
    /** @private @type {number | null} */
    this._selfTop = null;
    /** @private */
    this._moved = false;
    /** @private The jumps under way of the 3D book to the view's place: the view stays as it is. */
    this._quiet = 0;
    /** @private The view's own turns under way (turn): it goes to the new pages' first place. */
    this._turning = 0;
    /** @private Where the view was scrolled to, when last seen (_headroom). @type {number | null} */
    this._lastY = null;
    /** @private The toolbar's control focused last (cardStart). @type {HTMLElement | null} */
    this._barFocus = null;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._restTimer = undefined;
    /** @private The book whose part is shown (bookKey). @type {unknown} */
    this._book = undefined;
    /** @private The contents shown, filled once a book. @type {ContentsEntry<P>[] | null} */
    this._toc = null;
    /** @private A screen too short for a toolbar that stays. */
    this._short = (doc.defaultView ?? globalThis).matchMedia?.('(max-height: 420px)') ?? { matches: false };
    this._wire();
  }

  get isOpen() { return this._open; }

  /** Whether its contents are open. */
  get tocOpen() {
    return this._open && !this.$('.tv-toc').hidden;
  }

  /** Closes its contents (Back on a TV). */
  closeToc() {
    this._toggleToc(false);
  }

  /**
   * The height of the sticky toolbar over the text (0 while it is slid away).
   * @protected
   */
  _barH() {
    const bar = this.$('.tv-bar');
    return bar.classList.contains('tv-away') ? 0 : bar.getBoundingClientRect().height;
  }

  /**
   * On a short screen (a phone held sideways, 400% zoom) the toolbar slides away while the reader
   * scrolls down and comes back when they scroll up or reach it with Tab: it would otherwise cover
   * half the text (87 px of outside's at 320 × 256), and one that scrolled away would take the
   * reader to the top, away from their place, for a size or a theme. The view's own smooth scrolls
   * (_self: a size, a turn, Back) move it neither way: the place lands below it, shown for the jump
   * (_scrollTo), and a browser's smooth scroll goes on after the call, down as often as not.
   * @private
   */
  _headroom() {
    const y = this.el.scrollTop;
    const dy = y - (this._lastY ?? y);
    this._lastY = y;
    if (this._self) return;
    const bar = this.$('.tv-bar');
    if (!this._short.matches || !this.$('.tv-toc').hidden) bar.classList.remove('tv-away');
    else if (dy > 2 && y > bar.offsetHeight) bar.classList.add('tv-away');
    else if (dy < -2) bar.classList.remove('tv-away');
  }

  /** @private */
  _wire() {
    /** @type {(sel: string, fn: () => void) => void} */
    const q = (sel, fn) => this.el.querySelectorAll(sel).forEach((b) => b.addEventListener('click', fn));
    // What starts from the reader's place brings the 3D book there first (_sync), so a size, Back,
    // Put back or a turn starts from where the view is, not from where the 3D book was left.
    /** @type {(fn: () => unknown) => () => void} */
    const synced = (fn) => () => { this._sync().then(fn); };
    q('.tv-close', () => this.close());
    q('.tv-toc-btn', () => this._toggleToc());
    q('.tv-smaller', synced(() => this._size(-1)));
    q('.tv-bigger', synced(() => this._size(1)));
    q('.tv-back', synced(() => this.goBack()));
    q('.tv-putback', synced(() => this.putBack()));
    q('.tv-prev', () => this._part(-1));
    q('.tv-next', () => this._part(1));
    this.$('.tv-theme-sel').addEventListener('change', (e) => this._theme(/** @type {HTMLSelectElement} */ (e.target).value)); // the select's own
    this.$('.tv-slider').addEventListener('change', (e) => this.jumpToProgress(Number(/** @type {HTMLInputElement} */ (e.target).value) / 1000)); // the slider's own
    this.el.addEventListener('scroll', () => {
      if (!this._reflowing()) {
        this._headroom();
        if (!this._self && this.el.scrollTop !== this._selfTop) this._read();
      }
      this._restSoon();
    }, { passive: true });
    const bar = this.$('.tv-bar');
    // Reached with Tab, a slid-away toolbar comes back. The browser has scrolled the text towards its
    // button already (before the scroll's event): the text goes back, the reader's place stays.
    bar.addEventListener('focusin', (e) => {
      this._barFocus = /** @type {HTMLElement} */ (e.target); // where Menu comes back to on a TV (cardStart)
      bar.classList.remove('tv-away');
      if (this._lastY != null && this.el.scrollTop !== this._lastY) {
        this.el.scrollTop = this._lastY;
        this._selfTop = this._lastY;
      }
    });
    // What Tab or a jump scrolls to stops below the sticky toolbar, not under it (scroll-margin on the
    // text: a scroll-padding would count the toolbar's own buttons as hidden and scroll to them). And
    // as it and the text change with the view's width, the view goes back to the reader's place.
    const Observer = this.doc.defaultView?.ResizeObserver;
    if (Observer) {
      new Observer(() => {
        this.el.style.setProperty('--tv-bar-h', `${bar.offsetHeight}px`);
        this._reflowed();
      }).observe(bar);
      new Observer(() => this._reflowed()).observe(this.$('.tv-body'));
    }
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!this.$('.tv-toc').hidden) this._toggleToc(false);
        else this.close();
      } else if (isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) {
        // the slider's and the theme's own keys
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.turn(e.key === 'ArrowRight' ? 1 : -1);
      } else if (this.tv && e.target === this.el && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        // A TV's remote while reading: the text scrolls (the WebView would move the focus instead).
        e.preventDefault();
        this.scrollStep(e.key === 'ArrowDown' ? 1 : -1, e.repeat);
      }
    });
  }

  /**
   * ← →: the 3D book a page on (1) or back (-1) from the reader's place, the view following it
   * (outside's; also for a remote that leaves the focus on the 3D view).
   * @param {number} side
   */
  async turn(side) {
    await this._sync();
    this._turning++;
    try {
      await this.turnPage(side);
    } finally {
      this._turning--;
    }
  }

  /**
   * Reads on (dir 1) or back (-1) by a step (the step option) of what shows below the toolbar: a TV
   * remote's ↑ ↓, held (repeat) without a smooth scroll each.
   * @param {number} dir
   * @param {boolean} [repeat]
   */
  scrollStep(dir, repeat = false) {
    if (!this._open) return;
    const top = dir * this.step(this.el.clientHeight - this._barH());
    this.el.scrollBy({ top, behavior: repeat || this.reduced() ? 'auto' : 'smooth' });
  }

  /** The text size, one step, the view staying at its place. @private @param {number} step */
  async _size(step) {
    this.aim(this._at);
    try {
      await this.changeFont(step);
    } finally {
      this._aim = null;
    }
  }

  /** A theme: the colours change, the text and its place do not. @private @param {string} name */
  async _theme(name) {
    this._quiet++;
    try {
      await this.setTheme(name);
    } finally {
      this._quiet--;
    }
    this._style();
  }

  /** The view scrolled: once it rests (a quarter second), its place is shared (_rest). @private */
  _restSoon() {
    clearTimeout(this._restTimer);
    this._restTimer = setTimeout(() => this._rest(), 250);
  }

  /** A smooth scroll of the view's own: its scroll events, until the next rest, are not the reader's. @private */
  _selfScrolled() {
    this._self = true;
    this._restSoon(); // ends it even when nothing scrolled
  }

  /** @private */
  _rest() {
    this._self = false;
    if (this._moved) this._sync();
  }

  /**
   * The reader has scrolled: their place, at the toolbar's foot, is taken now, while the text is as
   * they read it, since a change of width moves it under them (_reflowed).
   * @private
   */
  _read() {
    this._moved = true;
    if (this._open && this.part >= 0 && this.bookOpen()) this._at = this.placeAt(this._top()) ?? this._at;
  }

  /**
   * What the text's place under the scroll depends on, besides the text: its width, which it is
   * wrapped to, and the toolbar's height (the toolbar wraps too), which it begins below.
   * @private
   */
  _layout() {
    return `${this.$('.tv-body').clientWidth} ${this.$('.tv-bar').offsetHeight}`;
  }

  /**
   * Whether the layout has changed since the place was taken, and the observers have yet to see it
   * (_reflowed): what is at the top then is not the reader's place, and a scroll the layout made (the
   * browser keeping something in sight, or the text shorter, its end nearer) is not their reading.
   * @private
   */
  _reflowing() {
    return this._laid != null && this._layout() !== this._laid;
  }

  /**
   * The view's width has changed (a phone turned, a window resized, the browser's zoom), and the text
   * has reflowed, or the toolbar wrapped again, under the view's scroll: the view goes back to the
   * reader's place, taken before, as it does a frame after opening. Its own scroll, not reading: the
   * 3D book stays where it is. A change of height alone moves nothing.
   * @private
   */
  _reflowed() {
    const was = this._laid;
    this._laid = this._layout();
    if (was == null || this._laid === was || !this._open || this.part < 0 || this._at == null) return;
    this._scrollTo(this._at, false);
  }

  /** Where the toolbar's foot is, in the page's coordinates: what is above it is under the toolbar. @private */
  _top() {
    return this.el.getBoundingClientRect().top + this._barH();
  }

  /**
   * The reader's place, the place at the view's top once they have scrolled, becomes the shared one:
   * the 3D book goes there in place (the view covers it), unless it shows it already. Also at once,
   * before anything that starts from the place (a size, Back, Put back, a turn, a link).
   * @protected
   */
  async _sync() {
    if (!this._open || !this.bookOpen() || this.part < 0) return;
    if (this._moved && !this._reflowing()) this._at = this.placeAt(this._top()) ?? this._at;
    this._moved = false;
    if (this._at == null) return;
    this._quiet++;
    try {
      await this.jumpTo(this._at, { inPlace: true });
    } finally {
      this._quiet--;
    }
  }

  /** T, and the site's "Text view" button: opens it, or closes it back to the 3D book. */
  toggle() {
    return this._open ? this.close() : this.open();
  }

  /**
   * Opens it at the 3D book's place, or at the view's own last one while the 3D book still shows it
   * (closed and opened again). A screen only: in VR nothing changes.
   */
  async open() {
    if (this._open || !this.bookOpen() || this.presenting()) return;
    this._open = true;
    this.el.hidden = false;
    this._style();
    const kept = this._book === this.bookKey() ? this._at : null;
    await this._show(kept != null && this.showsPlace(kept) ? kept : this.placeShown(), { smooth: false });
    if (!this._open) return;
    this._home().focus({ preventScroll: true });
    this.onOpen();
    // Once it is drawn, the place again (a late change of layout must not leave it under the
    // toolbar), unless the reader has scrolled meanwhile.
    this._frame(() => {
      if (this._open && !this._moved && !this._self && this._at != null) this._scrollTo(this._at, false);
    });
  }

  /** fn on the next frame (or soon, without frames). @private @param {() => void} fn */
  _frame(fn) {
    const win = this.doc.defaultView;
    if (win?.requestAnimationFrame) win.requestAnimationFrame(fn);
    else setTimeout(fn, 16);
  }

  /**
   * Where the focus goes in the view: its title, for the keyboard and a screen reader to carry on
   * from; on a TV (tv) the view itself, which holds the remote's focus while reading.
   * @protected
   */
  _home() {
    return this.tv ? this.el : this.$('.tv-title');
  }

  /** What a TV remote's card is while the view is open: its contents when open, else the whole view. */
  layer() {
    return this.tocOpen ? this.$('.tv-toc') : this.el;
  }

  /**
   * Menu on a TV: the toolbar's control used last, else its first that can be used.
   * @returns {HTMLElement | null}
   */
  cardStart() {
    const bar = this.$('.tv-bar');
    /** @type {(e: HTMLElement | null | undefined) => e is HTMLElement} */
    const usable = (e) => !!e && bar.contains(e) && !(/** @type {HTMLButtonElement} */ (e).disabled) && !e.hidden && e.getClientRects().length > 0;
    return usable(this._barFocus) ? this._barFocus : Array.from(/** @type {NodeListOf<HTMLElement>} */ (bar.querySelectorAll('button, select, input'))).find(usable) ?? null;
  }

  /**
   * OK on a TV: the first link on the screen, below the toolbar, to go on from link to link; or none.
   * @returns {HTMLElement | null}
   */
  linkHere() {
    const bottom = this.el.getBoundingClientRect().bottom;
    for (const a of Array.from(/** @type {NodeListOf<HTMLElement>} */ (this.$('.tv-body').querySelectorAll('a[href]')))) {
      if (this.onScreen(a)) return a;
      if (a.getBoundingClientRect().top >= bottom) break;
    }
    return null;
  }

  /** Whether a control is in its toolbar (a TV remote's ↑ ↓ between it and the text). @param {Node | null} el */
  inBar(el) {
    return this.$('.tv-bar').contains(el);
  }

  /** Whether an element's top is on the screen, below the toolbar: the focus can go there without a scroll. @param {Element} el */
  onScreen(el) {
    const view = this.el.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.top >= view.top + this._barH() - 1 && r.top < view.bottom;
  }

  /**
   * Closes it, leaving the 3D book open at the place at the top of the view (keepPlace), and gives
   * focus back (returnFocus). In VR too: the place is shared all the same.
   * @param {{ keepPlace?: boolean }} [options] keepPlace false: the book is being put back
   */
  async close({ keepPlace = true } = {}) {
    if (!this._open) return;
    const place = keepPlace && this.bookOpen() && this.part >= 0;
    if (place && this._moved && !this._reflowing()) this._at = this.placeAt(this._top()) ?? this._at;
    clearTimeout(this._restTimer);
    this._moved = this._self = false;
    this._open = false;
    this._toggleToc(false);
    this.el.hidden = true;
    if (place && this._at != null) await this.jumpTo(this._at, { inPlace: true });
    if (place) this.onClose();
    this.returnFocus(!keepPlace)?.focus?.({ preventScroll: true });
  }

  /**
   * Where a jump is going (a link, Back, the contents, a part), or null: the view shows it, not the 3D
   * book's place, which may be a spread beginning on the part before (its left page). A site that
   * cleans up its places does so here (vrlbry's { c, b, f }) and calls super.
   * @param {P | null | undefined} place
   */
  aim(place) {
    this._aim = place ?? null;
  }

  /**
   * After every page turn or jump of the 3D book: the view follows it. While the 3D book still shows
   * the view's place (showsPlace), the view stays there, as it opens: its pages shown again, one or
   * two (outside's refit). A turn of the view's own (turn) goes to the new pages' first place all the
   * same: they may hold some of the place too, as vrlbry's places are blocks, and a paragraph runs
   * over two spreads.
   */
  follow() {
    this._style();
    const aim = this._aim;
    this._aim = null;
    if (!this._open || !this.bookOpen()) return;
    if (this._quiet) {
      this._header(); // the 3D book came to the view's place
      return;
    }
    const kept = aim == null && !this._turning && this._book === this.bookKey() ? this._at : null;
    this._show(aim != null ? this.placeAimed(aim) : kept != null && this.showsPlace(kept) ? kept : this.placeShown());
  }

  /** The theme's colours and the text size, as the 3D book has them. @protected */
  _style() {
    const theme = this.theme() || 'paper';
    this.el.setAttribute('data-theme', theme);
    this.el.setAttribute('data-motion', this.reduced() ? 'less' : 'full');
    this.el.style.setProperty('--tv-scale', String(this.fontScale() || 1));
    /** @type {HTMLSelectElement} */ (this.$('.tv-theme-sel')).value = theme; // STATIC's <select>
  }

  /**
   * Shows the part a place is in (building it when it is another), scrolled to the place: once the
   * one before has been shown.
   * @protected
   * @param {P | null} place
   * @param {{ smooth?: boolean }} [options] a smooth scroll (as motion allows) within the part shown
   */
  _show(place, { smooth = true } = {}) {
    const run = this._showing.then(() => this._showNow(place, smooth)).catch((err) => console.warn('text view', err));
    this._showing = run;
    return run;
  }

  /**
   * @private
   * @param {P | null} place
   * @param {boolean} smooth
   */
  async _showNow(place, smooth) {
    if (!this._open || !this.bookOpen() || place == null) return;
    const book = this.bookKey();
    const part = this.partOf(place);
    if (book !== this._book || part !== this.part) {
      const box = this.doc.createElement('div');
      const shown = (await this.renderPart(box, part, { onLink: (link) => { this._sync().then(() => this.followLink(link)); } })) ?? {}; // Back returns here
      if (!this._open || !this.bookOpen() || this.bookKey() !== book) {
        this.part = -1; // built again when next shown: the site may have let go of what was shown
        return;
      }
      // Focus in the view (a link just followed, which goes with the old part) moves to the new
      // part's heading, so the keyboard and a screen reader carry on from there.
      const active = this.doc.activeElement;
      const refocus = !active || active === this.doc.body || this.el.contains(active);
      this.$('.tv-body').replaceChildren(...Array.from(box.childNodes));
      this.$('.tv-title').textContent = shown.title ?? '';
      const sub = this.$('.tv-sub');
      sub.textContent = shown.subtitle ?? '';
      sub.hidden = !shown.subtitle;
      this.part = part;
      if (book !== this._book) this._toc = null;
      this._book = book;
      smooth = false;
      if (refocus) this._home().focus({ preventScroll: true });
    }
    this._header();
    this._at = place;
    this._moved = false;
    this._scrollTo(place, smooth);
  }

  /**
   * Scrolls a place to just below the toolbar (placeTop), or the view to its top.
   * @private
   * @param {P} place
   * @param {boolean} smooth
   */
  _scrollTo(place, smooth) {
    // The place lands below the toolbar, shown for the jump: its height now, since the observer last
    // saw it hidden (0) when the view opens and has not run again yet (and not its box, which may be
    // sliding back).
    const bar = this.$('.tv-bar');
    bar.classList.remove('tv-away');
    const barH = bar.offsetHeight;
    this.el.style.setProperty('--tv-bar-h', `${barH}px`);
    const top = this.placeTop(place);
    const smoothly = top != null && smooth && !this.reduced();
    if (smoothly) this._selfScrolled(); // a while: its scroll events until it rests are its own
    const y = top == null ? 0 : top - this.el.getBoundingClientRect().top - barH + this.el.scrollTop;
    this.el.scrollTo({ top: Math.max(0, Math.round(y)), behavior: smoothly ? 'smooth' : 'auto' });
    // An instant scroll is done at once: its event is known by where it leaves the view.
    this._selfTop = smoothly ? null : this.el.scrollTop;
    this._lastY = this.el.scrollTop;
    if (this._laid != null) this._laid = this._layout(); // what the place is right for now
  }

  /** Where the reader is, Back, and the parts. @protected */
  _header() {
    const label = this.label();
    this.$('.tv-label').textContent = label;
    const slider = /** @type {HTMLInputElement} */ (this.$('.tv-slider')); // STATIC's range
    slider.value = String(Math.round(this.progress() * 1000));
    slider.setAttribute('aria-valuetext', /\//.test(label) ? `Page ${label.replace(' / ', ' of ')}` : label);
    this.$('.tv-back').hidden = !this.hasTrail();
    const n = this.partCount();
    const word = this.partWord(); // a Wikipedia volume's parts are its articles, and are called so
    for (const [sel, name, wide] of [['.tv-prev', `Previous ${word}`, ` Previous ${word}`], ['.tv-next', `Next ${word}`, `Next ${word} `]]) {
      for (const b of Array.from(/** @type {NodeListOf<HTMLButtonElement>} */ (this.el.querySelectorAll(sel)))) {
        b.disabled = sel === '.tv-prev' ? this.part <= 0 : this.part >= n - 1;
        b.setAttribute('aria-label', name);
        /** @type {HTMLElement} */ (b.querySelector('.tv-wide')).textContent = wide; // STATIC's
      }
    }
    const no = this.$('.tv-partno');
    no.textContent = n > 1 ? `${word.charAt(0).toUpperCase()}${word.slice(1)} ${this.part + 1} of ${n}` : '';
    no.hidden = n <= 1;
  }

  /** The previous or next part, from its start. @private @param {number} dir */
  async _part(dir) {
    const part = this.part + dir;
    if (part < 0 || part >= this.partCount()) return;
    await this._goTo(this.partStart(part));
  }

  /**
   * A place, the view showing it (a part's start, an entry of the contents), and the focus on the
   * view's home.
   * @protected
   * @param {P | null} place
   */
  async _goTo(place) {
    if (place == null) return;
    this.aim(place);
    try {
      // The spread may show the place already (a part's start on its right): the view goes there anyway.
      if (!(await this.jumpTo(place, { inPlace: false }))) this.follow();
    } finally {
      this._aim = null;
    }
    this._home().focus({ preventScroll: true });
  }

  /**
   * Opens or closes the contents: a panel under the toolbar, over the text, so the reader's place
   * stays where it is; its entries (contents) once a book, the focus on where the reader is.
   * @protected
   * @param {boolean} [show]
   */
  _toggleToc(show = this.$('.tv-toc').hidden) {
    const nav = this.$('.tv-toc');
    const btn = this.$('.tv-toc-btn');
    if (show && !this._toc) {
      const list = this.$('.tv-toc-list');
      list.replaceChildren();
      const toc = (this._toc = this.contents());
      for (const entry of toc) {
        const li = this.doc.createElement('li');
        li.className = `tv-toc-l${Math.min(6, Math.max(1, entry.level || 1))}`;
        const a = this.doc.createElement('a');
        a.href = entry.href ?? '#';
        a.textContent = entry.title;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          this._toggleToc(false);
          Promise.resolve(this.useContents(entry)).then(() => this._home().focus({ preventScroll: true }));
        });
        li.append(a);
        if (entry.after) li.append(this.doc.createTextNode(entry.after));
        list.append(li);
      }
      if (!toc.length) {
        const li = this.doc.createElement('li');
        li.textContent = 'This book has no contents.';
        list.append(li);
      }
    }
    // Closed from inside (Esc), focus goes back to its button, not to the page.
    if (!show && !nav.hidden && nav.contains(this.doc.activeElement)) btn.focus({ preventScroll: true });
    if (show) {
      const top = Math.max(0, this.$('.tv-bar').getBoundingClientRect().bottom);
      nav.style.top = `${top}px`;
      nav.style.maxHeight = `min(60vh, ${Math.max(80, (this.doc.defaultView?.innerHeight ?? 0) - top - 8)}px)`;
    }
    nav.hidden = !show;
    btn.setAttribute('aria-expanded', String(!!show));
    if (show) {
      // Focus on where the reader is (the last entry in or before the part shown), not the first of a
      // thousand, in the middle of the list.
      const links = Array.from(/** @type {NodeListOf<HTMLElement>} */ (nav.querySelectorAll('a')));
      let i = 0;
      (this._toc ?? []).forEach((e, k) => { if (this.partOf(e.place) <= this.part) i = k; });
      const here = links[Math.min(i, links.length - 1)];
      if (here) {
        const r = here.getBoundingClientRect();
        const n = nav.getBoundingClientRect();
        nav.scrollTop += r.top - n.top - (n.height - r.height) / 2;
        here.focus({ preventScroll: true });
      }
    }
  }

  // ── The site's: common's know no book ─────────────────────────────────────

  /** Whether a book is open, for the view to show (a book in VR too: close shares its place). @returns {boolean} */
  bookOpen() {
    return false;
  }

  /** Whether in VR, where the view does not open. @returns {boolean} */
  presenting() {
    return false;
  }

  /**
   * Which book is open, as anything compared with ===: when it changes, the view builds its part
   * again, fills its contents again and forgets its place (vrlbry's library and id). One book: null.
   * @returns {unknown}
   */
  bookKey() {
    return null;
  }

  /** How many parts the book has (vrlbry's chunks; outside's title page, pieces and sources). @returns {number} */
  partCount() {
    return 1;
  }

  /**
   * The part a place is in.
   * @param {P} place
   * @returns {number}
   */
  partOf(place) {
    return 0;
  }

  /**
   * The place a part begins at: where the previous and next part go.
   * @param {number} part
   * @returns {P | null}
   */
  partStart(part) {
    return null;
  }

  /**
   * Builds a part into body, a new element the view puts in once it is built (vrlbry's chunk's blocks,
   * outside's pieces): text as text, never as HTML. Each link's click calls onLink with what it leads
   * to, and the view brings the 3D book to its place and follows it (followLink). Returns what the
   * view's title and the line under it say; it may be waited for (vrlbry's fetches the part).
   * @param {HTMLElement} body
   * @param {number} part
   * @param {{ onLink: (link: unknown) => void }} options
   * @returns {RenderedPart | Promise<RenderedPart>}
   */
  renderPart(body, part, options) {
    return {};
  }

  /** The 3D book's place: where the view opens and what it follows. @returns {P | null} */
  placeShown() {
    return null;
  }

  /**
   * Whether the 3D book's open pages show a place: the view opens again at its own while they do, and
   * stays at it when they are shown again (vrlbry's _showsBlock, outside's showsPlace).
   * @param {P} place
   * @returns {boolean}
   */
  showsPlace(place) {
    return false;
  }

  /**
   * What the view shows for a place aimed at (aim), once the 3D book has gone there: the place itself
   * by default (vrlbry's names an element the 3D page found, and shows the page's place then).
   * @param {P} aim
   * @returns {P | null}
   */
  placeAimed(aim) {
    return aim;
  }

  /**
   * Where a place is in the view, in the page's coordinates (a getBoundingClientRect's top), for it to
   * land below the toolbar; null for the part's top (its heading). vrlbry's finds its block, outside's
   * the line with its word.
   * @param {P} place
   * @returns {number | null}
   */
  placeTop(place) {
    return null;
  }

  /**
   * The place at the view's top, top being the toolbar's foot in the page's coordinates: the first
   * block reaching below it (vrlbry's topBlock), and outside's first word there in sight. null keeps
   * the place the view has.
   * @param {number} top
   * @returns {P | null}
   */
  placeAt(top) {
    return null;
  }

  /**
   * Brings the 3D book to a place: in place (inPlace) when the view covers it, the reader's place
   * shared; returns whether it moved (a spread showing it already does not).
   * @param {P} place
   * @param {{ inPlace: boolean }} options
   * @returns {boolean | Promise<boolean>}
   */
  jumpTo(place, options) {
    return false;
  }

  /** The 3D book a page on (1) or back (-1). @param {number} dir @returns {unknown} */
  turnPage(dir) {
    return undefined;
  }

  /** The 3D book to a fraction of the way through (0…1): the slider. @param {number} f @returns {unknown} */
  jumpToProgress(f) {
    return undefined;
  }

  /** The text a size larger (1) or smaller (-1): the 3D book's and the view's. @param {number} step @returns {unknown} */
  changeFont(step) {
    return undefined;
  }

  /** A theme by name (paper, sepia, night): the 3D book's and the view's. @param {string} name @returns {unknown} */
  setTheme(name) {
    return undefined;
  }

  /** Back along the links followed (hasTrail). @returns {unknown} */
  goBack() {
    return undefined;
  }

  /** Puts the book back (outside's puts it down), which closes the view (close with keepPlace false). @returns {unknown} */
  putBack() {
    return undefined;
  }

  /** Follows a link of the text (renderPart's onLink), the reader's place shared first, for Back. @param {unknown} link @returns {unknown} */
  followLink(link) {
    return undefined;
  }

  /** The book's contents: vrlbry's by level, outside's pieces with their authors after them. @returns {ContentsEntry<P>[]} */
  contents() {
    return [];
  }

  /**
   * Goes to an entry of the contents (the contents closed): its place by default, the view showing
   * it. vrlbry's jumps as its 3D contents do.
   * @param {ContentsEntry<P>} entry
   * @returns {unknown}
   */
  useContents(entry) {
    return this._goTo(entry.place);
  }

  /** Where the reader is, said ("12 / 340", or what a page is called). @returns {string} */
  label() {
    return '';
  }

  /** How far through the book the reader is, 0…1. @returns {number} */
  progress() {
    return 0;
  }

  /** Whether Back has a link to go back along. @returns {boolean} */
  hasTrail() {
    return false;
  }

  /** What a part is called: 'part', or 'article' in a Wikipedia volume. @returns {string} */
  partWord() {
    return 'part';
  }

  /** The theme the 3D book has: paper, sepia or night. @returns {string} */
  theme() {
    return 'paper';
  }

  /** The text's size, 1 its own. @returns {number} */
  fontScale() {
    return 1;
  }

  /** Less motion (access.js reduceMotion): no smooth scrolls, the toolbar not sliding. @returns {boolean} */
  reduced() {
    return false;
  }
}
