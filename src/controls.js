// Walking about a site behind one of the Hallway's doors, on every device, for each site's own
// Controls to extend:
//   desktop: drag to look, WASD / arrows to walk (Shift runs), click what to use or where to go
//   phone:   drag to look (a finger drags the scene), tap what to use or where to go
//   gamepad: as in vrlbry, it takes over when used and the mouse takes it back: the left stick
//            walks, the right one looks, A uses what the middle of the view is on, B is the
//            site's (gamepad.js)
//   TV:      the remote's arrows walk and turn (tv.js's keyOf), and OK uses the middle of the view
//            (the site gives its Remote useMiddle, and sets aimMiddle)
//   headset: point and pull the trigger (or pinch) at what to use or where to go; the left stick
//            walks (move 'smooth') or aims a teleport (move 'teleport'), the right one turns in
//            steps (turn 'snap') or smoothly (turn 'smooth'); or walk through the doorway
// The template's public/js/controls.js (AriaMoKr/RoomTemplateEmpty at f3e1c91), call for call, with
// what is general in outside's (AriaMoKr/outside at 93b6eda): ground that rises and falls, a route
// there, the pitch the view rests at, the keys a page has used, and the places where a site's own
// comes first (outside's book). What is the site's (what a ray meets, where one may walk, what can
// be used and what that does, its doorway) are methods its subclass overrides, and common's
// constructor calls none of them, since a subclass's own fields are set only after super(). The
// visitor's body is `rig` (yaw only); the camera is its head (pitch on a screen, the headset's pose
// in VR). Per frame nothing is allocated.
import * as THREE from 'three';
import { firstPad, readPad } from './gamepad.js';
import { keyOf } from './tv.js';

const LOOK = 0.0045; // radians per pixel dragged
const WALK = 1.9, RUN = 3.8, XR_WALK = 1.8; // metres per second
const TURN = 1.9; // radians per second (arrow keys)
const SNAP = Math.PI / 6;
const SMOOTH_TURN = 1.6; // radians per second at full stick
const PITCH = 1.35;
const PAD_TURN = 2.4, PAD_PITCH = 1.6; // radians per second, a gamepad's right stick at full tilt (vrlbry's)
const EYE = 1.6; // metres, on a screen

/** @typedef {'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight' | 'run'} KeyAction */

/**
 * What a key does, by its name (tv.js's keyOf: its code, else its key; a TV's spare keys as the
 * arrows).
 * @type {Readonly<Record<string, KeyAction>>}
 */
export const KEYS = Object.freeze({
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', KeyD: 'right',
  ArrowLeft: 'turnLeft', KeyQ: 'turnLeft',
  ArrowRight: 'turnRight', KeyE: 'turnRight',
  ShiftLeft: 'run', ShiftRight: 'run',
});

/**
 * What a ray meets (castRay), as far as common reads it. A site's castRay writes its own fields
 * too (the template's u, v and piece, the hallway's door), into a hit of its own shape (the `hit`
 * option).
 * @typedef {object} Hit
 * @property {number} t how far along the ray
 * @property {string} kind what it met: 'door' is the doorway (use: onDoor) and a 'ceiling' shows no
 *   reticle; the rest are the site's
 * @property {number} x where
 * @property {number} y
 * @property {number} z
 * @property {number} nx the surface's normal, towards where the ray came from; any length
 * @property {number} ny
 * @property {number} nz
 * @property {boolean} walkable ground to walk or teleport to, whatever its kind
 */

/** @typedef {'screen' | 'xr'} How a click, a tap, A or OK ('screen'), or a controller in VR ('xr') */

/**
 * A hand in VR: its controller, the laser and its tip, the reticle where it points, and what it
 * points at.
 * @template {Hit} [H=Hit]
 * @typedef {object} Hand
 * @property {THREE.XRTargetRaySpace} controller in the rig
 * @property {THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>} laser
 * @property {THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>} tip
 * @property {THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>} reticle in the scene
 * @property {XRInputSource | null} source
 * @property {H} hit castRay's, written each frame
 * @property {H | null} last what it points at now
 * @property {boolean} aiming a teleport (move 'teleport')
 */

/**
 * A walk under way (_startWalk).
 * @typedef {object} Walk
 * @property {[number, number][]} points
 * @property {number} i the point it goes to now
 * @property {number | null} face the yaw it turns to on the way, or null
 * @property {number} speed metres per second
 * @property {boolean} turn it looks where it goes, facing only on its last leg (by default, along
 *   more than one point)
 * @property {(() => void) | null} done once there (and turned)
 */

/**
 * A gamepad's A and B pressed this frame (takePad): a site that takes one clears it.
 * @typedef {{ use: boolean, back: boolean }} PadPress
 */

/**
 * A press on the view: a mouse button or a finger, from where it went down.
 * @typedef {{ id: number, x: number, y: number, lx: number, ly: number, touch: boolean, moved: boolean, t: number, yaw: number, pitch: number }} Down
 */

/**
 * @template {Hit} [H=Hit]
 * @typedef {object} ControlsOptions
 * @property {{ xr: THREE.WebXRManager }} renderer the site's WebGLRenderer
 * @property {THREE.Camera} camera the head, in the rig
 * @property {THREE.Object3D} rig the body: yaw only
 * @property {THREE.Object3D} scene where the reticles go
 * @property {HTMLElement} dom the view (the renderer's canvas): drags, clicks and taps, and the cursor
 * @property {number} [eye] the eye's height on a screen, in metres: 1.6
 * @property {() => H} [hit] a hit of the site's own shape, for its castRay to write into (one for
 *   the screen, one per hand): common's Hit by default
 * @property {Pick<Window, 'addEventListener'>} [window] where the keys, a blur and the gamepads come
 *   from: the page's
 * @property {() => ArrayLike<Gamepad | null> | null | undefined} [getGamepads] navigator.getGamepads
 */

