// The Hallway's door contract (README). The Hallway (https://ariamokr.github.io/hallway/,
// github.com/AriaMoKr/hallway) is a WebXR corridor whose doors lead to other environments. A door
// opens its environment's address with the visit added (doorLink, the Hallway's side):
//   ?from=hallway&back=<the way back>&dx=…&yaw=…&pitch=…&dw=…&dh=…&glow=…[&room=…]
// The environment reads it once (readVisit, then withoutVisit), leads back by `back` (wayBack,
// leaveUrl), and can show the Hallway as seen from its door there (hallwayViews, viewParams).
// Another hall can link an environment the same way, naming itself with `backname`. Pure: each
// environment passes its own door id, and the page's origin where it matters.

/** The Hallway's id in `from`. */
export const HALLWAY_ID = 'hallway';

/** The Hallway. In front of an environment's door it is this with ?from=<the door's id> (hallwayUrl). */
export const HALLWAY_URL = 'https://ariamokr.github.io/hallway/';

/**
 * What a door adds to the address, taken off once read (withoutVisit). `backname` comes from a
 * hall other than the Hallway. `room` stays: it names the shared session.
 */
export const VISIT_PARAMS = Object.freeze(['from', 'back', 'backname', 'dx', 'yaw', 'pitch', 'dw', 'dh', 'glow']);

/** What the Hallway's doors add to an environment's address, in this order (doorLink). A door's own address must not use them. */
export const LINK_PARAMS = Object.freeze(['from', 'back', 'dx', 'yaw', 'pitch', 'dw', 'dh', 'glow', 'room']);

/**
 * How the visitor came through the door; each null when the link doesn't give it, or gives nonsense.
 * @typedef {object} Visit
 * @property {string | null} from who sent the visitor: 'hallway' from the Hallway's doors
 * @property {number | null} dx where they went through: metres from the doorway's middle, + to
 *   their right as they face in (-1.2 to 1.2)
 * @property {number | null} yaw which way they faced: radians from straight in, + to the left
 *   (±90°)
 * @property {number | null} pitch how far up they looked: radians, + up (±89°); none in VR, where
 *   the headset gives it
 * @property {number | null} dw the doorway's width, metres (0.7 to 2.4)
 * @property {number | null} dh the doorway's height, metres (1.9 to 3.2)
 * @property {string | null} glow the doorway's colour, '#rrggbb'
 */

/**
 * Where the way back leads, and what it is called there.
 * @typedef {object} WayBack
 * @property {string} url
 * @property {string} label on the button and the link: '← Hallway', or '← ' and the place's name,
 *   shortened past 24 characters
 * @property {string} title the tooltip: where it leads
 * @property {string} name on the door back's plaque and sign: 'Hallway', or the place's name for
 *   itself (`backname`), else its host
 * @property {string} host where it leads: the url's host
 * @property {boolean} hallway whether it is the Hallway (then its door back can show the Hallway's
 *   view of the door here: hallwayViews)
 */

/**
 * How the Hallway's view of a door is hung behind an opening (its views.json; README, "The view
 * from your door"). Metres, but `horizon` (a fraction of the picture's height from its bottom) and
 * `aspect` (its width over its height).
 * @typedef {object} ViewParams
 * @property {string} image the picture's file name, beside views.json
 * @property {number} depth how far behind the opening the picture is
 * @property {number} pictureHeight
 * @property {number} eye the horizon's height above the sill
 * @property {number} horizon
 * @property {number} aspect
 */

/**
 * How a visitor goes through a door, in the doorway's own terms (the Hallway's doorPose).
 * @typedef {object} DoorPose
 * @property {number} across metres from the doorway's centre, + to the right facing in
 * @property {number} yaw radians from straight in, + turned left (as three.js's rotation.y)
 * @property {number} pitch radians, + looking up
 */

const DEG = Math.PI / 180;
const IN_DEG = 180 / Math.PI;
const HALLWAY = new URL(HALLWAY_URL);
/** The longest name on the way back's button, in characters; a longer one ends in '…'. */
const NAME_MAX = 24;

/**
 * The Hallway, in front of an environment's door: the way back from there when its link gives none.
 * @param {string} id the environment's door id in the Hallway, e.g. 'vrlbry'
 */
export function hallwayUrl(id) {
  const u = new URL(HALLWAY_URL);
  if (id) u.searchParams.set('from', id);
  return u.href;
}

/**
 * A number parameter, kept between lo and hi, or null when it is missing or not a number.
 * @param {URLSearchParams} q
 * @param {string} key
 * @param {number} lo
 * @param {number} hi
 */
