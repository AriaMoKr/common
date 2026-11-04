/** The browser to start: CHROME_PATH, else the first Chrome, Edge or Chromium installed. */
export function findChrome(): string;
/**
 * A new profile's Local State: the account's password is not blank, as of `now`.
 * @param {number} [now] ms since 1970, as Date.now()
 */
export function localState(now?: number): {
    password_manager: {
        os_password_blank: boolean;
        os_password_last_changed: string;
    };
};
/**
 * A new, empty profile folder in the system's temp folder, for one Chrome. On Windows its Local State
 * is written first (localState): without it Chrome logs on with an empty password to see whether
 * the account's is blank, a failed logon each launch.
 * @param {{ platform?: string, now?: number }} [o] the platform (process.platform) and the time
 *   (Date.now()), for tests
 * @returns {string} its path
 */
export function newProfile({ platform, now }?: {
    platform?: string;
    now?: number;
}): string;
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
export function launchChrome({ headless, args, url, timeout }?: {
    headless?: boolean | undefined;
    args?: string[] | undefined;
    url?: string | undefined;
    timeout?: number | undefined;
}): Promise<Chrome>;
/** @type {(ms: number) => Promise<void>} */
export const sleep: (ms: number) => Promise<void>;
/** One tab: send DevTools commands, listen to events, evaluate JavaScript. */
export class Page {
    /**
     * Connects to a tab by its WebSocket URL (webSocketDebuggerUrl in /json/list).
     * @param {string} url
     */
    static connect(url: string): Promise<Page>;
    /** @param {WebSocket} ws */
    constructor(ws: WebSocket);
    ws: WebSocket;
    id: number;
    /** @type {Map<number, { res: (v: any) => void, rej: (e: Error) => void }>} */
    pending: Map<number, {
        res: (v: any) => void;
        rej: (e: Error) => void;
    }>;
    /** @type {Map<string, ((params: any) => void)[]>} */
    listeners: Map<string, ((params: any) => void)[]>;
    /**
     * Sends a DevTools command; resolves to its result.
     * @param {string} method
     * @param {object} [params]
     * @returns {Promise<any>}
     */
    send(method: string, params?: object): Promise<any>;
    /**
     * Calls fn with each event's params.
     * @param {string} method
     * @param {(params: any) => void} fn
     */
    on(method: string, fn: (params: any) => void): void;
    /**
     * Value of a JS expression (promises are awaited); throws with the page's error message.
     * @param {string} expression
     * @returns {Promise<any>}
     */
    evaluate(expression: string): Promise<any>;
    /**
     * Load `url` and wait `settleMs` for the app to render.
     * @param {string} url
     * @param {number} [settleMs]
     */
    goto(url: string, settleMs?: number): Promise<void>;
    close(): void;
}
export type Chrome = {
    /**
     * its DevTools endpoint (http://127.0.0.1:<port>): /json/list and the
     * rest, as a browser started with --remote-debugging-port has
     */
    endpoint: string;
    /**
     * its profile's folder, removed by close() once Chrome has let go of it
     */
    profile: string;
    /**
     * the process spawned, which may not
     * be the browser: a Chrome that restarted itself runs on in another
     */
    process: import("node:child_process").ChildProcess;
    /**
     * opens a tab at about:blank
     */
    newPage: () => Promise<Page>;
    /**
     * ends Chrome by Browser.close, whichever process it is, then
     * the process spawned if it is still there, then removes the profile once Chrome has let go of it
     */
    close: () => Promise<void>;
};
