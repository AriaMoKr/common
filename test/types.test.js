// The .d.ts files: current with the JSDoc they come from, and what a site in TypeScript gets.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let tsc = null;
try {
  tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
} catch {
  // not installed: npm install
}
const run = (...args) => execFileSync(process.execPath, [tsc, ...args], { cwd: root, encoding: 'utf8' });

describe('the types', { skip: tsc ? false : 'TypeScript is not installed (npm install)' }, () => {
  it('are current with the JSDoc: npm run types makes the same .d.ts files', () => {
    const out = mkdtempSync(join(tmpdir(), 'common-types-'));
    try {
      run('-p', 'tsconfig.json', '--outDir', out);
      const made = readdirSync(out).sort();
      assert.deepEqual(made, readdirSync(join(root, 'src')).filter((f) => f.endsWith('.d.ts')).sort());
      for (const f of made) {
        assert.equal(readFileSync(join(root, 'src', f), 'utf8'), readFileSync(join(out, f), 'utf8'), `src/${f} is stale: npm run types`);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('type a site in TypeScript, set up as breadboard is (Vite: bundler resolution, strict)', () => {
    assert.ok(existsSync(join(root, 'test', 'types', 'tsconfig.json')));
    try {
      run('-p', 'test/types/tsconfig.json');
    } catch (e) {
      assert.fail(`tsc -p test/types/tsconfig.json\n${e.stdout}${e.stderr}`);
    }
  });
});
