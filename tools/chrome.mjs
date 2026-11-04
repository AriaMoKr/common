// Chrome over the DevTools protocol, for the sites' tools that need a real browser: headless for
// pictures and checks (breadboard's check-browser.mjs, outside's preview.mjs, hallway's
// door-views.mjs), or a visible window for measuring performance on a desktop (vrlbry's and music's
// quest-perf.mjs). Breadboard's scripts/lib/chrome.mjs, with launchChrome's options.
//
// Each Chrome starts on a new profile of its own: current Chrome opens its DevTools port only on a
// profile that is not the default one. On Windows a new profile makes Chrome test whether the
// account's password is blank by logging on with an empty one: a failed logon each launch, and ten
// in ten minutes lock the account. So newProfile writes the answer into the profile's Local State
// before Chrome starts, stamped now; Chrome only tests again if the password changes after that.
//
// The process spawned may not stay the browser: with an update waiting, Chrome starts the new
// version on the same switches and profile and exits, and the new one writes the port (156.0.8078.74
// to .80, on 2026-11-02). So launchChrome reads the port until its deadline, whatever the process
// spawned does, and close() ends the browser by Browser.close, whichever process it is. A profile goes
// only once no Chrome holds it: removed under a Chrome still starting, it is a new, empty profile to
// that Chrome, and the failed logon above.
//
// Needs Node 22+ (built-in WebSocket) and an installed Chrome, Edge or Chromium; set CHROME_PATH
// to choose one.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** @type {(ms: number) => Promise<void>} */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @type {Record<string, string[]>} */
const CANDIDATES = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'],
};

/** The browser to start: CHROME_PATH, else the first Chrome, Edge or Chromium installed. */
export function findChrome() {
  const path = process.env.CHROME_PATH ?? (CANDIDATES[process.platform] ?? []).find((p) => existsSync(p));
  if (!path) throw new Error('No Chrome, Edge or Chromium found. Set CHROME_PATH to one.');
  return path;
}

/**
 * A new profile's Local State: the account's password is not blank, as of `now`.
 * @param {number} [now] ms since 1970, as Date.now()
 */
export function localState(now = Date.now()) {
  const micros = (BigInt(Math.trunc(now)) + 11644473600000n) * 1000n; // Chrome's clock: microseconds since 1601
  return { password_manager: { os_password_blank: false, os_password_last_changed: String(micros) } };
}

/**
 * A new, empty profile folder in the system's temp folder, for one Chrome. On Windows its Local State
 * is written first (localState): without it Chrome logs on with an empty password to see whether
 * the account's is blank, a failed logon each launch.
 * @param {{ platform?: string, now?: number }} [o] the platform (process.platform) and the time
 *   (Date.now()), for tests
 * @returns {string} its path
 */
export function newProfile({ platform = process.platform, now = Date.now() } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'common-chrome-'));
  if (platform === 'win32') writeFileSync(join(profile, 'Local State'), JSON.stringify(localState(now)));
  return profile;
}

/**
 * What the Chrome on a profile wrote into its DevToolsActivePort as it began to listen: its port and
 * its browser's socket path (/devtools/browser/<id>). Null until it has.
 * @param {string} profile
 */
function activePort(profile) {
  try {
    const [, port, path] = /^(\d+)\n(\/\S+)/.exec(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8')) ?? [];
    return port && path ? { port, path } : null;
  } catch {
    return null; // not written yet
  }
}

/**
 * Whether a process is running.
 * @param {number} pid
 */
function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return /** @type {NodeJS.ErrnoException} */ (e).code === 'EPERM'; // there, but not ours to signal
  }
}

/**
 * Whether a Chrome holds a profile: its lockfile, which Chrome deletes as it exits (Windows), or its
 * SingletonLock, a link to the host and process id of the Chrome that made it (elsewhere).
 * @param {string} profile
 */
function held(profile) {
  if (existsSync(join(profile, 'lockfile'))) return true;
  try {
    const pid = Number(readlinkSync(join(profile, 'SingletonLock')).split('-').pop());
    return pid > 0 && running(pid);
  } catch {
    return false; // no lock
  }
}

/**
 * Resolves once `done()` is true, or after `ms`: to `done()`.
 * @param {() => boolean} done
 * @param {number} ms
 */
