// tools/vendor.mjs: a site's node_modules into its public/vendor/, as its vendor.json lists, in a
// temporary site; nothing for a site installed under someone's node_modules.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LIST, installed, readList, vendor } from '../tools/vendor.mjs';

const here = fileURLToPath(new URL('..', import.meta.url));
const script = join(here, 'tools', 'vendor.mjs');
const base = mkdtempSync(join(tmpdir(), 'common-vendor-'));
after(() => rmSync(base, { recursive: true, force: true, maxRetries: 5 }));

let sites = 0;
/** A site with these files under its root, and its vendor.json. */
function site(files, list, { under = '' } = {}) {
  const root = join(base, under, `site${++sites}`);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  mkdirSync(root, { recursive: true });
  if (list) writeFileSync(join(root, LIST), JSON.stringify(list));
  return root;
}

/** Every file under dir, as relative paths with /, sorted. */
function tree(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? tree(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]))
    .sort();
}

const MODULES = {
  'node_modules/three/build/three.module.js': 'import "./three.core.js";',
  'node_modules/three/build/three.core.js': 'core',
  'node_modules/three/LICENSE': 'MIT three',
  'node_modules/@scope/core/dist/a.mjs': 'a',
  'node_modules/@scope/core/dist/a.mjs.map': 'map',
  'node_modules/@scope/core/dist/a.d.mts': 'types',
  'node_modules/@scope/core/dist/b.js': 'b',
  'node_modules/@scope/core/dist/b.d.ts': 'types',
  'node_modules/@scope/core/dist/inner/c.mjs': 'c',
  'node_modules/pkg/src/door.js': 'door',
  'node_modules/pkg/src/door.d.ts': 'types',
  'node_modules/pkg/tools/serve.mjs': 'a tool',
};

describe('vendor', () => {
  it('copies a file where `to` says, the same bytes', () => {
    const root = site(MODULES, [{ from: 'three/build/three.module.js', to: 'three/build/three.module.js' }, { from: 'three/LICENSE', to: 'three/LICENSE' }]);
    const r = vendor(root);
    assert.deepEqual(r, { skipped: false, out: join(root, 'public', 'vendor'), copied: ['three/build/three.module.js', 'three/LICENSE'] });
    assert.equal(readFileSync(join(root, 'public/vendor/three/build/three.module.js'), 'utf8'), 'import "./three.core.js";');
    assert.deepEqual(tree(join(root, 'public/vendor')), ['three/LICENSE', 'three/build/three.module.js']);
  });

  it('copies the modules of a folder by their extension, not its maps, types or subfolders', () => {
    const root = site(MODULES, [{ dir: '@scope/core/dist', to: 'core', ext: '.mjs' }, { dir: 'pkg/src', to: 'pkg', ext: '.js' }]);
    vendor(root);
    assert.deepEqual(tree(join(root, 'public/vendor')), ['core/a.mjs', 'pkg/door.js']);
  });

  it('copies .js and .mjs from a folder when no extension is given', () => {
    const root = site(MODULES, [{ dir: '@scope/core/dist', to: 'core' }]);
    vendor(root);
    assert.deepEqual(tree(join(root, 'public/vendor')), ['core/a.mjs', 'core/b.js']);
  });

  it('passes over an optional entry that is not installed, file or folder', () => {
    const root = site(MODULES, [
      { from: 'iwer/build/iwer.module.js', to: 'iwer/iwer.module.js', optional: true },
      { dir: 'nothing/dist', to: 'nothing', optional: true },
      { from: 'three/build/three.core.js', to: 'three/build/three.core.js', optional: true },
    ]);
    assert.deepEqual(vendor(root).copied, ['three/build/three.core.js']);
  });

  it('fails on a required entry that is not installed, and leaves the copies as they were', () => {
    const root = site({ ...MODULES, 'public/vendor/three/old.js': 'old' }, [
      { from: 'three/LICENSE', to: 'three/LICENSE' },
      { from: 'trystero/index.js', to: 'trystero/index.js' },
    ]);
    assert.throws(() => vendor(root), { message: 'vendor: trystero/index.js is missing; run npm install' });
    assert.deepEqual(tree(join(root, 'public/vendor')), ['three/old.js']);
    const folder = site(MODULES, [{ dir: 'gone/dist', to: 'gone' }]);
    assert.throws(() => vendor(folder), /gone\/dist is missing/);
  });

  it('empties public/vendor/ first, so nothing stale is left there', () => {
    const root = site({ ...MODULES, 'public/vendor/old/x.js': 'old', 'public/index.html': 'page' }, [{ from: 'three/LICENSE', to: 'three/LICENSE' }]);
    vendor(root);
    assert.deepEqual(tree(join(root, 'public')), ['index.html', 'vendor/three/LICENSE']);
  });

  it('does nothing for a site installed under someone\'s node_modules (its dependencies are beside it)', () => {
    const root = site({ 'package.json': '{}' }, [{ from: 'three/LICENSE', to: 'three/LICENSE' }], { under: 'hallway/node_modules' });
    assert.equal(installed(root), true);
    assert.deepEqual(vendor(root), { skipped: true, out: join(root, 'public', 'vendor'), copied: [] });
    assert.equal(existsSync(join(root, 'public')), false);
    const noList = site({}, null, { under: 'x/node_modules/@scope' });
    assert.equal(vendor(noList).skipped, true, 'without reading a list');
    assert.equal(installed(base), false);
  });

  it('copies only common\'s src/ modules from the package itself: never tools/, never the types', () => {
    const root = site({}, [{ dir: 'common/src', to: 'common', ext: '.js' }, { from: 'common/LICENSE', to: 'common/LICENSE' }]);
    mkdirSync(join(root, 'node_modules'));
    const link = join(root, 'node_modules', 'common');
    symlinkSync(here, link, process.platform === 'win32' ? 'junction' : 'dir');
    try {
      vendor(root);
    } finally {
      unlinkSync(link); // the link alone
    }
    const src = readdirSync(join(here, 'src')).filter((f) => f.endsWith('.js')).sort();
    assert.ok(src.includes('back-history.js'));
    assert.deepEqual(tree(join(root, 'public/vendor')), ['common/LICENSE', ...src.map((f) => `common/${f}`)]);
  });
});

