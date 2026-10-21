/**
 * A complete, valid choice from whatever was stored: unknown or missing values are the defaults',
 * value by value.
 * @param {unknown} value
 * @param {Readonly<Nav>} [defaults] NAV_DEFAULTS, or a site's own (vrlbry's older setting decides
 *   `move` until a choice is stored)
 * @returns {Nav}
 */
export function normalizeNav(value: unknown, defaults?: Readonly<Nav>): Nav;
/**
 * The visitor's choice, as stored, else the defaults.
 * @param {Storage | null} [storage] localStorage when left out; null where there is none
 * @param {Readonly<Nav>} [defaults]
 * @returns {Nav}
 */
export function loadNav(storage?: Storage | null, defaults?: Readonly<Nav>): Nav;
/**
 * Keeps the choice where the Hallway reads it, complete and valid.
 * @param {Partial<Nav>} nav
 * @param {Storage | null} [storage] localStorage when left out
 * @returns {boolean} false when it could not be kept (storage blocked, as in a private window): the
 *   choice then lasts this visit
 */
export function saveNav(nav: Partial<Nav>, storage?: Storage | null): boolean;
/** The Hallway's key in localStorage, not under any site's own prefix. */
export const NAV_KEY: "hallway.nav";
/** @type {Readonly<Nav>} */
export const NAV_DEFAULTS: Readonly<Nav>;
export type Nav = {
    move: "smooth" | "teleport";
    turn: "snap" | "smooth";
};
