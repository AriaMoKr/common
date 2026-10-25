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
// Needs Node 22+ (built-in WebSocket) and an installed Chrome, Edge or Chromium; set CHROME_PATH
// to choose one.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** @param {number} ms */
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
 * @typedef {object} Chrome
 * @property {string} endpoint its DevTools endpoint (http://127.0.0.1:<port>): /json/list and the
 *   rest, as a browser started with --remote-debugging-port has
 * @property {string} profile its profile's folder, removed by close()
 * @property {import('node:child_process').ChildProcess} process
 * @property {() => Promise<Page>} newPage opens a tab at about:blank
 * @property {() => Promise<void>} close ends Chrome and removes its profile
 */

/**
 * Starts Chrome on a new profile (newProfile), with its DevTools port open.
 * @param {object} [o]
 * @param {boolean} [o.headless] true (the default): no window; false: a visible window, for
 *   measuring performance on a desktop
 * @param {string[]} [o.args] more command-line switches (--window-size=1280,800, …)
 * @param {string} [o.url] what its first tab opens (about:blank)
 * @returns {Promise<Chrome>}
 */
export async function launchChrome({ headless = true, args = [], url = 'about:blank' } = {}) {
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
  const proc = spawn(chrome, switches, { stdio: 'ignore' });
  /** @type {Error | null} */
  let failed = null;
  proc.once('error', (e) => {
    failed = e;
  });
  const exited = new Promise((r) => proc.once('exit', r));
  const removeProfile = () => {
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      /* Chrome still holds a file; the OS cleans tmp */
    }
  };
  let port = '';
  for (let i = 0; i < 150 && !port && !failed && proc.exitCode === null; i++) {
    await sleep(100);
    try {
      port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; // the port Chrome picked
    } catch {
      /* not written yet */
    }
  }
  if (!port) {
    proc.kill();
    removeProfile();
    throw new Error(failed ? `Chrome did not start (${chrome}): ${/** @type {Error} */ (failed).message}` : 'Chrome did not open its DevTools port.');
  }
  const endpoint = `http://127.0.0.1:${port}`;
  return {
    endpoint,
    profile,
    process: proc,
    async newPage() {
      const target = await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json();
      return Page.connect(target.webSocketDebuggerUrl);
    },
    async close() {
      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill();
        await Promise.race([exited, sleep(5000)]);
      }
      removeProfile();
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
