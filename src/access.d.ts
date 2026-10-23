/**
 * Complete, valid settings from whatever was stored: unknown or missing values are the defaults',
 * value by value.
 * @param {unknown} value
 * @param {Readonly<Access>} [defaults]
 * @returns {Access}
 */
export function normalizeAccess(value: unknown, defaults?: Readonly<Access>): Access;
/**
 * The visitor's settings, as stored, else the defaults.
 * @param {Storage | null} [storage] localStorage when left out; null where there is none
 * @param {Readonly<Access>} [defaults]
 * @returns {Access}
 */
export function loadAccess(storage?: Storage | null, defaults?: Readonly<Access>): Access;
/**
 * Keeps the settings where every site on the origin reads them, complete and valid.
 * @param {Partial<Access>} access
 * @param {Storage | null} [storage] localStorage when left out
 * @returns {boolean} false when they could not be kept (storage blocked, as in a private window):
 *   they then last this visit
 */
export function saveAccess(access: Partial<Access>, storage?: Storage | null): boolean;
/**
 * The system's reduced-motion setting as a media query list, or null where there is none (Node,
 * a page without matchMedia). Get it once and pass it on: each call makes a new one.
 * @returns {MediaQueryList | null}
 */
export function motionQuery(): MediaQueryList | null;
/**
 * Whether to reduce motion: true for 'reduce', false for 'full', and for 'system' (or anything
 * else) whatever the system's setting says.
 * @param {Partial<Access> | null | undefined} access
 * @param {{ matches: boolean } | null} [query] motionQuery() (the default); null for none
 */
export function reduceMotion(access: Partial<Access> | null | undefined, query?: {
    matches: boolean;
} | null): boolean;
/**
 * Calls onChange(reduce) whenever the system's reduced-motion setting changes, with the new
 * setting, so a site can react without reloading: with motion 'system' it then calls
 * reduceMotion again. Returns a function that stops it.
 * @param {(reduce: boolean) => void} onChange
 * @param {MediaQueryList | null} [query] motionQuery() (the default)
 * @returns {() => void}
 */
export function watchMotion(onChange: (reduce: boolean) => void, query?: MediaQueryList | null): () => void;
/**
 * The metres to raise the rig in VR for these settings: SEATED_LIFT when seated, else 0. Sites add
 * it to the rig's height in VR only.
 * @param {Partial<Access> | null | undefined} access
 * @returns {number}
 */
export function eyeLift(access: Partial<Access> | null | undefined): number;
/** The Hallway's key in localStorage, not under any site's own prefix. */
export const ACCESS_KEY: "hallway.access";
/** @type {Readonly<Access>} */
export const ACCESS_DEFAULTS: Readonly<Access>;
/** The media query for the system's reduced-motion setting. */
export const REDUCED_MOTION: "(prefers-reduced-motion: reduce)";
/** How far to raise a seated visitor's eyes in VR, metres: from sitting to standing height. */
export const SEATED_LIFT: 0.45;
/** How the vignette closes and opens. */
export const VIGNETTE: Readonly<{
    /** m/s: at this speed or more it is fully closed (the sites walk at 1.8 at full stick in VR). */
    fullSpeed: 1.8;
    /** rad/s: at this turning rate or more it is fully closed (the sites' smooth turn at full stick). */
    fullTurn: 1.6;
    /** The clear view's half-angle from straight ahead, radians, as it starts to close... */
    open: number;
    /** ...and fully closed. */
    closed: number;
    /** How far its soft edge reaches past the clear view, radians, to black. */
    feather: number;
    /** Strength per second while closing in: fully closed in 0.15 s. */
    rise: number;
    /** Strength per second while opening: fully open in 0.4 s. */
    fall: number;
}>;
/**
 * The vignette's uniforms: uInner, the clear view's half-angle (radians), and uFeather, its soft
 * edge's width beyond it.
 * @typedef {object} VignetteUniforms
 * @property {{ value: number }} uInner
 * @property {{ value: number }} uFeather
 */
/** @typedef {THREE.ShaderMaterial & { uniforms: VignetteUniforms }} VignetteMaterial */
/**
 * A comfort vignette for VR: a ring round the view, on the camera, that closes in while the
 * visitor moves or turns smoothly and opens when they stop. Snap turns and teleports need none:
 * they blink (Fade). Drawn over everything but the fade, at infinity in both eyes.
 */
export class Vignette {
    /**
     * Puts the ring on the camera, open.
     * @param {THREE.Object3D} camera
     * @param {boolean} [enabled] the visitor's setting (access.vignette); true by default
     */
    constructor(camera: THREE.Object3D, enabled?: boolean);
    /** @type {VignetteMaterial} */
    material: VignetteMaterial;
    mesh: THREE.Mesh<THREE.SphereGeometry, VignetteMaterial, THREE.Object3DEventMap>;
    /** Whether the visitor wants it (access.vignette). Off, it stays open. */
    enabled: boolean;
    /** How closed it is now: 0 open (hidden), 1 fully closed. */
    strength: number;
    /**
     * Moves it on, every frame, from how the visitor is moving: it closes toward the larger of
     * speed / VIGNETTE.fullSpeed and turnRate / VIGNETTE.fullTurn. Allocates nothing. Outside VR,
     * or not enabled, it is open.
     * @param {number} dt seconds since the last frame
     * @param {number} speed the visitor's smooth movement, m/s (not the head's own motion)
     * @param {number} turnRate their smooth turning, rad/s, either way (0 for snap turns)
     * @param {boolean} xr whether the view is in VR (renderer.xr.isPresenting)
     */
    update(dt: number, speed: number, turnRate: number, xr: boolean): void;
    /**
     * Sets its strength at once, 0 to 1.
     * @param {number} strength
     */
    set(strength: number): void;
    /** @private */
    private _apply;
}
export type Access = {
    motion: "system" | "reduce" | "full";
    vignette: boolean;
    seated: boolean;
};
/**
 * The vignette's uniforms: uInner, the clear view's half-angle (radians), and uFeather, its soft
 * edge's width beyond it.
 */
export type VignetteUniforms = {
    uInner: {
        value: number;
    };
    uFeather: {
        value: number;
    };
};
export type VignetteMaterial = THREE.ShaderMaterial & {
    uniforms: VignetteUniforms;
};
import * as THREE from 'three';
