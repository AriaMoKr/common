// The afternoon sky (src/sky.js), in Node with three and a stand-in canvas (test/canvas.js). The
// fixtures are outside's: its bake.js SUN_DIR, its sky.js skyColor at these points, and the
// fingerprint of the picture its skyTexture paints, all taken from outside's main.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { SKY_UV, SUN_DIR, skyColor, skyDome, skyMaterial, skyTexture } from '../src/sky.js';
import { recordingCanvas } from './canvas.js';

const DEG = Math.PI / 180;
const W = 2048, H = 1024;
const near = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} ≠ ${b}`);

/** SKY_UV in JS, line for line: u from the azimuth (0.5 down -z), v from the elevation (0.5 the horizon). */
const skyUv = ([x, y, z]) => {
  const l = Math.hypot(x, y, z);
  return [Math.atan2(x / l, -z / l) * 0.15915494 + 0.5, Math.asin(Math.min(1, Math.max(-1, y / l))) * 0.31830989 + 0.5];
};
/** Where a direction falls on the painted canvas: CanvasTexture flips it, so v = 1 is the canvas's top row. */
const onCanvas = (d, w = W, h = H) => {
  const [u, v] = skyUv(d);
  return [u * w, (1 - v) * h];
};
/** skyMaterial's turn, as its vertex shader does it: a world direction back into the garden's frame. */
const turnBack = ([x, y, z], yaw) => {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [c * x - s * z, y, s * x + c * z];
};
const paint = () => {
  const rec = recordingCanvas();
  return { ...rec, texture: skyTexture({ canvas: rec.canvas }) };
};

describe('the sun', () => {
  it('is outside\'s, low in the west', () => {
    assert.deepEqual([...SUN_DIR], [-0.7179210391214367, 0.42875839836419133, -0.5484119048844308]);
    near(Math.hypot(...SUN_DIR), 1, 'unit length');
    assert.ok(Object.isFrozen(SUN_DIR));
    near(Math.asin(SUN_DIR[1]) / DEG, 25.39, 'elevation, degrees', 0.01);
    near(Math.atan2(SUN_DIR[0], -SUN_DIR[2]) / DEG, -52.62, 'azimuth from -z toward +x, degrees', 0.01);
  });
});

describe('the sky\'s colour', () => {
  it('is outside\'s at chosen elevations and angles from the sun', () => {
    // [elevation in degrees, cosine from the sun, outside's skyColor]
    const OUTSIDE = [
      [-30, 0, [95, 107, 66]],
      [-1, 0.9, [164.31981481481483, 165.0588148148148, 129.45574074074074]],
      [-1, -0.5, [155.8148148148148, 165.8148148148148, 141.74074074074076]],
      [0, -1, [210.3, 213.7, 214.1]],
      [0, 1, [255, 208, 138]],
      [2, 0.5, [210.5415234979327, 211.4535039093223, 208.61777715580305]],
      [10, 0.99, [232.1857075892274, 205.36558563877557, 163.42629332318575]],
      [25, 1, [244.6029688673812, 204.3394647757644, 144.00394571940626]],
      [45, 0, [102.51929177927288, 143.57920958608204, 202.05256965790406]],
      [90, 0.43, [63.30342544365377, 109.15645374743636, 178.9352060322929]],
      [24.6, 1, [244.82028236109807, 204.44673181014912, 143.94758555828764]],
    ];
    // To 1e-12: V8 may round `**` a last bit differently once a function is optimised.
    for (const [el, toSun, rgb] of OUTSIDE) skyColor(el * DEG, toSun).forEach((v, i) => near(v, rgb[i], `${el}°, ${toSun}, ${'rgb'[i]}`, 1e-12 * 255));
  });

  it('is the ground far below the horizon, and the sun\'s gold at the horizon facing it', () => {
    assert.deepEqual(skyColor(-40 * DEG, 1), [95, 107, 66]);
    assert.deepEqual(skyColor(0, 1), [255, 208, 138]);
    // Away from the sun, the haze is cool, and the same whatever the angle behind.
    assert.deepEqual(skyColor(5 * DEG, -0.2), skyColor(5 * DEG, -0.9));
  });
});

describe('a direction in the picture (SKY_UV)', () => {
  it('is the GLSL the JS version here transcribes', () => {
    assert.equal(SKY_UV.trim(), [
      'vec2 skyUv(vec3 d) {',
      '  return vec2(atan(d.x, -d.z) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);',
      '}',
    ].join('\n'));
    near(0.15915494, 1 / (2 * Math.PI), '1 / 2π', 1e-8);
    near(0.31830989, 1 / Math.PI, '1 / π', 1e-8);
  });

  it('puts straight down the garden in the middle, the horizon half way up', () => {
    // To 1e-6: the GLSL's 1/2π and 1/π have 8 digits.
    const at = (d, [u, v], msg) => {
      const [U, V] = skyUv(d);
      if (u !== null) near(U, u, `${msg}: u`, 1e-6);
      near(V, v, `${msg}: v`, 1e-6);
    };
    at([0, 0, -1], [0.5, 0.5], 'down the garden');
    at([1, 0, 0], [0.75, 0.5], '+x');
    at([-1, 0, 0], [0.25, 0.5], '-x');
    at([0, 1, 0], [null, 1], 'straight up');
    at([0, -1, 0], [null, 0], 'straight down');
    at([0, 0.5, -0.5], [0.5, 0.75], '45° up');
    const back = skyUv([0, 0, 1])[0];
    assert.ok(Math.abs(back) < 1e-6 || Math.abs(back - 1) < 1e-6, 'straight back: the seam');
  });

  it('lands where the painter painted it: the sun', () => {
    const { log } = paint();
    // The sun's wide glow is the radial gradient from radius 0 to 220 on the big canvas.
    const sun = log.find((e) => e[0] === 0 && e[1] === 'radial' && e[5] === 0 && e[8] === 220);
    assert.ok(sun, 'the sun is painted');
    // To a thousandth of a pixel: the GLSL's constants have 8 digits, the painter's are exact.
    const [x, y] = onCanvas(SUN_DIR);
    near(sun[3], x, 'x', 1e-3);
    near(sun[4], y, 'y', 1e-3);
  });

  it('lands where the painter painted it: the gradient, pixel by pixel', () => {
    const { log, images } = paint();
    const small = log.find((e) => e[1] === 'canvas' && e[2] === 512);
    const img = images.get(small[0]);
    assert.deepEqual([img.width, img.height], [512, 256]);
    for (const [x, y] of [[0, 0], [255, 127], [256, 128], [100, 120], [511, 255], [400, 30], [37, 200]]) {
      // The direction the painter worked this pixel out for: its centre's azimuth and elevation.
      const az = ((x + 0.5) / 512 - 0.5) * 2 * Math.PI, el = (0.5 - (y + 0.5) / 256) * Math.PI;
      const d = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
      const [cx, cy] = onCanvas(d, 512, 256);
      near(cx, x + 0.5, `x of ${x},${y}`, 1e-4);
      near(cy, y + 0.5, `y of ${x},${y}`, 1e-4);
      const want = skyColor(el, d[0] * SUN_DIR[0] + d[1] * SUN_DIR[1] + d[2] * SUN_DIR[2]).map((v) => Math.min(255, Math.max(0, Math.round(v))));
      const k = (y * 512 + x) * 4;
      assert.deepEqual([...img.data.slice(k, k + 4)], [...want, 255], `pixel ${x},${y}`);
    }
  });
});

describe('the panorama', () => {
  it('is painted on the canvases it is given, 2048 × 1024 from a 512 × 256 gradient', () => {
    const { log, texture } = paint();
    assert.deepEqual(log.filter((e) => e[1] === 'canvas').map((e) => e.slice(2)), [[2048, 1024], [512, 256]]);
    assert.ok(texture instanceof THREE.CanvasTexture);
    assert.equal(texture.image.tag, 'canvas#0');
    assert.deepEqual([texture.colorSpace, texture.generateMipmaps, texture.minFilter, texture.wrapS], [THREE.SRGBColorSpace, false, THREE.LinearFilter, THREE.RepeatWrapping]);
  });

  it('is outside\'s picture, call for call, the same every time', () => {
    const fingerprint = () => {
      const { log, images } = paint();
      const round = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v);
      const h = createHash('sha256').update(JSON.stringify(log.filter((e) => e[1] !== 'canvas').map((e) => e.map(round))));
      for (const img of images.values()) h.update(img.data);
      return h.digest('hex');
    };
    // outside's skyTexture, painted the same way (its 6832 calls, sizes aside, and its gradient's pixels).
    assert.equal(fingerprint(), 'a0c22e13e52e5f2a90ab41ec6c05819ee452828e96942f4c7cd8568d00b6fa28');
  });

  it('paints on the page\'s canvas when given none', () => {
    const made = [];
    globalThis.document = { createElement: (kind) => {
      const c = recordingCanvas().canvas(0, 0);
      made.push([kind, c]);
      return c;
    } };
    try {
      skyTexture();
      assert.deepEqual(made.map(([kind, c]) => [kind, c.width, c.height]), [['canvas', 2048, 1024], ['canvas', 512, 256]]);
    } finally {
      delete globalThis.document;
    }
  });
});

describe('the dome', () => {
  it('is outside\'s: a sphere round the scene, drawn first, the picture by direction', () => {
    const map = new THREE.Texture();
    const dome = skyDome(map);
    assert.deepEqual([dome.name, dome.renderOrder, dome.frustumCulled], ['sky', -1, false]);
    assert.ok(dome.geometry instanceof THREE.SphereGeometry);
    assert.equal(dome.geometry.parameters.radius, 90);
    assert.deepEqual([dome.material.side, dome.material.depthWrite], [THREE.BackSide, false]);
    assert.equal(dome.material.uniforms.uMap.value, map);
    assert.ok(dome.material.fragmentShader.includes(SKY_UV));
    assert.match(dome.material.fragmentShader, /skyUv\(normalize\(vWorld - cameraPosition\)\)/);
  });
});

describe('the sky material', () => {
  const map = new THREE.Texture();

  it('shows the picture by the direction from the eye, at infinity, from world positions', () => {
    const m = skyMaterial(map);
    assert.equal(m.uniforms.uMap.value, map);
    assert.equal(m.uniforms.uYaw.value, 0);
    assert.ok(m.fragmentShader.includes(SKY_UV));
    assert.match(m.fragmentShader, /skyUv\(normalize\(vDir\)\)/);
    // World positions, not a frame per opening: merged glass works.
    assert.match(m.vertexShader, /vec4 w = modelMatrix \* vec4\(position, 1\.0\);/);
    assert.match(m.vertexShader, /vec3 d = w\.xyz - cameraPosition;/);
    // An opaque surface: drawn on its front, writing depth, as the glass it replaces.
    assert.deepEqual([m.side, m.depthWrite, m.transparent], [THREE.FrontSide, true, false]);
  });

  it('turns the panorama by yaw, as three.js turns an object', () => {
    assert.equal(skyMaterial(map, { yaw: 1.2 }).uniforms.uYaw.value, 1.2);
    assert.match(skyMaterial(map).vertexShader, /float c = cos\(uYaw\), s = sin\(uYaw\);\s*vDir = vec3\(c \* d\.x - s \* d\.z, d\.y, s \* d\.x \+ c \* d\.z\);/);
    const Y = new THREE.Vector3(0, 1, 0);
    for (const yaw of [0, 0.4, -1.3, Math.PI / 2, Math.PI, 2.9]) {
      // The garden's view down -z, turned as rotation.y = yaw turns it, is the middle of the picture again.
      const ahead = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y, yaw);
      near(ahead.x, -Math.sin(yaw), 'ahead.x');
      near(ahead.z, -Math.cos(yaw), 'ahead.z');
      skyUv(turnBack(ahead.toArray(), yaw)).forEach((v, i) => near(v, 0.5, `yaw ${yaw}, ${'uv'[i]}`));
      // And the sun, turned with it, is where it was painted.
      const sun = new THREE.Vector3(...SUN_DIR).applyAxisAngle(Y, yaw);
      onCanvas(turnBack(sun.toArray(), yaw)).forEach((v, i) => near(v, onCanvas(SUN_DIR)[i], `yaw ${yaw}, the sun`, 1e-6));
    }
  });
});

describe('the shaders', () => {
  const map = new THREE.Texture();
  for (const [name, material] of [['the dome', skyDome(map).material], ['the sky material', skyMaterial(map)]]) {
    it(`of ${name} declare only their uniforms, and include only chunks this three has`, () => {
      const declared = [...`${material.vertexShader}\n${material.fragmentShader}`.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)].map((x) => x[1]);
      assert.deepEqual([...new Set(declared)].sort(), Object.keys(material.uniforms).sort());
      const chunks = [...material.fragmentShader.matchAll(/#include <(\w+)>/g)].map((x) => x[1]);
      assert.deepEqual(chunks, ['tonemapping_fragment', 'colorspace_fragment']);
      for (const c of chunks) assert.equal(typeof THREE.ShaderChunk[c], 'string', c);
    });
  }
});
