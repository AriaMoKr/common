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
export function portalMaterial({ map, width, height, depth, pictureHeight, eye, horizon, aspect, color }: PortalView & {
    map: THREE.Texture;
    width: number;
    height: number;
    color?: THREE.ColorRepresentation | null;
}): PortalMaterial;
/**
 * The quad for an opening, its origin at the middle of the sill, facing +z.
 * @param {number} width
 * @param {number} height
 */
export function openingGeometry(width: number, height: number): THREE.PlaneGeometry;
/**
 * Call once the mesh is placed, and again whenever it moves: the shader works in the opening's
 * own frame.
 * @param {THREE.Mesh<THREE.BufferGeometry, PortalMaterial>} mesh
 */
export function placePortal(mesh: THREE.Mesh<THREE.BufferGeometry, PortalMaterial>): void;
/**
 * Swaps the picture, keeping its height and taking the new one's aspect (the Hallway's door
 * previews, once loaded).
 * @param {PortalMaterial} material
 * @param {THREE.Texture} map
 * @param {number} aspect the new picture's width over its height
 */
export function setPicture(material: PortalMaterial, map: THREE.Texture, aspect: number): void;
/**
 * Swaps the picture for one hung its own way, a new room behind the opening (as the Hallway's
 * views.json gives them for the view from a door): `depth` behind the opening, `pictureHeight`
 * tall, its horizon `eye` above the sill and at `horizon` of its height, `aspect` times as wide.
 * @param {PortalMaterial} material
 * @param {THREE.Texture} map
 * @param {PortalView} view
 */
export function setView(material: PortalMaterial, map: THREE.Texture, { depth, pictureHeight, eye, horizon, aspect }: PortalView): void;
/**
 * The material's uniforms. A site sets uTime (seconds, for the veil's drift) and uGlow (0 idle, 1
 * pointed at) each frame, and may read uMap (the picture hung now); the rest are set by
 * portalMaterial, setPicture, setView and placePortal.
 */
export type PortalUniforms = {
    /**
     * the picture
     */
    uMap: {
        value: THREE.Texture;
    };
    /**
     * the veil's and the glow's colour
     */
    uColor: {
        value: THREE.Color;
    };
    /**
     * the room behind the opening, in the opening's frame
     * (origin at the middle of its sill, facing +z): the picture hangs at z = uBoxMin.z
     */
    uBoxMin: {
        value: THREE.Vector3;
    };
    /**
     * the room's other corner, at the opening (z = 0)
     */
    uBoxMax: {
        value: THREE.Vector3;
    };
    /**
     * the opening's width and height
     */
    uOpening: {
        value: THREE.Vector2;
    };
    /**
     * seconds, for the veil's drift
     */
    uTime: {
        value: number;
    };
    /**
     * 0 idle, 1 pointed at
     */
    uGlow: {
        value: number;
    };
    /**
     * 1 with a veil, 0 for a plain window
     */
    uVeil: {
        value: number;
    };
    /**
     * the mesh's world matrix, inverted (placePortal)
     */
    uInverseModel: {
        value: THREE.Matrix4;
    };
};
export type PortalMaterial = THREE.ShaderMaterial & {
    uniforms: PortalUniforms;
};
/**
 * How a picture is hung behind the opening: the fields of door.js's viewParams (a view the Hallway
 * publishes), so a view can be passed straight in. Metres, but `horizon` (a fraction of the
 * picture's height from its bottom) and `aspect` (its width over its height).
 */
export type PortalView = {
    /**
     * how far behind the opening the picture hangs
     */
    depth: number;
    /**
     * the picture's height (its width follows its aspect)
     */
    pictureHeight: number;
    /**
     * the height above the sill the picture's horizon is put at
     */
    eye: number;
    /**
     * where its horizon is, as a fraction of its height from the bottom
     */
    horizon: number;
    /**
     * its width over its height: 2 when left out
     */
    aspect?: number | undefined;
};
import * as THREE from 'three';
