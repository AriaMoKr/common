// An environment behind one of the Hallway's doors, in TypeScript (test/types.test.js compiles it). The
// lines marked as expected errors fail the compile if they are not, so the types must be real.

import { HALLWAY_URL, VISIT_PARAMS, doorLink, hallwayViews, keptWay, leaveUrl, readVisit, viewParams, wayBack, withoutVisit } from 'common/door.js';
import type { DoorPose, ViewParams, Visit, WayBack } from 'common/door.js';
import { NAV_DEFAULTS, NAV_KEY, loadNav, normalizeNav, saveNav } from 'common/nav.js';
import type { Nav } from 'common/nav.js';
import * as THREE from 'three';
import { openingGeometry, placePortal, portalMaterial, setPicture, setView } from 'common/portal.js';
import type { PortalMaterial, PortalView } from 'common/portal.js';
import { Fade } from 'common/fade.js';
import { BUTTON, BUTTONS, DEADZONE, firstPad, held, readPad, stick } from 'common/gamepad.js';
import type { PadState } from 'common/gamepad.js';

const visit: Visit = readVisit('?from=hallway&dx=0.12');
const dx: number | null = visit.dx;
const found: WayBack | null = wayBack('?from=hallway', 'breadboard', { origin: 'https://ariamokr.github.io', always: false });
const way: WayBack = found ?? keptWay(null) ?? { url: HALLWAY_URL, label: '← Hallway', title: '', name: 'Hallway', host: '', hallway: true };
const views: { views: string; id: string } | null = hallwayViews(way, 'breadboard');
const hung: ViewParams | null = viewParams({ image: 'breadboard.jpg' });
const pose: DoorPose = { across: 0, yaw: 0, pitch: 0 };
const link: string = doorLink({ id: 'garden', url: 'https://example.org/', color: '#7fc4a0' }, { here: HALLWAY_URL, hall: { doorWidth: 1.1, doorHeight: 2.25 }, pose });
const urls: string[] = [withoutVisit(link), leaveUrl(way, null), ...VISIT_PARAMS];

const nav: Nav = loadNav(null, { ...NAV_DEFAULTS, move: 'teleport' });
const kept: boolean = saveNav(nav, null);
const key: 'hallway.nav' = NAV_KEY;

// The doorway back, hung as the Hallway's view of the door says, the view spread straight in.
const map = new THREE.Texture();
const material: PortalMaterial = portalMaterial({ ...hung!, map, width: 1.1, height: 2.25, color: '#d9b26a' });
const portal = new THREE.Mesh(openingGeometry(1.1, 2.25), material);
placePortal(portal);
material.uniforms.uTime.value += 1 / 72;
material.uniforms.uGlow.value = 1;
const picture: THREE.Texture = material.uniforms.uMap.value;
setPicture(material, picture, 1.5);
const room: PortalView = { depth: 2.4, pictureHeight: 3, eye: 1.6, horizon: 0.56 };
setView(material, map, room);
const endWindow = portalMaterial({ ...room, map, width: 1.6, height: 1.2, color: null });

const fade = new Fade(new THREE.PerspectiveCamera(), 0);
fade.to(1, 0.3, () => location.assign(link));
fade.update(1 / 72);
fade.set(0);
const hide: THREE.Object3D[] = [fade.mesh];

const pad: Gamepad | null = firstPad(navigator.getGamepads());
const state: PadState | null = pad && readPad(pad);
const moved: { x: number; y: number } = stick(pad?.axes[0], pad?.axes[1], DEADZONE, { x: 0, y: 0 });
const using: boolean = pad ? held(pad, BUTTON.a) : false;
const first: 'a' = BUTTONS[0];

// @ts-expect-error uTime is a number
material.uniforms.uTime.value = 'now';
// @ts-expect-error setPicture needs the new picture's aspect
setPicture(material, map);
// @ts-expect-error a portal needs its opening's size
portalMaterial({ ...room, map });
// @ts-expect-error the fade's helpers are its own
fade._apply();
// @ts-expect-error BUTTONS stays as it is
BUTTONS.push('x');

// @ts-expect-error a place's door id is needed
wayBack('');
// @ts-expect-error the way back may be none
const sure: WayBack = wayBack('', 'breadboard');
// @ts-expect-error a move that isn't one
const fly: Nav = { move: 'fly', turn: 'snap' };
// @ts-expect-error the defaults stay as they are
NAV_DEFAULTS.move = 'teleport';
// @ts-expect-error a view's sizes are numbers
const depth: string = hung!.depth;

export { dx, views, urls, kept, key, sure, fly, depth, normalizeNav, endWindow, hide, state, moved, using, first };
