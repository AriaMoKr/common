// An environment behind one of the Hallway's doors (src/door.js): the visit its link brings, and
// the way back. The cases come from the copies this module replaces: breadboard's tests/vr-hallway.test.ts,
// outside's test/way.test.js and vrlbry's test/client-hallway.test.js.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HALLWAY_ID, HALLWAY_URL, VISIT_PARAMS, hallwayUrl, hallwayViews, keptWay, leaveUrl, readVisit, viewParams, wayBack,
  withoutVisit,
} from '../src/door.js';

const ORIGIN = 'https://ariamokr.github.io';
const DEG = Math.PI / 180;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-12, `${msg}: ${a} ≠ ${b}`);
/** A door's link, as the Hallway's README ("Going in") shows one. */
const door = (back, extra = '') =>
  `?from=hallway&back=${encodeURIComponent(back)}&dx=0.12&yaw=-8&pitch=-3&dw=1.1&dh=2.25&glow=d8543f${extra}`;
const back = (id) => `https://ariamokr.github.io/hallway/?from=${id}`;
const THE_HALLWAY = { label: '← Hallway', title: 'Back to the Hallway, whose doors lead to other places', name: 'Hallway', hallway: true };

describe('the Hallway', () => {
  it('is named hallway in from, and in front of a door is its address with ?from=<the door>', () => {
    assert.equal(HALLWAY_ID, 'hallway');
    assert.equal(HALLWAY_URL, 'https://ariamokr.github.io/hallway/');
    for (const id of ['breadboard', 'outside', 'vrlbry', 'music']) assert.equal(hallwayUrl(id), back(id));
    assert.equal(hallwayUrl(''), HALLWAY_URL);
  });
});

describe('the visit', () => {
  it('reads where and how they went through the doorway', () => {
    const v = readVisit(door(back('breadboard')));
    assert.equal(v.from, 'hallway');
    assert.equal(v.dx, 0.12);
    near(v.yaw, -8 * DEG, 'yaw');
    near(v.pitch, -3 * DEG, 'pitch');
    assert.deepEqual([v.dw, v.dh, v.glow], [1.1, 2.25, '#d8543f']);
    assert.equal(readVisit('?glow=9FD07A').glow, '#9fd07a', 'the glow in lower case');
  });

  it('keeps numbers in range, and makes what is missing or nonsense null', () => {
    const v = readVisit('?dx=9&yaw=-400&pitch=abc&dw=0.1&dh=&glow=red');
    assert.deepEqual([v.dx, v.yaw, v.pitch, v.dw, v.dh, v.glow], [1.2, -Math.PI / 2, null, 0.7, null, null]);
    const w = readVisit('?from=hallway&yaw=abc&pitch=&dx=7&dw=0.1&glow=red');
    assert.deepEqual([w.yaw, w.pitch, w.dx, w.dw, w.dh, w.glow], [null, null, 1.2, 0.7, null, null]);
    const big = readVisit('?dx=-5&yaw=95&pitch=-95&dw=9&dh=0.5&glow=%23d8543f');
    assert.deepEqual([big.dx, big.yaw, big.pitch, big.dw, big.dh, big.glow], [-1.2, Math.PI / 2, -89 * DEG, 2.4, 1.9, null]);
    assert.deepEqual(readVisit(''), { from: null, dx: null, yaw: null, pitch: null, dw: null, dh: null, glow: null });
    assert.equal(readVisit('?dx=Infinity&yaw=%20').dx, null);
  });

  it('is taken off the address once read, keeping the rest and the shared session', () => {
    const href = `${ORIGIN}/breadboard/vr.html${door(back('breadboard'), '&debug&room=k3vd-q8hn')}#example/counter`;
    assert.equal(withoutVisit(href), '/breadboard/vr.html?debug&room=k3vd-q8hn#example/counter');
    assert.equal(withoutVisit(`${ORIGIN}/breadboard/vr.html#c1.abc`), '/breadboard/vr.html#c1.abc');
    assert.equal(withoutVisit(`${ORIGIN}/outside/${door(back('outside'), '&room=k3vd-q8hn')}#x`), '/outside/?room=k3vd-q8hn#x');
    assert.equal(withoutVisit(`${ORIGIN}/outside/?xr=emulate&dx=1`), '/outside/?xr=emulate');
    assert.equal(withoutVisit(`${ORIGIN}/outside/`), '/outside/');
  });

  it('takes off a hall\'s backname too, a parameter however it is written, and survives a broken one', () => {
    assert.ok(VISIT_PARAMS.includes('backname'));
    assert.ok(!VISIT_PARAMS.includes('room'));
    const hall = `?back=${encodeURIComponent('https://example.org/hall/')}&backname=Garden%20Hall&place=demo`;
    assert.equal(withoutVisit(`${ORIGIN}/vrlbry/${hall}`), '/vrlbry/?place=demo');
    assert.equal(withoutVisit(`${ORIGIN}/vrlbry/?%66rom=hallway&g%6Cow=d9b26a&x=1`), '/vrlbry/?x=1');
    assert.equal(withoutVisit(`${ORIGIN}/vrlbry/?%E0%A4%A=1&dx=1&&`), '/vrlbry/?%E0%A4%A=1');
  });
});

