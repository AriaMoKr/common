// Accessibility settings, shared by every site on the origin as `hallway.nav` is: kept in
// localStorage under the Hallway's key `hallway.access`, so a visitor's choice comes with them
// through the doors. Three of them:
//   motion    'system' (follow the system's reduced-motion setting), 'reduce' or 'full': with less
//             motion a site jumps instead of gliding, blinks instead of fading slowly, and stops its
//             ambient motion (reduceMotion, watchMotion);
//   vignette  a comfort vignette in VR, closing in while the visitor moves or turns smoothly
//             (Vignette); on by default;
//   seated    a seated visitor's eyes raised to standing height in VR (eyeLift).
// The settings are pure but for the storage, which can be passed in; Vignette is drawn with three.

import * as THREE from 'three';

/** The Hallway's key in localStorage, not under any site's own prefix. */
export const ACCESS_KEY = 'hallway.access';

/** @typedef {{ motion: 'system' | 'reduce' | 'full', vignette: boolean, seated: boolean }} Access */

const MOTIONS = /** @type {readonly Access['motion'][]} */ (Object.freeze(['system', 'reduce', 'full']));

/** @type {Readonly<Access>} */
export const ACCESS_DEFAULTS = Object.freeze({ motion: 'system', vignette: true, seated: false });

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
 * Complete, valid settings from whatever was stored: unknown or missing values are the defaults',
 * value by value.
 * @param {unknown} value
 * @param {Readonly<Access>} [defaults]
 * @returns {Access}
 */
export function normalizeAccess(value, defaults = ACCESS_DEFAULTS) {
  const out = { ...defaults };
  if (value && typeof value === 'object') {
    const v = /** @type {{ motion?: unknown, vignette?: unknown, seated?: unknown }} */ (value);
    if (oneOf(MOTIONS, v.motion)) out.motion = v.motion;
    if (typeof v.vignette === 'boolean') out.vignette = v.vignette;
    if (typeof v.seated === 'boolean') out.seated = v.seated;
  }
  return out;
}

/**
 * The visitor's settings, as stored, else the defaults.
 * @param {Storage | null} [storage] localStorage when left out; null where there is none
 * @param {Readonly<Access>} [defaults]
 * @returns {Access}
 */
export function loadAccess(storage, defaults = ACCESS_DEFAULTS) {
  try {
    return normalizeAccess(JSON.parse(storageOr(storage)?.getItem(ACCESS_KEY) ?? 'null'), defaults);
  } catch {
    return { ...defaults };
  }
}

/**
 * Keeps the settings where every site on the origin reads them, complete and valid.
 * @param {Partial<Access>} access
 * @param {Storage | null} [storage] localStorage when left out
 * @returns {boolean} false when they could not be kept (storage blocked, as in a private window):
 *   they then last this visit
 */
export function saveAccess(access, storage) {
  try {
    const s = storageOr(storage);
    if (!s) return false;
    s.setItem(ACCESS_KEY, JSON.stringify(normalizeAccess(access)));
    return true;
  } catch {
    return false;
  }
}

/** The media query for the system's reduced-motion setting. */
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * The system's reduced-motion setting as a media query list, or null where there is none (Node,
 * a page without matchMedia). Get it once and pass it on: each call makes a new one.
 * @returns {MediaQueryList | null}
 */
