// The sites in the Android TV app (AriaMoKr/HallwayApp): the site in a full-screen WebView whose user
// agent ends with " HallwayTV/<version>" (tvMode; ?tv=emulate shows the TV's page in any browser),
// walked with the TV's remote. Walking, the 3D view holds the focus, the arrows walk and turn (the
// site's own keys, read through keyOf), and OK uses the middle of the view, as a gamepad's A does.
// Menu moves the focus into the card, where up and down go from control to control (a choice one
// stop), left and right through a choice, and OK ticks; Escape or Back walk again. A control that
// uses the arrows itself keeps them: an open combobox up and down (and Escape, as Back closes its
// list first), a range left and right, a text box's caret left and right until it is at an end.
// Walking, Back is the site's own step back (step), if any. The app asks the page what Back and
// Menu do (window.hallwayTV, answerApp): true when the page used the key, else the app goes back a
// page, or leaves (README, "The TV app"). With TalkBack on, the arrows are TalkBack's and never
// reach the page, but the channel and media keys do: keyOf reads four of them as the arrows.
// The hallway's public/js/tv.js (26f6d40), without its Join form (roomFromInput stays in the
// hallway: it needs layersharedsession), with the step back of a site's own and the rest the other
// sites need.

/**
 * Whether this is the TV app's WebView: its user agent ends with " HallwayTV/<version>".
 * @param {string | null | undefined} userAgent
 */
export const isTV = (userAgent) => /\bHallwayTV\/\d/.test(userAgent ?? '');

/**
 * Whether to show the TV's page: in the TV app, or with ?tv=emulate in the address, in any browser.
 * @param {{ userAgent?: string, search?: string }} [o] navigator.userAgent and location.search by default
 */
export function tvMode({ userAgent = globalThis.navigator?.userAgent, search = globalThis.location?.search } = {}) {
  if (isTV(userAgent)) return true;
  try {
    return new URLSearchParams(search ?? '').get('tv') === 'emulate';
  } catch {
    return false;
  }
}

/**
 * The remote's keys that reach the page with TalkBack on, read as the arrows (TalkBack keeps the
 * arrows): channel up and down, rewind and fast-forward. Play, pause, stop and next stay as they are.
 */
export const SPARE_KEYS = Object.freeze({ ChannelUp: 'ArrowUp', ChannelDown: 'ArrowDown', MediaRewind: 'ArrowLeft', MediaFastForward: 'ArrowRight' });

/** @param {string} k */
const spare = (k) => (Object.hasOwn(SPARE_KEYS, k) ? SPARE_KEYS[/** @type {keyof typeof SPARE_KEYS} */ (k)] : undefined);

/**
 * A key event's name for a site's key map: its code ('KeyW', 'ArrowUp'), else its key, since the
 * remote's OK and keys sent with `adb shell input keyevent` come with an empty code ('Enter',
 * 'ArrowUp'); the spare keys (SPARE_KEYS) as the arrows.
 * @param {{ code?: string, key?: string }} e
 * @returns {string}
 */
export function keyOf(e) {
  const k = e.code || e.key || '';
  return spare(k) ?? spare(e.key ?? '') ?? k;
}

/** @param {{ code?: string, key?: string }} e the key's name for the card: its key, a spare key as its arrow */
const keyName = (e) => spare(e.key ?? '') ?? spare(e.code ?? '') ?? e.key ?? '';

const TYPED = new Set(['text', 'search', 'url', 'email', 'number', 'password', 'tel', 'textarea']);

/**
 * Whether the focused control uses this key itself, so the card leaves it to it: an open combobox
 * (role="combobox", aria-expanded="true") up, down and Escape; a range left and right; a text box's
 * caret left and right, until it is at that end.
 * @param {Element | null | undefined} el
 * @param {string} key
 */
export function keepsKey(el, key) {
  if (!el) return false;
  const c = /** @type {HTMLInputElement} */ (el);
  if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Escape') {
    return c.getAttribute?.('role') === 'combobox' && c.getAttribute('aria-expanded') === 'true';
  }
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return false;
  if (c.type === 'range') return true;
  if (!TYPED.has(c.type)) return false;
  let caret = null;
  try {
    caret = c.selectionStart === c.selectionEnd ? c.selectionStart : null;
  } catch {
    /* a box without a caret */
  }
  if (caret === null) return false;
  return key === 'ArrowLeft' ? caret > 0 : caret < (c.value ?? '').length;
}

