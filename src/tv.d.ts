/**
 * Whether to show the TV's page: in the TV app, or with ?tv=emulate in the address, in any browser.
 * @param {{ userAgent?: string, search?: string }} [o] navigator.userAgent and location.search by default
 */
export function tvMode({ userAgent, search }?: {
    userAgent?: string;
    search?: string;
}): boolean;
/**
 * A key event's name for a site's key map: its code ('KeyW', 'ArrowUp'), else its key, since the
 * remote's OK and keys sent with `adb shell input keyevent` come with an empty code ('Enter',
 * 'ArrowUp'); the spare keys (SPARE_KEYS) as the arrows.
 * @param {{ code?: string, key?: string }} e
 * @returns {string}
 */
export function keyOf(e: {
    code?: string;
    key?: string;
}): string;
/**
 * Whether the focused control uses this key itself, so the card leaves it to it: an open combobox
 * (role="combobox", aria-expanded="true") up, down and Escape; a range left and right; a text box's
 * caret left and right, until it is at that end.
 * @param {Element | null | undefined} el
 * @param {string} key
 */
export function keepsKey(el: Element | null | undefined, key: string): boolean;
/**
 * The card's stops among its controls, in order ([{ radio }]: a radio's group name, else ''): their
 * indices, a choice (a radio group) one stop, its checked option standing for it (else its first).
 * @param {Array<{ radio: string, checked?: boolean }>} items
 * @returns {number[]}
 */
export function focusStops(items: Array<{
    radio: string;
    checked?: boolean;
}>): number[];
/**
 * The stop `dir` (−1, +1) on from `at` (−1: none yet) among `n`, staying at the ends; −1 when there
 * are none.
 * @param {number} n
 * @param {number} at
 * @param {number} dir
 */
export function nextStop(n: number, at: number, dir: number): number;
export function isTV(userAgent: string | null | undefined): boolean;
/**
 * The remote's keys that reach the page with TalkBack on, read as the arrows (TalkBack keeps the
 * arrows): channel up and down, rewind and fast-forward. Play, pause, stop and next stay as they are.
 */
export const SPARE_KEYS: Readonly<{
    ChannelUp: "ArrowUp";
    ChannelDown: "ArrowDown";
    MediaRewind: "ArrowLeft";
    MediaFastForward: "ArrowRight";
}>;
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
    constructor({ root, view, use, step }: RemoteOptions);
    root: HTMLElement;
    view: HTMLElement;
    use: () => void;
    /** Back while walking: the site's own step back; true when it took one. */
    step: () => boolean;
    /** @type {(inCard: boolean) => void} when the focus goes into the card, or back to walking */
    onMode: (inCard: boolean) => void;
    /**
     * The control last left in the card, to come back to.
     * @private
     * @type {HTMLElement | null}
     */
    private _last;
    /**
     * The key event a control keeps: it goes to the control and no further.
     * @private
     * @type {Event | null}
     */
    private _kept;
    /** Whether the focus is in the card, not on the view or nowhere. */
    get inCard(): boolean;
    /**
     * Menu: into the card, or out of it.
     * @returns {true}
     */
    menu(): true;
    /**
     * Back: in the card, an open list closed (as its Escape would), else walking again; walking, the
     * site's step back.
     * @returns {boolean} false when none: the app goes back a page, or leaves
     */
    back(): boolean;
    /** A gamepad's B or Back: as Back, else back a page if there is one (the page can't leave the app). */
    padBack(): void;
    /** The focus to the view: walking. */
    walk(): void;
    /** The focus into the card: the control last left there, else its first. */
    toCard(): void;
    /**
     * Answers the app (README, "The TV app"): in TV mode, window.hallwayTV = { menu, back }, which the
     * app calls on each press of Menu and of Back, going back a page (or leaving) unless it returns true.
     * @param {boolean} [tv] tvMode()
     * @returns {boolean} whether it answers: in TV mode
     */
    answerApp(tv?: boolean): boolean;
    /**
     * The controls the focus stops at, as shown: one per choice.
     * @private
     * @returns {HTMLElement[]}
     */
    private _stops;
    /**
     * @private
     * @param {KeyboardEvent} e
     */
    private _key;
}
export type RemoteOptions = {
    /**
     * the page's card, around its controls (document.body when they are
     * spread over the page): everything the remote must reach
     */
    root: HTMLElement;
    /**
     * the 3D view's canvas, which holds the focus while walking
     */
    view: HTMLElement;
    /**
     * OK while walking: the middle of the view, as the gamepad's A
     */
    use: () => void;
    /**
     * Back while walking: the site's own step back (put a book back,
     * stand up, close a text view); true when it took one. One the page's history has an entry for
     * (BackHistory's book) is the app's back, not a step
     */
    step?: (() => boolean) | undefined;
};