async function until(done, ms) {
  const end = Date.now() + ms;
  while (!done() && Date.now() < end) await sleep(50);
  return done();
}

/**
 * Asks the browser on a DevTools socket for its process id (SystemInfo.getProcessInfo), then to close
 * (Browser.close). Resolves to the id once it has answered, or the socket closed, or 5 s passed.
 * @param {string} url
 * @returns {Promise<number | null>}
 */
function askToClose(url) {
  return new Promise((resolve) => {
    /** @type {number | null} */
    let pid = null;
    const ws = new WebSocket(url);
    const done = () => {
      clearTimeout(timer);
      ws.close();
      resolve(pid);
    };
    const timer = setTimeout(done, 5000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'SystemInfo.getProcessInfo' }));
    ws.onmessage = (m) => {
      const { id, result } = JSON.parse(String(m.data));
      if (id === 1) {
        pid = result?.processInfo?.find((/** @type {{ type: string }} */ p) => p.type === 'browser')?.id ?? null;
        ws.send(JSON.stringify({ id: 2, method: 'Browser.close' }));
      } else if (id === 2) done();
    };
    ws.onerror = done;
    ws.onclose = done;
  });
}

/**
 * Closes the Chrome that wrote `active` by Browser.close, which ends the browser whichever process it
 * is, and resolves once that process has exited. One still running 10 s on is ended by its id.
 * @param {{ port: string, path: string }} active
 */
async function closeBrowser({ port, path }) {
  const pid = await askToClose(`ws://127.0.0.1:${port}${path}`);
  if (pid === null || (await until(() => !running(pid), 10000))) return;
  try {
    process.kill(pid);
  } catch {
    /* gone meanwhile */
  }
  await until(() => !running(pid), 5000);
}

/**
 * Waits up to 5 s for any Chrome on a profile to let go of it, closing by Browser.close one that
 * opens its port meanwhile: resolves to whether the profile is free.
 * @param {string} profile
 */
async function release(profile) {
  const end = Date.now() + 5000;
  let closed = '';
  while (held(profile) && Date.now() < end) {
    const active = activePort(profile);
    if (active && active.port !== closed) {
      closed = active.port;
      await closeBrowser(active);
    } else {
      await sleep(100);
    }
  }
  return !held(profile);
}

/**
 * @typedef {object} Chrome
 * @property {string} endpoint its DevTools endpoint (http://127.0.0.1:<port>): /json/list and the
 *   rest, as a browser started with --remote-debugging-port has
 * @property {string} profile its profile's folder, removed by close() once Chrome has let go of it
 * @property {import('node:child_process').ChildProcess} process the process spawned, which may not
 *   be the browser: a Chrome that restarted itself runs on in another
 * @property {() => Promise<Page>} newPage opens a tab at about:blank
 * @property {() => Promise<void>} close ends Chrome by Browser.close, whichever process it is, then
 *   the process spawned if it is still there, then removes the profile once Chrome has let go of it
 */

/**
 * Starts Chrome on a new profile (newProfile), with its DevTools port open. Chrome may restart
 * itself, to start an update waiting: the port is read until `timeout`, from whichever process
 * writes it. Then, if it hasn't come, the process spawned is ended, any Chrome that opens its port
 * meanwhile is closed by Browser.close, and the profile is removed once no Chrome holds it, waiting
 * up to 5 s; else the error says where it is left.
 * @param {object} [o]
 * @param {boolean} [o.headless] true (the default): no window; false: a visible window, for
 *   measuring performance on a desktop
 * @param {string[]} [o.args] more command-line switches (--window-size=1280,800, …)
 * @param {string} [o.url] what its first tab opens (about:blank)
 * @param {number} [o.timeout] how long Chrome has to open its DevTools port, in ms (60000)
 * @returns {Promise<Chrome>}
 */