describe('the way back to the Hallway', () => {
  it('leads where the Hallway\'s door says, kept as given', () => {
    for (const id of ['breadboard', 'outside']) {
      assert.deepEqual(wayBack(door(back(id)), id, { origin: ORIGIN }), { url: back(id), host: 'ariamokr.github.io', ...THE_HALLWAY });
    }
    // In a shared session the way back carries its room, and keeps it.
    const inRoom = `${back('vrlbry')}&room=k3vd-q8hn`;
    const search = `?place=%7Egutenberg_en_all_2025-11&from=hallway&back=${encodeURIComponent(inRoom)}&dx=0.12&yaw=-8&pitch=-3&dw=1.1&dh=2.25&glow=d9b26a`;
    assert.deepEqual(wayBack(search, 'vrlbry'), { url: inRoom, host: 'ariamokr.github.io', ...THE_HALLWAY });
    assert.equal(wayBack(door('https://ariamokr.github.io/hallway/index.html?from=vrlbry'), 'vrlbry')?.hallway, true, 'its index.html');
  });

  it('is the Hallway only on its own address: its origin and path (vrlbry ea430a8)', () => {
    // Another site on the Hallway's origin, as all of them are, another origin, or a link not from the Hallway.
    for (const [other, from, label] of [
      ['https://ariamokr.github.io/outside/', 'hallway', '← ariamokr.github.io'],
      ['https://ariamokr.github.io/breadboard/vr.html', 'hallway', '← ariamokr.github.io'],
      ['https://ariamokr.github.io/hallway-2/', 'hallway', '← ariamokr.github.io'],
      ['https://example.org/hallway/', 'hallway', '← example.org'],
      ['http://ariamokr.github.io/hallway/', 'hallway', '← ariamokr.github.io'],
      [back('vrlbry'), '', '← ariamokr.github.io'],
      [back('vrlbry'), 'vrlbry', '← ariamokr.github.io'],
    ]) {
      const way = wayBack(`?from=${from}&back=${encodeURIComponent(other)}`, 'vrlbry', { origin: ORIGIN });
      assert.deepEqual([way?.url, way?.label, way?.hallway], [other, label, false], `${from} ${other}`);
    }
  });

  it('is the Hallway on a dev server too, when this page is on one: only with the origin given', () => {
    const dev = door('http://localhost:8088/?from=outside');
    assert.equal(wayBack(dev, 'outside', { origin: 'http://localhost:8090' })?.hallway, true);
    assert.equal(wayBack(dev, 'outside', { origin: 'http://[::1]:8090' })?.hallway, true);
    assert.equal(wayBack(door('http://127.0.0.1:5174/hallway/?from=breadboard'), 'breadboard', { origin: 'http://127.0.0.1:5174' })?.label, '← Hallway');
    assert.equal(wayBack(door('http://hall.localhost:8088/'), 'outside', { origin: 'http://localhost:5173' })?.hallway, true);
    // Not from the published page, nor without the origin, nor without from=hallway.
    assert.equal(wayBack(dev, 'outside', { origin: ORIGIN })?.hallway, false);
    assert.equal(wayBack(dev, 'outside')?.hallway, false);
    assert.equal(wayBack('?back=http://localhost:8088/', 'vrlbry', { origin: 'http://localhost:8090' })?.url, 'http://localhost:8088/');
    assert.equal(wayBack('?back=http://localhost:8088/', 'vrlbry', { origin: 'http://localhost:8090' })?.hallway, false);
  });

  it('leads to the Hallway in front of this door when the link gives no usable way back', () => {
    for (const search of ['', '?place=demo', '?back=', '?xr=emulate&perf', '?from=hallway', '?back=javascript%3Aalert(1)', '?back=%3A%3A']) {
      assert.deepEqual(wayBack(search, 'vrlbry'), { url: back('vrlbry'), host: 'ariamokr.github.io', ...THE_HALLWAY }, search);
    }
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///C:/x', 'not a url', '//example.org/hall/', 'ftp://example.org/']) {
      assert.equal(wayBack(`?back=${encodeURIComponent(bad)}`, 'vrlbry').url, back('vrlbry'), bad);
    }
  });

  it('with always: false, is none for a visit that came through no door', () => {
    const o = { origin: ORIGIN, always: false };
    for (const search of ['', '?debug', '?back=javascript%3Aalert(1)', '?back=not%20a%20url']) assert.equal(wayBack(search, 'breadboard', o), null, search);
    assert.equal(wayBack('?from=hallway', 'breadboard', o)?.url, back('breadboard'));
    assert.equal(wayBack(door('javascript:alert(1)'), 'breadboard', o)?.url, back('breadboard'));
    assert.equal(wayBack(door(back('breadboard')), 'breadboard', o)?.hallway, true);
    assert.equal(wayBack(`?back=${encodeURIComponent('https://example.org/')}`, 'breadboard', o)?.host, 'example.org');
  });
});

