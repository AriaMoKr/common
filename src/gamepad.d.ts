/**
 * A stick with a radial dead zone, rescaled so motion starts smoothly at its edge and reaches 1 at
 * full tilt, diagonally too.
 * @param {number} [x] -1 to 1, right; 0 for a missing axis
 * @param {number} [y] -1 to 1, down
 * @param {number} [deadzone]
 * @param {{ x: number, y: number }} [out] written and returned, so nothing is allocated
 * @returns {{ x: number, y: number }}
 */
export function stick(x?: number, y?: number, deadzone?: number, out?: {
    x: number;
    y: number;
}): {
    x: number;
    y: number;
};
/**
 * Whether a button is held: pressed, or an analogue one more than half way.
 * @param {Pad} pad
 * @param {number} i its index in the standard mapping (BUTTON, BUTTONS)
 */
export function held(pad: Pad, i: number): boolean;
/**
 * What a gamepad asks for now, written into `out`.
 * @param {Pad} pad
 * @param {PadState} [out]
 * @returns {PadState}
 */
export function readPad(pad: Pad, out?: PadState): PadState;
/**
 * The first connected gamepad, preferring one with the standard mapping.
 * @template {{ connected: boolean, mapping: string } | null | undefined} P
 * @param {ArrayLike<P> | null | undefined} pads navigator.getGamepads()
 * @returns {NonNullable<P> | null}
 */
export function firstPad<P extends {
    connected: boolean;
    mapping: string;
} | null | undefined>(pads: ArrayLike<P> | null | undefined): NonNullable<P> | null;
/** Buttons readPad reads, by index in the W3C standard mapping (https://w3c.github.io/gamepad/#remapping). */
export const BUTTON: Readonly<{
    a: 0;
    b: 1;
    back: 8;
    leftStick: 10;
}>;
/** Every button's name, by index in the standard mapping (vrlbry's). */
export const BUTTONS: readonly ["a", "b", "x", "y", "lb", "rb", "lt", "rt", "back", "start", "ls", "rs", "up", "down", "left", "right", "home"];
/** How far a stick moves before it counts. */
export const DEADZONE: 0.18;
/**
 * What a gamepad gives, as far as these functions read it: the DOM's Gamepad, or a stand-in.
 */
export type Pad = {
    axes: ArrayLike<number | undefined>;
    buttons: ArrayLike<{
        pressed: boolean;
        value: number;
    } | null | undefined>;
};
/**
 * What a gamepad asks for now (readPad): the sticks as -1 to 1, y down as gamepads give it, and
 * the buttons as held or not.
 */
export type PadState = {
    /**
     * the left stick
     */
    moveX: number;
    moveY: number;
    /**
     * the right stick
     */
    lookX: number;
    lookY: number;
    /**
     * the left stick clicked in
     */
    run: boolean;
    /**
     * A
     */
    use: boolean;
    /**
     * B or Back
     */
    back: boolean;
};
