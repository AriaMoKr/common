// A doorway's material: a flat quad in the opening that shows a room behind it, made from one
// picture. The picture is the room's far wall, and its edges are stretched back to the opening as
// the floor, ceiling and side walls ("interior mapping"). Each eye sees it from its own position,
// so it has parallax and, in a headset, depth. In front of it drift a veil and a glow along the
// frame, brighter when pointed at; without a colour there is no veil, for a plain window (the
// Hallway's end window). The Hallway's (its public/js/portal.js), as outside has it, with setView
// for the views the Hallway publishes (door.js viewParams; README, "The view from your door").

import * as THREE from 'three';

const vertexShader = /* glsl */ `
uniform mat4 uInverseModel;
varying vec3 vLocal;
varying vec3 vEye;
void main() {
  vLocal = position;
  vEye = (uInverseModel * vec4(cameraPosition, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform vec3 uBoxMin;   // the room behind the opening, in the opening's frame (origin at the
uniform vec3 uBoxMax;   // middle of its sill, facing +z): the picture hangs at z = uBoxMin.z
uniform vec2 uOpening;  // the opening's width and height
uniform float uTime;
uniform float uGlow;    // 0 idle, 1 pointed at
uniform float uVeil;    // 0: a plain window
varying vec3 vLocal;
varying vec3 vEye;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float safe(float v) { return abs(v) < 1e-5 ? (v < 0.0 ? -1e-5 : 1e-5) : v; }

void main() {
  // Follow the ray from the eye through this point until it leaves the room.
  vec3 dir = vLocal - vEye;
  vec3 inv = vec3(1.0 / safe(dir.x), 1.0 / safe(dir.y), 1.0 / safe(dir.z));
  vec3 exits = max((uBoxMin - vLocal) * inv, (uBoxMax - vLocal) * inv);
  float t = min(min(exits.x, exits.y), exits.z);
  vec3 hit = vLocal + dir * t;
  vec2 uv = clamp((hit.xy - uBoxMin.xy) / (uBoxMax.xy - uBoxMin.xy), 0.002, 0.998);
  // The stretched edges (floor, ceiling, sides) a little darker than the picture itself.
  float back = step(exits.z, min(exits.x, exits.y));
  vec3 col = texture2D(uMap, uv).rgb * mix(0.78, 1.0, back);
  if (uVeil > 0.0) {
    float n = noise(vLocal.xy * vec2(3.0, 2.0) + vec2(0.0, uTime * 0.35)) * 0.6
            + noise(vLocal.xy * 7.0 - vec2(uTime * 0.25, 0.0)) * 0.4;
    float d = max(min(uOpening.x * 0.5 - abs(vLocal.x), uOpening.y - vLocal.y), 0.0);
    float rim = exp(-d / 0.11) * (0.75 + 0.25 * n);
    float mist = (0.05 + 0.10 * uGlow) * n * n;
    col = col * (0.95 + 0.3 * uGlow) + uColor * (mist + rim * (0.5 + 0.9 * uGlow)) * uVeil;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The material's uniforms. A site sets uTime (seconds, for the veil's drift) and uGlow (0 idle, 1
 * pointed at) each frame, and may read uMap (the picture hung now); the rest are set by
 * portalMaterial, setPicture, setView and placePortal.
 * @typedef {object} PortalUniforms
 * @property {{ value: THREE.Texture }} uMap the picture
 * @property {{ value: THREE.Color }} uColor the veil's and the glow's colour
 * @property {{ value: THREE.Vector3 }} uBoxMin the room behind the opening, in the opening's frame
 *   (origin at the middle of its sill, facing +z): the picture hangs at z = uBoxMin.z
 * @property {{ value: THREE.Vector3 }} uBoxMax the room's other corner, at the opening (z = 0)
 * @property {{ value: THREE.Vector2 }} uOpening the opening's width and height
 * @property {{ value: number }} uTime seconds, for the veil's drift
 * @property {{ value: number }} uGlow 0 idle, 1 pointed at
 * @property {{ value: number }} uVeil 1 with a veil, 0 for a plain window
 * @property {{ value: THREE.Matrix4 }} uInverseModel the mesh's world matrix, inverted (placePortal)
 */

/** @typedef {THREE.ShaderMaterial & { uniforms: PortalUniforms }} PortalMaterial */

/**
 * How a picture is hung behind the opening: the fields of door.js's viewParams (a view the Hallway
 * publishes), so a view can be passed straight in. Metres, but `horizon` (a fraction of the
 * picture's height from its bottom) and `aspect` (its width over its height).
 * @typedef {object} PortalView
 * @property {number} depth how far behind the opening the picture hangs
 * @property {number} pictureHeight the picture's height (its width follows its aspect)
 * @property {number} eye the height above the sill the picture's horizon is put at
 * @property {number} horizon where its horizon is, as a fraction of its height from the bottom
 * @property {number} [aspect] its width over its height: 2 when left out
 */

/**
 * The material for an opening `width` by `height`, showing `map` hung as the view fields say.
 * @param {PortalView & { map: THREE.Texture, width: number, height: number, color?: THREE.ColorRepresentation | null }} o
 *   `color` is the veil's and the glow's; none (null) for a plain window. Other fields, such as a
 *   view's `image`, are ignored.
 * @returns {PortalMaterial}
 */
export function portalMaterial({ map, width, height, depth, pictureHeight, eye, horizon, aspect = 2, color = null }) {
  const material = /** @type {PortalMaterial} */ (new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uColor: { value: new THREE.Color(color || '#000000') },
      uBoxMin: { value: new THREE.Vector3() },
      uBoxMax: { value: new THREE.Vector3() },
      uOpening: { value: new THREE.Vector2(width, height) },
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uVeil: { value: color ? 1 : 0 },
      uInverseModel: { value: new THREE.Matrix4() },
    },
    vertexShader,
    fragmentShader,
  }));
  setView(material, map, { depth, pictureHeight, eye, horizon, aspect });
  return material;
}

/**
 * The room's width from its height and the picture's aspect, centred on the opening.
 * @param {PortalMaterial} material
 * @param {number} aspect
 */
function setAspect(material, aspect) {
  const u = material.uniforms;
  const half = ((u.uBoxMax.value.y - u.uBoxMin.value.y) * aspect) / 2;
  u.uBoxMin.value.x = -half;
  u.uBoxMax.value.x = half;
}

/**
 * The quad for an opening, its origin at the middle of the sill, facing +z.
 * @param {number} width
 * @param {number} height
 */
export function openingGeometry(width, height) {
  return new THREE.PlaneGeometry(width, height).translate(0, height / 2, 0);
}

/**
 * Call once the mesh is placed, and again whenever it moves: the shader works in the opening's
 * own frame.
 * @param {THREE.Mesh<THREE.BufferGeometry, PortalMaterial>} mesh
 */
export function placePortal(mesh) {
  mesh.updateWorldMatrix(true, false);
  mesh.material.uniforms.uInverseModel.value.copy(mesh.matrixWorld).invert();
}

/**
 * Swaps the picture, keeping its height and taking the new one's aspect (the Hallway's door
 * previews, once loaded).
 * @param {PortalMaterial} material
 * @param {THREE.Texture} map
 * @param {number} aspect the new picture's width over its height
 */
export function setPicture(material, map, aspect) {
  material.uniforms.uMap.value = map;
  setAspect(material, aspect);
}

/**
 * Swaps the picture for one hung its own way, a new room behind the opening (as the Hallway's
 * views.json gives them for the view from a door): `depth` behind the opening, `pictureHeight`
 * tall, its horizon `eye` above the sill and at `horizon` of its height, `aspect` times as wide.
 * @param {PortalMaterial} material
 * @param {THREE.Texture} map
 * @param {PortalView} view
 */
export function setView(material, map, { depth, pictureHeight, eye, horizon, aspect = 2 }) {
  const u = material.uniforms;
  const bottom = eye - horizon * pictureHeight;
  u.uBoxMin.value.set(0, bottom, -depth);
  u.uBoxMax.value.set(0, bottom + pictureHeight, 0);
  u.uMap.value = map;
  setAspect(material, aspect);
}
