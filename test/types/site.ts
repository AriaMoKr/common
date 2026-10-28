// An environment behind one of the Hallway's doors, in TypeScript (test/types.test.js compiles it). The
// lines marked as expected errors fail the compile if they are not, so the types must be real.

import { HALLWAY_URL, VISIT_PARAMS, doorLink, hallLink, hallwayViews, keptWay, leaveUrl, readVisit, viewParams, wayBack, withoutVisit } from 'common/door.js';
import type { DoorPose, ViewParams, Visit, WayBack } from 'common/door.js';
import { NAV_DEFAULTS, NAV_KEY, loadNav, normalizeNav, saveNav } from 'common/nav.js';
import type { Nav } from 'common/nav.js';
import * as THREE from 'three';
import { openingGeometry, placePortal, portalMaterial, setPicture, setView } from 'common/portal.js';
import type { PortalMaterial, PortalView } from 'common/portal.js';
import { Fade } from 'common/fade.js';
import { BUTTON, BUTTONS, DEADZONE, firstPad, held, readPad, stick } from 'common/gamepad.js';
import type { PadState } from 'common/gamepad.js';
import { SKY_UV, SUN_DIR, skyColor, skyDome, skyMaterial, skyTexture } from 'common/sky.js';
import type { SkyMaterial } from 'common/sky.js';
import { ACCESS_DEFAULTS, ACCESS_KEY, Vignette, eyeLift, loadAccess, motionQuery, normalizeAccess, reduceMotion, saveAccess, watchMotion } from 'common/access.js';
import type { Access, VignetteMaterial } from 'common/access.js';
import { BackHistory } from 'common/back-history.js';
import type { BackHistoryOptions } from 'common/back-history.js';
import { Remote, SPARE_KEYS, focusStops, isTV, keepsKey, keyOf, nextStop, tvMode } from 'common/tv.js';
import type { RemoteOptions } from 'common/tv.js';

const visit: Visit = readVisit('?from=hallway&dx=0.12');
const dx: number | null = visit.dx;
const found: WayBack | null = wayBack('?from=hallway', 'breadboard', { origin: 'https://ariamokr.github.io', always: false });
const way: WayBack = found ?? keptWay(null) ?? { url: HALLWAY_URL, label: '← Hallway', title: '', name: 'Hallway', host: '', hallway: true };
const views: { views: string; id: string } | null = hallwayViews(way, 'breadboard');
const hung: ViewParams | null = viewParams({ image: 'breadboard.jpg' });
const pose: DoorPose = { across: 0, yaw: 0, pitch: 0 };
const link: string = doorLink({ id: 'garden', url: 'https://example.org/', color: '#7fc4a0' }, { here: HALLWAY_URL, hall: { doorWidth: 1.1, doorHeight: 2.25 }, pose });
const urls: string[] = [withoutVisit(link), leaveUrl(way, null), ...VISIT_PARAMS];
const onward: string = hallLink({ id: 'studio', url: 'https://example.org/' }, { here: 'https://example.org/art/', name: 'art', room: null });

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

// The afternoon sky: a dome, and the room's merged window glass looking out at it, turned.
const sky: THREE.CanvasTexture = skyTexture();
const dome: THREE.Mesh = skyDome(sky);
const glass: SkyMaterial = skyMaterial(sky, { yaw: Math.PI / 2 });
glass.uniforms.uYaw.value = 0;
const sunUp: number = SUN_DIR[1];
const [red]: [number, number, number] = skyColor(0, SUN_DIR[1]);
const reflects: string = `${SKY_UV}`;
skyTexture({ canvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }) });

// The visitor's accessibility settings: less motion, the comfort vignette, seated.
let access: Access = loadAccess();
const query = motionQuery();
let reduce: boolean = reduceMotion(access, query);
const stopWatching: () => void = watchMotion(() => { reduce = reduceMotion(access, query); }, query);
access = normalizeAccess({ ...access, motion: 'reduce' });
const kept2: boolean = saveAccess({ seated: true });
const vignette = new Vignette(new THREE.PerspectiveCamera(), access.vignette);
vignette.update(1 / 72, 1.8, 0, true);
const ring: VignetteMaterial = vignette.material;
const lift: number = eyeLift(access);
const accessKey: 'hallway.access' = ACCESS_KEY;

