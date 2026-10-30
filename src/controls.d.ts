/** @typedef {'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight' | 'run'} KeyAction */
/**
 * What a key does, by its name (tv.js's keyOf: its code, else its key; a TV's spare keys as the
 * arrows).
 * @type {Readonly<Record<string, KeyAction>>}
 */
export const KEYS: Readonly<Record<string, KeyAction>>;
/**
 * Walking about a site: a screen, a gamepad, a TV's remote, and VR. A site extends it with its own:
 * castRay, clampWalk, usable, use and walkInto, and where it has them groundAt, route, stand, the
 * hover it shows (_setHover) and the places where its own comes first (takeKey, takePad, …).
 * @template {Hit} [H=Hit]
 */
export class Controls<H extends Hit = Hit> {
    /** @param {ControlsOptions<H>} options */
    constructor({ renderer, camera, rig, scene, dom, eye, hit, window: win, getGamepads }: ControlsOptions<H>);
    renderer: {
        xr: THREE.WebXRManager;
    };
    camera: THREE.Camera;
    rig: THREE.Object3D<THREE.Object3DEventMap>;
    scene: THREE.Object3D<THREE.Object3DEventMap>;
    dom: HTMLElement;
    /** The eye's height on a screen: the camera's in the rig. */
    eye: number;
    yaw: number;
    pitch: number;
    /** What the keys held do (KEYS). @type {Set<string>} */
    keys: Set<string>;
    /** What is pointed at that could be used (usable): 'door', or the site's. @type {string | null} */
    hover: string | null;
    hoverDoor: boolean;
    /** VR navigation (nav.js, under hallway.nav). @type {'smooth' | 'teleport'} */
    move: "smooth" | "teleport";
    /** @type {'snap' | 'smooth'} */
    turn: "snap" | "smooth";
    /** Less motion (access.js reduceMotion): a walk jumps to its end. */
    reduceMotion: boolean;
    /** In VR, how far the rig stands above the ground: access.js eyeLift, for seated mode (setEyeLift). */
    eyeLift: number;
    /** The sticks' smooth movement (m/s) and turning (rad/s) this frame in VR, for the vignette; 0 for snaps and teleports. */
    moveSpeed: number;
    turnRate: number;
    /**
     * The pitch the view comes back to, after setPose or a walk that faces somewhere: level, unless
     * a site sets it (a TV's a little down in outside, as its remote can't look up or down). A walk
     * facing nowhere leaves the view as it was, unless it looked where it went: then it ends a
     * little down (towards -0.1, or this if lower).
     */
    restPitch: number;
    /** (how, hit) when the doorway is chosen (use). @type {(how: How, hit: H) => void} */
    onDoor: (how: How, hit: H) => void;
    /** (hand) when a controller's grip is squeezed in VR (a wave in the shared session). @type {(hand: Hand<H>) => void} */
    onSqueeze: (hand: Hand<H>) => void;
    /** (move) for a teleport: the site blinks the view around move(), which puts the visitor there. @type {(move: () => void) => void} */
    onTeleport: (move: () => void) => void;
    /** The first time the visitor does anything (hides the hint). @type {() => void} */
    onActivity: () => void;
    /** A gamepad was used last: the middle of the view is what it points at (the site shows a dot there). */
    padActive: boolean;
    /** (on) when the gamepad takes over or hands back. @type {(on: boolean) => void} */
    onPadActive: (on: boolean) => void;
    /** When its B or Back is pressed (the site leaves fullscreen). @type {() => void} */
    onPadBack: () => void;
    /** @protected */
    protected _pad: import("./gamepad.js").PadState;
    /** @protected */
    protected _padUse: boolean;
    /** @protected */
    protected _padBack: boolean;
    /** @protected @type {PadPress} */
    protected _padPress: PadPress;
    /** @protected */
    protected _pads: number;
    /** Whether a gamepad is connected. */
    hasPad: boolean;
    /** The middle of the view is the pointer whatever is used (a TV, whose remote has none: tv.js). */
    aimMiddle: boolean;
    /** A walk under way, or null. @type {Walk | null} */
    auto: Walk | null;
    /** The mouse over the view, in client pixels, or null. @type {{ x: number, y: number } | null} */
    pointer: {
        x: number;
        y: number;
    } | null;
    /** @protected */
    protected _pointerAt: {
        x: number;
        y: number;
    };
    /** @protected @type {Down | null} */
    protected _down: Down | null;
    /** @protected @type {Map<number, [number, number]>} fingers down: pointerId → where */
    protected _touches: Map<number, [number, number]>;
    /** @protected */
    protected _pinch: number;
    /** @protected */
    protected _cursor: string;
    /** @protected */
    protected _raycaster: THREE.Raycaster;
    /** @protected */
    protected _ndc: THREE.Vector2;
    /** @protected @type {H} */
    protected _hit: H;
    /** @protected */
    protected _head: THREE.Vector3;
    /** @protected */
    protected _dir: THREE.Vector3;
    /** @protected */
    protected _origin: THREE.Vector3;
    /** @protected */
    protected _normal: THREE.Vector3;
    /** @protected */
    protected _clamped: {
        x: number;
        z: number;
    };
    /** @protected */
    protected _snapArmed: boolean;
    /** @protected */
    protected _recenter: number;
    /** @protected */
    protected _entry: {
        x: number;
        z: number;
        yaw: number;
    };
    /** @protected */
    protected _window: Pick<Window, "addEventListener">;
    /** @protected */
    protected _getGamepads: () => ArrayLike<Gamepad | null> | null | undefined;
    /** The two hands in VR. @type {Hand<H>[]} */
    hands: Hand<H>[];
    /**
     * Puts the visitor at (x, z) on the ground, facing yaw, looking up by pitch (restPitch).
     * @param {number} x
     * @param {number} z
     * @param {number} yaw
     * @param {number} [pitch]
     */
    setPose(x: number, z: number, yaw: number, pitch?: number): void;
    /**
     * Sets how to move and turn in VR (nav.js).
     * @param {{ move: 'smooth' | 'teleport', turn: 'snap' | 'smooth' }} nav
     */
    setNav({ move, turn }: {
        move: "smooth" | "teleport";
        turn: "snap" | "smooth";
    }): void;
    /**
     * Raises the rig this far above the ground in VR (access.js eyeLift: 0.45 m in seated mode, else
     * 0), at once; on a screen the eye height stays.
     * @param {number} lift
     */
    setEyeLift(lift: number): void;
    /**
     * Walks to (x, z) along the site's route there, then turns to `face` (a yaw) if given and calls
     * `then`; with less motion, there at once. Gets up first (stand). Only on a screen: in VR, where
     * update walks nowhere, a site teleports instead (_teleport), as use does.
     * @param {number} x
     * @param {number} z
     * @param {{ face?: number | null, then?: (() => void) | null }} [options]
     */
    walkTo(x: number, z: number, { face, then }?: {
        face?: number | null;
        then?: (() => void) | null;
    }): void;
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
    protected _startWalk(points: [number, number][], face: number | null, done?: (() => void) | null, turn?: boolean): void;
    /** @param {number} dt seconds since the last frame */
    update(dt: number): void;
    /**
     * Keeps the rig on the ground under (x, z), `lift` above it: at once when dt is 0, else easing
     * there, so a step up or down is no jolt.
     * @protected
     * @param {number} dt
     * @param {number} x
     * @param {number} z
     * @param {number} lift
     */
    protected _standOnGround(dt: number, x: number, z: number, lift: number): void;
    /** @protected */
    protected _apply(): void;
    /**
     * Moves the rig towards (x, z), as far as the site lets it (clampWalk).
     * @protected
     * @param {number} x
     * @param {number} z
     * @returns {{ x: number, z: number }} where it is now
     */
    protected _move(x: number, z: number): {
        x: number;
        z: number;
    };
    /**
     * @protected
     * @param {number} dt
     */
    protected _updateKeys(dt: number): void;
    /**
     * The gamepad takes over the view's middle as the pointer when used; the mouse takes it back.
     * @protected
     * @param {boolean} on
     */
    protected _setPadActive(on: boolean): void;
    /**
     * The first connected gamepad: walking and looking like a first-person game, A to use, B the
     * site's; its own buttons first (takePad).
     * @protected
     * @param {number} dt
     */
    protected _updatePad(dt: number): void;
    /** A on a gamepad, or OK on a TV's remote: what the middle of the view is on, as a click there would. */
    useMiddle(): void;
    /**
     * @protected
     * @param {number} dt
     */
    protected _updateWalk(dt: number): void;
    /**
     * A walk that got where it was going: what it was for.
     * @protected
     * @param {Walk} a
     */
    protected _endWalk(a: Walk): void;
    /**
     * What is at (clientX, clientY) on the view.
     * @protected
     * @param {number} clientX
     * @param {number} clientY
     * @returns {H | null}
     */
    protected _pickScreen(clientX: number, clientY: number): H | null;
    /**
     * What is at (x, y) in the view, -1…1 from its bottom left.
     * @protected
     * @param {number} x
     * @param {number} y
     * @returns {H | null}
     */
    protected _pickNdc(x: number, y: number): H | null;
    /** @protected */
    protected _updateHover(): void;
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
    castRay(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, out: H): H | null;
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
    clampWalk(fx: number, fz: number, x: number, z: number, out: {
        x: number;
        z: number;
    }): {
        x: number;
        z: number;
    };
    /**
     * How high the ground is at (x, z), for the rig to stand on: 0 unless a site's rises and falls
     * (outside's).
     * @param {number} x
     * @param {number} z
     * @returns {number}
     */
    groundAt(x: number, z: number): number;
    /**
     * The points to walk through from (fx, fz) to (x, z), the last of them where it ends, or none to
     * stay: straight there unless a site has a way round (outside's bridge).
     * @param {number} fx
     * @param {number} fz
     * @param {number} x
     * @param {number} z
     * @returns {[number, number][]}
     */
    route(fx: number, fz: number, x: number, z: number): [number, number][];
    /**
     * What could be used where a hit is, for hover, the cursor and the reticle: 'door' for the
     * doorway. A site adds its own (a panel's button, a piece), and calls super for the rest.
     * @param {H | null} hit
     * @returns {string | null}
     */
    usable(hit: H | null): string | null;
    /**
     * Uses what a hit is on: the doorway (onDoor), or ground to walk to (a walk there on a screen, a
     * teleport in VR). A site uses its own first and calls super for the rest; a press that met
     * nothing comes here too, as null (outside's puts its open book down).
     * @param {H | null} hit
     * @param {How} how
     */
    use(hit: H | null, how: How): void;
    /**
     * Shows what is pointed at (usable(hit), and the hit): hover and hoverDoor. A site shows its own
     * too (the template's panel button and piece), calling super.
     * @protected
     * @param {string | null} usable
     * @param {H | null} hit
     */
    protected _setHover(usable: string | null, hit: H | null): void;
    /** Walks up to the site's doorway and through it (a walk with _startWalk): common's does nothing. */
    walkInto(): void;
    /**
     * Gets up before a move (walking, a walk, a teleport), if the visitor sits (video's seats,
     * outside's bench): whether they did. Common's has nothing to sit on.
     * @returns {boolean}
     */
    stand(): boolean;
    /**
     * In VR, how far the rig stands above the ground: eyeLift, which a site lowers for a seat (video).
     * @protected
     * @returns {number}
     */
    protected _riseXR(): number;
    /**
     * How large a hand's reticle is on what could be used (`use`, usable's) or on nothing usable
     * (null): larger on the doorway, smaller on a button. A site may size its own (the template's
     * pieces).
     * @param {string | null} use
     * @param {H} hit
     * @returns {number}
     */
    reticleScale(use: string | null, hit: H): number;
    /**
     * A key, before walking's: whether the site took it (outside's Home and its book's keys; while
     * reading the arrows turn pages and only WASD walks). The page's own controls keep theirs, and
     * never come here.
     * @param {KeyboardEvent} e
     * @param {string} name keyOf(e)
     * @returns {boolean}
     */
    takeKey(e: KeyboardEvent, name: string): boolean;
    /**
     * A gamepad, each frame while one is connected, before walking and A and B: whether the site used
     * it (outside's book's buttons and triggers), so it takes over as walking would. It takes A's or
     * B's press by clearing press.use or press.back (outside's B goes back in its book first).
     * @param {Gamepad} pad
     * @param {number} dt
     * @param {PadPress} press
     * @returns {boolean}
     */
    takePad(pad: Gamepad, dt: number, press: PadPress): boolean;
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
    takeHand(hand: Hand<H>, pad: Gamepad, ax: number, ay: number, dt: number): boolean;
    /**
     * A drag on the view, let go: whether the site took it as a swipe (outside's book turns a page),
     * and then the view goes back to where the drag began.
     * @param {number} dx pixels, right
     * @param {number} dy pixels, down
     * @param {number} ms how long it took
     * @param {boolean} touch a finger, or a pen; not the mouse
     * @returns {boolean}
     */
    takeSwipe(dx: number, dy: number, ms: number, touch: boolean): boolean;
    /**
     * Two fingers on the view, moved apart (or together, < 0) by `apart` pixels since the last pinch
     * the site took: whether it took this one (outside's book comes nearer or goes farther). Two
     * fingers neither look nor tap.
     * @param {number} apart
     * @returns {boolean}
     */
    takePinch(apart: number): boolean;
    /**
     * The wheel on the view, dy pixels down (lines and pages as pixels): whether the site took it
     * (outside's book), and then the page doesn't scroll.
     * @param {number} dy
     * @returns {boolean}
     */
    takeWheel(dy: number): boolean;
    /**
     * A grip squeezed (on) or let go in VR: whether the site took it (outside's book moves with the
     * hand). A squeeze not taken is onSqueeze's.
     * @param {Hand<H>} hand
     * @param {boolean} on
     * @returns {boolean}
     */
    takeGrip(hand: Hand<H>, on: boolean): boolean;
    /**
     * How far apart two fingers are.
     * @protected
     */
    protected _pinchDistance(): number;
    /** @protected */
    protected _bindDom(): void;
    /**
     * @protected
     * @param {() => H} hit
     */
    protected _setupXR(hit: () => H): void;
    /** @protected */
    protected _headYaw(): number;
    /**
     * Turns the rig by angle about the head, so the visitor turns in place.
     * @protected
     * @param {number} angle
     */
    protected _turnAboutHead(angle: number): void;
    /**
     * Moves the rig so the head is at (x, z), wherever that is (a seat).
     * @protected
     * @param {number} x
     * @param {number} z
     */
    protected _placeHead(x: number, z: number): void;
    /**
     * Moves the rig so the head goes to (x, z), or as near as the site lets it (clampWalk).
     * @protected
     * @param {number} x
     * @param {number} z
     */
    protected _moveHead(x: number, z: number): void;
    /**
     * A moment after entering VR: the headset lined up with where the visitor stood and looked, and
     * the rig on the ground there (raised at once in seated mode, not rising into it).
     * @protected
     */
    protected _lineUp(): void;
    /**
     * @protected
     * @param {number} dt
     */
    protected _updateXR(dt: number): void;
    /**
     * Right stick: a 30 degree step each push (snap), or turning while held (smooth).
     * @protected
     * @param {number} ax
     * @param {number} dt
     */
    protected _turnStick(ax: number, dt: number): void;
    /**
     * Left stick, move 'smooth': walk the way the head faces (getting up first).
     * @protected
     * @param {number} ax
     * @param {number} ay
     * @param {number} dt
     */
    protected _walkStick(ax: number, ay: number, dt: number): void;
    /**
     * Left stick, move 'teleport': pushed forward, that hand's ray aims; let go, and the visitor is
     * there, if it was ground to stand on.
     * @protected
     * @param {Hand<H>} h
     * @param {number} ay
     */
    protected _teleportStick(h: Hand<H>, ay: number): void;
    /**
     * A teleport: the head to (x, z), getting up first, inside onTeleport.
     * @protected
     * @param {number} x
     * @param {number} z
     */
    protected _teleport(x: number, z: number): void;
    /**
     * @protected
     * @param {Hand<H>} hand
     */
    protected _xrSelect(hand: Hand<H>): void;
    /** @protected */
    protected _onSessionEnd(): void;
}
export type KeyAction = "forward" | "back" | "left" | "right" | "turnLeft" | "turnRight" | "run";
/**
 * What a ray meets (castRay), as far as common reads it. A site's castRay writes its own fields
 * too (the template's u, v and piece, the hallway's door), into a hit of its own shape (the `hit`
 * option).
 */
