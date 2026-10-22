// A fade to and from black around the viewer's head: a small sphere on the camera, drawn over
// everything. It works the same on a screen and in a headset. The Hallway's (its public/js/fade.js,
// as outside has it). The sites fade out before going through a door, fade in on arriving, and
// blink a teleport with it.

import * as THREE from 'three';

export class Fade {
  /**
   * Puts the sphere on the camera, at `value`.
   * @param {THREE.Object3D} camera
   * @param {number} [value] 1 (the default) starts black, 0 clear
   */
  constructor(camera, value = 1) {
    this.material = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false, opacity: value });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), this.material);
    this.mesh.renderOrder = 1e6;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'fade';
    camera.add(this.mesh);
    /** How black it is now: 0 clear, 1 black. */
    this.value = value;
    /** Where it is fading to. */
    this.target = value;
    /** How fast, in value per second. */
    this.rate = 1;
    /** @type {(() => void) | null} called once the fade arrives */
    this.done = null;
    this._apply();
  }

  /**
   * Fades to target (0 clear, 1 black) over seconds, then calls done.
   * @param {number} target
   * @param {number} seconds
   * @param {(() => void) | null} [done]
   */
  to(target, seconds, done = null) {
    this.target = target;
    this.rate = Math.abs(target - this.value) / Math.max(seconds, 1e-3);
    this.done = done;
    if (target === this.value) this._finish();
  }

  /**
   * Sets it at once, dropping a fade under way (its done is not called).
   * @param {number} value
   */
  set(value) {
    this.value = this.target = value;
    this.done = null;
    this._apply();
  }

  /**
   * Moves the fade on, every frame.
   * @param {number} dt seconds since the last frame
   */
  update(dt) {
    if (this.value === this.target) return;
    const step = this.rate * dt;
    if (Math.abs(this.target - this.value) <= step) this.value = this.target;
    else this.value += Math.sign(this.target - this.value) * step;
    this._apply();
    if (this.value === this.target) this._finish();
  }

  /** @private */
  _finish() {
    const done = this.done;
    this.done = null;
    done?.();
  }

  /** @private */
  _apply() {
    this.material.opacity = this.value;
    this.mesh.visible = this.value > 0.001;
  }
}