const wrapAngle = (/** @type {number} */ a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => (v < lo ? lo : v > hi ? hi : v);

/** @returns {Hit} */
const blankHit = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, walkable: false });

/**
 * Walking about a site: a screen, a gamepad, a TV's remote, and VR. A site extends it with its own:
 * castRay, clampWalk, usable, use and walkInto, and where it has them groundAt, route, stand, the
 * hover it shows (_setHover) and the places where its own comes first (takeKey, takePad, …).
 * @template {Hit} [H=Hit]
 */
export class Controls {
  /** @param {ControlsOptions<H>} options */
  constructor({ renderer, camera, rig, scene, dom, eye = EYE, hit = /** @type {() => H} */ (blankHit), window: win = globalThis.window, getGamepads = () => globalThis.navigator?.getGamepads?.() }) {
    this.renderer = renderer;
    this.camera = camera;
    this.rig = rig;
    this.scene = scene;
    this.dom = dom;
    /** The eye's height on a screen: the camera's in the rig. */
    this.eye = eye;
    this.yaw = 0;
    this.pitch = 0;
    /** What the keys held do (KEYS). @type {Set<string>} */
    this.keys = new Set();
    /** What is pointed at that could be used (usable): 'door', or the site's. @type {string | null} */
    this.hover = null;
    this.hoverDoor = false;
    /** VR navigation (nav.js, under hallway.nav). @type {'smooth' | 'teleport'} */
    this.move = 'smooth';
    /** @type {'snap' | 'smooth'} */
    this.turn = 'snap';
    /** Less motion (access.js reduceMotion): a walk jumps to its end. */
    this.reduceMotion = false;
    /** In VR, how far the rig stands above the ground: access.js eyeLift, for seated mode (setEyeLift). */
    this.eyeLift = 0;
    /** The sticks' smooth movement (m/s) and turning (rad/s) this frame in VR, for the vignette; 0 for snaps and teleports. */
    this.moveSpeed = 0;
    this.turnRate = 0;
    /**
     * The pitch the view comes back to, after setPose or a walk that faces somewhere: level, unless
     * a site sets it (a TV's a little down in outside, as its remote can't look up or down). A walk
     * facing nowhere leaves the view as it was, unless it looked where it went: then it ends a
     * little down (towards -0.1, or this if lower).
     */
    this.restPitch = 0;
    /** (how, hit) when the doorway is chosen (use). @type {(how: How, hit: H) => void} */
    this.onDoor = () => {};
    /** (hand) when a controller's grip is squeezed in VR (a wave in the shared session). @type {(hand: Hand<H>) => void} */
    this.onSqueeze = () => {};
    /** (move) for a teleport: the site blinks the view around move(), which puts the visitor there. @type {(move: () => void) => void} */
    this.onTeleport = (move) => move();
    /** The first time the visitor does anything (hides the hint). @type {() => void} */
    this.onActivity = () => {};
    /** A gamepad was used last: the middle of the view is what it points at (the site shows a dot there). */
    this.padActive = false;
    /** (on) when the gamepad takes over or hands back. @type {(on: boolean) => void} */
    this.onPadActive = () => {};
    /** When its B or Back is pressed (the site leaves fullscreen). @type {() => void} */
    this.onPadBack = () => {};
    /** @protected */
    this._pad = readPad({ axes: [], buttons: [] });
    /** @protected */
    this._padUse = false;
    /** @protected */
    this._padBack = false;
    /** @protected @type {PadPress} */
    this._padPress = { use: false, back: false };
    /** @protected */
    this._pads = 0; // connected; none, and nothing is polled
    /** Whether a gamepad is connected. */
    this.hasPad = false;
    /** The middle of the view is the pointer whatever is used (a TV, whose remote has none: tv.js). */
    this.aimMiddle = false;
    /** A walk under way, or null. @type {Walk | null} */
    this.auto = null;
    /** The mouse over the view, in client pixels, or null. @type {{ x: number, y: number } | null} */
    this.pointer = null;
    /** @protected */
    this._pointerAt = { x: 0, y: 0 };
    /** @protected @type {Down | null} */
    this._down = null;
    /** @protected @type {Map<number, [number, number]>} fingers down: pointerId → where */
    this._touches = new Map();
    /** @protected */
    this._pinch = 0; // two fingers' distance apart, while they pinch
    /** @protected */
    this._cursor = '';
    /** @protected */
    this._raycaster = new THREE.Raycaster();
    /** @protected */
    this._ndc = new THREE.Vector2();
    /** @protected @type {H} */
    this._hit = hit();
    /** @protected */
    this._head = new THREE.Vector3();
    /** @protected */
    this._dir = new THREE.Vector3();
    /** @protected */
    this._origin = new THREE.Vector3();
    /** @protected */
    this._normal = new THREE.Vector3();
    /** @protected */
    this._clamped = { x: 0, z: 0 };
    /** @protected */
    this._snapArmed = true;
    /** @protected */
    this._recenter = 0; // frames until VR lines the headset up with the pose it entered at
    /** @protected */
    this._entry = { x: 0, z: 0, yaw: 0 };
    /** @protected */
    this._window = win;
    /** @protected */
    this._getGamepads = getGamepads;
    /** The two hands in VR. @type {Hand<H>[]} */
    this.hands = [];
    camera.position.set(0, eye, 0);
    camera.rotation.order = 'YXZ';
    this._bindDom();
    this._setupXR(hit);
  }