export type Hit = {
    /**
     * how far along the ray
     */
    t: number;
    /**
     * what it met: 'door' is the doorway (use: onDoor) and a 'ceiling' shows no
     * reticle; the rest are the site's
     */
    kind: string;
    /**
     * where
     */
    x: number;
    y: number;
    z: number;
    /**
     * the surface's normal, towards where the ray came from; any length
     */
    nx: number;
    ny: number;
    nz: number;
    /**
     * ground to walk or teleport to, whatever its kind
     */
    walkable: boolean;
};
/**
 * a click, a tap, A or OK ('screen'), or a controller in VR ('xr')
 */
export type How = "screen" | "xr";
/**
 * A hand in VR: its controller, the laser and its tip, the reticle where it points, and what it
 * points at.
 */
export type Hand<H extends Hit = Hit> = {
    /**
     * in the rig
     */
    controller: THREE.XRTargetRaySpace;
    laser: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    tip: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    /**
     * in the scene
     */
    reticle: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    source: XRInputSource | null;
    /**
     * castRay's, written each frame
     */
    hit: H;
    /**
     * what it points at now
     */
    last: H | null;
    /**
     * a teleport (move 'teleport')
     */
    aiming: boolean;
};
/**
 * A walk under way (_startWalk).
 */
export type Walk = {
    points: [number, number][];
    /**
     * the point it goes to now
     */
    i: number;
    /**
     * the yaw it turns to on the way, or null
     */
    face: number | null;
    /**
     * metres per second
     */
    speed: number;
    /**
     * it looks where it goes, facing only on its last leg (by default, along
     * more than one point)
     */
    turn: boolean;
    /**
     * once there (and turned)
     */
    done: (() => void) | null;
};
/**
 * A gamepad's A and B pressed this frame (takePad): a site that takes one clears it.
 */
