// The Hallway's side of the door (src/door.js doorLink): the link a door opens. The cases come from
// hallway's test/link.test.js; the round trips read the link back as a place does.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HALLWAY_ID, LINK_PARAMS, VISIT_PARAMS, doorLink, hallLink, hallwayViews, leaveUrl, readVisit, wayBack, withoutVisit } from '../src/door.js';

/** The Hallway's doorways (its layout.js HALL). */
const HALL = { doorWidth: 1.1, doorHeight: 2.25 };
const DEG = Math.PI / 180;
const env = { id: 'garden', title: 'Garden', url: 'https://example.org/garden/?place=%7Edusk#gate', color: '#7FC4A0' };
const here = 'https://ariamokr.github.io/hallway/?from=pond#x';
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

describe('a door\'s link', () => {
  it('keeps the place\'s address and adds the visit to its query', () => {
    const pose = { across: 0.123, yaw: -8.4 * DEG, pitch: -3.2 * DEG };
    const url = new URL(doorLink(env, { here, hall: HALL, pose, room: 'k3vd-q8hn' }));
    assert.equal(url.origin + url.pathname, 'https://example.org/garden/');
    assert.equal(url.hash, '#gate');
    assert.ok(url.search.startsWith('?place=%7Edusk&'), url.search);
    assert.deepEqual([...url.searchParams.keys()], ['place', ...LINK_PARAMS]);
    const q = Object.fromEntries(url.searchParams);
    assert.equal(q.from, HALLWAY_ID);
    assert.equal(q.back, 'https://ariamokr.github.io/hallway/?from=garden&room=k3vd-q8hn');
    assert.equal(q.room, 'k3vd-q8hn');
    assert.equal(q.dx, '0.12');
    assert.equal(q.yaw, '-8');
    assert.equal(q.pitch, '-3');
    assert.equal(q.dw, String(HALL.doorWidth));
    assert.equal(q.dh, String(HALL.doorHeight));
    assert.equal(q.glow, '7fc4a0');
  });

  it('in VR leaves out the pitch; from the doors list, the pose; and zero has no minus', () => {
    const xr = new URL(doorLink(env, { here, hall: HALL, pose: { across: -0.001, yaw: -0.001, pitch: 0.5 }, xr: true }));
    assert.equal(xr.searchParams.get('dx'), '0');
    assert.equal(xr.searchParams.get('yaw'), '0');
    assert.equal(xr.searchParams.has('pitch'), false);
    const list = new URL(doorLink(env, { here, hall: HALL }));
    for (const k of ['dx', 'yaw', 'pitch']) assert.equal(list.searchParams.has(k), false, k);
    for (const k of ['from', 'back', 'dw', 'dh', 'glow']) assert.ok(list.searchParams.has(k), k);
  });

  it('outside a shared session has no room, nor has its way back', () => {
    const url = new URL(doorLink(env, { here: 'https://ariamokr.github.io/hallway/?room=old', hall: HALL }));
    assert.equal(url.searchParams.has('room'), false);
    assert.equal(url.searchParams.get('back'), 'https://ariamokr.github.io/hallway/?from=garden');
  });

  it('is what the README shows, walking through vrlbry\'s door', () => {
    const vrlbry = { id: 'vrlbry', url: 'https://ariamokr.github.io/vrlbry/?place=%7Egutenberg_en_all_2025-11', color: '#d9b26a' };
    const pose = { across: 0.12, yaw: -8 * DEG, pitch: -3 * DEG };
    assert.equal(doorLink(vrlbry, { here: 'https://ariamokr.github.io/hallway/', hall: HALL, pose }),
      'https://ariamokr.github.io/vrlbry/?place=%7Egutenberg_en_all_2025-11&from=hallway&back=https%3A%2F%2Fariamokr.github.io%2Fhallway%2F%3Ffrom%3Dvrlbry&dx=0.12&yaw=-8&pitch=-3&dw=1.1&dh=2.25&glow=d9b26a');
    // In VR, in a shared session: the Hallway's real link (door.test.js), with the session's room on the link too.
    assert.equal(doorLink({ ...vrlbry, url: 'https://ariamokr.github.io/vrlbry/' }, { here: 'https://ariamokr.github.io/hallway/', hall: HALL, pose, xr: true, room: 'k3vd-q8hn' }),
      'https://ariamokr.github.io/vrlbry/?from=hallway&back=https%3A%2F%2Fariamokr.github.io%2Fhallway%2F%3Ffrom%3Dvrlbry%26room%3Dk3vd-q8hn&dx=0.12&yaw=-8&dw=1.1&dh=2.25&glow=d9b26a&room=k3vd-q8hn');
  });
});