  /**
   * Puts the visitor at (x, z) on the ground, facing yaw, looking up by pitch (restPitch).
   * @param {number} x
   * @param {number} z
   * @param {number} yaw
   * @param {number} [pitch]
   */
  setPose(x, z, yaw, pitch = this.restPitch) {
    this.rig.position.set(x, this.groundAt(x, z) + (this.renderer.xr.isPresenting ? this._riseXR() : 0), z);
    this.yaw = yaw;
    this.pitch = clamp(pitch, -PITCH, PITCH);
    this.auto = null;
    this._apply();
  }

  /**
   * Sets how to move and turn in VR (nav.js).
   * @param {{ move: 'smooth' | 'teleport', turn: 'snap' | 'smooth' }} nav
   */
  setNav({ move, turn }) {
    this.move = move;
    this.turn = turn;
    for (const h of this.hands) h.aiming = false;
  }

  /**
   * Raises the rig this far above the ground in VR (access.js eyeLift: 0.45 m in seated mode, else
   * 0), at once; on a screen the eye height stays.
   * @param {number} lift
   */
  setEyeLift(lift) {
    this.eyeLift = lift;
    if (!this.renderer.xr.isPresenting) return;
    this.camera.getWorldPosition(this._head);
    this.rig.position.y = this.groundAt(this._head.x, this._head.z) + this._riseXR();
  }

  /**
   * Walks to (x, z) along the site's route there, then turns to `face` (a yaw) if given and calls
   * `then`; with less motion, there at once. Gets up first (stand). Only on a screen: in VR, where
   * update walks nowhere, a site teleports instead (_teleport), as use does.
   * @param {number} x
   * @param {number} z
   * @param {{ face?: number | null, then?: (() => void) | null }} [options]
   */
  walkTo(x, z, { face = null, then = null } = {}) {
    this.stand();
    const p = this.rig.position;
    const points = this.route(p.x, p.z, x, z);
    if (!points.length) return;
    this._startWalk(points, face, then);
  }

  /**
   * Starts a walk along points, turning to `face` on the way and calling `done` once there and
   * turned. With `turn` (by default, when it goes along more than one point) it looks where it goes
   * and turns to `face` on its last leg; without, it turns to `face` from its first step, as a walk
   * whose view is handed on before it ends must (through a door). With less motion it jumps to the
   * end. A wall ends it, and so does walking or looking. Only on a screen, as walkTo.
   * @protected
   * @param {[number, number][]} points
   * @param {number | null} face
   * @param {(() => void) | null} [done]
   * @param {boolean} [turn]
   */
  _startWalk(points, face, done = null, turn = points.length > 1) {
    if (this.reduceMotion) {
      // Straight to the end (where the site lets one be there, not on the way: outside's route
      // crosses the water by its bridge), facing `face` if given.
      this.auto = null;
      const end = points[points.length - 1];
      if (end) {
        const c = this.clampWalk(end[0], end[1], end[0], end[1], this._clamped);
        this.rig.position.x = c.x;
        this.rig.position.z = c.z;
        this._standOnGround(0, c.x, c.z, 0);
      }
      if (face !== null) {
        this.yaw = face;
        this.pitch = this.restPitch;
      }
      this._apply();
      done?.();
      return;
    }
    let length = 0, x = this.rig.position.x, z = this.rig.position.z;
    for (const [px, pz] of points) {
      length += Math.hypot(px - x, pz - z);
      x = px;
      z = pz;
    }
    // Long walks go faster, so none takes much more than a second and a half.
    this.auto = { points, i: 0, face, speed: clamp(length / 1.5, 2.2, 7), turn, done };
  }

  /** @param {number} dt seconds since the last frame */
  update(dt) {
    this.moveSpeed = 0;
    this.turnRate = 0;
    if (this.renderer.xr.isPresenting) {
      this._updateXR(dt);
      return;
    }
    if (this.auto) this._updateWalk(dt);
    else this._updateKeys(dt);
    if (this._pads) this._updatePad(dt);
    this._standOnGround(dt, this.rig.position.x, this.rig.position.z, 0);
    this._apply();
    this._updateHover();
  }

  /**
   * Keeps the rig on the ground under (x, z), `lift` above it: at once when dt is 0, else easing
   * there, so a step up or down is no jolt.
   * @protected
   * @param {number} dt
   * @param {number} x
   * @param {number} z
   * @param {number} lift
   */
  _standOnGround(dt, x, z, lift) {
    const target = this.groundAt(x, z) + lift;
    const p = this.rig.position;
    const k = dt > 0 ? 1 - Math.exp(-dt * 18) : 1;
    p.y += (target - p.y) * k;
  }

  /** @protected */
  _apply() {
    this.rig.rotation.y = this.yaw;
    if (!this.renderer.xr.isPresenting) this.camera.rotation.set(this.pitch, 0, 0);
  }

