// tools/chrome.mjs: the profile each Chrome starts on, checked without starting Chrome, a stand-in
// Chrome (test/chrome.js) that is not the process spawned, and the tab's DevTools messages over a
// stand-in WebSocket. With CHROME_TEST=1, a real Chrome too.

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Page, findChrome, launchChrome, localState, newProfile, sleep } from '../tools/chrome.mjs';
import { serve } from '../tools/serve.mjs';

const source = readFileSync(new URL('../tools/chrome.mjs', import.meta.url), 'utf8');
/** The profiles in the temp folder: inside `inOwnTemp`, only those of the test it runs. */
const profiles = () => readdirSync(tmpdir()).filter((n) => n.startsWith('common-chrome-')).sort();

/**
 * Runs `test` with a temp folder of its own as TEMP, TMP and TMPDIR (which tmpdir() reads each time
 * it is called), so the profiles it lists are only its own: other sessions' tools start and end
 * Chromes on profiles in the shared one at any time. The folder goes after, unless a profile is
 * left in it: that is the test's failure, and a Chrome may hold it still.
 */
async function inOwnTemp(test) {
  const own = mkdtempSync(join(tmpdir(), 'common-temp-'));
  const was = Object.fromEntries(['TEMP', 'TMP', 'TMPDIR'].map((name) => [name, process.env[name]]));
  for (const name in was) process.env[name] = own;
  try {
    assert.equal(tmpdir(), own, 'new profiles are made in it');
    await test();
  } finally {
    for (const [name, value] of Object.entries(was)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    if (!readdirSync(own).some((n) => n.startsWith('common-chrome-'))) rmSync(own, { recursive: true, force: true, maxRetries: 5 });
  }
}

const running = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Runs `test` with the stand-in Chrome as CHROME_PATH, given the switches that make it log, and what
 * it has logged so far. Then the stand-ins still running exit, as their log's folder goes, and the
 * profiles they started on go too, whatever launchChrome left.
 */
async function withStandIn(test) {
  const dir = mkdtempSync(join(tmpdir(), 'common-stand-in-'));
  const log = join(dir, 'log');
  const logged = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : []);
  const was = process.env.CHROME_PATH;
  process.env.CHROME_PATH = fileURLToPath(new URL('./chrome.js', import.meta.url));
  try {
    await test([`--stand-in-log=${log}`], logged);
  } finally {
    if (was === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = was;
    const started = new Set(logged().map((e) => e.profile).filter(Boolean));
    rmSync(dir, { recursive: true, force: true });
    await sleep(200);
    for (const p of started) rmSync(p, { recursive: true, force: true, maxRetries: 5 });
  }
}

/** What each process logged, in order, as [as, event]. */
const events = (logged) => logged.map((e) => [e.as, e.event]);

describe('the profile each Chrome starts on', () => {
  it('tells Chrome the Windows password is not blank, as of now in microseconds since 1601', () => {
    const now = Date.UTC(2026, 9, 25, 12, 30, 15, 250);
    const since1601 = BigInt(now - Date.UTC(1601, 0, 1)) * 1000n;
    assert.deepEqual(localState(now), { password_manager: { os_password_blank: false, os_password_last_changed: String(since1601) } });
    assert.equal(localState(now).password_manager.os_password_last_changed, '13437405015250000');
    const stamped = BigInt(localState().password_manager.os_password_last_changed);
    const at = BigInt(Date.now() - Date.UTC(1601, 0, 1)) * 1000n;
    assert.ok(at - stamped >= 0n && at - stamped < 5_000_000n, 'now, by default');
  });

  it('writes Local State into a new profile on Windows, before anything else is there', () => {
    const now = Date.UTC(2026, 9, 25);
    const profile = newProfile({ platform: 'win32', now });
    try {
      assert.deepEqual(readdirSync(profile), ['Local State']);
      const written = readFileSync(join(profile, 'Local State'), 'utf8');
      assert.deepEqual(JSON.parse(written), { password_manager: { os_password_blank: false, os_password_last_changed: String((BigInt(now) + 11644473600000n) * 1000n) } });
      assert.equal(written, JSON.stringify(localState(now)));
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  });

  it('leaves the profile empty elsewhere, and is new each time, in the temp folder', () => {
    const a = newProfile({ platform: 'linux' });
    const b = newProfile({ platform: 'darwin' });
    const here = newProfile();
    try {
      assert.notEqual(a, b);
      assert.deepEqual([readdirSync(a), readdirSync(b)], [[], []]);
      assert.equal(existsSync(join(here, 'Local State')), process.platform === 'win32', 'on this machine');
      for (const p of [a, b, here]) assert.ok(p.startsWith(join(tmpdir(), 'common-chrome-')), p);
    } finally {
      for (const p of [a, b, here]) rmSync(p, { recursive: true, force: true });
    }
  });

  it('is what launchChrome starts Chrome on: made before Chrome is spawned, and named on its command line', () => {
    const body = source.slice(source.indexOf('export async function launchChrome'), source.indexOf('export class Page'));
    const made = body.indexOf('const profile = newProfile();');
    assert.ok(made > 0, 'launchChrome makes its profile with newProfile');
    assert.ok(made < body.indexOf('spawn('), 'before it spawns Chrome');
    assert.match(body, /`--user-data-dir=\$\{profile\}`/);
    assert.match(body, /'--remote-debugging-port=0'/);
  });

  /** launchChrome with CHROME_PATH a `name` that isn't there, in a temp folder of its own. */
  const cannotStart = (name) => inOwnTemp(async () => {
    const was = process.env.CHROME_PATH;
    process.env.CHROME_PATH = join(tmpdir(), 'no-such-chrome', name);
    try {
      await assert.rejects(launchChrome(), /Chrome did not start .*no-such-chrome/);
    } finally {
      if (was === undefined) delete process.env.CHROME_PATH;
      else process.env.CHROME_PATH = was;
    }
    assert.deepEqual(profiles(), [], 'the profile it made removed');
  });

  it('is removed again when Chrome cannot start', () => cannotStart('chrome.exe'));

  it('is removed again when Chrome cannot even be spawned (a .cmd, which Windows starts only through a shell)', () => cannotStart('chrome.cmd'));
});

describe('findChrome', () => {
  it('takes CHROME_PATH as it is, else an installed one, else says so', () => {
    const was = process.env.CHROME_PATH;
    try {
      process.env.CHROME_PATH = '/opt/some/chrome';
      assert.equal(findChrome(), '/opt/some/chrome');
      delete process.env.CHROME_PATH;
      let found = null;
      try {
        found = findChrome();
      } catch (e) {
        assert.match(e.message, /Set CHROME_PATH/);
      }
      if (found) assert.ok(existsSync(found), found);
    } finally {
      if (was === undefined) delete process.env.CHROME_PATH;
      else process.env.CHROME_PATH = was;
    }
  });
});

describe('a Chrome that is not the process spawned (the stand-in, test/chrome.js)', () => {
  const windows = process.platform === 'win32'; // where the profile has its Local State
  const closed = [['spawned', 'start'], ['browser', 'start'], ['browser', 'port'], ['browser', 'closed'], ['browser', 'exit']];

  it('is held on to when it restarts itself, as Chrome with an update waiting, and close() ends it', async () => {
    await withStandIn(async (args, logged) => {
      const chrome = await launchChrome({ args: [...args, '--stand-in-restart'] });
      const [spawned, browser, port] = logged();
      assert.deepEqual(events([spawned, browser, port]), closed.slice(0, 3));
      assert.equal(spawned.pid, chrome.process.pid);
      assert.equal(chrome.process.exitCode, 0, 'the process spawned exited before the port came');
      assert.equal(chrome.endpoint, `http://127.0.0.1:${port.port}`, "the browser's");
      assert.equal(browser.profile, chrome.profile);
      assert.equal(browser.localState, windows);
      await chrome.close();
      assert.deepEqual(events(logged()), closed, 'closed by Browser.close, its profile untouched while it ran');
      assert.equal(logged().at(-1).localState, windows, 'Local State there until it exited');
      assert.equal(running(browser.pid), false);
      assert.equal(existsSync(chrome.profile), false, 'then the profile removed');
    });
  });

  it('is closed by Browser.close when the process spawned only started it, and then that process', async () => {
    await withStandIn(async (args, logged) => {
      const chrome = await launchChrome({ args: [...args, '--stand-in-wrapper'] });
      const [spawned, browser] = logged();
      assert.equal(spawned.pid, chrome.process.pid);
      assert.equal(chrome.process.exitCode, null, 'the process spawned still there');
      await chrome.close();
      assert.deepEqual(events(logged()), closed);
      assert.equal(logged().at(-1).localState, windows);
      assert.equal(running(browser.pid), false);
      assert.notEqual(chrome.process.exitCode ?? chrome.process.signalCode, null, 'the process spawned ended after');
      assert.equal(existsSync(chrome.profile), false);
    });
  });

  it('gives up at the timeout, and a Chrome that opens its port after is closed before the profile goes', async () => {
    await withStandIn(async (args, logged) => {
      const late = launchChrome({ args: [...args, '--stand-in-restart', '--stand-in-port-after=1500'], timeout: 1000 });
      await assert.rejects(late, /Chrome did not open its DevTools port in 1 s\.$/);
      const browser = logged()[1];
      assert.deepEqual(events(logged()), closed, 'closed by Browser.close, its profile untouched while it ran');
      assert.equal(logged().at(-1).localState, windows);
      assert.equal(running(browser.pid), false);
      assert.equal(existsSync(browser.profile), false, 'the profile removed once it had exited');
    });
  });
});

/** A WebSocket's part a Page uses: what it sends, and replies and events delivered by hand. */
class FakeSocket {
  constructor() {
    this.readyState = WebSocket.OPEN;
    this.sent = [];
  }
  send(text) { this.sent.push(JSON.parse(text)); }
  deliver(msg) { this.onmessage({ data: JSON.stringify(msg) }); }
  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }
}

describe('a tab (Page)', () => {
  it('sends numbered commands and resolves each by its id, in any order', async () => {
    const ws = new FakeSocket();
    const page = new Page(ws);
    const a = page.send('Page.enable');
    const b = page.send('Runtime.evaluate', { expression: '1 + 1' });
    assert.deepEqual(ws.sent, [{ id: 1, method: 'Page.enable', params: {} }, { id: 2, method: 'Runtime.evaluate', params: { expression: '1 + 1' } }]);
    ws.deliver({ id: 2, result: { two: 2 } });
    ws.deliver({ id: 1, result: {} });
    assert.deepEqual(await Promise.all([a, b]), [{}, { two: 2 }]);
    assert.equal(page.pending.size, 0);
  });

  it('rejects with the protocol\'s error, and evaluate with the page\'s', async () => {
    const ws = new FakeSocket();
    const page = new Page(ws);
    const bad = page.send('No.such');
    ws.deliver({ id: 1, error: { message: '\'No.such\' wasn\'t found', data: 'x' } });
    await assert.rejects(bad, /wasn't found \(x\)/);
    const thrown = page.evaluate('nope()');
    assert.deepEqual(ws.sent[1].params, { expression: 'nope()', awaitPromise: true, returnByValue: true, timeout: 120000 });
    ws.deliver({ id: 2, result: { exceptionDetails: { text: 'Uncaught', exception: { description: 'ReferenceError: nope is not defined' } } } });
    await assert.rejects(thrown, /ReferenceError: nope is not defined/);
    const value = page.evaluate('[1, 2]');
    ws.deliver({ id: 3, result: { result: { type: 'object', value: [1, 2] } } });
    assert.deepEqual(await value, [1, 2]);
  });

  it('hands events to their listeners', () => {
    const ws = new FakeSocket();
    const page = new Page(ws);
    const seen = [];
    page.on('Page.loadEventFired', (p) => seen.push(['load', p.timestamp]));
    page.on('Page.loadEventFired', () => seen.push(['again']));
    ws.deliver({ method: 'Page.loadEventFired', params: { timestamp: 5 } });
    ws.deliver({ method: 'Runtime.consoleAPICalled', params: {} });
    assert.deepEqual(seen, [['load', 5], ['again']]);
  });

  it('rejects what is waiting when the tab closes (a window closed by hand), and what is sent after', async () => {
    const ws = new FakeSocket();
    const page = new Page(ws);
    const waiting = page.evaluate('new Promise(() => {})');
    ws.close();
    await assert.rejects(waiting, /the tab closed/);
    await assert.rejects(page.send('Page.enable'), /the tab closed/);
    assert.equal(ws.sent.length, 1);
  });
});

describe('a real Chrome', { skip: process.env.CHROME_TEST ? false : 'set CHROME_TEST=1 to start Chrome' }, () => {
  it('opens a served page, keeps its Local State, and leaves no Chrome or profile behind', () => inOwnTemp(async () => {
    const site = mkdtempSync(join(tmpdir(), 'common-site-'));
    writeFileSync(join(site, 'index.html'), '<!doctype html><title>common</title><p>here</p>');
    const server = await serve(site);
    const url = `http://127.0.0.1:${server.address().port}/`;
    const chrome = await launchChrome({ url });
    try {
      if (process.platform === 'win32') {
        const state = JSON.parse(readFileSync(join(chrome.profile, 'Local State'), 'utf8'));
        assert.equal(state.password_manager?.os_password_blank, false, 'Chrome kept the answer');
      }
      let target = null;
      for (let i = 0; i < 50 && !target; i++) {
        const list = await (await fetch(`${chrome.endpoint}/json/list`)).json();
        target = list.find((t) => t.type === 'page' && t.url === url);
        if (!target) await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(target, 'its first tab is the page');
      const page = await Page.connect(target.webSocketDebuggerUrl);
      // Listed at its address while the first, blank document may still be there: wait for the page's.
      let title = '';
      for (let i = 0; i < 50 && title !== 'common'; i++) {
        title = await page.evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete' ? document.title : ''`);
        if (title !== 'common') await new Promise((r) => setTimeout(r, 100));
      }
      assert.equal(title, 'common');
      page.close();
      const blank = await chrome.newPage();
      assert.equal(await blank.evaluate('location.href'), 'about:blank');
      blank.close();
    } finally {
      await chrome.close();
      server.close();
      rmSync(site, { recursive: true, force: true });
    }
    await assert.rejects(fetch(`${chrome.endpoint}/json/version`), TypeError, 'nothing listens on its port');
    assert.equal(existsSync(chrome.profile), false);
    assert.deepEqual(profiles(), [], 'nor another');
  }));
});