describe('the list, vendor.json', () => {
  const bad = (list) => {
    const root = site({}, null);
    writeFileSync(join(root, LIST), typeof list === 'string' ? list : JSON.stringify(list));
    return () => readList(root);
  };

  it('is read from the site\'s root', () => {
    const list = [{ from: 'a/b.js', to: 'a/b.js', optional: true }, { dir: 'c/dist', to: 'c', ext: '.mjs' }];
    assert.deepEqual(readList(site({}, list)), list);
  });

  it('is needed, as a list', () => {
    assert.throws(() => readList(site({}, null)), /vendor: cannot read .*vendor\.json/);
    assert.throws(bad('{ not json'), /cannot read/);
    assert.throws(bad({ from: 'a', to: 'a' }), /vendor: vendor\.json is not a list/);
  });

  it('has a file or a folder in each entry, and where it goes', () => {
    assert.throws(bad([null]), /entry 1 is not an object/);
    assert.throws(bad([{ from: 'a', dir: 'b', to: 'c' }]), /entry 1 needs one of "from" and "dir"/);
    assert.throws(bad([{ to: 'c' }]), /needs one of "from" and "dir"/);
    assert.throws(bad([{ from: 'a.js', to: 'a.js' }, { from: 'a' }]), /entry 2 needs "to"/);
    assert.throws(bad([{ from: '', to: 'a' }]), /"from" is not a name/);
    assert.throws(bad([{ dir: 'a', to: 'a', ext: 5 }]), /"ext" is not a name/);
    assert.throws(bad([{ from: 'a', to: 'a', optional: 'yes' }]), /"optional" is true or false/);
  });

  it('keeps each entry inside node_modules and public/vendor/', () => {
    assert.throws(bad([{ from: '../secret', to: 'a' }]), /"\.\.\/secret" leaves its folder/);
    assert.throws(bad([{ from: 'a', to: 'x/../../index.html' }]), /leaves its folder/);
    assert.throws(bad([{ dir: 'a', to: '.' }]), /leaves its folder/);
    assert.throws(bad([{ from: process.platform === 'win32' ? 'C:\\a.js' : '/a.js', to: 'a' }]), /leaves its folder/);
  });
});

describe('the command', () => {
  const run = (cwd) => spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });

  it('runs from the site\'s root, as its postinstall', () => {
    const root = site(MODULES, [{ from: 'three/LICENSE', to: 'three/LICENSE' }, { dir: 'pkg/src', to: 'pkg' }]);
    const r = run(root);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, `vendor: copied 2 files into ${join(root, 'public', 'vendor')}\n`);
    assert.deepEqual(tree(join(root, 'public/vendor')), ['pkg/door.js', 'three/LICENSE']);
  });

  it('fails the install when something required is missing', () => {
    const r = run(site({}, [{ from: 'three/LICENSE', to: 'three/LICENSE' }]));
    assert.equal(r.status, 1);
    assert.equal(r.stderr, 'vendor: three/LICENSE is missing; run npm install\n');
  });

  it('says nothing and does nothing under node_modules', () => {
    const root = site({}, null, { under: 'other/node_modules' });
    const r = run(root);
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, '', '']);
    assert.deepEqual(readdirSync(root), []);
  });
});