describe('the way back to another place', () => {
  it('is named by its host, and says where it leads', () => {
    assert.deepEqual(wayBack(door('https://example.org/garden/'), 'breadboard', { origin: ORIGIN }), {
      url: 'https://example.org/garden/', label: '← example.org', title: 'Back to https://example.org/garden/',
      name: 'example.org', host: 'example.org', hallway: false,
    });
    // from=hallway is what makes the Hallway's own address the Hallway.
    assert.equal(wayBack(`?back=${encodeURIComponent(HALLWAY_URL)}`, 'breadboard')?.label, '← ariamokr.github.io');
    assert.equal(wayBack(`?back=${encodeURIComponent(back('outside'))}`, 'outside')?.hallway, false);
  });

  it('or by its own name, a hall\'s backname, on one line and shortened on the button', () => {
    const hall = encodeURIComponent('https://example.org/my hall/?from=vrlbry');
    assert.deepEqual(wayBack(`?back=${hall}&backname=${encodeURIComponent('  Garden   Hall ')}`, 'vrlbry'), {
      url: 'https://example.org/my%20hall/?from=vrlbry', label: '← Garden Hall', title: 'Back to Garden Hall (example.org)',
      name: 'Garden Hall', host: 'example.org', hallway: false,
    });
    assert.equal(wayBack(`?back=${hall}`, 'vrlbry').label, '← example.org');
    assert.equal(wayBack(`?back=${hall}&backname=%20%20`, 'vrlbry').label, '← example.org');
    const long = wayBack(`?back=${hall}&backname=${'A very long name for a hallway of many doors'}`, 'vrlbry');
    assert.equal(long.label, '← A very long name for a…');
    assert.equal(long.title, 'Back to A very long name for a hallway of many doors (example.org)');
    assert.equal(long.name, 'A very long name for a hallway of many doors');
    const exact = 'Twenty-four characters!!';
    assert.equal(exact.length, 24);
    assert.equal(wayBack(`?back=${hall}&backname=${encodeURIComponent(exact)}`, 'vrlbry').label, `← ${exact}`);
  });

  it('is named without control characters or direction changes, and shortened by character', () => {
    const hall = encodeURIComponent('https://example.org/hall/');
    const name = (n) => wayBack(`?back=${hall}&backname=${encodeURIComponent(n)}`, 'vrlbry');
    assert.equal(name('Garden\tHall\n').name, 'Garden Hall');
    assert.equal(name('Garden\u0000 \u0007Hall').name, 'Garden Hall');
    assert.equal(name('\u202eGarden\u202c Hall\u2066').name, 'Garden Hall');
    assert.equal(name('\u202e\u0007').label, '← example.org');
    assert.equal(name('🌿'.repeat(30)).label, `← ${'🌿'.repeat(23)}…`);
  });

  it('never claims to be the Hallway, whatever it calls itself', () => {
    const w = wayBack(`?from=hallway&back=${encodeURIComponent('https://example.org/')}&backname=Hallway`, 'vrlbry');
    assert.equal(w.hallway, false);
    assert.equal(w.title, 'Back to Hallway (example.org)');
    assert.equal(hallwayViews(w, 'vrlbry'), null);
  });
});

