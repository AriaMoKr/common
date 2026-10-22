// A doorway's material (src/portal.js), in Node with three: no WebGL is needed to build it, and
// the shader's room is all in its uniforms.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { viewParams } from '../src/door.js';
import { openingGeometry, placePortal, portalMaterial, setPicture, setView } from '../src/portal.js';

const near = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} ≠ ${b}`);
const nearVec = (v, [x, y, z], msg, eps = 1e-9) => {
  near(v.x, x, `${msg}.x`, eps);
  near(v.y, y, `${msg}.y`, eps);
  near(v.z, z, `${msg}.z`, eps);
};
/** A view as the Hallway's views.json has it (door.js viewParams). */
const VIEW = { image: 'vrlbry.jpg', depth: 2.94, pictureHeight: 6.5, eye: 1.6, horizon: 0.6154, aspect: 2 };
const map = new THREE.Texture();
/** The uniforms the material has, and the ones its shaders declare. */
const UNIFORMS = ['uMap', 'uColor', 'uBoxMin', 'uBoxMax', 'uOpening', 'uTime', 'uGlow', 'uVeil', 'uInverseModel'];

describe('the portal\'s room', () => {
  it('hangs the picture as the view says: its bottom at eye - horizon * pictureHeight, half as wide as pictureHeight * aspect', () => {
    const { depth, pictureHeight, eye, horizon, aspect } = VIEW;
    const u = portalMaterial({ map, width: 1.1, height: 2.25, depth, pictureHeight, eye, horizon, aspect, color: '#d9b26a' }).uniforms;
    const bottom = eye - horizon * pictureHeight;
    nearVec(u.uBoxMin.value, [-(pictureHeight * aspect) / 2, bottom, -depth], 'uBoxMin');
    nearVec(u.uBoxMax.value, [(pictureHeight * aspect) / 2, bottom + pictureHeight, 0], 'uBoxMax');
    assert.equal(u.uMap.value, map);
    assert.deepEqual([u.uOpening.value.x, u.uOpening.value.y], [1.1, 2.25]);
    assert.deepEqual([u.uTime.value, u.uGlow.value], [0, 0]);
  });

  it('is 2:1 when the aspect is left out', () => {
    const u = portalMaterial({ map, width: 1, height: 2, depth: 2.4, pictureHeight: 3, eye: 1.6, horizon: 0.56 }).uniforms;
    near(u.uBoxMax.value.x - u.uBoxMin.value.x, 6, 'width');
  });

  it('takes a view from views.json spread straight in, its image ignored', () => {
    const view = viewParams(VIEW);
    assert.ok(view);
    const spread = portalMaterial({ ...view, map, width: 1.1, height: 2.25, color: '#d9b26a' }).uniforms;
    const given = portalMaterial({ map, width: 1.1, height: 2.25, depth: 2.94, pictureHeight: 6.5, eye: 1.6, horizon: 0.6154, aspect: 2, color: '#d9b26a' }).uniforms;
    assert.deepEqual(spread.uBoxMin.value.toArray(), given.uBoxMin.value.toArray());
    assert.deepEqual(spread.uBoxMax.value.toArray(), given.uBoxMax.value.toArray());
  });
});

describe('the veil', () => {
  it('is drawn in the door\'s colour', () => {
    const u = portalMaterial({ map, width: 1.1, height: 2.25, ...VIEW, color: '#d9b26a' }).uniforms;
    assert.equal(u.uVeil.value, 1);
    assert.equal(u.uColor.value.getHexString(), new THREE.Color('#d9b26a').getHexString());
  });

  it('is off without a colour, for a plain window (uVeil 0)', () => {
    for (const color of [null, undefined]) {
      // The Hallway's end window: a far view of hills, no veil.
      const u = portalMaterial({ map, width: 1.6, height: 1.2, depth: 40, pictureHeight: 50, eye: 0.55, horizon: 0.3, color }).uniforms;
      assert.equal(u.uVeil.value, 0, String(color));
      assert.equal(u.uColor.value.getHex(), 0);
    }
  });
});

describe('a new picture', () => {
  it('with setPicture keeps the picture\'s height and takes the new one\'s aspect', () => {
    const material = portalMaterial({ map, width: 1.1, height: 2.25, ...VIEW });
    const u = material.uniforms;
    const [y0, y1, z0] = [u.uBoxMin.value.y, u.uBoxMax.value.y, u.uBoxMin.value.z];
    const preview = new THREE.Texture();
    setPicture(material, preview, 1.5);
    assert.equal(u.uMap.value, preview);
    assert.deepEqual([u.uBoxMin.value.y, u.uBoxMax.value.y, u.uBoxMin.value.z, u.uBoxMax.value.z], [y0, y1, z0, 0]);
    nearVec(u.uBoxMin.value, [-(6.5 * 1.5) / 2, y0, z0], 'uBoxMin');
    near(u.uBoxMax.value.x, (6.5 * 1.5) / 2, 'uBoxMax.x');
  });

  it('with setView hangs it in a new room', () => {
    // outside's door before its view loads, then the Hallway's view of it.
    const material = portalMaterial({ map, width: 1.1, height: 2.25, depth: 2.4, pictureHeight: 3, eye: 1.6, horizon: 0.56, color: '#9fd07a' });
    const u = material.uniforms;
    const view = new THREE.Texture();
    setView(material, view, VIEW);
    assert.equal(u.uMap.value, view);
    const bottom = 1.6 - 0.6154 * 6.5;
    nearVec(u.uBoxMin.value, [-6.5, bottom, -2.94], 'uBoxMin');
    nearVec(u.uBoxMax.value, [6.5, bottom + 6.5, 0], 'uBoxMax');
    setView(material, map, { depth: 1, pictureHeight: 2, eye: 1, horizon: 0.5 });
    nearVec(u.uBoxMin.value, [-2, 0, -1], 'uBoxMin, 2:1 by default');
    nearVec(u.uBoxMax.value, [2, 2, 0], 'uBoxMax, 2:1 by default');
    assert.deepEqual([u.uOpening.value.x, u.uOpening.value.y, u.uVeil.value], [1.1, 2.25, 1], 'the opening and the veil stay');
  });
});

describe('the opening', () => {
  it('is a quad with its origin at the middle of the sill, facing +z', () => {
    const g = openingGeometry(1.1, 2.25);
    g.computeBoundingBox();
    // Vertex positions are 32-bit floats.
    nearVec(g.boundingBox.min, [-0.55, 0, 0], 'min', 1e-6);
    nearVec(g.boundingBox.max, [0.55, 2.25, 0], 'max', 1e-6);
    const n = g.getAttribute('normal');
    assert.deepEqual([n.getX(0), n.getY(0), n.getZ(0)], [0, 0, 1]);
  });

  it('is placed in its own frame: placePortal inverts the mesh\'s world matrix, its parents\' moves included', () => {
    const parent = new THREE.Group();
    const mesh = new THREE.Mesh(openingGeometry(1.1, 2.25), portalMaterial({ map, width: 1.1, height: 2.25, ...VIEW, color: '#d9b26a' }));
    parent.add(mesh);
    parent.position.set(3, 0, -7);
    parent.rotation.y = Math.PI / 2;
    mesh.position.set(-1.6, 0, 0.4);
    mesh.rotation.y = -Math.PI / 3;
    mesh.scale.set(1, 1.2, 1);
    placePortal(mesh);
    const inverse = mesh.material.uniforms.uInverseModel.value;
    const product = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld).toArray();
    const identity = new THREE.Matrix4().toArray();
    product.forEach((v, i) => near(v, identity[i], `element ${i}`));
    // A point in front of the opening, seen from the room's frame.
    const eye = new THREE.Vector3(0, 1.6, 2).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
    nearVec(eye, [0, 1.6, 2], 'a point round the trip');
  });
});

describe('the shaders', () => {
  const m = portalMaterial({ map, width: 1, height: 2, ...VIEW });

  it('declare the material\'s uniforms, and only those', () => {
    const declared = [...`${m.vertexShader}\n${m.fragmentShader}`.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((x) => x[1]);
    assert.deepEqual([...new Set(declared)].sort(), [...UNIFORMS].sort());
    assert.deepEqual(Object.keys(m.uniforms).sort(), [...UNIFORMS].sort());
  });

  it('include only chunks this three has (colorspace_fragment: three r154 and later)', () => {
    const chunks = [...m.fragmentShader.matchAll(/#include <(\w+)>/g)].map((x) => x[1]);
    assert.deepEqual(chunks, ['tonemapping_fragment', 'colorspace_fragment']);
    for (const c of chunks) assert.equal(typeof THREE.ShaderChunk[c], 'string', c);
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(pkg.peerDependencies.three, '>=0.154.0');
  });

  it('draw the veil only when uVeil is on', () => {
    assert.match(m.fragmentShader, /if \(uVeil > 0\.0\) \{[^}]*uColor[^}]*\* uVeil;\s*\}/s);
  });
});
