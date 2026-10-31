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
import { Controls, KEYS } from 'common/controls.js';
import type { ControlsOptions, Hand, Hit, How, KeyAction, PadPress } from 'common/controls.js';
import { Label, Panel, UI, wrapText } from 'common/panel.js';
import type { ButtonElement, Control, CustomElement, ListElement, ListItem, PanelElement, PanelOptions } from 'common/panel.js';
import { TEXT_VIEW_CSS, TextView } from 'common/text-view.js';
import type { ContentsEntry, RenderedPart, TextViewOptions } from 'common/text-view.js';

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

// Walking about the room: the site's own Controls, its room in its own fields and methods, its hits
// with the picture pointed at.
interface RoomHit extends Hit {
  piece: number;
}
const blankHit = (): RoomHit => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, walkable: false, piece: -1 });

class RoomControls extends Controls<RoomHit> {
  hoverPiece = -1;
  onPiece: (i: number, how: How) => void = () => {};
  reading = false;
  readonly size: number;

  constructor(options: ControlsOptions<RoomHit>, size: number) {
    super({ ...options, hit: blankHit });
    this.size = size;
  }

  castRay(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, out: RoomHit): RoomHit | null {
    if (dy >= 0) return null;
    const t = -oy / dy, x = ox + dx * t, z = oz + dz * t;
    Object.assign(out, { t, kind: 'floor', x, y: 0, z, nx: 0, ny: 1, nz: 0, walkable: Math.abs(x) < this.size && Math.abs(z) < this.size, piece: -1 });
    return out;
  }

  clampWalk(_fx: number, _fz: number, x: number, z: number, out: { x: number; z: number }) {
    out.x = Math.max(-this.size, Math.min(this.size, x));
    out.z = Math.max(-this.size, Math.min(this.size, z));
    return out;
  }

  usable(hit: RoomHit | null): string | null {
    return hit && hit.piece >= 0 ? 'piece' : super.usable(hit);
  }

  use(hit: RoomHit | null, how: How): void {
    if (hit && hit.piece >= 0) this.onPiece(hit.piece, how);
    else super.use(hit, how);
  }

  protected _setHover(usable: string | null, hit: RoomHit | null): void {
    super._setHover(usable, hit);
    this.hoverPiece = usable === 'piece' && hit ? hit.piece : -1;
  }

  walkInto(): void {
    this._startWalk([[0, -1], [0, 0.3]], Math.PI);
  }

  walkThrough(side: number): void {
    // Facing the door from the first step: the view is handed on before the walk ends.
    this._startWalk([[side * 0.75, -2], [side * 1.9, -2]], (-side * Math.PI) / 2, null, false);
  }

  walkUpTo(i: number, done: (() => void) | null = null): void {
    if (this.renderer.xr.isPresenting) this._teleport(i, -2);
    else this._startWalk([[i, -2]], 0, done);
  }

  takeKey(e: KeyboardEvent, name: string): boolean {
    if (name !== 'Home') return false;
    e.preventDefault();
    this.setPose(0, 0, 0);
    return true;
  }

  takePad(pad: Gamepad, _dt: number, press: PadPress): boolean {
    if (!this.reading || !press.back) return pad.buttons[4]?.pressed ?? false;
    press.back = false;
    this.reading = false;
    return true;
  }

  takeHand(hand: Hand<RoomHit>, _pad: Gamepad, ax: number, _ay: number, _dt: number): boolean {
    return this.reading && hand.source?.handedness === 'right' && Math.abs(ax) > 0.6;
  }
}

const renderer = new THREE.WebGLRenderer();
const head = new THREE.PerspectiveCamera(70, 1, 0.05, 100);
const body = new THREE.Group();
body.add(head);
const walking = new RoomControls({ renderer, camera: head, rig: body, scene: new THREE.Scene(), dom: renderer.domElement }, 3);
walking.setNav(nav);
walking.setEyeLift(lift);
walking.reduceMotion = reduce;
walking.restPitch = tv ? -0.12 : 0;
walking.aimMiddle = tv;
walking.onDoor = (how, hit) => (how === 'screen' && hit.kind === 'door' ? walking.walkInto() : fade.to(1, 0.3, () => location.assign(link)));
walking.onPiece = (i) => walking.walkUpTo(i, () => {});
walking.onTeleport = (move) => fade.to(1, 0.1, () => (move(), fade.to(0, 0.1)));
walking.onSqueeze = (hand) => hand.controller.position.length();
walking.walkTo(1, -2, { face: Math.PI, then: () => walking.setPose(1, -2, Math.PI) });
walking.walkThrough(1);
walking.update(1 / 72);
vignette.update(1 / 72, walking.moveSpeed, walking.turnRate, renderer.xr.isPresenting);
const pointedAt: string | null = walking.hover;
const mouseAt: { x: number; y: number } | null = walking.pointer;
const hands: Hand<RoomHit>[] = walking.hands;
const piece: number | undefined = walking.hands[0]?.last?.piece;
const walkKey: KeyAction | undefined = KEYS[keyOf(new KeyboardEvent('keydown', { code: 'KeyW' }))];
new Remote({ ...remoteOptions, use: () => walking.useMiddle() });