/**
 * The card's stops among its controls, in order ([{ radio }]: a radio's group name, else ''): their
 * indices, a choice (a radio group) one stop, its checked option standing for it (else its first).
 * @param {Array<{ radio: string, checked?: boolean }>} items
 * @returns {number[]}
 */
export function focusStops(items) {
  /** @type {number[]} */
  const stops = [];
  const groups = new Map();
  items.forEach((item, i) => {
    if (!item.radio) {
      stops.push(i);
      return;
    }
    const at = groups.get(item.radio);
    if (at === undefined) {
      groups.set(item.radio, stops.length);
      stops.push(i);
    } else if (item.checked && !items[stops[at]].checked) {
      stops[at] = i;
    }
  });
  return stops;
}

/**
 * The stop `dir` (−1, +1) on from `at` (−1: none yet) among `n`, staying at the ends; −1 when there
 * are none.
 * @param {number} n
 * @param {number} at
 * @param {number} dir
 */
export function nextStop(n, at, dir) {
  if (n <= 0) return -1;
  if (at < 0) return dir < 0 ? n - 1 : 0;
  return Math.min(n - 1, Math.max(0, at + dir));
}

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** @param {Element} e */
const shown = (e) => (typeof e.checkVisibility === 'function' ? e.checkVisibility({ visibilityProperty: true }) : e.getClientRects().length > 0);

/** @param {Element} el @param {string} type */
const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

/** A key sent to a control, for its own listener (the TV's remote has no Escape, and a spare key isn't an arrow). @param {Element} el @param {string} key */
const send = (el, key) => el.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));

/**
 * @typedef {object} RemoteOptions
 * @property {HTMLElement} root the page's card, around its controls (document.body when they are
 *   spread over the page): everything the remote must reach
 * @property {HTMLElement} view the 3D view's canvas, which holds the focus while walking
 * @property {() => void} use OK while walking: the middle of the view, as the gamepad's A
 * @property {() => boolean} [step] Back while walking: the site's own step back (put a book back,
 *   stand up, close a text view); true when it took one. One the page's history has an entry for
 *   (BackHistory's book) is the app's back, not a step
 */

/** The remote's keys, and the card's focus. */
export class Remote {
  /** @param {RemoteOptions} o */
  constructor({ root, view, use, step = () => false }) {
    this.root = root;
    this.view = view;
    this.use = use;
    /** Back while walking: the site's own step back; true when it took one. */
    this.step = step;
    /** @type {(inCard: boolean) => void} when the focus goes into the card, or back to walking */
    this.onMode = () => {};
    /**
     * The control last left in the card, to come back to.
     * @private
     * @type {HTMLElement | null}
     */
    this._last = null;
    /**
     * The key event a control keeps: it goes to the control and no further.
     * @private
     * @type {Event | null}
     */
    this._kept = null;
    view.tabIndex = 0;
    // Before the site's own listeners, which walk with the arrows: in the card they move the focus.
    addEventListener('keydown', (e) => this._key(e), true);
    // A key the control kept, on its way up from it: not to the site's walking either.
    root.addEventListener('keydown', (e) => {
      if (e === this._kept) e.stopPropagation();
    });
    // The focus fallen from the card to nowhere (a control blurred by its own key, or gone): walking.
    root.addEventListener('focusout', (e) => {
      const from = /** @type {HTMLElement} */ (e.target);
      if (e.relatedTarget || from === view) return;
      queueMicrotask(() => {
        if (document.activeElement && document.activeElement !== document.body) return;
        this._last = from;
        this.walk();
      });
    });
    view.focus({ preventScroll: true });
  }

  /** Whether the focus is in the card, not on the view or nowhere. */
  get inCard() {
    const a = document.activeElement;
    return !!a && a !== this.view && a !== document.body && this.root.contains(a);
  }

  /**
   * Menu: into the card, or out of it.
   * @returns {true}
   */
  menu() {
    if (this.inCard) this.walk();
    else this.toCard();
    return true;
  }

  /**
   * Back: in the card, an open list closed (as its Escape would), else walking again; walking, the
   * site's step back.
   * @returns {boolean} false when none: the app goes back a page, or leaves
   */
  back() {
    if (!this.inCard) return this.step() === true;
    const a = /** @type {HTMLElement} */ (document.activeElement);
    if (keepsKey(a, 'Escape')) {
      send(a, 'Escape');
      if (this.inCard && !keepsKey(a, 'Escape')) return true;
    }
    this._last = a;
    this.walk();
    return true;
  }

