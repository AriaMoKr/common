// A stand-in for Chrome, for test/chrome.test.js: launchChrome runs it by CHROME_PATH, on this Node.
// As Chrome does, it takes its profile's lock (a lockfile on Windows, a SingletonLock link
// elsewhere), listens on a port it writes into DevToolsActivePort, answers SystemInfo.getProcessInfo
// and Browser.close on its browser's socket, and lets go of the lock as it exits. Its own switches
// say what else it does:
//   --stand-in-log=<file>       where it logs what it does and sees, a line of JSON each: start (as
//                               the process spawned or the browser; the browser's says whether its
//                               profile's Local State is there), port, local-state-gone and
//                               lock-gone (taken from its profile while it runs), closed (by
//                               Browser.close), exit (with whether Local State is still there)
//   --stand-in-restart          the process spawned starts the browser, on its switches and the three
//                               Chrome added, and exits, as Chrome did with an update waiting
//   --stand-in-wrapper          the process spawned starts the browser and stays, as a wrapper does
//   --stand-in-port-after=<ms>  how long the browser takes to write its port once it listens (300)
// Each exits by itself after 20 s, or as soon as its log's folder is gone. Not a test file itself.

import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const value = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const profile = value('user-data-dir');
const log = value('stand-in-log');
const modes = ['--stand-in-restart', '--stand-in-wrapper'];
const as = argv.some((a) => modes.includes(a)) ? 'spawned' : 'browser';
const wanted = () => existsSync(dirname(log));
const note = (event, more = {}) => {
  if (wanted()) appendFileSync(log, `${JSON.stringify({ event, as, pid: process.pid, ...more })}\n`);
};
// There, as a link too (SingletonLock links to a name, not a file).
const there = (path) => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};
let lock = null;
const quit = () => {
  if (lock) rmSync(lock, { force: true });
  process.exit(0);
};

if (!wanted()) quit();
if (as === 'spawned') {
  note('start', { profile });
  const rest = argv.filter((a) => !modes.includes(a));
  const browser = [fileURLToPath(import.meta.url), ...rest, '--flag-switches-begin', '--flag-switches-end', '--noerrdialogs'];
  spawn(process.execPath, browser, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  if (argv.includes('--stand-in-restart')) quit();
  setTimeout(quit, 20000);
  setInterval(() => wanted() || quit(), 20);
} else {
  browse();
}

function browse() {
  const localState = join(profile, 'Local State');
  const hadState = existsSync(localState); // written first on Windows only
  note('start', { profile, localState: hadState });
  const exit = () => {
    note('exit', { localState: existsSync(localState) });
    quit();
  };
  setTimeout(exit, 20000);

  mkdirSync(profile, { recursive: true }); // as Chrome makes its user-data-dir when it isn't there
  if (process.platform === 'win32') {
    lock = join(profile, 'lockfile');
    writeFileSync(lock, '');
  } else {
    lock = join(profile, 'SingletonLock');
    symlinkSync(`${hostname()}-${process.pid}`, lock);
  }
  const gone = new Set();
  const look = () => {
    if (!wanted()) quit();
    for (const [event, path, was] of [['local-state-gone', localState, hadState], ['lock-gone', lock, true]]) {
      if (was && !gone.has(event) && !there(path)) {
        gone.add(event);
        note(event);
      }
    }
  };
  setInterval(look, 20);

  const id = randomUUID();
  const server = createServer((req, res) => res.writeHead(404).end());
  server.on('upgrade', (req, socket) => {
    if (req.url !== `/devtools/browser/${id}`) {
      socket.destroy();
      return;
    }
    const accept = createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.on('error', () => {});
    const send = (msg) => {
      const data = Buffer.from(JSON.stringify(msg));
      const head = data.length < 126 ? [0x81, data.length] : [0x81, 126, data.length >> 8, data.length & 0xff];
      socket.write(Buffer.concat([Buffer.from(head), data]));
    };
    const answer = ({ id: n, method }) => {
      if (method === 'SystemInfo.getProcessInfo') {
        send({ id: n, result: { processInfo: [{ type: 'browser', id: process.pid, cpuTime: 0 }] } });
      } else if (method === 'Browser.close') {
        send({ id: n, result: {} });
        note('closed');
        // As Chrome: the socket closed a moment after the answer, the process gone a moment after that.
        setTimeout(() => socket.end(Buffer.from([0x88, 0])), 20);
        setTimeout(exit, 50);
      } else {
        send({ id: n, error: { code: -32601, message: `'${method}' wasn't found` } });
      }
    };
    // A client's frames are masked; these are short.
    let buffered = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      for (;;) {
        if (buffered.length < 2) return;
        let length = buffered[1] & 0x7f;
        let at = 2;
        if (length === 126) {
          if (buffered.length < 4) return;
          length = buffered.readUInt16BE(2);
          at = 4;
        }
        if (buffered.length < at + 4 + length) return;
        const mask = buffered.subarray(at, at + 4);
        const data = Buffer.alloc(length);
        for (let i = 0; i < length; i++) data[i] = buffered[at + 4 + i] ^ mask[i % 4];
        const op = buffered[0] & 0x0f;
        buffered = buffered.subarray(at + 4 + length);
        if (op === 8) {
          socket.end(Buffer.from([0x88, 0]));
          return;
        }
        if (op === 1) answer(JSON.parse(data.toString()));
      }
    });
  });
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    setTimeout(() => {
      if (!wanted()) return;
      mkdirSync(profile, { recursive: true });
      writeFileSync(join(profile, 'DevToolsActivePort'), `${port}\n/devtools/browser/${id}`);
      note('port', { port });
    }, Number(value('stand-in-port-after') ?? 300));
  });
}
