// An environment behind one of the Hallway's doors, in TypeScript (test/types.test.js compiles it). The
// lines marked as expected errors fail the compile if they are not, so the types must be real.

import { HALLWAY_URL, VISIT_PARAMS, doorLink, hallwayViews, keptWay, leaveUrl, readVisit, viewParams, wayBack, withoutVisit } from 'common/door.js';
import type { DoorPose, ViewParams, Visit, WayBack } from 'common/door.js';
import { NAV_DEFAULTS, NAV_KEY, loadNav, normalizeNav, saveNav } from 'common/nav.js';
import type { Nav } from 'common/nav.js';

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

export { dx, views, urls, kept, key, sure, fly, depth, normalizeNav };