export function motionQuery() {
  try {
    return globalThis.matchMedia?.(REDUCED_MOTION) ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether to reduce motion: true for 'reduce', false for 'full', and for 'system' (or anything
 * else) whatever the system's setting says.
 * @param {Partial<Access> | null | undefined} access
 * @param {{ matches: boolean } | null} [query] motionQuery() (the default); null for none
 */
export function reduceMotion(access, query = motionQuery()) {
  const motion = access?.motion;
  if (motion === 'reduce') return true;
  if (motion === 'full') return false;
  return query?.matches === true;
}

/**
 * Calls onChange(reduce) whenever the system's reduced-motion setting changes, with the new
 * setting, so a site can react without reloading: with motion 'system' it then calls
 * reduceMotion again. Returns a function that stops it.
 * @param {(reduce: boolean) => void} onChange
 * @param {MediaQueryList | null} [query] motionQuery() (the default)
 * @returns {() => void}
 */
export function watchMotion(onChange, query = motionQuery()) {
  if (!query) return () => {};
  /** @param {{ matches: boolean }} e */
  const listener = (e) => onChange(e.matches === true);
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }
  // Safari before 14.
  query.addListener(listener);
  return () => query.removeListener(listener);
}

/** How far to raise a seated visitor's eyes in VR, metres: from sitting to standing height. */
export const SEATED_LIFT = 0.45;

/**
 * The metres to raise the rig in VR for these settings: SEATED_LIFT when seated, else 0. Sites add
 * it to the rig's height in VR only.
 * @param {Partial<Access> | null | undefined} access
 * @returns {number}
 */
export function eyeLift(access) {
  return access?.seated === true ? SEATED_LIFT : 0;
}

const DEG = Math.PI / 180;

/** How the vignette closes and opens. */
export const VIGNETTE = Object.freeze({
  /** m/s: at this speed or more it is fully closed (the sites walk at 1.8 at full stick in VR). */
  fullSpeed: 1.8,
  /** rad/s: at this turning rate or more it is fully closed (the sites' smooth turn at full stick). */
  fullTurn: 1.6,
  /** The clear view's half-angle from straight ahead, radians, as it starts to close... */
  open: 60 * DEG,
  /** ...and fully closed. */
  closed: 30 * DEG,
  /** How far its soft edge reaches past the clear view, radians, to black. */
  feather: 15 * DEG,
  /** Strength per second while closing in: fully closed in 0.15 s. */
  rise: 1 / 0.15,
  /** Strength per second while opening: fully open in 0.4 s. */
  fall: 1 / 0.4,
});

const vertexShader = /* glsl */ `
varying vec3 vWorld;
varying vec3 vAhead;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  // The head's straight ahead: the sphere rides on the camera, facing -z.
  vAhead = -modelMatrix[2].xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// The angle is measured from each eye (cameraPosition is the eye being drawn), so the ring is at
// infinity in both eyes rather than on the small sphere: no near object at the edge of the view.
const fragmentShader = /* glsl */ `
uniform float uInner;    // the clear view's half-angle, radians
uniform float uFeather;  // the soft edge's width beyond it, radians
varying vec3 vWorld;
varying vec3 vAhead;
void main() {
  float a = acos(clamp(dot(normalize(vWorld - cameraPosition), normalize(vAhead)), -1.0, 1.0));
  gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(uInner, uInner + uFeather, a));
}
`;

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
  constructor(camera, enabled = true) {
    /** @type {VignetteMaterial} */
    this.material = /** @type {VignetteMaterial} */ (new THREE.ShaderMaterial({
      uniforms: { uInner: { value: VIGNETTE.open }, uFeather: { value: VIGNETTE.feather } },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }));
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), this.material);
    this.mesh.renderOrder = 1e6 - 1; // under the fade's
    this.mesh.frustumCulled = false;
    this.mesh.name = 'vignette';
    camera.add(this.mesh);
    /** Whether the visitor wants it (access.vignette). Off, it stays open. */
    this.enabled = enabled;
    /** How closed it is now: 0 open (hidden), 1 fully closed. */
    this.strength = 0;
    this._apply();
  }

  /**
   * Moves it on, every frame, from how the visitor is moving: it closes toward the larger of
   * speed / VIGNETTE.fullSpeed and turnRate / VIGNETTE.fullTurn. Allocates nothing. Outside VR,
   * or not enabled, it is open.
   * @param {number} dt seconds since the last frame
   * @param {number} speed the visitor's smooth movement, m/s (not the head's own motion)
   * @param {number} turnRate their smooth turning, rad/s, either way (0 for snap turns)
   * @param {boolean} xr whether the view is in VR (renderer.xr.isPresenting)
   */
  update(dt, speed, turnRate, xr) {
    let target = 0;
    if (this.enabled && xr) {
      target = Math.min(1, Math.max(Math.abs(speed) / VIGNETTE.fullSpeed || 0, Math.abs(turnRate) / VIGNETTE.fullTurn || 0));
    } else if (this.strength !== 0) {
      this.strength = 0;
      this._apply();
      return;
    }
    if (target === this.strength) return;
    const step = (target > this.strength ? VIGNETTE.rise : VIGNETTE.fall) * Math.max(0, dt);
    this.strength = Math.abs(target - this.strength) <= step ? target : this.strength + Math.sign(target - this.strength) * step;
    this._apply();
  }

  /**
   * Sets its strength at once, 0 to 1.
   * @param {number} strength
   */
  set(strength) {
    this.strength = Math.min(1, Math.max(0, strength || 0));
    this._apply();
  }

  /** @private */
  _apply() {
    this.material.uniforms.uInner.value = VIGNETTE.open + (VIGNETTE.closed - VIGNETTE.open) * this.strength;
    this.mesh.visible = this.strength > 0.001;
  }
}