// The browser's Back for an open book: along the links followed, then the book put away.
const backOptions: BackHistoryOptions = { history, load: performance.timeOrigin, onBack: async (depth) => depth >= 0, onAway: () => {} };
const backHistory = new BackHistory({ ...backOptions, prefix: 'vrlbry' });
addEventListener('popstate', (e) => backHistory.popstate(e.state));
backHistory.bookOut();
backHistory.pushed(1);
const throughHistory: boolean = backHistory.back();
backHistory.cleared();
const bookLevel: number = backHistory.level;

// @ts-expect-error Back past the book's entry puts it away: the page says how
new BackHistory({ history, load: 1, onBack: () => true });
// @ts-expect-error its fields' prefix is a name
new BackHistory({ ...backOptions, prefix: 2 });
// @ts-expect-error its helpers are its own
backHistory._rewindTo(0);

// The TV app: the 10-foot view, the remote over the card and the view, and the app's Back and Menu.
const tv: boolean = tvMode() || isTV(navigator.userAgent) || tvMode({ search: '?tv=emulate' });
document.documentElement.classList.toggle('tv', tv);
let reading = true;
const remoteOptions: RemoteOptions = {
  root: document.body,
  view: document.createElement('canvas'),
  use: () => {},
  // A book with its entry in the page's history is the app's back; a text view open is a step.
  step: () => backHistory.level === 0 && reading && !(reading = false),
  // While reading, Menu goes to the book's buttons.
  first: () => (reading ? document.querySelector('.book-buttons') : null),
};
const remote = new Remote(remoteOptions);
remote.onMode = (inCard) => document.body.classList.toggle('in-card', inCard);
const answering: boolean = remote.answerApp(tv);
const stepped: boolean = remote.back();
const intoCard: true = remote.menu();
const inCard: boolean = remote.inCard;
// The book opened: Menu goes to its buttons next, not to the control left in the card.
remote.forget();
addEventListener('keydown', (e) => {
  const named: string = keyOf(e);
  const kept: boolean = keepsKey(document.activeElement, named);
  if (!kept && named === SPARE_KEYS.ChannelUp) remote.padBack();
});
const stops: number[] = focusStops([{ radio: '' }, { radio: 'nav-move', checked: true }]);
const next: number = nextStop(stops.length, -1, 1);

// @ts-expect-error the step says whether it took one
new Remote({ ...remoteOptions, step: () => {} });
// @ts-expect-error Menu's first stop is an element
new Remote({ ...remoteOptions, first: () => 'book' });
// @ts-expect-error OK while walking is the site's
new Remote({ root: document.body, view: remoteOptions.view });
// @ts-expect-error the spare keys stay as they are
SPARE_KEYS.ChannelUp = 'ArrowDown';
// @ts-expect-error its stops are its own
remote._stops();
// @ts-expect-error an address's search, not the whole of it
tvMode({ search: new URLSearchParams() });

// @ts-expect-error motion is one of three
const sometimes: Access = { ...ACCESS_DEFAULTS, motion: 'sometimes' };
// @ts-expect-error the vignette moves on with the speed, the turning and whether in VR
vignette.update(1 / 72, 1.8);

// @ts-expect-error the sun stays where it is
SUN_DIR[0] = 0;
// @ts-expect-error the panorama's turn is a number
skyMaterial(sky, { yaw: 'west' });
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

export { dx, views, urls, onward, kept, key, sure, fly, depth, normalizeNav, endWindow, hide, state, moved, using, first, dome, glass, sunUp, red, reflects, reduce, stopWatching, kept2, ring, lift, accessKey, sometimes, throughHistory, bookLevel, answering, stepped, intoCard, inCard, next };
