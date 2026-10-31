// A site's tools in JavaScript (outside's preview.mjs and serve.mjs, vrlbry's quest-perf.mjs,
// layersharedsession's guarded vendor copy), using common's tools by their names. test/types.test.js
// checks it as outside's tsconfig.node.json checks its tools/; the lines marked as expected errors
// fail the check if they are not, so the types must be real. It is never run.
import { Page, findChrome, launchChrome, localState, newProfile, sleep } from 'common/tools/chrome.mjs';
import { TYPES, options, serve, start } from 'common/tools/serve.mjs';
import { LIST, installed, readList, run, vendor } from 'common/tools/vendor.mjs';

// outside's preview.mjs: the page served on a free port, drawn in a headless Chrome.
const server = await serve('public');
const chrome = await launchChrome({ args: ['--window-size=1280,800'] });
try {
  const page = await chrome.newPage();
  await page.goto(`http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}/`, 1000);
  for (let i = 0; i < 100 && !(await page.evaluate('!!window.__outside')); i++) await sleep(200);
  page.on('Runtime.consoleAPICalled', (params) => console.log(params.type));
  await page.send('Page.enable');
  page.close();
} finally {
  await chrome.close();
  server.close();
}

// quest-perf.mjs: a window on the page to measure, its tab connected by its DevTools endpoint.
const shown = await launchChrome({ headless: false, url: 'http://localhost:8080/?perf' });
/** @type {{ type: string, webSocketDebuggerUrl: string }[]} */
const tabs = await (await fetch(`${shown.endpoint}/json/list`)).json();
const perf = await Page.connect(tabs.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? '');
perf.close();
shown.process.kill();
const profiles = [shown.profile, newProfile({ platform: 'linux', now: 0 })];
const browser = findChrome();
const changed = localState(0).password_manager.os_password_last_changed;

// A site's own tools/serve.mjs, on its port.
const dev = await start(process.argv.slice(2), { port: 8090 });
dev.close();
const served = options(['--port', '8091'], { root: 'public' });
const html = TYPES['.html'];

// layersharedsession's guarded vendor copy, and a site's list.
if (!installed(process.cwd())) run();
const copied = vendor(process.cwd(), { list: readList(process.cwd()) }).copied.length;
const list = LIST;

// @ts-expect-error a Chrome's switches are a list
await launchChrome({ args: '--window-size=1280,800' });
// @ts-expect-error a tab waits a number of milliseconds
await (await chrome.newPage()).goto('about:blank', '1s');
// @ts-expect-error a port is a number
await serve('public', { port: '8090' });
// @ts-expect-error an entry says where it goes
vendor('.', { list: [{ from: 'three/build/three.module.js' }] });
// @ts-expect-error the list's name stays as it is
LIST = 'list.json';

export { profiles, browser, changed, served, html, copied, list };
