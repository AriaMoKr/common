// The fade to and from black (src/fade.js), in Node with three.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { Fade } from '../src/fade.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);
const counter = () => {
  const f = () => { f.calls++; };
  f.calls = 0;
  return f;
};

describe('the fade', () => {
  it('is a sphere on the camera, drawn over everything, black at first', () => {
    const camera = new THREE.PerspectiveCamera();
    const fade = new Fade(camera);
    assert.equal(fade.mesh.parent, camera);
    assert.equal(fade.mesh.name, 'fade');
    assert.equal(fade.mesh.renderOrder, 1e6);
    assert.equal(fade.mesh.frustumCulled, false);
    assert.equal(fade.material, fade.mesh.material);
    assert.deepEqual([fade.material.side, fade.material.transparent, fade.material.depthTest, fade.material.depthWrite], [THREE.BackSide, true, false, false]);
    assert.deepEqual([fade.value, fade.material.opacity, fade.mesh.visible], [1, 1, true]);
  });

  it('can start clear, and is hidden while clear', () => {
    const fade = new Fade(new THREE.Object3D(), 0);
    assert.deepEqual([fade.value, fade.material.opacity, fade.mesh.visible], [0, 0, false]);
  });

  it('fades over the time given, then calls done once', () => {
    const fade = new Fade(new THREE.Object3D(), 1);
    const done = counter();
    fade.to(0, 0.8, done);
    fade.update(0.2);
    near(fade.value, 0.75, 'a quarter of the way');
    near(fade.material.opacity, 0.75, 'opacity');
    assert.equal(done.calls, 0);
    fade.update(0.4);
    near(fade.value, 0.25, 'three quarters');
    fade.update(0.5); // past the end: it stops there
    assert.deepEqual([fade.value, fade.material.opacity, fade.mesh.visible, done.calls], [0, 0, false, 1]);
    fade.update(1);
    fade.to(0, 1);
    assert.equal(done.calls, 1, 'not again');
  });

  it('fades back up, and over no time arrives on the next frame', () => {
    const fade = new Fade(new THREE.Object3D(), 0);
    const done = counter();
    fade.to(1, 0.3, done);
    fade.update(0.1);
    near(fade.value, 1 / 3, 'a third');
    assert.equal(fade.mesh.visible, true);
    fade.update(0.2);
    assert.deepEqual([fade.value, done.calls], [1, 1]);
    const blink = counter();
    fade.to(0, 0, blink);
    assert.equal(blink.calls, 0);
    fade.update(1 / 90);
    assert.deepEqual([fade.value, blink.calls], [0, 1]);
  });

  it('calls done at once when it is already there', () => {
    const fade = new Fade(new THREE.Object3D(), 1);
    const done = counter();
    fade.to(1, 0.4, done);
    assert.equal(done.calls, 1);
    fade.update(0.1);
    assert.equal(done.calls, 1);
  });

  it('drops a fade under way for a new one, whose done alone is called', () => {
    const fade = new Fade(new THREE.Object3D(), 1);
    const first = counter(), second = counter();
    fade.to(0, 1, first);
    fade.update(0.5);
    fade.to(1, 0.25, second);
    fade.update(0.25);
    assert.deepEqual([fade.value, first.calls, second.calls], [1, 0, 1]);
  });

  it('set puts it there at once and drops a fade under way, done uncalled', () => {
    const fade = new Fade(new THREE.Object3D(), 1);
    const done = counter();
    fade.to(0, 1, done);
    fade.update(0.5);
    fade.set(0.2);
    assert.deepEqual([fade.value, fade.target, fade.material.opacity, fade.mesh.visible], [0.2, 0.2, 0.2, true]);
    fade.update(1);
    assert.deepEqual([fade.value, done.calls], [0.2, 0]);
    fade.set(0);
    assert.equal(fade.mesh.visible, false);
  });
});
