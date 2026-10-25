// tools/serve.mjs: a site's public/ as GitHub Pages serves it, on a free port; and as a command.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TYPES, options, serve } from '../tools/serve.mjs';

const tools = fileURLToPath(new URL('../tools/', import.meta.url));
let site;
let server;
let base;

before(async () => {
  site = mkdtempSync(join(tmpdir(), 'common-serve-'));
  mkdirSync(join(site, 'public', 'js'), { recursive: true });
  mkdirSync(join(site, 'public', 'views'));
  writeFileSync(join(site, 'public', 'index.html'), '<!doctype html><title>here</title>');
  writeFileSync(join(site, 'public', 'js', 'main.js'), 'export const x = 1;\n');
  writeFileSync(join(site, 'public', 'js', 'index.html'), 'the js folder');
  for (const ext of ['jpg', 'jpeg', 'webp', 'PNG', 'bin']) writeFileSync(join(site, 'public', 'views', `a.${ext}`), 'pixels');
  writeFileSync(join(site, 'secret.txt'), 'not served');
  writeFileSync(join(site, 'package.json'), JSON.stringify({ name: 'garden' }));
  server = await serve(join(site, 'public'));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  rmSync(site, { recursive: true, force: true, maxRetries: 5 });
});

describe('serve', () => {
  it('listens on a free port of 127.0.0.1 by default, and resolves to the listening server', () => {
    assert.equal(server.address().address, '127.0.0.1');
    assert.ok(server.address().port > 0);
    assert.equal(server.listening, true);
  });

  it('serves a folder\'s index.html, and each file with its type, as Pages does', async () => {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(page.headers.get('access-control-allow-origin'), '*');
    assert.equal(page.headers.get('cache-control'), 'no-cache');
    assert.equal(await page.text(), '<!doctype html><title>here</title>');
    assert.equal(await (await fetch(`${base}/js/`)).text(), 'the js folder');
    assert.equal(await (await fetch(`${base}/js`)).text(), 'the js folder');
    const js = await fetch(`${base}/js/main.js?v=2`);
    assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.equal(js.headers.get('content-length'), '20');
    assert.equal(await js.text(), 'export const x = 1;\n');
    const types = {};
    for (const ext of ['jpg', 'jpeg', 'webp', 'PNG', 'bin']) types[ext] = (await fetch(`${base}/views/a.${ext}`)).headers.get('content-type');
    assert.deepEqual(types, { jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', PNG: 'image/png', bin: 'application/octet-stream' });
  });

  it('has the hallway\'s types and outside\'s', () => {
    assert.deepEqual(Object.keys(TYPES).sort(), ['.css', '.html', '.ico', '.jpeg', '.jpg', '.js', '.json', '.mjs', '.png', '.svg', '.txt', '.webp']);
  });

  it('answers HEAD with the headers alone', async () => {
    const r = await fetch(`${base}/js/main.js`, { method: 'HEAD' });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-length'), '20');
    assert.equal(await r.text(), '');
  });

  it('says what is not there, keeps to its folder, and turns a bad address away', async () => {
    const missing = await fetch(`${base}/nothing.js`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal((await fetch(`${base}/views/`)).status, 404, 'a folder without index.html');
    assert.equal((await fetch(`${base}/..%2fsecret.txt`)).status, 403);
    assert.equal((await fetch(`${base}/js/..%2f..%2f..%2fsecret.txt`)).status, 403);
    assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
  });

  it('takes a folder relative to where it runs, and rejects a port in use', async () => {
    const cwd = process.cwd();
    process.chdir(site);
    let rel;
    try {
      rel = await serve('public/');
    } finally {
      process.chdir(cwd);
    }
    try {
      assert.equal(await (await fetch(`http://127.0.0.1:${rel.address().port}/js/main.js`)).text(), 'export const x = 1;\n');
      assert.equal((await fetch(`http://127.0.0.1:${rel.address().port}/..%2fsecret.txt`)).status, 403);
      await assert.rejects(serve(site, { port: rel.address().port }), /EADDRINUSE/);
    } finally {
      rel.close();
    }
  });
});

describe('its options', () => {
  it('serve public/ on 8080 at localhost, named from the site\'s package.json, by default', () => {
    assert.deepEqual(options([], {}, site), { root: join(site, 'public'), port: 8080, host: 'localhost', name: 'garden' });
  });

  it('take a site\'s own defaults (its port), and the command line over them', () => {
    assert.deepEqual(options([], { port: 8088, name: 'hallway' }, site), { root: join(site, 'public'), port: 8088, host: 'localhost', name: 'hallway' });
    assert.deepEqual(
      options(['--port', '9000', '--host', '0.0.0.0', '--root', 'dist', '--name', 'x'], { port: 8088 }, site),
      { root: join(site, 'dist'), port: 9000, host: '0.0.0.0', name: 'x' },
    );
    assert.equal(options(['--port'], { port: 8088 }, site).port, 8088, 'a flag without its value is left out');
  });

  it('name the folder where there is no package.json', () => {
    const bare = join(site, 'public');
    assert.equal(options([], {}, bare).name, 'public');
  });
});

/**
 * Runs the command until it prints its line; resolves to the line and stop(), which ends it and
 * waits (a running process holds its folder on Windows).
 */
function command(script, args, cwd) {
  const proc = spawn(process.execPath, [script, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise((r) => proc.once('exit', r));
  const stop = () => {
    proc.kill();
    return exited;
  };
  return new Promise((ok, fail) => {
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => {
      out += d;
      if (out.includes('\n')) ok({ line: out.trim(), stop });
    });
    proc.stderr.on('data', (d) => (err += d));
    exited.then((code) => fail(new Error(`exited ${code}: ${err}`)));
  });
}

describe('the command', () => {
  it('serves the site\'s public/ from its root, and prints <name>: http://…/', async () => {
    const { line, stop } = await command(join(tools, 'serve.mjs'), ['--port', '0', '--host', '127.0.0.1'], site);
    try {
      const m = line.match(/^garden: http:\/\/127\.0\.0\.1:(\d+)\/$/);
      assert.ok(m, line);
      assert.equal(await (await fetch(`http://127.0.0.1:${m[1]}/`)).text(), '<!doctype html><title>here</title>');
    } finally {
      await stop();
    }
  });

  it('runs through a link to the package too (a file: dependency, npm link)', async () => {
    const link = join(site, 'linked-tools');
    symlinkSync(resolve(tools), link, process.platform === 'win32' ? 'junction' : 'dir');
    try {
      const { line, stop } = await command(join(link, 'serve.mjs'), ['--port', '0', '--host', '127.0.0.1', '--name', 'linked'], site);
      await stop();
      assert.match(line, /^linked: http:\/\/127\.0\.0\.1:\d+\/$/);
    } finally {
      unlinkSync(link); // the link alone, before the site's folder goes
    }
  });
});
