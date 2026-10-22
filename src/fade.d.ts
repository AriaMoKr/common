export class Fade {
    /**
     * Puts the sphere on the camera, at `value`.
     * @param {THREE.Object3D} camera
     * @param {number} [value] 1 (the default) starts black, 0 clear
     */
    constructor(camera: THREE.Object3D, value?: number);
    material: THREE.MeshBasicMaterial;
    mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    /** How black it is now: 0 clear, 1 black. */
    value: number;
    /** Where it is fading to. */
    target: number;
    /** How fast, in value per second. */
    rate: number;
    /** @type {(() => void) | null} called once the fade arrives */
    done: (() => void) | null;
    /**
     * Fades to target (0 clear, 1 black) over seconds, then calls done.
     * @param {number} target
     * @param {number} seconds
     * @param {(() => void) | null} [done]
     */
    to(target: number, seconds: number, done?: (() => void) | null): void;
    /**
     * Sets it at once, dropping a fade under way (its done is not called).
     * @param {number} value
     */
    set(value: number): void;
    /**
     * Moves the fade on, every frame.
     * @param {number} dt seconds since the last frame
     */
    update(dt: number): void;
    /** @private */
    private _finish;
    /** @private */
    private _apply;
}
import * as THREE from 'three';
