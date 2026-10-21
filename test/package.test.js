// The package as the sites take it: from GitHub, as plain modules they vendor or bundle.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const modules = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js')).sort();

describe('the package', () => {
  it('names each module of src/ in its exports, and only those', () => {
    const exported = Object.entries(pkg.exports).filter(([k]) => k !== './package.json');
    assert.deepEqual(exported, modules.map((m) => [`./${m}`, `./src/${m}`]));
    assert.deepEqual(pkg.files, ['src/']);
  });

  it('resolves by its name to the same modules (as a site imports them)', async () => {
    for (const m of modules) assert.equal(await import(`${pkg.name}/${m}`), await import(`../src/${m}`), m);
  });

  it('has a .d.ts beside each module, for sites in TypeScript', () => {
    for (const m of modules) assert.ok(existsSync(new URL(`../src/${m.replace(/\.js$/, '.d.ts')}`, import.meta.url)), m);
  });

  it('runs nothing on install and needs nothing at run time', () => {
    assert.equal(pkg.dependencies, undefined);
    for (const s of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack']) assert.equal(pkg.scripts[s], undefined, s);
    assert.deepEqual(Object.keys(pkg.devDependencies), ['typescript']);
  });

  it('imports nothing, so a vendored copy works wherever it is put', () => {
    for (const m of modules) {
      const src = readFileSync(new URL(`../src/${m}`, import.meta.url), 'utf8');
      assert.doesNotMatch(src, /^\s*import\b/m, m);
      assert.doesNotMatch(src, /^\s*export\s[^;'"]*\bfrom\s*['"]/m, m);
      assert.doesNotMatch(src, /\bimport\s*\(/, m);
    }
  });

  it('is MIT licensed, for Node 22 or later', () => {
    assert.equal(pkg.license, 'MIT');
    assert.match(readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'), /^MIT License/);
    assert.equal(pkg.engines.node, '>=22');
    assert.equal(pkg.type, 'module');
  });
});
