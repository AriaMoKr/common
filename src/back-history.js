// The browser's Back for an open book: taking a book out adds a history entry at the same address,
// and so does each link followed in it. So the browser's Back (its button, a phone's back gesture, a
// mouse's back button, Quest Browser's) returns to the page a link was on, one link at a time, as a
// toolbar's ↩ Back does (through the same entries), and then puts the book away. A book put away
// otherwise (Put back, ✕, Esc, B) takes its entries back out, so that Back then leaves as it would
// have. Entries left by an earlier load of the page (before a reload) are passed over. Pure: given
// the page's history.
// vrlbry's public/js/back-history.js (and music's and outside's), its fields in an entry's state
// named from `prefix`: neutral by default, since each page has its own history.state.

/**
 * @typedef {object} BackHistoryOptions
 * @property {Pick<History, 'state' | 'pushState' | 'replaceState' | 'back' | 'go'>} history the page's
 * @property {string | number} load this load of the page (performance.timeOrigin): its entries' mark
 * @property {(depth: number) => boolean | Promise<boolean>} onBack go back to where the trail was
 *   `depth` links deep; false when there is no such place
 * @property {() => void} onAway Back past the book's own entry: the book is put away
 * @property {string} [prefix] the start of its fields' names in an entry's state ('back': backBook,
 *   backTrail, backLoad); 'vrlbry' or 'outside' keeps a site's own copy's
 */

export class BackHistory {
  /** @param {BackHistoryOptions} o */
  constructor({ history, load, onBack, onAway, prefix = 'back' }) {
    this.history = history;
    this.load = load;
    this.onBack = onBack;
    this.onAway = onAway;
    /**
     * Our fields in an entry's state, beside what was there (the address's).
     * @private
     */
    this._fields = { book: `${prefix}Book`, trail: `${prefix}Trail`, load: `${prefix}Load` };
    /** How deep in our entries the current one is: 0 the page, 1 a book out, 1 + n n links deep in it. */
    this.level = 0;
    /** @private */
    this._rewinding = false;
    /**
     * A book came out while its entries were being taken out.
     * @private
     */
    this._pendingBook = false;
    // Loaded again on an entry of ours (a reload while a book was out): it is the page itself now.
    const state = history.state;
    const fields = Object.values(this._fields);
    if (state && typeof state === 'object' && fields.some((k) => k in state)) {
      const rest = { ...state };
      for (const k of fields) delete rest[k];
      history.replaceState(Object.keys(rest).length ? rest : null, '');
    }
  }

  /** A book came out. Another book a link swaps in keeps the entries there are. */
  bookOut() {
    if (this._rewinding) this._pendingBook = true;
    else if (this.level === 0) this._push(0);
  }

  /**
   * A link was followed: the trail is now `depth` long.
   * @param {number} depth
   */
  pushed(depth) {
    this._push(depth);
  }

  /**
   * @private
   * @param {number} depth
   */
  _push(depth) {
    const f = this._fields;
    this.history.pushState({ ...(this.history.state || {}), [f.book]: 1, [f.trail]: depth, [f.load]: this.load }, '');
    this.level = 1 + depth;
  }

  /**
   * The toolbar's Back: through the browser's history, when a link's entry of ours is there.
   * @returns {boolean} false when not: the toolbar goes back itself
   */
  back() {
    if (this.level <= 1 || this._rewinding) return false;
    this.history.back();
    return true;
  }

  /** The book was put away, not by Back: its entries are taken back out. */
  cleared() {
    this._pendingBook = false;
    this._rewindTo(0);
  }

  /**
   * @private
   * @param {number} level
   */
  _rewindTo(level) {
    if (this.level <= level) return;
    this._rewinding = true;
    this.history.go(level - this.level);
    this.level = level;
  }

  /**
   * The window's popstate.
   * @param {any} state the event's state
   */
  popstate(state) {
    const f = this._fields;
    const ours = !!state?.[f.book];
    if (ours && state[f.load] !== this.load) {
      this.history.back(); // left by an earlier load of the page: on to the one before
      return;
    }
    const level = ours ? 1 + (state[f.trail] | 0) : 0;
    if (this._rewinding) {
      this._rewinding = false;
      this.level = level;
      if (this._pendingBook) {
        this._pendingBook = false;
        this.bookOut();
      }
      return;
    }
    const back = level < this.level;
    this.level = level;
    if (!back) return; // Forward: neither the book nor the links come back
    if (level === 0) {
      this.onAway();
      return;
    }
    Promise.resolve(this.onBack(level - 1)).then((ok) => {
      // Nowhere to go back to (the trail is gone): out of the links' entries, to the book's own.
      if (!ok && this.level === level) this._rewindTo(1);
    });
  }
}