// @ts-expect-error its helpers are a subclass's
walking._move(0, 0);
// @ts-expect-error what the keys do stays as it is
KEYS.KeyW = 'back';
// @ts-expect-error a hit of the site's own shape
new RoomControls({ renderer, camera: head, rig: body, scene: body, dom: renderer.domElement, hit: () => ({ t: 0 }) }, 3);
// @ts-expect-error a walk faces a yaw
walking.walkTo(1, -2, { face: 'north' });
// @ts-expect-error used on a screen or in VR
walking.use(null, 'tv');
// @ts-expect-error a move that isn't one
walking.setNav({ move: 'fly', turn: 'snap' });

// A panel in the room: a title, the pieces in a list with a scroll bar, a button, a slider and a
// piano roll of the site's own, pointed at by where a ray meets it, the row pointed at outlined.
const panelOptions: PanelOptions = { width: 0.8, height: 0.6, ring: 2 };
const panel = new Panel(panelOptions);
const sized = new Panel({ width: 0.8, height: 0.6, px: 1024, background: null });
panel.add({ type: 'text', id: 'title', x: 40, y: 30, w: 880, h: 60, text: 'Pieces', size: 40, serif: true });
const items: ListItem[] = [{ label: 'Walden', sub: 'Thoreau', right: '1854', onClick: (it) => walking.walkUpTo(it ? 0 : 1) }];
const list = panel.add({ type: 'list', id: 'pieces', x: 40, y: 100, w: 880, h: 400, items, rowH: 84, size: 28, serif: true }) as ListElement;
panel.add({ type: 'button', id: 'close', x: 40, y: 600, w: 200, h: 80, label: 'Close', onClick: (b: ButtonElement) => panel.set(b.id ?? '', { active: true }) });
panel.add({ type: 'slider', id: 'volume', x: 300, y: 600, w: 400, h: 80, value: 0.5, onClick: (value) => panel.set('volume', { value }) });
const roll: CustomElement = { type: 'custom', id: 'roll', x: 40, y: 500, w: 880, h: 80, notes: [60, 64, 67], draw: (g, el) => g.fillRect(el.x, el.y, el.w, el.h) };
panel.add(roll);
new THREE.Scene().add(panel.mesh, sized.mesh);
panel.update();
const there: Control | null = panel.elementAt(0.5, 0.5);
const lit: boolean = panel.pointerMove(0.5, 0.5);
const used: boolean = panel.click(0.5, 0.5);
if (panel.pressAt(0.95, 0.5)) panel.dragTo(0.95, 0.4);
const released: boolean = panel.release();
panel.pointerLeave();
panel.ring = tv ? 4 : 2;
panel.scrollList('pieces', 3);
const scrolls: boolean = panel.scrolls(list);
const drawn: PanelElement[] = panel.elements;
const label = new Label({ width: 0.4 });
label.setText('Walden', 'Thoreau');
label.visible = lit;
const lines: string[] = wrapText(panel.ctx, 'A line too long for the panel', 300, 2);
const serif: string = UI.serif;
panel.dispose();

// @ts-expect-error where a ray meets it is two numbers, not a uv
panel.click({ x: 0.5, y: 0.5 });
// @ts-expect-error an element of a type it draws
panel.add({ type: 'video', x: 0, y: 0, w: 1, h: 1 });
// @ts-expect-error the outline is a width in pixels
new Panel({ width: 1, height: 1, ring: true });
// @ts-expect-error where a ray meets it, in pixels, is its own
panel._toPx(0.5, 0.5);

// The book's text on a screen: the site's own view, its places { c, b } (vrlbry's: a chunk and a
// block, f an element the 3D page found), its book its own.
interface Place {
  c: number;
  b: number;
  f?: string;
}
interface Shelf {
  title: string;
  chunks: string[][];
  at: Place;
  scale: number;
  theme: string;
}

class BookView extends TextView<Place> {
  readonly shelf: Shelf;

  constructor(options: TextViewOptions, shelf: Shelf) {
    super(options);
    this.shelf = shelf;
  }

  bookOpen(): boolean { return this.shelf.chunks.length > 0; }
  presenting(): boolean { return walking.renderer.xr.isPresenting; }
  partCount(): number { return this.shelf.chunks.length; }
  partOf(place: Place): number { return place.c; }
  partStart(part: number): Place { return { c: part, b: 0 }; }