  /**
   * Moves the rig towards (x, z), as far as the site lets it (clampWalk).
   * @protected
   * @param {number} x
   * @param {number} z
   * @returns {{ x: number, z: number }} where it is now
   */
  _move(x, z) {
    const p = this.rig.position;
    const c = this.clampWalk(p.x, p.z, x, z, this._clamped);
    p.x = c.x;
    p.z = c.z;
    return c;
  }

  /**
   * @protected
   * @param {number} dt
   */
  _updateKeys(dt) {
    const k = this.keys;
    if (!k.size) return;
    this.yaw += ((k.has('turnLeft') ? 1 : 0) - (k.has('turnRight') ? 1 : 0)) * TURN * dt;
    const f = (k.has('forward') ? 1 : 0) - (k.has('back') ? 1 : 0);
    const s = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    if (!f && !s) return;
    this.stand();
    const step = ((k.has('run') ? RUN : WALK) * dt) / Math.hypot(f, s);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // Forward is (-sin, -cos); right is (cos, -sin).
    const p = this.rig.position;
    this._move(p.x + (-sin * f + cos * s) * step, p.z + (-cos * f - sin * s) * step);
  }

  /**
   * The gamepad takes over the view's middle as the pointer when used; the mouse takes it back.
   * @protected
   * @param {boolean} on
   */
  _setPadActive(on) {
    if (this.padActive === on) return;
    this.padActive = on;
    this.onPadActive(on);
  }

  /**
   * The first connected gamepad: walking and looking like a first-person game, A to use, B the
   * site's; its own buttons first (takePad).
   * @protected
   * @param {number} dt
   */
  _updatePad(dt) {
    const pad = firstPad(this._getGamepads());
    if (!pad) {
      this._setPadActive(false);
      return;
    }
    const s = readPad(pad, this._pad);
    const moving = s.moveX !== 0 || s.moveY !== 0, looking = s.lookX !== 0 || s.lookY !== 0;
    // Buttons act once per press.
    const use = s.use && !this._padUse, back = s.back && !this._padBack;
    this._padUse = s.use;
    this._padBack = s.back;
    const press = this._padPress;
    press.use = use;
    press.back = back;
    const own = this.takePad(pad, dt, press);
    if (moving || looking || own || use || back) {
      this._setPadActive(true);
      this.onActivity();
    }
    if (!this.padActive) return;
    if (moving || looking) this.auto = null;
    if (looking) {
      this.yaw -= s.lookX * PAD_TURN * dt;
      this.pitch = clamp(this.pitch - s.lookY * PAD_PITCH * dt, -PITCH, PITCH);
    }
    if (moving) {
      this.stand();
      const step = (s.run ? RUN : WALK) * dt;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const f = -s.moveY, r = s.moveX;
      const p = this.rig.position;
      this._move(p.x + (-sin * f + cos * r) * step, p.z + (-cos * f - sin * r) * step);
    }
    if (press.use) this.useMiddle();
    if (press.back) this.onPadBack();
  }

  /** A on a gamepad, or OK on a TV's remote: what the middle of the view is on, as a click there would. */
  useMiddle() {
    this.camera.updateWorldMatrix(true, false);
    this.use(this._pickNdc(0, 0), 'screen');
  }

  /**
   * @protected
   * @param {number} dt
   */
  _updateWalk(dt) {
    const a = /** @type {Walk} */ (this.auto);
    const p = this.rig.position;
    const there = a.i >= a.points.length;
    let tx = 0, tz = 0, dist = 0;
    if (!there) {
      const point = a.points[a.i];
      tx = point[0];
      tz = point[1];
      dist = Math.hypot(tx - p.x, tz - p.z);
    }
    const turn = 1 - Math.exp(-dt * 6);
    if (a.face !== null && (!a.turn || a.i >= a.points.length - 1)) {
      // Turn to face the doorway, or what it walks up to, on the way.
      this.yaw += wrapAngle(a.face - this.yaw) * turn;
      this.pitch += (this.restPitch - this.pitch) * turn;
    } else if (a.turn && dist > 0.3) {
      // A walk that turns corners looks where it is going.
      this.yaw += wrapAngle(Math.atan2(p.x - tx, p.z - tz) - this.yaw) * turn;
      this.pitch += (Math.min(-0.1, this.restPitch) - this.pitch) * turn;
    }
    if (there) {
      // There, and done once turned to face it.
      if (a.face === null || (Math.abs(wrapAngle(a.face - this.yaw)) < 0.01 && Math.abs(this.pitch - this.restPitch) < 0.01)) this._endWalk(a);
      return;
    }
    const step = a.speed * dt;
    if (dist <= step) {
      this._move(tx, tz);
      if (++a.i >= a.points.length && a.face === null) this._endWalk(a);
      return;
    }
    const px = p.x, pz = p.z;
    const c = this._move(px + ((tx - px) / dist) * step, pz + ((tz - pz) / dist) * step);
    if (Math.hypot(c.x - px, c.z - pz) < step * 0.05) this.auto = null; // blocked by a wall
  }

  /**
   * A walk that got where it was going: what it was for.
   * @protected
   * @param {Walk} a
   */
  _endWalk(a) {
    this.auto = null;
    a.done?.();
  }