describe('a door\'s link, read by the place behind it', () => {
  const pose = { across: -0.31, yaw: 12.4 * DEG, pitch: -5.6 * DEG };

  it('gives the visit, the way back to the Hallway and the view from its door', () => {
    const link = new URL(doorLink(env, { here: 'https://ariamokr.github.io/hallway/', hall: HALL, pose, room: 'k3vd-q8hn' }));
    const v = readVisit(link.search);
    assert.equal(v.from, HALLWAY_ID);
    assert.equal(v.dx, -0.31);
    near(v.yaw, 12 * DEG, 'yaw, in whole degrees');
    near(v.pitch, -6 * DEG, 'pitch, in whole degrees');
    assert.deepEqual([v.dw, v.dh, v.glow], [1.1, 2.25, '#7fc4a0']);
    const way = wayBack(link.search, env.id, { origin: link.origin });
    assert.deepEqual([way?.url, way?.hallway], ['https://ariamokr.github.io/hallway/?from=garden&room=k3vd-q8hn', true]);
    assert.deepEqual(hallwayViews(way, env.id), { views: 'https://ariamokr.github.io/hallway/views/views.json', id: 'garden' });
    assert.equal(withoutVisit(link.href), '/garden/?place=%7Edusk&room=k3vd-q8hn#gate');
  });

  it('from a Hallway on a dev server, read by a place on another', () => {
    const local = { ...env, url: 'http://localhost:8090/' };
    const link = new URL(doorLink(local, { here: 'http://localhost:8088/?from=garden', hall: HALL, pose, xr: true }));
    assert.equal(wayBack(link.search, 'garden', { origin: link.origin })?.hallway, true);
    assert.equal(readVisit(link.search).pitch, null);
  });

  it('takes off all a door adds but the room', () => {
    assert.deepEqual(LINK_PARAMS.filter((k) => !VISIT_PARAMS.includes(k)), ['room']);
  });
});

describe('another hall\'s link (hallLink)', () => {
  const art = 'https://ariamokr.github.io/art/?tv=emulate#x';
  const studio = { id: 'studio', url: 'https://ariamokr.github.io/vartiste/?load=gallery%2Fpaper.vartistez#y' };

  it('keeps the place\'s address and adds the way back, named, and the room', () => {
    const url = new URL(hallLink(studio, { here: art, name: 'art', room: 'k3vd-q8hn' }));
    assert.equal(url.origin + url.pathname, 'https://ariamokr.github.io/vartiste/');
    assert.equal(url.hash, '#y');
    assert.deepEqual([...url.searchParams.keys()], ['load', 'back', 'backname', 'room']);
    assert.equal(url.searchParams.get('back'), 'https://ariamokr.github.io/art/?from=studio&room=k3vd-q8hn');
    assert.equal(url.searchParams.get('backname'), 'art');
    assert.equal(hallLink(studio, { here: art, name: 'art' }),
      'https://ariamokr.github.io/vartiste/?load=gallery%2Fpaper.vartistez&back=https%3A%2F%2Fariamokr.github.io%2Fart%2F%3Ffrom%3Dstudio&backname=art#y');
  });

  it('is read by the place as a way back to the hall, by its name, never the Hallway', () => {
    const link = new URL(hallLink(studio, { here: art, name: 'art', room: 'k3vd-q8hn' }));
    const way = wayBack(link.search, 'vartiste', { origin: link.origin, always: false });
    assert.ok(way);
    assert.deepEqual([way.url, way.label, way.name, way.hallway], ['https://ariamokr.github.io/art/?from=studio&room=k3vd-q8hn', '← art', 'art', false]);
    assert.equal(hallwayViews(way, 'vartiste'), null);
    assert.equal(leaveUrl(way, null), 'https://ariamokr.github.io/art/?from=studio');
    assert.equal(withoutVisit(link.href), '/vartiste/?load=gallery%2Fpaper.vartistez&room=k3vd-q8hn#y');
    // Between two dev servers too: only from=hallway makes a way back on this machine the Hallway.
    const local = new URL(hallLink({ ...studio, url: 'http://localhost:7979/' }, { here: 'http://localhost:8096/', name: 'art' }));
    assert.equal(wayBack(local.search, 'vartiste', { origin: local.origin })?.hallway, false);
    assert.equal(readVisit(local.search).from, null);
  });
});