  async renderPart(body: HTMLElement, part: number, { onLink }: { onLink: (link: unknown) => void }): Promise<RenderedPart> {
    for (const [b, text] of (this.shelf.chunks[part] ?? []).entries()) {
      const p = document.createElement('p');
      p.dataset.b = String(b);
      p.textContent = text;
      p.addEventListener('click', () => onLink({ c: part + 1, b: 0 }));
      body.append(p);
    }
    return { title: this.shelf.title, subtitle: part ? `Volume ${part + 1}` : '' };
  }

  placeShown(): Place { return this.shelf.at; }
  showsPlace(place: Place): boolean { return place.c === this.shelf.at.c && place.b - (place.b % 2) === this.shelf.at.b; }
  placeAimed(aim: Place): Place { return aim.f ? this.shelf.at : aim; }
  placeTop(place: Place): number | null { return this.el.querySelector(`.tv-body [data-b="${place.b}"]`)?.getBoundingClientRect().top ?? null; }

  placeAt(top: number): Place | null {
    for (const el of this.el.querySelectorAll<HTMLElement>('.tv-body [data-b]')) {
      if (el.getBoundingClientRect().bottom > top) return { c: this.part, b: Number(el.dataset.b) };
    }
    return null;
  }

  async jumpTo(place: Place, { inPlace }: { inPlace: boolean }): Promise<boolean> {
    if (this.showsPlace(place)) return false;
    this.shelf.at = { c: place.c, b: place.b - (place.b % 2) };
    if (!inPlace) this.follow();
    return true;
  }

  turnPage(dir: number): void { this.shelf.at = { ...this.shelf.at, b: Math.max(0, this.shelf.at.b + 2 * dir) }; this.follow(); }
  changeFont(step: number): void { this.shelf.scale += step / 10; this.follow(); }
  setTheme(name: string): void { this.shelf.theme = name; this.follow(); }

  async followLink(link: Place): Promise<void> {
    this.aim(link);
    await this.jumpTo(link, { inPlace: false });
  }

  aim(place: Place | null | undefined): void { super.aim(place && { c: place.c, b: place.f ? 0 : place.b, f: place.f }); }
  contents(): ContentsEntry<Place>[] { return this.shelf.chunks.map((_, c) => ({ title: `Chapter ${c + 1}`, place: { c, b: 0 }, level: 1 })); }
  label(): string { return `${this.shelf.at.b + 1} / 340`; }
  theme(): string { return this.shelf.theme; }
  fontScale(): number { return this.shelf.scale; }
  reduced(): boolean { return reduce; }
}

const overlay = document.createElement('div');
const shelf: Shelf = { title: 'Walden', chunks: [['Economy'], ['Where I lived']], at: { c: 0, b: 0 }, scale: 1, theme: 'paper' };
const textOptions: TextViewOptions = { root: overlay, tv, step: (h) => Math.max(40, h * 0.75), returnFocus: (away) => (away ? null : overlay), onOpen: () => remote.walk() };
const reader = new BookView(textOptions, shelf);
void reader.toggle();
reader.follow();
reader.aim({ c: 0, b: 5, f: 'note-3' });
void reader.turn(1);
reader.scrollStep(1, true);
const reading2: boolean = reader.isOpen && reader.tocOpen;
reader.closeToc();
const card: HTMLElement = reader.layer();
const startAt: HTMLElement | null = reader.cardStart() ?? reader.linkHere();
const inToolbar: boolean = reader.inBar(document.activeElement) && reader.onScreen(overlay);
void reader.close({ keepPlace: false });
const css: string = TEXT_VIEW_CSS;
const partShown: number = reader.part;

// @ts-expect-error a place of the site's own shape
reader.aim([0, 5, 0]);
// @ts-expect-error the view goes in an element
new BookView({ root: '#overlay' }, shelf);
// @ts-expect-error its place is its own
reader._at;
// @ts-expect-error a part's line under its title is text
const untitled: RenderedPart = { title: 'Walden', subtitle: 2 };
// @ts-expect-error a turn is a direction
void reader.turn('next');

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

export { dx, views, urls, onward, kept, key, sure, fly, depth, normalizeNav, endWindow, hide, state, moved, using, first, dome, glass, sunUp, red, reflects, reduce, stopWatching, kept2, ring, lift, accessKey, sometimes, throughHistory, bookLevel, answering, stepped, intoCard, inCard, next, pointedAt, mouseAt, hands, piece, walkKey, there, used, released, scrolls, drawn, lines, serif, reading2, card, startAt, inToolbar, css, partShown, untitled };
