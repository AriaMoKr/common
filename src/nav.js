// How the visitor moves in VR, the Hallway's choice (README, "Moving in VR"): `move` smooth (the
// left stick walks the way they face) or teleport (it aims a jump), `turn` snap (the right stick
// turns 30° a push) or smooth. The Hallway's control panel keeps it in localStorage under the
// Hallway's own key, which every site on ariamokr.github.io can read and write: one choice for
// the Hallway and the environments behind its doors. Pure but for the storage, which can be
// passed in.

/** The Hallway's key in localStorage, not under any site's own prefix. */
export const NAV_KEY = 'hallway.nav';

/** @typedef {{ move: 'smooth' | 'teleport', turn: 'snap' | 'smooth' }} Nav */

const CHOICES = Object.freeze({
  move: /** @type {readonly Nav['move'][]} */ (Object.freeze(['smooth', 'teleport'])),
  turn: /** @type {readonly Nav['turn'][]} */ (Object.freeze(['snap', 'smooth'])),
});

/** @type {Readonly<Nav>} */
export const NAV_DEFAULTS = Object.freeze({ move: 'smooth', turn: 'snap' });

/**
 * @template T
 * @param {readonly T[]} choices
 * @param {unknown} v
 * @returns {v is T}
 */
const oneOf = (choices, v) => /** @type {readonly unknown[]} */ (choices).includes(v);

/**
 * localStorage, looked up only when asked for: in a browser that blocks storage, reading it throws.
 * @param {Storage | null | undefined} storage
 */
const storageOr = (storage) => (storage === undefined ? globalThis.localStorage : storage);

/**
 * A complete, valid choice from whatever was stored: unknown or missing values are the defaults',
 * value by value.
 * @param {unknown} value
 * @param {Readonly<Nav>} [defaults] NAV_DEFAULTS, or a site's own (vrlbry's older setting decides
 *   `move` until a choice is stored)
 * @returns {Nav}
 */
export function normalizeNav(value, defaults = NAV_DEFAULTS) {
  const out = { ...defaults };
  if (value && typeof value === 'object') {
    const v = /** @type {{ move?: unknown, turn?: unknown }} */ (value);
    if (oneOf(CHOICES.move, v.move)) out.move = v.move;
    if (oneOf(CHOICES.turn, v.turn)) out.turn = v.turn;
  }
  return out;
}

/**
 * The visitor's choice, as stored, else the defaults.
 * @param {Storage | null} [storage] localStorage when left out; null where there is none
 * @param {Readonly<Nav>} [defaults]
 * @returns {Nav}
 */
export function loadNav(storage, defaults = NAV_DEFAULTS) {
  try {
    return normalizeNav(JSON.parse(storageOr(storage)?.getItem(NAV_KEY) ?? 'null'), defaults);
  } catch {
    return { ...defaults };
  }
}

/**
 * Keeps the choice where the Hallway reads it, complete and valid.
 * @param {Partial<Nav>} nav
 * @param {Storage | null} [storage] localStorage when left out
 * @returns {boolean} false when it could not be kept (storage blocked, as in a private window): the
 *   choice then lasts this visit
 */
export function saveNav(nav, storage) {
  try {
    const s = storageOr(storage);
    if (!s) return false;
    s.setItem(NAV_KEY, JSON.stringify(normalizeNav(nav)));
    return true;
  } catch {
    return false;
  }
}