describe('the way back, kept for the tab', () => {
  it('reads back as it was kept', () => {
    for (const w of [wayBack(door(back('outside')), 'outside', { origin: ORIGIN }), wayBack(door('https://example.org/garden/'), 'outside')]) {
      assert.deepEqual(keptWay(JSON.stringify(w)), w);
    }
  });

  it('is checked before it is used', () => {
    const w = wayBack(door(back('outside')), 'outside');
    for (const bad of [null, '', 'not json', 'null', '"x"', '{}', '[]',
      '{"url":"javascript:alert(1)","label":"x","title":"x","name":"x","host":"x"}',
      JSON.stringify({ ...w, url: 'https://' }), JSON.stringify({ ...w, label: '' }), JSON.stringify({ ...w, name: '' }),
      JSON.stringify({ ...w, host: 1 })]) {
      assert.equal(keptWay(bad), null, String(bad));
    }
    assert.equal(keptWay(JSON.stringify({ ...w, hallway: 'yes' })).hallway, false);
    assert.deepEqual(Object.keys(keptWay(JSON.stringify({ ...w, extra: 1 }))), ['url', 'label', 'title', 'name', 'host', 'hallway']);
  });
});

describe('leaving', () => {
  it('leads back in the shared session, or out of any', () => {
    const w = wayBack(door(back('outside')), 'outside');
    assert.equal(leaveUrl(w, 'k3vd-q8hn'), `${back('outside')}&room=k3vd-q8hn`);
    const inRoom = { ...w, url: `${back('outside')}&room=old1-old2` };
    assert.equal(leaveUrl(inRoom, null), back('outside'));
    assert.equal(leaveUrl(inRoom, 'new1-new2'), `${back('outside')}&room=new1-new2`);
    assert.equal(leaveUrl({ url: 'https://example.org/garden/#gate' }, 'k3vd-q8hn'), 'https://example.org/garden/?room=k3vd-q8hn#gate');
  });
});