  /** A gamepad's B or Back: as Back, else back a page if there is one (the page can't leave the app). */
  padBack() {
    if (this.back()) return;
    if (/** @type {any} */ (globalThis).navigation?.canGoBack) history.back();
  }

  /** The focus to the view: walking. */
  walk() {
    if (this.inCard) this._last = /** @type {HTMLElement} */ (document.activeElement);
    this.view.focus({ preventScroll: true });
    this.onMode(false);
  }

  /** The focus into the card: the control last left there, else its first. */
  toCard() {
    const stops = this._stops();
    const to = this._last && stops.includes(this._last) ? this._last : stops[0];
    to?.focus();
    if (this.inCard) this.onMode(true);
  }

  /**
   * Answers the app (README, "The TV app"): in TV mode, window.hallwayTV = { menu, back }, which the
   * app calls on each press of Menu and of Back, going back a page (or leaving) unless it returns true.
   * @param {boolean} [tv] tvMode()
   * @returns {boolean} whether it answers: in TV mode
   */
  answerApp(tv = tvMode()) {
    if (!tv) return false;
    /** @type {any} */ (globalThis).hallwayTV = { menu: () => this.menu(), back: () => this.back() };
    return true;
  }

  /**
   * The controls the focus stops at, as shown: one per choice.
   * @private
   * @returns {HTMLElement[]}
   */
  _stops() {
    const els = /** @type {HTMLInputElement[]} */ (Array.from(this.root.querySelectorAll(FOCUSABLE))).filter((e) => e !== this.view && !e.disabled && shown(e));
    return focusStops(els.map((e) => ({ radio: e.type === 'radio' ? e.name : '', checked: e.checked }))).map((i) => els[i]);
  }

  /**
   * @private
   * @param {KeyboardEvent} e
   */
  _key(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const key = keyName(e);
    if (!this.inCard) {
      // Walking: the arrows are the site's (which keep them from the WebView's spatial navigation).
      if (key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) this.use();
      }
      return;
    }
    const a = /** @type {HTMLInputElement} */ (document.activeElement);
    const select = a.tagName === 'SELECT' ? /** @type {HTMLSelectElement} */ (/** @type {Element} */ (a)) : null;
    const done = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (keepsKey(a, key)) {
      if (key === e.key) {
        this._kept = e; // the control's own: on to it, and no further (the root's listener)
        return;
      }
      // A spare key, which the control doesn't know: the arrow it stands for.
      done();
      if (a.type === 'range') {
        const was = a.value;
        if (key === 'ArrowLeft') a.stepDown();
        else a.stepUp();
        if (a.value !== was) {
          fire(a, 'input');
          fire(a, 'change');
        }
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const at = (a.selectionStart ?? 0) + (key === 'ArrowLeft' ? -1 : 1);
        a.setSelectionRange(at, at);
      } else {
        send(a, key); // an open combobox's own listener
      }
      return;
    }
    switch (key) {
      case 'Escape':
        done();
        this.walk();
        return;
      case 'ArrowUp':
      case 'ArrowDown': {
        done();
        const stops = /** @type {HTMLInputElement[]} */ (this._stops());
        const at = stops.findIndex((s) => s === a || (a.type === 'radio' && s.type === 'radio' && s.name === a.name));
        stops[nextStop(stops.length, at, key === 'ArrowUp' ? -1 : 1)]?.focus();
        return;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        done();
        const dir = key === 'ArrowLeft' ? -1 : 1;
        if (a.type === 'radio') {
          // Through the choice's options: each chosen as it is reached, as arrows do in a radio group.
          const group = /** @type {HTMLInputElement[]} */ (Array.from(this.root.querySelectorAll('input[type=radio]'))).filter((r) => r.name === a.name && !r.disabled);
          const to = group[nextStop(group.length, group.indexOf(a), dir)];
          if (to && to !== a) {
            to.focus();
            to.click();
          }
        } else if (select && !select.multiple) {
          // A select is a choice too: through its options, as the site's change listener expects.
          let i = select.selectedIndex + dir;
          while (i >= 0 && i < select.options.length && select.options[i].disabled) i += dir;
          if (i >= 0 && i < select.options.length) {
            select.selectedIndex = i;
            fire(select, 'input');
            fire(select, 'change');
          }
        }
        // Anywhere else the focus stays in the card.
        return;
      }
      case 'Enter':
        if (a.type === 'checkbox' || a.type === 'radio') {
          done();
          a.click();
        } else if (select) {
          done();
          try {
            select.showPicker();
          } catch {
            /* no picker here: left and right choose */
          }
        }
        return;
    }
  }
}
