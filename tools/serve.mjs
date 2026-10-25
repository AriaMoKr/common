// A static file server for a site's public/, for development, as GitHub Pages serves it:
//   node node_modules/common/tools/serve.mjs [--root public] [--port 8080] [--host 0.0.0.0] [--name x]
// and prints `<name>: http://localhost:<port>/`.
// WebXR needs a secure context: http://localhost counts as one. A headset on the LAN can reach it
// over `adb reverse tcp:<port> tcp:<port>`. The tools that render in a browser import serve() to
// serve a folder on a free port of their own. outside's tools/serve.mjs, with the hallway's types.
import { createServer } from 'node:http';
import { createReadStream, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {Record<string, string>} */
export const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Serves the folder `root` on host:port (port 0: a free one); resolves to the listening server.
 * @param {string} root
 * @param {{ port?: number, host?: string }} [o] port 0 and host 127.0.0.1 by default
 * @returns {Promise<import('node:http').Server>}
 */
export function serve(root, { port = 0, host = '127.0.0.1' } = {}) {
  root = resolve(root);
  const server = createServer((req, res) => {
    let path;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    let file = normalize(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let stat;
    try {
      stat = statSync(file);
      if (stat.isDirectory()) {
        file = join(file, 'index.html');
        stat = statSync(file);
      }
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-cache',
      // As GitHub Pages does: the Hallway reads the sites' pictures, and they read the Hallway's.
      'access-control-allow-origin': '*',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}

/**
 * The command's options, from its arguments over a site's defaults: --root (public), --port (8080),
 * --host (localhost), --name (the name in the package.json where it runs, else that folder's).
 * @param {string[]} args
 * @param {{ root?: string, port?: number, host?: string, name?: string }} [defaults]
 * @param {string} [cwd]
 */
export function options(args, defaults = {}, cwd = process.cwd()) {
  /** @param {string} name */
  const opt = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
  };
  return {
    root: resolve(cwd, opt('root') ?? defaults.root ?? 'public'),
    port: Number(opt('port') ?? defaults.port ?? 8080),
    host: opt('host') ?? defaults.host ?? 'localhost',
    name: opt('name') ?? defaults.name ?? packageName(cwd),
  };
}

/** @param {string} dir */
function packageName(dir) {
  try {
    const { name } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    if (typeof name === 'string' && name) return name;
  } catch {
    /* none there */
  }
  return basename(dir);
}

/**
 * The command: serves as its arguments say over the site's defaults, and prints where. A site's own
 * tools/serve.mjs gives its port: `await start(process.argv.slice(2), { port: 8088 })`.
 * @param {string[]} [args]
 * @param {{ root?: string, port?: number, host?: string, name?: string }} [defaults]
 * @returns {Promise<import('node:http').Server>}
 */
export async function start(args = process.argv.slice(2), defaults = {}) {
  const { root, port, host, name } = options(args, defaults);
  const server = await serve(root, { port, host });
  const address = server.address();
  const shown = address && typeof address === 'object' ? address.port : port;
  console.log(`${name}: http://${host === '0.0.0.0' ? 'localhost' : host}:${shown}/`);
  return server;
}

/** Whether this module is the script node was started with (also through a link to the package). */
function isMain() {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) await start();
