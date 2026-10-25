// The package as the sites take it: from GitHub, as plain modules they vendor or bundle, tools their
// Node scripts run, and a Pages workflow their own call.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const modules = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js')).sort();
const tools = readdirSync(new URL('../tools/', import.meta.url)).filter((f) => f.endsWith('.mjs')).sort();
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('the package', () => {
  it('names each module of src/ and each tool of tools/ in its exports, and only those', () => {
    const exported = Object.entries(pkg.exports).filter(([k]) => k !== './package.json');
    assert.deepEqual(exported, [...modules.map((m) => [`./${m}`, `./src/${m}`]), ...tools.map((t) => [`./tools/${t}`, `./tools/${t}`])]);
    assert.deepEqual(tools, ['chrome.mjs', 'serve.mjs', 'vendor.mjs']);
    assert.deepEqual(pkg.files, ['src/', 'tools/']);
  });

  it('resolves by its name to the same modules (as a site imports them)', async () => {
    for (const m of modules) assert.equal(await import(`${pkg.name}/${m}`), await import(`../src/${m}`), m);
    for (const t of tools) assert.equal(await import(`${pkg.name}/tools/${t}`), await import(`../tools/${t}`), t);
  });

  it('has a .d.ts beside each module, for sites in TypeScript', () => {
    for (const m of modules) assert.ok(existsSync(new URL(`../src/${m.replace(/\.js$/, '.d.ts')}`, import.meta.url)), m);
  });

  it('runs nothing on install, and needs only the site\'s three at run time', () => {
    assert.equal(pkg.dependencies, undefined);
    for (const s of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack']) assert.equal(pkg.scripts[s], undefined, s);
    assert.deepEqual(pkg.peerDependencies, { three: '>=0.154.0' });
    assert.deepEqual(Object.keys(pkg.devDependencies), ['@types/three', 'three', 'typescript']);
  });

  it('imports only three, by its bare name, so a vendored copy works wherever it is put', () => {
    const THREE_USERS = ['access.js', 'fade.js', 'portal.js', 'sky.js'];
    for (const m of modules) {
      const src = readFileSync(new URL(`../src/${m}`, import.meta.url), 'utf8');
      const imports = [...src.matchAll(/^\s*import\s[^;'"]*['"]([^'"]+)['"]/gm)].map((x) => x[1]);
      assert.deepEqual(imports, THREE_USERS.includes(m) ? ['three'] : [], m);
      assert.doesNotMatch(src, /^\s*export\s[^;'"]*\bfrom\s*['"]/m, m);
      assert.doesNotMatch(src, /\bimport\s*\(/, m);
    }
    assert.deepEqual(modules.filter((m) => THREE_USERS.includes(m)), THREE_USERS, 'the modules named are there');
  });

  it('has tools that import only Node\'s own modules, so a site runs them with nothing else installed', () => {
    for (const t of tools) {
      const src = read(`tools/${t}`);
      const imports = [...src.matchAll(/^\s*import\s[^;'"]*['"]([^'"]+)['"]/gm), ...src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map((x) => x[1]);
      assert.ok(imports.length > 0, t);
      for (const i of imports) assert.match(i, /^node:/, `${t} imports ${i}`);
    }
  });

  it('has a Pages workflow only for the sites to call: common itself publishes nothing', () => {
    assert.deepEqual(readdirSync(new URL('../.github/workflows/', import.meta.url)), ['pages.yml']);
    const wf = read('.github/workflows/pages.yml');
    assert.match(wf, /^on:\n {2}workflow_call:\n {4}inputs:\n/m);
    assert.doesNotMatch(wf, /^\s*(push|pull_request|pull_request_target|workflow_dispatch|schedule|release):/m);
    for (const input of ['node-version', 'build', 'path']) assert.match(wf, new RegExp(`^ {6}${input}:$`, 'm'), input);
    assert.match(wf, /^ {6}node-version:\n(.*\n){2} {8}default: '24'\n/m);
    assert.match(wf, /^ {6}path:\n(.*\n){2} {8}default: public\n/m);
  });

  it('is installed, and its workflow called, at this version in the README and the workflow\'s own example', () => {
    const tag = `v${pkg.version}`;
    const readme = read('README.md');
    assert.ok(readme.includes(`"common": "github:AriaMoKr/common#${tag}"`), 'the dependency');
    assert.ok(readme.includes(`uses: AriaMoKr/common/.github/workflows/pages.yml@${tag}`), 'the workflow');
    assert.ok(read('.github/workflows/pages.yml').includes(`uses: AriaMoKr/common/.github/workflows/pages.yml@${tag}`));
  });

  it('is MIT licensed, for Node 22 or later', () => {
    assert.equal(pkg.license, 'MIT');
    assert.match(readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'), /^MIT License/);
    assert.equal(pkg.engines.node, '>=22');
    assert.equal(pkg.type, 'module');
  });
});