describe('the Hallway\'s view of the door to here', () => {
  const VIEWS = 'https://ariamokr.github.io/hallway/views/views.json';

  it('is published beside the Hallway the way back leads to, under the door\'s id', () => {
    assert.deepEqual(hallwayViews(wayBack(door(back('breadboard')), 'breadboard'), 'breadboard'), { views: VIEWS, id: 'breadboard' });
    assert.deepEqual(hallwayViews(wayBack('?from=hallway', 'breadboard', { always: false }), 'breadboard'), { views: VIEWS, id: 'breadboard' });
    assert.deepEqual(hallwayViews(wayBack('', 'outside'), 'outside'), { views: VIEWS, id: 'outside' });
    assert.deepEqual(hallwayViews(wayBack(door('http://localhost:8088/?from=outside'), 'outside', { origin: 'http://localhost:8090' })), { views: 'http://localhost:8088/views/views.json', id: 'outside' });
  });

  it('is the one the way back\'s from names, else this place\'s id, else none', () => {
    assert.equal(hallwayViews(wayBack(door(back('vrlbry-2')), 'vrlbry'), 'vrlbry')?.id, 'vrlbry-2');
    const bare = wayBack(door(HALLWAY_URL), 'vrlbry');
    assert.equal(bare.hallway, true);
    assert.equal(hallwayViews(bare, 'vrlbry')?.id, 'vrlbry');
    assert.equal(hallwayViews(bare), null);
    // The same view from a door's link and from no link at all.
    const search = `?from=hallway&back=${encodeURIComponent(`${back('vrlbry')}&room=k3vd-q8hn`)}`;
    assert.deepEqual(hallwayViews(wayBack(search, 'vrlbry'), 'vrlbry'), hallwayViews(wayBack('', 'vrlbry'), 'vrlbry'));
  });

  it('is none when the way back is not the Hallway', () => {
    assert.equal(hallwayViews(wayBack(door('https://example.org/garden/'), 'breadboard'), 'breadboard'), null);
    assert.equal(hallwayViews(wayBack(`?back=${encodeURIComponent('https://example.org/')}`, 'outside'), 'outside'), null);
  });

  it('is hung as views.json says, when that is sensible', () => {
    const entry = { image: 'breadboard.jpg', depth: 2.94, pictureHeight: 6.5, eye: 1.6, horizon: 0.6154, aspect: 2 };
    assert.deepEqual(viewParams(entry), entry);
    const { aspect: _, ...noAspect } = entry;
    assert.equal(viewParams(noAspect)?.aspect, 2);
    assert.deepEqual(viewParams({ ...entry, aspect: undefined }), entry);
    assert.deepEqual(viewParams({ ...entry, extra: 1 }), entry);
    for (const bad of [null, undefined, 'breadboard.jpg', {}, { ...entry, image: '' }, { ...entry, depth: 0 }, { ...entry, depth: 500 },
      { ...entry, horizon: 2 }, { ...entry, eye: '1.6' }, { ...entry, aspect: 9 }, { ...entry, pictureHeight: NaN }]) {
      assert.equal(viewParams(bad), null, JSON.stringify(bad));
    }
  });
});

describe('the Hallway\'s real link', () => {
  // A door of the Hallway in VR (no pitch), in a shared session: vrlbry's door.
  const LINK = '?from=hallway&back=https%3A%2F%2Fariamokr.github.io%2Fhallway%2F%3Ffrom%3Dvrlbry%26room%3Dk3vd-q8hn&dx=0.12&yaw=-8&dw=1.1&dh=2.25&glow=d9b26a';
  const BACK = 'https://ariamokr.github.io/hallway/?from=vrlbry&room=k3vd-q8hn';

  it('is read as a visit through vrlbry\'s door, looking where the headset says', () => {
    const v = readVisit(LINK);
    assert.deepEqual({ ...v, yaw: null }, { from: 'hallway', dx: 0.12, yaw: null, pitch: null, dw: 1.1, dh: 2.25, glow: '#d9b26a' });
    near(v.yaw, -8 * DEG, 'yaw');
  });

  it('leads back to the Hallway, in front of that door and in the session', () => {
    const way = wayBack(LINK, 'vrlbry', { origin: ORIGIN });
    assert.deepEqual(way, { url: BACK, host: 'ariamokr.github.io', ...THE_HALLWAY });
    assert.deepEqual(wayBack(LINK, 'vrlbry', { origin: ORIGIN, always: false }), way);
    assert.deepEqual(keptWay(JSON.stringify(way)), way);
    assert.deepEqual(hallwayViews(way, 'vrlbry'), { views: 'https://ariamokr.github.io/hallway/views/views.json', id: 'vrlbry' });
    assert.equal(leaveUrl(way, 'k3vd-q8hn'), BACK);
    assert.equal(leaveUrl(way, 'new1-new2'), 'https://ariamokr.github.io/hallway/?from=vrlbry&room=new1-new2');
    assert.equal(leaveUrl(way, null), 'https://ariamokr.github.io/hallway/?from=vrlbry');
  });

  it('comes off the address whole', () => {
    assert.equal(withoutVisit(`https://ariamokr.github.io/vrlbry/${LINK}`), '/vrlbry/');
    assert.equal(withoutVisit(`https://ariamokr.github.io/vrlbry/?place=%7Egutenberg_en_all_2025-11&${LINK.slice(1)}&room=k3vd-q8hn`), '/vrlbry/?place=%7Egutenberg_en_all_2025-11&room=k3vd-q8hn');
  });
});