export async function launchChrome({ headless = true, args = [], url = 'about:blank', timeout = 60000 } = {}) {
  if (typeof WebSocket === 'undefined') throw new Error('This script needs Node 22 or newer (built-in WebSocket).');
  const chrome = findChrome();
  const profile = newProfile();
  const switches = [
    ...(headless ? ['--headless=new'] : []),
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    ...args,
    url,
  ];
  const removeProfile = () => {
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      /* a file still held: the profile stays */
    }
  };
  // A Node script stands in for Chrome (test/chrome.js), run by this Node: Windows starts only programs.
  const [command, ...first] = /\.[cm]?js$/.test(chrome) ? [process.execPath, chrome] : [chrome];
  /** @type {import('node:child_process').ChildProcess} */
  let proc;
  try {
    proc = spawn(command, [...first, ...switches], { stdio: 'ignore' });
  } catch (e) {
    removeProfile(); // not a program (EFTYPE), or a .cmd without a shell (EINVAL): thrown, not emitted
    throw new Error(`Chrome did not start (${chrome}): ${/** @type {Error} */ (e).message}`);
  }
  /** @type {Error | null} */
  let failed = null;
  proc.once('error', (e) => {
    failed = e;
  });
  const spawnedEnded = () => proc.exitCode !== null || proc.signalCode !== null;
  const endSpawned = async () => {
    if (!spawnedEnded()) {
      proc.kill();
      await until(spawnedEnded, 5000); // polled: a timer raced against the exit would keep Node up 5 s
    }
  };
  // The port Chrome picked, from whichever process writes it: one spawned that exits first may have
  // started the browser.
  const deadline = Date.now() + timeout;
  let written = null;
  while (!written && !failed && Date.now() < deadline) {
    await sleep(100);
    written = activePort(profile);
  }
  if (!written) {
    await endSpawned();
    const free = failed !== null || (await release(profile));
    if (free) removeProfile();
    if (failed) throw new Error(`Chrome did not start (${chrome}): ${/** @type {Error} */ (failed).message}`);
    throw new Error(`Chrome did not open its DevTools port in ${timeout / 1000} s.${free ? '' : ` A Chrome still holds its profile, left at ${profile}.`}`);
  }
  const active = written;
  const endpoint = `http://127.0.0.1:${active.port}`;
  return {
    endpoint,
    profile,
    process: proc,
    async newPage() {
      const target = /** @type {{ webSocketDebuggerUrl: string }} */ (await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json()); // the tab DevTools opened
      return Page.connect(target.webSocketDebuggerUrl);
    },
    async close() {
      await closeBrowser(active);
      await endSpawned();
      if (await until(() => !held(profile), 5000)) removeProfile();
    },
  };
}

/** One tab: send DevTools commands, listen to events, evaluate JavaScript. */
export class Page {
  /**
   * Connects to a tab by its WebSocket URL (webSocketDebuggerUrl in /json/list).
   * @param {string} url
   */
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('could not connect to the tab'));
    });
    return new Page(ws);
  }

  /** @param {WebSocket} ws */
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    /** @type {Map<number, { res: (v: any) => void, rej: (e: Error) => void }>} */
    this.pending = new Map();
    /** @type {Map<string, ((params: any) => void)[]>} */
    this.listeners = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      const waiting = msg.id && this.pending.get(msg.id);
      if (waiting) {
        this.pending.delete(msg.id);
        if (msg.error) waiting.rej(new Error(`${msg.error.message} (${msg.error.data ?? ''})`));
        else waiting.res(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params);
      }
    };
    // The tab or the browser closed (a visible window closed by hand): nothing will answer.
    ws.onclose = () => {
      for (const { rej } of this.pending.values()) rej(new Error('the tab closed'));
      this.pending.clear();
    };
  }

  /**
   * Sends a DevTools command; resolves to its result.
   * @param {string} method
   * @param {object} [params]
   * @returns {Promise<any>}
   */
  send(method, params = {}) {
    return new Promise((res, rej) => {
      if (this.ws.readyState !== WebSocket.OPEN) {
        rej(new Error('the tab closed'));
        return;
      }
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /**
   * Calls fn with each event's params.
   * @param {string} method
   * @param {(params: any) => void} fn
   */
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method)?.push(fn);
  }

  /**
   * Value of a JS expression (promises are awaited); throws with the page's error message.
   * @param {string} expression
   * @returns {Promise<any>}
   */
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 120000 });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }

  /**
   * Load `url` and wait `settleMs` for the app to render.
   * @param {string} url
   * @param {number} [settleMs]
   */
  async goto(url, settleMs = 1500) {
    await this.send('Page.navigate', { url });
    await sleep(settleMs);
  }

  close() {
    this.ws.close();
  }
}
