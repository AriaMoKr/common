// A stand-in for the page's DOM, for the text view in Node (test/text-view.test.js): a document with
// its head, body and window, elements built by hand or from markup (innerHTML), the few selectors a
// view asks for, events that bubble, focus with focusin and focusout, and a layout each test lays
// out itself. An element's box is where it is in its scroller's content (or the page's): the
// scroller's scrollTop moves what is in it, and its scroll events come a microtask later. A sticky
// box stays at its scroller's top, moved up by its height while it has the class tv-away (as the
// text view's CSS moves its toolbar). Hidden, or not in the document, an element has no box. Grown
// from outside's test/helpers/fake-dom.js (vrlbry's before it). Not a test file itself
// (test/*.test.js).

const VOID = new Set(['br', 'hr', 'img', 'input', 'link', 'meta']);
const FOCUSABLE = /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/;

/** An event: as its listeners get it. */
export class Ev {
  /**
   * @param {string} type
   * @param {Record<string, unknown>} [init] bubbles, key, code, repeat, ctrlKey, … (cancelable by default)
   */
  constructor(type, init = {}) {
    Object.assign(this, { type, bubbles: false, cancelable: true, key: '', code: '', repeat: false, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, relatedTarget: null }, init);
    /** @type {El | null} */
    this.target = null;
    /** @type {El | null} */
    this.currentTarget = null;
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

class Text {
  /**
   * @param {Doc} doc
   * @param {string} data
   */
  constructor(doc, data) {
    /** @type {3} */
    this.nodeType = 3;
    this.ownerDocument = doc;
    this.data = String(data);
    /** @type {El | null} */
    this.parentNode = null;
  }

  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
}

/** An element's style: its custom properties (setProperty) and whatever else is set on it. */
class Style {
  constructor() {
    /** @type {Map<string, string>} */
    this._props = new Map();
  }

  /** @param {string} name @param {string} value */
  setProperty(name, value) { this._props.set(name, String(value)); }

  /** @param {string} name */
  getPropertyValue(name) { return this._props.get(name) ?? ''; }
}

/** The class attribute's names. */
class ClassList {
  /** @param {El} el */
  constructor(el) { this.el = el; }

  _names() { return (this.el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean); }

  /** @param {string} name */
  contains(name) { return this._names().includes(name); }

  /** @param {...string} names */
  add(...names) { this.el.setAttribute('class', [...new Set([...this._names(), ...names])].join(' ')); }

  /** @param {...string} names */
  remove(...names) { this.el.setAttribute('class', this._names().filter((n) => !names.includes(n)).join(' ')); }

  /** @param {string} name @param {boolean} [on] */
  toggle(name, on = !this.contains(name)) {
    if (on) this.add(name);
    else this.remove(name);
    return on;
  }
}

/** `tag`, `.class`, `#id`, `[attr]` and `[attr="value"]`, each alone or together, comma-separated. @param {string} sel */
function matcher(sel) {
  const alts = sel.split(',').map((s) => s.trim()).map((s) => {
    const parts = [...s.matchAll(/([a-z][a-z0-9]*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/gi)];
    if (!s || parts.map((p) => p[0]).join('') !== s) throw new Error(`the stand-in can't match ${s}`);
    /** @param {El} e */
    return (e) => parts.every(([, tag, cls, id, attr, value]) => (tag ? e.tagName === tag.toUpperCase()
      : cls ? e.classList.contains(cls)
        : id ? e.id === id
          : e.hasAttribute(attr) && (value === undefined || e.getAttribute(attr) === value)));
  });
  /** @param {El} e */
  return (e) => alts.some((m) => m(e));
}

/**
 * Markup as nodes: tags with their attributes (quoted, or bare), void tags, text. No entities, no
 * comments: the text view's own markup needs none.
 * @param {Doc} doc
 * @param {string} html
 */
function parse(doc, html) {
  const top = new El(doc, 'template');
  const open = [top];
  for (const [, close, tag, attrs, text] of html.matchAll(/<\/([a-z0-9]+)\s*>|<([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/gi)) {
    const at = open[open.length - 1];
    if (close) {
      if (at.tagName !== close.toUpperCase()) throw new Error(`the stand-in can't close ${close} in ${at.tagName}`);
      open.pop();
    } else if (tag) {
      const el = doc.createElement(tag);
      for (const [, name, value] of attrs.matchAll(/([a-z-]+)(?:="([^"]*)")?/gi)) el.setAttribute(name, value ?? '');
      at.append(el);
      if (!VOID.has(tag.toLowerCase())) open.push(el);
    } else at.append(doc.createTextNode(text));
  }
  if (open.length !== 1) throw new Error(`the stand-in found ${open[open.length - 1].tagName} not closed`);
  return [...top.childNodes];
}

/**
 * Where an element is laid out: top and height in its scroller's content (or the page's), and
 * whether it sticks to its scroller's top.
 * @typedef {{ top: number, height: number, sticky?: boolean }} Box
 */

export class El {
  /**
   * @param {Doc} doc
   * @param {string} tag
   */
  constructor(doc, tag) {
    /** @type {1} */
    this.nodeType = 1;
    this.ownerDocument = doc;
    this.tagName = tag.toUpperCase();
    /** @type {Map<string, string>} */
    this.attributes = new Map();
    /** @type {(El | Text)[]} */
    this.childNodes = [];
    /** @type {El | null} */
    this.parentNode = null;
    /** @type {{ type: string, fn: (e: Ev) => void }[]} */
    this.listeners = [];
    this.style = new Style();
    this.classList = new ClassList(this);
    this.disabled = false;
    this.value = '';
    /** Where it is laid out, or null (no box). @type {Box | null} */
    this.box = null;
    /** A scroller: its scrollTop moves the boxes in it. */
    this.scrolls = false;
    this._scrollTop = 0;
    /** Each scrollTo ({ top, behavior }) and scrollBy ({ by, behavior }) asked of it. @type {Record<string, unknown>[]} */
    this.scrolled = [];
    /** Each focus() it took, with its options. @type {unknown[]} */
    this.focused = [];
  }

  /** @param {string} name */
  getAttribute(name) { return this.attributes.get(name) ?? null; }

  /** @param {string} name @param {string} value */
  setAttribute(name, value) { this.attributes.set(name, String(value)); }

  /** @param {string} name */
  removeAttribute(name) { this.attributes.delete(name); }

  /** @param {string} name */
  hasAttribute(name) { return this.attributes.has(name); }

  get id() { return this.getAttribute('id') ?? ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') ?? ''; }
  set className(v) { this.setAttribute('class', v); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) {
    if (v) this.setAttribute('hidden', '');
    else this.removeAttribute('hidden');
  }

  get tabIndex() { return Number(this.getAttribute('tabindex') ?? (FOCUSABLE.test(this.tagName) ? 0 : -1)); }
  set tabIndex(v) { this.setAttribute('tabindex', String(v)); }
  get href() { return this.getAttribute('href') ?? ''; }
  set href(v) { this.setAttribute('href', v); }

  get children() { return /** @type {El[]} */ (this.childNodes.filter((n) => n.nodeType === 1)); }

  /** @param {El | Text | string} node @param {number} i */
  _insert(node, i) {
    const n = typeof node === 'string' ? this.ownerDocument.createTextNode(node) : node;
    n.parentNode?._take(n);
    n.parentNode = this;
    this.childNodes.splice(i, 0, n);
  }

  /** @param {El | Text} node */
  _take(node) {
    const i = this.childNodes.indexOf(node);
    if (i >= 0) this.childNodes.splice(i, 1);
    node.parentNode = null;
  }

  /** @param {...(El | Text | string)} nodes */
  append(...nodes) {
    for (const n of nodes) this._insert(n, this.childNodes.length);
  }

  /** @param {...(El | Text | string)} nodes */
  prepend(...nodes) {
    nodes.forEach((n, i) => this._insert(n, i));
  }

  /** @param {...(El | Text | string)} nodes */
  replaceChildren(...nodes) {
    for (const n of [...this.childNodes]) this._take(n);
    this.append(...nodes);
  }

  remove() {
    this.parentNode?._take(this);
  }

  /** @param {El | Text | null} other */
  contains(other) {
    for (let n = other; n; n = n.parentNode) if (n === this) return true;
    return false;
  }

  get textContent() { return this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(v) {
    this.replaceChildren();
    if (v != null && v !== '') this.append(String(v));
  }

  /** @param {string} html */
  set innerHTML(html) { this.replaceChildren(...parse(this.ownerDocument, html)); }

  /** @returns {Generator<El>} */
  *descendants() {
    for (const n of this.children) {
      yield n;
      yield* n.descendants();
    }
  }

  /** @param {string} sel */
  querySelectorAll(sel) {
    return [...this.descendants()].filter(matcher(sel));
  }

  /** @param {string} sel */
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] ?? null;
  }

  /** @param {string} type @param {(e: Ev) => void} fn */
  addEventListener(type, fn) {
    this.listeners.push({ type, fn });
  }

  /** At it, then (bubbles) at each element it is in. @param {Ev} e */
  dispatchEvent(e) {
    e.target = this;
    for (let n = /** @type {El | null} */ (this); n && !e.stopped; n = e.bubbles ? n.parentNode : null) {
      e.currentTarget = n;
      for (const l of [...n.listeners]) if (l.type === e.type) l.fn.call(n, e);
    }
    return !e.defaultPrevented;
  }

  /** A click, unless it is disabled. */
  click() {
    if (!this.disabled) this.dispatchEvent(new Ev('click', { bubbles: true }));
  }

  /** Takes the focus, if it is shown. @param {unknown} [options] */
  focus(options) {
    if (!this.displayed()) return;
    this.focused.push(options);
    this.ownerDocument._focus(this);
  }

  blur() {
    if (this.ownerDocument.activeElement === this) this.ownerDocument._focus(this.ownerDocument.body);
  }

  /** Whether it is in the document, and neither it nor what it is in is hidden. */
  displayed() {
    /** @type {El | null} */
    let last = null;
    for (let n = /** @type {El | null} */ (this); n; n = n.parentNode) {
      if (n.hidden) return false;
      last = n;
    }
    return last === this.ownerDocument.documentElement;
  }

  /** The scroller it is in, or null. */
  get scroller() {
    for (let n = this.parentNode; n; n = n.parentNode) if (n.scrolls) return n;
    return null;
  }

  getBoundingClientRect() {
    if (!this.box || !this.displayed()) return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
    const s = this.scroller;
    const h = this.box.height;
    let top = this.box.top;
    if (s) {
      const base = s.getBoundingClientRect().top;
      top = this.box.sticky ? base - (this.classList.contains('tv-away') ? h : 0) : base + this.box.top - s.scrollTop;
    }
    return { top, bottom: top + h, left: 0, right: 100, width: 100, height: h, x: 0, y: top };
  }

  getClientRects() {
    const r = this.getBoundingClientRect();
    return r.height > 0 ? [r] : [];
  }

  get offsetHeight() { return this.box && this.displayed() ? this.box.height : 0; }
  get clientHeight() { return this.offsetHeight; }

  /** How high what it scrolls is: its own height, or the foot of the lowest box in it. */
  get scrollHeight() {
    let h = this.clientHeight;
    for (const d of this.descendants()) if (d.box && !d.box.sticky && d.scroller === this && d.displayed()) h = Math.max(h, d.box.top + d.box.height);
    return h;
  }

  get scrollTop() { return this._scrollTop; }
  set scrollTop(v) {
    const top = Math.max(0, Math.min(this.scrollHeight - this.clientHeight, Math.round(v)));
    if (top === this._scrollTop) return;
    this._scrollTop = top;
    queueMicrotask(() => this.dispatchEvent(new Ev('scroll')));
  }

  /** @param {{ top?: number, behavior?: string }} [o] at once, smooth or not */
  scrollTo({ top = this._scrollTop, behavior = 'auto' } = {}) {
    this.scrolled.push({ top, behavior });
    this.scrollTop = top;
  }

  /** @param {{ top?: number, behavior?: string }} [o] */
  scrollBy({ top = 0, behavior = 'auto' } = {}) {
    this.scrolled.push({ by: top, behavior });
    this.scrollTop = this._scrollTop + top;
  }
}

/** A document: its <html> with <head> and <body>, the focus, and a window (defaultView). */
export class Doc {
  /**
   * @param {{ short?: boolean, innerHeight?: number }} [o] short: a window at most 420 px high
   */
  constructor({ short = false, innerHeight = 600 } = {}) {
    /** @type {9} */
    this.nodeType = 9;
    this.documentElement = new El(this, 'html');
    this.head = new El(this, 'head');
    this.body = new El(this, 'body');
    this.documentElement.append(this.head, this.body);
    /** @type {El} */
    this.activeElement = this.body;
    /** What requestAnimationFrame was given, until frame(). @type {((t: number) => void)[]} */
    this.frames = [];
    /** What each ResizeObserver observes, and its callback. @type {{ el: El, fn: () => void }[]} */
    this.observed = [];
    const doc = this;
    this.defaultView = {
      innerHeight,
      /** @param {string} query */
      matchMedia: (query) => ({ media: query, matches: short && /max-height:\s*420px/.test(query) }),
      /** @param {(t: number) => void} fn */
      requestAnimationFrame: (fn) => doc.frames.push(fn),
      ResizeObserver: class {
        /** @param {() => void} fn */
        constructor(fn) { this.fn = fn; }
        /** @param {El} el */
        observe(el) { doc.observed.push({ el, fn: this.fn }); }
      },
    };
  }

  /** @param {string} tag */
  createElement(tag) { return new El(this, tag); }

  /** @param {string} data */
  createTextNode(data) { return new Text(this, data); }

  /** @param {string} id */
  getElementById(id) {
    for (const e of this.documentElement.descendants()) if (e.id === id) return e;
    return null;
  }

  /** The next frame: what requestAnimationFrame was given, run. */
  frame() {
    for (const fn of this.frames.splice(0)) fn(0);
  }

  /** @param {El} el */
  _focus(el) {
    const was = this.activeElement;
    if (was === el) return;
    this.activeElement = el;
    if (was !== this.body) was.dispatchEvent(new Ev('focusout', { bubbles: true, relatedTarget: el }));
    if (el !== this.body) el.dispatchEvent(new Ev('focusin', { bubbles: true, relatedTarget: was }));
  }
}
