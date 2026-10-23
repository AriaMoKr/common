// The sky of a late afternoon, the one outside's garden is under: painted once into an
// equirectangular picture (the gradient warming toward the low sun in the west, haze, far hills
// and a line of trees at the horizon, a few clouds lit gold on their sunny sides, the sun), and
// shown by direction, so each eye sees it at infinity: on a dome round a scene (skyDome), or on any
// surface that looks out at the far distance, such as a window's glass or a skylight (skyMaterial).
// Water can reflect the same picture, looked up the same way (SKY_UV). outside's (its
// public/js/sky.js and bake.js's SUN_DIR), so every window behind every door shows one afternoon.

import * as THREE from 'three';

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {[number, number, number]}
 */
const normalize = (x, y, z) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};

/**
 * Toward the sun, a unit vector: low in the west, over the bench's right shoulder in outside's
 * garden, whose path runs down -z.
 * @type {readonly [number, number, number]}
 */
export const SUN_DIR = Object.freeze(normalize(-0.72, 0.43, -0.55));

/**
 * GLSL: where a direction falls in the picture (u: 0.5 straight down the garden, -z; v: 0.5 the
 * horizon), as `vec2 skyUv(vec3 d)`, for a site's own shader (outside's water reflects the sky).
 * @type {string}
 */
export const SKY_UV = /* glsl */ `
vec2 skyUv(vec3 d) {
  return vec2(atan(d.x, -d.z) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
}`;

/** The picture's pixel at a direction (azimuth from -z toward +x, elevation), for painting. */
const W = 2048, H = 1024;
/** @param {number} az */
const px = (az) => (az / (2 * Math.PI) + 0.5) * W;
/** @param {number} el */
const py = (el) => (0.5 - el / Math.PI) * H;
const SUN_AZ = Math.atan2(SUN_DIR[0], -SUN_DIR[2]);
const SUN_EL = Math.asin(SUN_DIR[1]);
const DEG = Math.PI / 180;

/** @typedef {[number, number, number]} RGB sRGB, 0 to 255, not rounded */

/**
 * @param {RGB} a
 * @param {RGB} b
 * @param {number} t
 * @returns {RGB}
 */
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/**
 * @param {number} a
 * @param {number} b
 * @param {number} v
 */
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/**
 * @param {string} h '#rrggbb'
 * @returns {RGB}
 */
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const ZENITH = hex('#3f6db3'), HIGH = hex('#6f97cf'), LOW = hex('#b9cde3'), HORIZON = hex('#e8dcc6');
const SUNNY = hex('#ffd08a'), WARM_HAZE = hex('#f6cf9c'), COOL_HAZE = hex('#c9d3dd');
const FAR_GROUND = hex('#8c9672'), NEAR_GROUND = hex('#5f6b42');

/**
 * The sky's colour, before clouds, hills and the sun's disc are painted over it.
 * @param {number} el the elevation, radians: 0 at the horizon, + up
 * @param {number} toSun the cosine of the angle from the sun (a direction's dot product with SUN_DIR)
 * @returns {RGB} sRGB, 0 to 255, not rounded
 */
export function skyColor(el, toSun) {
  const sunny = Math.max(0, toSun);
  if (el < 0) {
    const haze = mix(COOL_HAZE, WARM_HAZE, sunny ** 3);
    return mix(mix(haze, FAR_GROUND, smooth(0, 1.5 * DEG, -el)), NEAR_GROUND, smooth(2 * DEG, 25 * DEG, -el));
  }
  const k = Math.sqrt(el / (Math.PI / 2));
  let c = mix(HORIZON, LOW, smooth(0, 0.3, k));
  c = mix(c, HIGH, smooth(0.25, 0.65, k));
  c = mix(c, ZENITH, smooth(0.6, 1, k));
  // Haze along the horizon, warm toward the sun and cooler away from it.
  const haze = Math.exp(-el / (4 * DEG));
  c = mix(c, mix(COOL_HAZE, WARM_HAZE, sunny ** 2), haze * 0.7);
  // The sun's glow: wide and soft, then close and bright.
  const glow = sunny ** 6 * 0.5 * (1 - 0.5 * k) + sunny ** 60 * 0.55;
  return mix(c, SUNNY, Math.min(1, glow));
}

/**
 * The far hills, two ranges, and a line of trees: their tops' elevation at an azimuth (periodic,
 * so they meet round the back).
 * @param {number} az
 * @param {number[][]} terms
 */
const ridge = (az, terms) => terms.reduce((s, [n, a, p]) => s + a * Math.sin(n * az + p), 0);
const FAR_HILLS = [[2, 0.7, 0.4], [3, 0.5, 1.9], [5, 0.35, 2.7], [8, 0.18, 0.2], [13, 0.08, 1.1]];
const NEAR_HILLS = [[1, 0.6, 2.2], [4, 0.45, 0.3], [6, 0.3, 1.4], [11, 0.12, 2.0]];