function number(q, key, lo, hi) {
  const s = q.get(key);
  if (s === null || s.trim() === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;
}

/**
 * What the door's link says about the visit (README, "Going in").
 * @param {string} search location.search
 * @returns {Visit}
 */
export function readVisit(search) {
  const q = new URLSearchParams(search);
  const yaw = number(q, 'yaw', -90, 90);
  const pitch = number(q, 'pitch', -89, 89);
  const glow = q.get('glow');
  return {
    from: q.get('from'),
    dx: number(q, 'dx', -1.2, 1.2),
    yaw: yaw === null ? null : yaw * DEG,
    pitch: pitch === null ? null : pitch * DEG,
    dw: number(q, 'dw', 0.7, 2.4),
    dh: number(q, 'dh', 1.9, 3.2),
    glow: glow && /^[0-9a-f]{6}$/i.test(glow) ? `#${glow.toLowerCase()}` : null,
  };
}

/**
 * An http(s) address, or null for anything else: javascript:, data:, relative or broken.
 * @param {unknown} s
 */
function webUrl(s) {
  if (typeof s !== 'string' || !s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

/**
 * Whether an address is the Hallway's own page: its origin and path, whatever its query.
 * @param {URL} url
 */
function isHallway(url) {
  return url.origin === HALLWAY.origin && (url.pathname === HALLWAY.pathname || url.pathname === `${HALLWAY.pathname}index.html`);
}

/**
 * Whether an origin is a development server on this machine (the Hallway's and an environment's, on their own ports).
 * @param {string} origin
 */
function local(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
  } catch {
    return false;
  }
}

/**
 * A place's name for itself, on one line, without control or direction-changing characters.
 * @param {string | null} s
 */
function cleanName(s) {
  return (s || '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .trim();
}

/** @param {string} name */
function shorten(name) {
  const chars = Array.from(name);
  return chars.length > NAME_MAX ? `${chars.slice(0, NAME_MAX - 1).join('').trimEnd()}…` : name;
}

/**
 * The way back to the Hallway, at url.
 * @param {string} url
 * @returns {WayBack}
 */
function toHallway(url) {
  return {
    url, label: '← Hallway', title: 'Back to the Hallway, whose doors lead to other places',
    name: 'Hallway', host: new URL(url).host, hallway: true,
  };
}

/**
 * Where the way back leads, from the address the environment was opened with (README, "Linking back").
 *
 * It leads to `back` when that is an http(s) address. That is the Hallway, kept as given (its
 * `from` and the session's `room`), when the link says `from=hallway` and `back` is the Hallway's
 * own page: its origin and path. While developing it is the Hallway too when `back` and this page
 * are both on this machine (two dev servers, on their own ports). Any other `back` is another
 * place, named by its `backname`, else its host, so a link cannot send visitors somewhere unsaid.
 *
 * Without a usable `back` it leads to the Hallway, in front of this environment's door
 * (hallwayUrl). With `always: false` there is then no way back (null), unless the link says
 * `from=hallway`.
 *
 * @param {string} search location.search
 * @param {string} id this environment's door id in the Hallway, e.g. 'vrlbry'
 * @param {object} [o]
 * @param {string} [o.origin] this page's origin (location.origin), for the dev servers' rule;
 *   without it only the Hallway's own page is the Hallway
 * @param {boolean} [o.always] false for an environment that can be visited without a door, and
 *   then has no way back; true by default
 * @returns {WayBack | null} null only with `always: false`
 */
export function wayBack(search, id, { origin, always = true } = {}) {
  const q = new URLSearchParams(search);
  const from = q.get('from');
  const url = webUrl(q.get('back'));
  if (!url) return always || from === HALLWAY_ID ? toHallway(hallwayUrl(id)) : null;
  if (from === HALLWAY_ID && (isHallway(url) || (origin && local(url.origin) && local(origin)))) {
    return toHallway(url.href);
  }
  const named = cleanName(q.get('backname'));
  const name = named || url.host;
  return {
    url: url.href, label: `← ${shorten(name)}`, title: named ? `Back to ${name} (${url.host})` : `Back to ${url.href}`,
    name, host: url.host, hallway: false,
  };
}

/**
 * A way back kept for the tab (sessionStorage, as JSON), checked; null when it isn't one.
 * @param {string | null} json
 * @returns {WayBack | null}
 */
export function keptWay(json) {
  /** @type {any} */
  let w;
  try {
    w = JSON.parse(json ?? 'null');
  } catch {
    return null;
  }
  if (!w || typeof w !== 'object' || !webUrl(w.url)) return null;
  for (const k of ['label', 'title', 'name', 'host']) if (typeof w[k] !== 'string' || !w[k]) return null;
  return { url: w.url, label: w.label, title: w.title, name: w.name, host: w.host, hallway: w.hallway === true };
}

/**
 * A parameter's name, as URLSearchParams reads it.
 * @param {string} p 'key=value' or 'key'
 */
function paramName(p) {
  const k = p.split('=')[0].replace(/\+/g, ' ');
  try {
    return decodeURIComponent(k);
  } catch {
    return k;
  }
}

/**
 * The address without what a door added (VISIT_PARAMS): read once, so a reload, Back or a shared
 * link doesn't arrive again (README, "Going in"). The path, the other parameters (?debug, ?room=)
 * and the hash stay as written. For history.replaceState.
 * @param {string} href location.href
 */
export function withoutVisit(href) {
  const u = new URL(href);
  // the other parameters as written (URLSearchParams would turn ?debug into ?debug=)
  const kept = u.search.slice(1).split('&').filter((p) => p && !VISIT_PARAMS.includes(paramName(p)));
  return u.pathname + (kept.length ? `?${kept.join('&')}` : '') + u.hash;
}

/**
 * The address the way back opens: in the shared session `room`, or out of any (README, "Linking back").
 * @param {{ url: string }} way
 * @param {string | null} room
 */
export function leaveUrl(way, room) {
  const u = new URL(way.url);
  if (room) u.searchParams.set('room', room);
  else u.searchParams.delete('room');
  return u.href;
}

/**
 * Where the Hallway publishes the view out of its door to this environment (README, "The view from
 * your door"): views.json's address and the door's id there (the way back's `from`, else `id`), or
 * null when the way back is not the Hallway.
 * @param {{ url: string, hallway: boolean }} way
 * @param {string} [id] this environment's door id, for a way back to the Hallway without `from`
 * @returns {{ views: string, id: string } | null}
 */
export function hallwayViews(way, id) {
  if (!way.hallway) return null;
  const u = new URL(way.url);
  const door = u.searchParams.get('from') || id;
  return door ? { views: new URL('views/views.json', u).href, id: door } : null;
}

/**
 * An entry of the Hallway's views.json, checked: sizes in sensible ranges, else null.
 * @param {unknown} entry
 * @returns {ViewParams | null}
 */
export function viewParams(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const e = /** @type {Record<string, unknown>} */ (entry);
  if (typeof e.image !== 'string' || !e.image) return null;
  /** @type {(v: unknown, lo: number, hi: number) => number | null} */
  const n = (v, lo, hi) => (typeof v === 'number' && v >= lo && v <= hi ? v : null);
  const depth = n(e.depth, 0.3, 30), pictureHeight = n(e.pictureHeight, 0.5, 40), eye = n(e.eye, 0, 3);
  const horizon = n(e.horizon, 0, 1), aspect = n(e.aspect ?? 2, 0.25, 8);
  if (depth === null || pictureHeight === null || eye === null || horizon === null || aspect === null) return null;
  return { image: e.image, depth, pictureHeight, eye, horizon, aspect };
}

/**
 * v with at most `digits` decimals, no trailing zeros and no minus on a zero.
 * @param {number} v
 * @param {number} digits
 */
const num = (v, digits) => String(+v.toFixed(digits));

/**
 * The address a door of the Hallway opens (README, "Going in"): its environment's url with the
 * visit added to the query (LINK_PARAMS, in that order).
 * @param {{ id: string, url: string, color: string }} env the door: an entry of the Hallway's
 *   environments.js
 * @param {object} o
 * @param {string} o.here the Hallway's address: the way back is it with ?from=<env.id>
 * @param {{ doorWidth: number, doorHeight: number }} o.hall the doorway's size, metres
 * @param {DoorPose | null} [o.pose] how the visitor went through; none from the doors list
 * @param {boolean} [o.xr] in VR the headset gives the pitch, so it is left out
 * @param {string | null} [o.room] the shared session the visitor is in: the environment's link and
 *   the way back both carry it, so the visitor stays in the session
 */
export function doorLink(env, { here, hall, pose = null, xr = false, room = null }) {
  const back = new URL(here);
  back.search = '';
  back.hash = '';
  back.searchParams.set('from', env.id);
  if (room) back.searchParams.set('room', room);
  const url = new URL(env.url);
  const q = url.searchParams;
  q.set('from', HALLWAY_ID);
  q.set('back', back.href);
  if (pose) {
    q.set('dx', num(pose.across, 2));
    q.set('yaw', num(pose.yaw * IN_DEG, 0));
    if (!xr) q.set('pitch', num(pose.pitch * IN_DEG, 0));
  }
  q.set('dw', num(hall.doorWidth, 2));
  q.set('dh', num(hall.doorHeight, 2));
  q.set('glow', env.color.replace(/^#/, '').toLowerCase());
  if (room) q.set('room', room);
  return url.href;
}
