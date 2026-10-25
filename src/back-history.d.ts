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
    constructor({ history, load, onBack, onAway, prefix }: BackHistoryOptions);
    history: Pick<History, "state" | "pushState" | "replaceState" | "back" | "go">;
    load: string | number;
    onBack: (depth: number) => boolean | Promise<boolean>;
    onAway: () => void;
    /**
     * Our fields in an entry's state, beside what was there (the address's).
     * @private
     */
    private _fields;
    /** How deep in our entries the current one is: 0 the page, 1 a book out, 1 + n n links deep in it. */
    level: number;
    /** @private */
    private _rewinding;
    /**
     * A book came out while its entries were being taken out.
     * @private
     */
    private _pendingBook;
    /** A book came out. Another book a link swaps in keeps the entries there are. */
    bookOut(): void;
    /**
     * A link was followed: the trail is now `depth` long.
     * @param {number} depth
     */
    pushed(depth: number): void;
    /**
     * @private
     * @param {number} depth
     */
    private _push;
    /**
     * The toolbar's Back: through the browser's history, when a link's entry of ours is there.
     * @returns {boolean} false when not: the toolbar goes back itself
     */
    back(): boolean;
    /** The book was put away, not by Back: its entries are taken back out. */
    cleared(): void;
    /**
     * @private
     * @param {number} level
     */
    private _rewindTo;
    /**
     * The window's popstate.
     * @param {any} state the event's state
     */
    popstate(state: any): void;
}
export type BackHistoryOptions = {
    /**
     * the page's
     */
    history: Pick<History, "state" | "pushState" | "replaceState" | "back" | "go">;
    /**
     * this load of the page (performance.timeOrigin): its entries' mark
     */
    load: string | number;
    /**
     * go back to where the trail was
     * `depth` links deep; false when there is no such place
     */
    onBack: (depth: number) => boolean | Promise<boolean>;
    /**
     * Back past the book's own entry: the book is put away
     */
    onAway: () => void;
    /**
     * the start of its fields' names in an entry's state ('back': backBook,
     * backTrail, backLoad); 'vrlbry' or 'outside' keeps a site's own copy's
     */
    prefix?: string | undefined;
};