  /**
   * What is at (clientX, clientY) on the view.
   * @protected
   * @param {number} clientX
   * @param {number} clientY
   * @returns {H | null}
   */
  _pickScreen(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    this.camera.updateWorldMatrix(true, false);
    return this._pickNdc(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  /**
   * What is at (x, y) in the view, -1…1 from its bottom left.
   * @protected
   * @param {number} x
   * @param {number} y
   * @returns {H | null}
   */
  _pickNdc(x, y) {
    this._ndc.set(x, y);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const { origin: o, direction: d } = this._raycaster.ray;
    return this.castRay(o.x, o.y, o.z, d.x, d.y, d.z, this._hit);
  }

  /** @protected */
  _updateHover() {
    /** @type {H | null} */
    let hit = null;
    const aim = this.padActive || this.aimMiddle;
    const at = this.pointer;
    if (aim || (at && !this._down)) {
      if (aim) this.camera.updateWorldMatrix(true, false);
      hit = aim || !at ? this._pickNdc(0, 0) : this._pickScreen(at.x, at.y);
    }
    this._setHover(this.usable(hit), hit);
    const cursor = this.hover ? 'pointer' : this._down?.moved ? 'grabbing' : '';
    if (cursor !== this._cursor) this.dom.style.cursor = this._cursor = cursor;
  }

  // ── The site's ──────────────────────────────────────────────────────────────

  /**
   * What a ray from (ox, oy, oz) along (dx, dy, dz) meets first, written into out and returned, or
   * null: the site's room. Common's meets nothing.
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {H} out
   * @returns {H | null}
   */
  castRay(ox, oy, oz, dx, dy, dz, out) {
    return null;
  }

  /**
   * The nearest place to (x, z) the visitor coming from (fx, fz) may be, written into out and
   * returned: the site's walls. Common's has none.
   * @param {number} fx
   * @param {number} fz
   * @param {number} x
   * @param {number} z
   * @param {{ x: number, z: number }} out
   * @returns {{ x: number, z: number }}
   */
  clampWalk(fx, fz, x, z, out) {
    out.x = x;
    out.z = z;
    return out;
  }

  /**
   * How high the ground is at (x, z), for the rig to stand on: 0 unless a site's rises and falls
   * (outside's).
   * @param {number} x
   * @param {number} z
   * @returns {number}
   */
  groundAt(x, z) {
    return 0;
  }

  /**
   * The points to walk through from (fx, fz) to (x, z), the last of them where it ends, or none to
   * stay: straight there unless a site has a way round (outside's bridge).
   * @param {number} fx
   * @param {number} fz
   * @param {number} x
   * @param {number} z
   * @returns {[number, number][]}
   */
  route(fx, fz, x, z) {
    return [[x, z]];
  }

  /**
   * What could be used where a hit is, for hover, the cursor and the reticle: 'door' for the
   * doorway. A site adds its own (a panel's button, a piece), and calls super for the rest.
   * @param {H | null} hit
   * @returns {string | null}
   */
  usable(hit) {
    return hit?.kind === 'door' ? 'door' : null;
  }

  /**
   * Uses what a hit is on: the doorway (onDoor), or ground to walk to (a walk there on a screen, a
   * teleport in VR). A site uses its own first and calls super for the rest; a press that met
   * nothing comes here too, as null (outside's puts its open book down).
   * @param {H | null} hit
   * @param {How} how
   */
  use(hit, how) {
    if (!hit) return;
    if (hit.kind === 'door') this.onDoor(how, hit);
    else if (hit.walkable) {
      if (how === 'xr') this._teleport(hit.x, hit.z);
      else this.walkTo(hit.x, hit.z);
    }
  }

  /**
   * Shows what is pointed at (usable(hit), and the hit): hover and hoverDoor. A site shows its own
   * too (the template's panel button and piece), calling super.
   * @protected
   * @param {string | null} usable
   * @param {H | null} hit
   */
  _setHover(usable, hit) {
    this.hover = usable;
    this.hoverDoor = usable === 'door';
  }

  /** Walks up to the site's doorway and through it (a walk with _startWalk): common's does nothing. */
  walkInto() {}

  /**
   * Gets up before a move (walking, a walk, a teleport), if the visitor sits (video's seats,
   * outside's bench): whether they did. Common's has nothing to sit on.
   * @returns {boolean}
   */
  stand() {
    return false;
  }

  /**
   * In VR, how far the rig stands above the ground: eyeLift, which a site lowers for a seat (video).
   * @protected
   * @returns {number}
   */
  _riseXR() {
    return this.eyeLift;
  }

  /**
   * How large a hand's reticle is on what could be used (`use`, usable's) or on nothing usable
   * (null): larger on the doorway, smaller on a button. A site may size its own (the template's
   * pieces).
   * @param {string | null} use
   * @param {H} hit
   * @returns {number}
   */
  reticleScale(use, hit) {
    return use === 'door' ? 1.8 : use ? 0.7 : 1;
  }

  // ── Where a site's own comes first: common's take nothing ───────────────────

  /**
   * A key, before walking's: whether the site took it (outside's Home and its book's keys; while
   * reading the arrows turn pages and only WASD walks). The page's own controls keep theirs, and
   * never come here.
   * @param {KeyboardEvent} e
   * @param {string} name keyOf(e)
   * @returns {boolean}
   */
  takeKey(e, name) {
    return false;
  }

  /**
   * A gamepad, each frame while one is connected, before walking and A and B: whether the site used
   * it (outside's book's buttons and triggers), so it takes over as walking would. It takes A's or
   * B's press by clearing press.use or press.back (outside's B goes back in its book first).
   * @param {Gamepad} pad
   * @param {number} dt
   * @param {PadPress} press
   * @returns {boolean}
   */
  takePad(pad, dt, press) {
    return false;
  }

  /**
   * A hand's controller in VR, each frame: its stick (ax, ay, y down) and its buttons, before the
   * stick walks or turns. True takes the stick from them this frame (outside's book turns its pages
   * with it), and drops the hand's aim for a teleport.
   * @param {Hand<H>} hand
   * @param {Gamepad} pad
   * @param {number} ax
   * @param {number} ay
   * @param {number} dt
   * @returns {boolean}
   */
  takeHand(hand, pad, ax, ay, dt) {
    return false;
  }

  /**
   * A drag on the view, let go: whether the site took it as a swipe (outside's book turns a page),
   * and then the view goes back to where the drag began.
   * @param {number} dx pixels, right
   * @param {number} dy pixels, down
   * @param {number} ms how long it took
   * @param {boolean} touch a finger, or a pen; not the mouse
   * @returns {boolean}
   */
  takeSwipe(dx, dy, ms, touch) {
    return false;
  }

  /**
   * Two fingers on the view, moved apart (or together, < 0) by `apart` pixels since the last pinch
   * the site took: whether it took this one (outside's book comes nearer or goes farther). Two
   * fingers neither look nor tap.
   * @param {number} apart
   * @returns {boolean}
   */
  takePinch(apart) {
    return false;
  }

  /**
   * The wheel on the view, dy pixels down (lines and pages as pixels): whether the site took it
   * (outside's book), and then the page doesn't scroll.
   * @param {number} dy
   * @returns {boolean}
   */
  takeWheel(dy) {
    return false;
  }

  /**
   * A grip squeezed (on) or let go in VR: whether the site took it (outside's book moves with the
   * hand). A squeeze not taken is onSqueeze's.
   * @param {Hand<H>} hand
   * @param {boolean} on
   * @returns {boolean}
   */
  takeGrip(hand, on) {
    return false;
  }

  // ── The page ────────────────────────────────────────────────────────────────

  /**
   * How far apart two fingers are.
   * @protected
   */
  _pinchDistance() {
    /** @type {[number, number] | null} */
    let a = null;
    let d = 0;
    for (const f of this._touches.values()) {
      if (a) d = Math.hypot(f[0] - a[0], f[1] - a[1]);
      else a = f;
    }
    return d;
  }

  /** @protected */
  _bindDom() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      this._setPadActive(false);
      if (e.pointerType === 'touch') {
        this._touches.set(e.pointerId, [e.clientX, e.clientY]);
        if (this._touches.size === 2) {
          // A second finger: a pinch, so the first one's touch is no tap.
          this._pinch = this._pinchDistance();
          this._down = null;
          return;
        }
      }
      if (this._down || this._touches.size > 1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      this._down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, touch: e.pointerType !== 'mouse', moved: false, t: e.timeStamp, yaw: this.yaw, pitch: this.pitch };
      el.setPointerCapture?.(e.pointerId);
      this.onActivity();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        this._pointerAt.x = e.clientX;
        this._pointerAt.y = e.clientY;
        this.pointer = this._pointerAt;
      }
      if (e.movementX || e.movementY) this._setPadActive(false);
      const f = this._touches.get(e.pointerId);
      if (f) {
        f[0] = e.clientX;
        f[1] = e.clientY;
        if (this._touches.size === 2) {
          const d = this._pinchDistance();
          if (this._pinch && this.takePinch(d - this._pinch)) this._pinch = d;
          return;
        }
      }
      const d = this._down;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
      d.lx = e.clientX;
      d.ly = e.clientY;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > (d.touch ? 10 : 5)) d.moved = true;
      if (!d.moved) return;
      // The mouse turns the view the way it is dragged; a finger drags the scene (the opposite).
      const k = d.touch ? -LOOK * 1.15 : LOOK;
      this.yaw -= dx * k;
      this.pitch = clamp(this.pitch - dy * k, -PITCH, PITCH);
      this.auto = null;
    });
    const end = (/** @type {PointerEvent} */ e) => {
      this._touches.delete(e.pointerId);
      if (this._touches.size < 2) this._pinch = 0;
      const d = this._down;
      if (!d || d.id !== e.pointerId) return;
      this._down = null;
      if (e.type !== 'pointerup') return;
      if (!d.moved) this.use(this._pickScreen(e.clientX, e.clientY), 'screen');
      else if (this.takeSwipe(e.clientX - d.x, e.clientY - d.y, e.timeStamp - d.t, d.touch)) {
        this.yaw = d.yaw;
        this.pitch = d.pitch;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.pointer = null;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 600 : 1; // lines, pages
      if (this.takeWheel(e.deltaY * unit)) e.preventDefault();
    }, { passive: false });
    const win = this._window;
    win.addEventListener('keydown', (e) => {
      // A key a page control has already used (a TV remote's OK) isn't walking's.
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      // The page's own controls keep their keys: a radio button its arrows, a text view
      // (data-own-keys) its own, and a button or a link the Space or Enter that presses it.
      const target = /** @type {Element | null} */ (e.target);
      if (target?.closest?.('input, textarea, select, [contenteditable], [data-own-keys]')) return;
      // A TV remote's keys come without a code (tv.js's keyOf): their key names them.
      const name = keyOf(e);
      if ((name === 'Space' || name === ' ' || name === 'Enter' || name === 'NumpadEnter') && target?.closest?.('button, a[href]')) return;
      if (this.takeKey(e, name)) return;
      const k = KEYS[name];
      if (!k) return;
      // The arrows are walking's, not the TV's spatial navigation (or a page scroll).
      if (name.startsWith('Arrow')) e.preventDefault();
      this.keys.add(k);
      if (k !== 'run') this.auto = null;
      this.onActivity();
    });
    win.addEventListener('keyup', (e) => {
      const k = KEYS[keyOf(e)];
      if (k) this.keys.delete(k);
    });
    win.addEventListener('blur', () => this.keys.clear());
    // A browser shows a page a gamepad once one of its buttons is pressed.
    win.addEventListener('gamepadconnected', () => {
      this._pads++;
      this.hasPad = true;
    });
    win.addEventListener('gamepaddisconnected', () => {
      this._pads = Math.max(0, this._pads - 1);
      this.hasPad = this._pads > 0;
      if (!this.hasPad) this._setPadActive(false);
    });
  }

  // ── VR ──────────────────────────────────────────────────────────────────────

  /**
   * @protected
   * @param {() => H} hit
   */
  _setupXR(hit) {
    const laserGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xfff0d6, transparent: true, opacity: 0.6 });
    const ringGeometry = new THREE.RingGeometry(0.022, 0.034, 28);
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      const laser = new THREE.Line(laserGeometry, laserMaterial);
      laser.visible = false;
      controller.add(laser);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0d6 }));
      controller.add(tip);
      const reticle = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: 0xfff0d6, transparent: true, opacity: 0.85, depthWrite: false }));
      reticle.visible = false;
      this.scene.add(reticle);
      /** @type {Hand<H>} */
      const hand = { controller, laser, tip, reticle, source: null, hit: hit(), last: null, aiming: false };
      controller.addEventListener('connected', (e) => {
        hand.source = e.data;
      });
      controller.addEventListener('disconnected', () => {
        hand.source = null;
        hand.last = null;
        hand.aiming = false;
        laser.visible = reticle.visible = false;
      });
      controller.addEventListener('select', () => this._xrSelect(hand));
      controller.addEventListener('squeezestart', () => {
        if (!this.takeGrip(hand, true)) this.onSqueeze(hand);
      });
      controller.addEventListener('squeezeend', () => this.takeGrip(hand, false));
      this.rig.add(controller);
      this.hands.push(hand);
    }
    this.renderer.xr.addEventListener('sessionstart', () => {
      this._entry.x = this.rig.position.x;
      this._entry.z = this.rig.position.z;
      this._entry.yaw = this.yaw;
      this._recenter = 2;
      this.auto = null;
      this.keys.clear();
      this.rig.position.y = this.groundAt(this.rig.position.x, this.rig.position.z) + this._riseXR();
    });
    this.renderer.xr.addEventListener('sessionend', () => this._onSessionEnd());
  }

  /** @protected */
  _headYaw() {
    this.camera.getWorldDirection(this._dir);
    return Math.atan2(-this._dir.x, -this._dir.z);
  }

  /**
   * Turns the rig by angle about the head, so the visitor turns in place.
   * @protected
   * @param {number} angle
   */
  _turnAboutHead(angle) {
    this.camera.getWorldPosition(this._head);
    const p = this.rig.position;
    const ox = p.x - this._head.x, oz = p.z - this._head.z;
    const c = Math.cos(angle), s = Math.sin(angle);
    p.x = this._head.x + ox * c + oz * s;
    p.z = this._head.z - ox * s + oz * c;
    this.yaw += angle;
    this.rig.rotation.y = this.yaw;
  }

  /**
   * Moves the rig so the head is at (x, z), wherever that is (a seat).
   * @protected
   * @param {number} x
   * @param {number} z
   */
  _placeHead(x, z) {
    this.camera.getWorldPosition(this._head);
    this.rig.position.x += x - this._head.x;
    this.rig.position.z += z - this._head.z;
  }

  /**
   * Moves the rig so the head goes to (x, z), or as near as the site lets it (clampWalk).
   * @protected
   * @param {number} x
   * @param {number} z
   */
  _moveHead(x, z) {
    this.camera.getWorldPosition(this._head);
    const c = this.clampWalk(this._head.x, this._head.z, x, z, this._clamped);
    this.rig.position.x += c.x - this._head.x;
    this.rig.position.z += c.z - this._head.z;
  }

  /**
   * A moment after entering VR: the headset lined up with where the visitor stood and looked, and
   * the rig on the ground there (raised at once in seated mode, not rising into it).
   * @protected
   */
  _lineUp() {
    this._turnAboutHead(wrapAngle(this._entry.yaw - this._headYaw()));
    this.rig.updateMatrixWorld();
    this._moveHead(this._entry.x, this._entry.z);
    this.setEyeLift(this.eyeLift);
  }

  /**
   * @protected
   * @param {number} dt
   */
  _updateXR(dt) {
    if (this._recenter > 0 && --this._recenter === 0) this._lineUp();
    // The sticks: the right one turns, the left one walks or aims a teleport; the site's first.
    for (const h of this.hands) {
      const source = h.source, pad = source?.gamepad;
      if (!source || !pad || pad.axes.length < 2) continue;
      const ax = pad.axes.length >= 4 ? pad.axes[2] : pad.axes[0];
      const ay = pad.axes.length >= 4 ? pad.axes[3] : pad.axes[1];
      if (this.takeHand(h, pad, ax, ay, dt)) h.aiming = false;
      else if (source.handedness === 'right') this._turnStick(ax, dt);
      else if (this.move === 'teleport') this._teleportStick(h, ay);
      else this._walkStick(ax, ay, dt);
    }
    // Stand on the ground under the head (its height above the rig is the headset's own).
    this.camera.getWorldPosition(this._head);
    this._standOnGround(dt, this._head.x, this._head.z, this._riseXR());
    this.rig.updateMatrixWorld();
    /** @type {string | null} */
    let usable = null;
    /** @type {H | null} */
    let usableHit = null;
    for (const h of this.hands) {
      if (h.source?.targetRayMode !== 'tracked-pointer') {
        h.laser.visible = h.reticle.visible = false;
        h.last = null;
        continue;
      }
      const m = h.controller.matrixWorld;
      this._origin.setFromMatrixPosition(m);
      this._dir.set(0, 0, -1).transformDirection(m);
      const o = this._origin, d = this._dir;
      const hit = this.castRay(o.x, o.y, o.z, d.x, d.y, d.z, h.hit);
      h.last = hit;
      h.laser.visible = true;
      h.laser.scale.z = hit ? hit.t : 4;
      if (!hit || hit.kind === 'ceiling') {
        h.reticle.visible = false;
        continue;
      }
      const use = this.usable(hit);
      if (use && !usable) {
        usable = use;
        usableHit = hit;
      }
      const n = this._normal.set(hit.nx, hit.ny, hit.nz).normalize();
      // Aiming a teleport at the ground (walkable, or facing up): larger, and dim where one can't stand.
      const target = h.aiming && (hit.walkable || n.y > 0.7);
      h.reticle.position.set(hit.x + n.x * 0.01, hit.y + n.y * 0.01, hit.z + n.z * 0.01);
      h.reticle.quaternion.setFromUnitVectors(Z_AXIS, n);
      h.reticle.scale.setScalar(target ? 3.2 : this.reticleScale(use, hit));
      h.reticle.material.color.setHex(target ? (hit.walkable ? 0xe8c47c : 0x8a7f72) : use ? 0xe8c47c : hit.walkable ? 0xfff0d6 : 0x9a8f80);
      h.reticle.visible = true;
    }
    this._setHover(usable, usableHit);
  }

  /**
   * Right stick: a 30 degree step each push (snap), or turning while held (smooth).
   * @protected
   * @param {number} ax
   * @param {number} dt
   */
  _turnStick(ax, dt) {
    if (this.turn === 'smooth') {
      if (Math.abs(ax) > 0.15) {
        this._turnAboutHead(-ax * SMOOTH_TURN * dt);
        this.turnRate = Math.max(this.turnRate, Math.abs(ax) * SMOOTH_TURN);
      }
      return;
    }
    if (this._snapArmed && Math.abs(ax) > 0.6) {
      this._turnAboutHead(-Math.sign(ax) * SNAP);
      this._snapArmed = false;
    } else if (Math.abs(ax) < 0.3) this._snapArmed = true;
  }

  /**
   * Left stick, move 'smooth': walk the way the head faces (getting up first).
   * @protected
   * @param {number} ax
   * @param {number} ay
   * @param {number} dt
   */
  _walkStick(ax, ay, dt) {
    if (Math.hypot(ax, ay) <= 0.15) return;
    if (this.stand()) this.rig.updateMatrixWorld();
    this.camera.getWorldDirection(this._dir);
    let fx = this._dir.x, fz = this._dir.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    // Right of forward (fx, fz) is (-fz, fx).
    const step = XR_WALK * dt;
    this.moveSpeed = Math.max(this.moveSpeed, XR_WALK * Math.min(1, Math.hypot(ax, ay)));
    this.camera.getWorldPosition(this._head);
    this._moveHead(this._head.x + (-fz * ax - fx * ay) * step, this._head.z + (fx * ax - fz * ay) * step);
  }

  /**
   * Left stick, move 'teleport': pushed forward, that hand's ray aims; let go, and the visitor is
   * there, if it was ground to stand on.
   * @protected
   * @param {Hand<H>} h
   * @param {number} ay
   */
  _teleportStick(h, ay) {
    if (ay < -0.6) h.aiming = true;
    else if (h.aiming && ay > -0.3) {
      h.aiming = false;
      const hit = h.last;
      if (hit?.walkable) this._teleport(hit.x, hit.z);
    }
  }

  /**
   * A teleport: the head to (x, z), getting up first, inside onTeleport.
   * @protected
   * @param {number} x
   * @param {number} z
   */
  _teleport(x, z) {
    this.onTeleport(() => {
      if (this.stand()) this.rig.updateMatrixWorld();
      this._moveHead(x, z);
    });
  }

  /**
   * @protected
   * @param {Hand<H>} hand
   */
  _xrSelect(hand) {
    this.onActivity();
    this.use(hand.last, 'xr');
  }

  /** @protected */
  _onSessionEnd() {
    // Carry on from where the headset was, facing the way it faced.
    this.camera.getWorldPosition(this._head);
    const yaw = this._headYaw();
    const c = this.clampWalk(this._head.x, this._head.z, this._head.x, this._head.z, this._clamped);
    this.camera.position.set(0, this.eye, 0);
    this.camera.quaternion.identity();
    for (const h of this.hands) {
      h.laser.visible = h.reticle.visible = false;
      h.last = null;
      h.aiming = false;
    }
    this._setHover(null, null);
    this.setPose(c.x, c.z, yaw);
  }
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