export type PadPress = {
    use: boolean;
    back: boolean;
};
/**
 * A press on the view: a mouse button or a finger, from where it went down.
 */
export type Down = {
    id: number;
    x: number;
    y: number;
    lx: number;
    ly: number;
    touch: boolean;
    moved: boolean;
    t: number;
    yaw: number;
    pitch: number;
};
export type ControlsOptions<H extends Hit = Hit> = {
    /**
     * the site's WebGLRenderer
     */
    renderer: {
        xr: THREE.WebXRManager;
    };
    /**
     * the head, in the rig
     */
    camera: THREE.Camera;
    /**
     * the body: yaw only
     */
    rig: THREE.Object3D;
    /**
     * where the reticles go
     */
    scene: THREE.Object3D;
    /**
     * the view (the renderer's canvas): drags, clicks and taps, and the cursor
     */
    dom: HTMLElement;
    /**
     * the eye's height on a screen, in metres: 1.6
     */
    eye?: number | undefined;
    /**
     * a hit of the site's own shape, for its castRay to write into (one for
     * the screen, one per hand): common's Hit by default
     */
    hit?: (() => H) | undefined;
    /**
     * where the keys, a blur and the gamepads come
     * from: the page's
     */
    window?: Pick<Window, "addEventListener"> | undefined;
    /**
     * navigator.getGamepads
     */
    getGamepads?: (() => ArrayLike<Gamepad | null> | null | undefined) | undefined;
};
import * as THREE from 'three';
