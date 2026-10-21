/**
 * The Hallway, in front of an environment's door: the way back from there when its link gives none.
 * @param {string} id the environment's door id in the Hallway, e.g. 'vrlbry'
 */
export function hallwayUrl(id: string): string;
/**
 * What the door's link says about the visit (README, "Going in").
 * @param {string} search location.search
 * @returns {Visit}
 */
export function readVisit(search: string): Visit;
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
export function wayBack(search: string, id: string, { origin, always }?: {
    origin?: string | undefined;
    always?: boolean | undefined;
}): WayBack | null;
/**
 * A way back kept for the tab (sessionStorage, as JSON), checked; null when it isn't one.
 * @param {string | null} json
 * @returns {WayBack | null}
 */
export function keptWay(json: string | null): WayBack | null;
/**
 * The address without what a door added (VISIT_PARAMS): read once, so a reload, Back or a shared
 * link doesn't arrive again (README, "Going in"). The path, the other parameters (?debug, ?room=)
 * and the hash stay as written. For history.replaceState.
 * @param {string} href location.href
 */
export function withoutVisit(href: string): string;
/**
 * The address the way back opens: in the shared session `room`, or out of any (README, "Linking back").
 * @param {{ url: string }} way
 * @param {string | null} room
 */
export function leaveUrl(way: {
    url: string;
}, room: string | null): string;
/**
 * Where the Hallway publishes the view out of its door to this environment (README, "The view from
 * your door"): views.json's address and the door's id there (the way back's `from`, else `id`), or
 * null when the way back is not the Hallway.
 * @param {{ url: string, hallway: boolean }} way
 * @param {string} [id] this environment's door id, for a way back to the Hallway without `from`
 * @returns {{ views: string, id: string } | null}
 */
export function hallwayViews(way: {
    url: string;
    hallway: boolean;
}, id?: string): {
    views: string;
    id: string;
} | null;
/**
 * An entry of the Hallway's views.json, checked: sizes in sensible ranges, else null.
 * @param {unknown} entry
 * @returns {ViewParams | null}
 */
export function viewParams(entry: unknown): ViewParams | null;
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
export function doorLink(env: {
    id: string;
    url: string;
    color: string;
}, { here, hall, pose, xr, room }: {
    here: string;
    hall: {
        doorWidth: number;
        doorHeight: number;
    };
    pose?: DoorPose | null | undefined;
    xr?: boolean | undefined;
    room?: string | null | undefined;
}): string;
/** The Hallway's id in `from`. */
export const HALLWAY_ID: "hallway";
/** The Hallway. In front of an environment's door it is this with ?from=<the door's id> (hallwayUrl). */
export const HALLWAY_URL: "https://ariamokr.github.io/hallway/";
/**
 * What a door adds to the address, taken off once read (withoutVisit). `backname` comes from a
 * hall other than the Hallway. `room` stays: it names the shared session.
 */
export const VISIT_PARAMS: readonly string[];
/** What the Hallway's doors add to an environment's address, in this order (doorLink). A door's own address must not use them. */
export const LINK_PARAMS: readonly string[];
/**
 * How the visitor came through the door; each null when the link doesn't give it, or gives nonsense.
 */
export type Visit = {
    /**
     * who sent the visitor: 'hallway' from the Hallway's doors
     */
    from: string | null;
    /**
     * where they went through: metres from the doorway's middle, + to
     * their right as they face in (-1.2 to 1.2)
     */
    dx: number | null;
    /**
     * which way they faced: radians from straight in, + to the left
     * (±90°)
     */
    yaw: number | null;
    /**
     * how far up they looked: radians, + up (±89°); none in VR, where
     * the headset gives it
     */
    pitch: number | null;
    /**
     * the doorway's width, metres (0.7 to 2.4)
     */
    dw: number | null;
    /**
     * the doorway's height, metres (1.9 to 3.2)
     */
    dh: number | null;
    /**
     * the doorway's colour, '#rrggbb'
     */
    glow: string | null;
};
/**
 * Where the way back leads, and what it is called there.
 */
export type WayBack = {
    url: string;
    /**
     * on the button and the link: '← Hallway', or '← ' and the place's name,
     * shortened past 24 characters
     */
    label: string;
    /**
     * the tooltip: where it leads
     */
    title: string;
    /**
     * on the door back's plaque and sign: 'Hallway', or the place's name for
     * itself (`backname`), else its host
     */
    name: string;
    /**
     * where it leads: the url's host
     */
    host: string;
    /**
     * whether it is the Hallway (then its door back can show the Hallway's
     * view of the door here: hallwayViews)
     */
    hallway: boolean;
};
/**
 * How the Hallway's view of a door is hung behind an opening (its views.json; README, "The view
 * from your door"). Metres, but `horizon` (a fraction of the picture's height from its bottom) and
 * `aspect` (its width over its height).
 */
export type ViewParams = {
    /**
     * the picture's file name, beside views.json
     */
    image: string;
    /**
     * how far behind the opening the picture is
     */
    depth: number;
    pictureHeight: number;
    /**
     * the horizon's height above the sill
     */
    eye: number;
    horizon: number;
    aspect: number;
};
/**
 * How a visitor goes through a door, in the doorway's own terms (the Hallway's doorPose).
 */
export type DoorPose = {
    /**
     * metres from the doorway's centre, + to the right facing in
     */
    across: number;
    /**
     * radians from straight in, + turned left (as three.js's rotation.y)
     */
    yaw: number;
    /**
     * radians, + looking up
     */
    pitch: number;
};
