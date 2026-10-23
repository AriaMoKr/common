/**
 * The sky's colour, before clouds, hills and the sun's disc are painted over it.
 * @param {number} el the elevation, radians: 0 at the horizon, + up
 * @param {number} toSun the cosine of the angle from the sun (a direction's dot product with SUN_DIR)
 * @returns {RGB} sRGB, 0 to 255, not rounded
 */
export function skyColor(el: number, toSun: number): RGB;
/**
 * The panorama, 2048 × 1024, equirectangular: u from -180° to 180° of azimuth with 0.5 straight
 * down the garden (-z), v from straight down to straight up with 0.5 at the horizon (SKY_UV). Every
 * page that paints it gets the same picture (its clouds and trees come from a fixed seed). Paint
 * it once and share it.
 * @param {object} [o]
 * @param {CanvasFactory} [o.canvas] makes the canvases it paints on: the page's by default
 * @returns {THREE.CanvasTexture} sRGB, repeating in u, without mipmaps
 */
export function skyTexture({ canvas }?: {
    canvas?: CanvasFactory | undefined;
}): THREE.CanvasTexture;
/**
 * The dome: a sphere around the scene (radius 90), drawn first, showing the picture by direction
 * from each eye. outside's, round its garden.
 * @param {THREE.Texture} map skyTexture()
 */
export function skyDome(map: THREE.Texture): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial, THREE.Object3DEventMap>;
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
export function skyMaterial(map: THREE.Texture, { yaw }?: {
    yaw?: number | undefined;
}): SkyMaterial;
/**
 * Toward the sun, a unit vector: low in the west, over the bench's right shoulder in outside's
 * garden, whose path runs down -z.
 * @type {readonly [number, number, number]}
 */
export const SUN_DIR: readonly [number, number, number];
/**
 * GLSL: where a direction falls in the picture (u: 0.5 straight down the garden, -z; v: 0.5 the
 * horizon), as `vec2 skyUv(vec3 d)`, for a site's own shader (outside's water reflects the sky).
 * @type {string}
 */
export const SKY_UV: string;
/**
 * The sky material's uniforms.
 */
export type SkyUniforms = {
    /**
     * the panorama (skyTexture)
     */
    uMap: {
        value: THREE.Texture;
    };
    /**
     * how far the panorama is turned, radians (skyMaterial's yaw)
     */
    uYaw: {
        value: number;
    };
};
export type SkyMaterial = THREE.ShaderMaterial & {
    uniforms: SkyUniforms;
};
/**
 * sRGB, 0 to 255, not rounded
 */
export type RGB = [number, number, number];
/**
 * A canvas for the painter: the page's, or a stand-in where there is none (Node).
 */
export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;
import * as THREE from 'three';