/**
 * A canvas for the painter: the page's, or a stand-in where there is none (Node).
 * @callback CanvasFactory
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */

/** @type {CanvasFactory} */
const pageCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * A seeded random number generator (mulberry32), as outside's and the hallway's.
 * @param {number} seed
 */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The panorama, 2048 × 1024, equirectangular: u from -180° to 180° of azimuth with 0.5 straight
 * down the garden (-z), v from straight down to straight up with 0.5 at the horizon (SKY_UV). Every
 * page that paints it gets the same picture (its clouds and trees come from a fixed seed). Paint
 * it once and share it.
 * @param {object} [o]
 * @param {CanvasFactory} [o.canvas] makes the canvases it paints on: the page's by default
 * @returns {THREE.CanvasTexture} sRGB, repeating in u, without mipmaps
 */
export function skyTexture({ canvas = pageCanvas } = {}) {
  const c = canvas(W, H), g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')), r = rng(81);
  // The gradient, worked out per pixel at a quarter of the size, then scaled up (it is smooth).
  const w = 512, h = 256;
  const small = canvas(w, h), sg = /** @type {CanvasRenderingContext2D} */ (small.getContext('2d'));
  const img = sg.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const el = (0.5 - (y + 0.5) / h) * Math.PI;
    for (let x = 0; x < w; x++) {
      const az = ((x + 0.5) / w - 0.5) * 2 * Math.PI;
      const dx = Math.sin(az) * Math.cos(el), dy = Math.sin(el), dz = -Math.cos(az) * Math.cos(el);
      const col = skyColor(el, dx * SUN_DIR[0] + dy * SUN_DIR[1] + dz * SUN_DIR[2]);
      const k = (y * w + x) * 4;
      img.data[k] = col[0];
      img.data[k + 1] = col[1];
      img.data[k + 2] = col[2];
      img.data[k + 3] = 255;
    }
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(small, 0, 0, W, H);

  // Clouds: soft heaps of puffs, lit gold toward the sun, rosy grey away from it.
  for (let k = 0; k < 16; k++) {
    let az = (r() - 0.5) * 2 * Math.PI;
    if (k < 6) az = SUN_AZ + (r() - 0.5) * 1.4; // more of them about the sun
    const el = (7 + r() * 26) * DEG;
    if (Math.abs(az - SUN_AZ) < 0.12 && Math.abs(el - SUN_EL) < 0.1) continue;
    const size = (28 + r() * 46) * (1 - el / (Math.PI / 2)) * 1.2;
    const puffs = 6 + Math.floor(r() * 9);
    const toSun = Math.cos(el) * Math.cos(SUN_EL) * Math.cos(az - SUN_AZ) + Math.sin(el) * Math.sin(SUN_EL);
    const lit = Math.max(0, toSun);
    for (let p = 0; p < puffs; p++) {
      const ox = (r() - 0.5) * size * 3.2, oy = (r() - 0.5) * size * 0.55;
      const pr = size * (0.35 + 0.4 * r());
      const cx = px(az) + ox, cy = py(el) + oy;
      // Toward the sun's side of the puff, the lit edge.
      const sx = Math.sign(SUN_AZ - az) * pr * 0.3, sy = el > SUN_EL ? pr * 0.25 : -pr * 0.25;
      for (const shift of [-W, 0, W]) {
        // White, a soft grey underneath, warmed toward gold only on the side toward the sun.
        const grad = g.createRadialGradient(cx + shift + sx, cy + sy, pr * 0.1, cx + shift, cy, pr);
        grad.addColorStop(0, `rgba(255,${Math.round(252 - 14 * lit)},${Math.round(246 - 40 * lit)},0.82)`);
        grad.addColorStop(0.6, `rgba(${Math.round(238 + 10 * lit)},${Math.round(236 - 4 * lit)},${Math.round(238 - 20 * lit)},0.55)`);
        grad.addColorStop(0.85, 'rgba(225,222,228,0.2)');
        grad.addColorStop(1, 'rgba(220,220,228,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(cx + shift, cy, pr * 1.5, pr * 0.62, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // The sun: a bright disc in a close glow, in a wide one.
  const sx = px(SUN_AZ), sy = py(SUN_EL);
  for (const [rad, inner, outer] of /** @type {[number, string, string][]} */ ([[220, 'rgba(255,220,160,0.28)', 'rgba(255,210,150,0)'], [46, 'rgba(255,240,205,0.85)', 'rgba(255,226,170,0)'], [7, 'rgba(255,253,240,1)', 'rgba(255,248,225,0.9)']])) {
    const grad = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(sx, sy, rad * 1.1, rad, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Far hills, blue in the haze, washed warm toward the sun; then nearer ones; then trees.
  /**
   * @param {number[][]} terms
   * @param {number} base
   * @param {number} amp
   * @param {[string, string]} colors
   */
  const range = (terms, base, amp, colors) => {
    const grad = g.createLinearGradient(0, 0, W, 0);
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, az = (u - 0.5) * 2 * Math.PI;
      const sunny = Math.max(0, Math.cos(az - SUN_AZ)) ** 4;
      const col = mix(hex(colors[0]), hex(colors[1]), sunny);
      grad.addColorStop(u, `rgb(${col.map(Math.round).join(',')})`);
    }
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, py(-2 * DEG));
    for (let x = 0; x <= W; x += 4) {
      const az = (x / W - 0.5) * 2 * Math.PI;
      g.lineTo(x, py((base + amp * ridge(az, terms)) * DEG));
    }
    g.lineTo(W, py(-2 * DEG));
    g.closePath();
    g.fill();
  };
  range(FAR_HILLS, 2.2, 1.5, ['#a3afc0', '#e3cdb2']);
  range(NEAR_HILLS, 1.1, 1.0, ['#7f9184', '#c9b996']);
  // Trees all round: rounded crowns along the horizon, hazy green.
  for (let x = -20; x < W + 20; x += 3 + r() * 5) {
    const az = (x / W - 0.5) * 2 * Math.PI;
    const sunny = Math.max(0, Math.cos(az - SUN_AZ)) ** 4;
    const top = (0.5 + 1.2 * r() + 0.4 * Math.sin(az * 7)) * DEG;
    const rad = (py(0) - py(top)) * (0.7 + 0.4 * r());
    const col = mix(hex('#56654a'), hex('#a39a78'), sunny * 0.7);
    g.fillStyle = `rgb(${col.map((v) => Math.round(v * (0.9 + 0.2 * r()))).join(',')})`;
    g.beginPath();
    g.ellipse(x, py(0) - rad * 0.4, rad * (0.9 + 0.5 * r()), rad, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Below the horizon, the ground fading off; mostly hidden by the garden's own.
  const ground = g.createLinearGradient(0, py(0), 0, H);
  ground.addColorStop(0, '#7d8a5e');
  ground.addColorStop(0.15, '#69764a');
  ground.addColorStop(1, '#4a5534');
  g.fillStyle = ground;
  g.fillRect(0, py(0) + 1, W, H - py(0));

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // No mipmaps: the picture is never much smaller on screen, and the seam where u wraps stays clean.
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/**
 * The dome: a sphere around the scene (radius 90), drawn first, showing the picture by direction
 * from each eye. outside's, round its garden.
 * @param {THREE.Texture} map skyTexture()
 */
export function skyDome(map) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vWorld;
      ${SKY_UV}
      void main() {
        gl_FragColor = vec4(texture2D(uMap, skyUv(normalize(vWorld - cameraPosition))).rgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), material);
  mesh.name = 'sky';
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * The sky material's uniforms.
 * @typedef {object} SkyUniforms
 * @property {{ value: THREE.Texture }} uMap the panorama (skyTexture)
 * @property {{ value: number }} uYaw how far the panorama is turned, radians (skyMaterial's yaw)
 */

/** @typedef {THREE.ShaderMaterial & { uniforms: SkyUniforms }} SkyMaterial */

/**
 * A material for any surface that looks out at the far distance, such as a window's glass or a
 * skylight: it shows the panorama by the direction from each eye to the surface, so the sky is at
 * infinity and moves as the far distance does, with no frame per opening. It works on merged
 * geometry (all of a room's window glass in one mesh), since it uses world positions.
 * @param {THREE.Texture} map skyTexture()
 * @param {object} [o]
 * @param {number} [o.yaw] turns the panorama about the vertical, radians, as three.js turns an
 *   object (rotation.y): the garden's view down -z is then seen looking toward
 *   (-sin yaw, 0, -cos yaw). 0 by default, for a room laid out as the garden is.
 * @returns {SkyMaterial}
 */
export function skyMaterial(map, { yaw = 0 } = {}) {
  return /** @type {SkyMaterial} */ (new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uYaw: { value: yaw } },
    vertexShader: /* glsl */ `
      uniform float uYaw;
      varying vec3 vDir;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        // From the eye to here, turned back by the yaw into the garden's frame (linear, so it can
        // be done here and interpolated).
        vec3 d = w.xyz - cameraPosition;
        float c = cos(uYaw), s = sin(uYaw);
        vDir = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vDir;
      ${SKY_UV}
      void main() {
        gl_FragColor = vec4(texture2D(uMap, skyUv(normalize(vDir))).rgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
}
