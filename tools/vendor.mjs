// Copies the browser modules a site's pages import from its node_modules into its public/vendor/,
// so public/ is the whole site: served as it is by tools/serve.mjs and published as it is to GitHub
// Pages. The site's import map maps the bare names to the copies. It runs from the site's root,
// after `npm install`:
//   "postinstall": "node node_modules/common/tools/vendor.mjs"
// and copies what the site's vendor.json (beside its package.json) lists:
//   { "from": "three/build/three.module.js", "to": "three/build/three.module.js" }  a file
//   { "from": "iwer/build/iwer.module.js", "to": "iwer/iwer.module.js", "optional": true }  if there
//   { "dir": "common/src", "to": "common", "ext": ".js" }  every module of a folder, not its subfolders
// (`from` and `dir` under node_modules, `to` under public/vendor; `ext` .js and .mjs by default). A
// site installed under another project's node_modules is not served there: nothing to copy. (Such
// a package's postinstall runs where common may not be, beside it rather than in it: it calls run()
// from a script of its own that checks first; README, "tools/vendor.mjs".)
// The hallway's tools/vendor.mjs (and outside's), its list in the site, with layersharedsession's
// skip.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One entry of vendor.json: a file (`from`), or every module of a folder (`dir`), copied to `to`.
 * @typedef {{ from: string, to: string, optional?: boolean } | { dir: string, to: string, ext?: string, optional?: boolean }} Entry
 */

/** Where the list is, in the site's root. */
export const LIST = 'vendor.json';

/**
 * Whether a site at `root` is installed under some project's node_modules, rather than being the
 * project: its pages are not served there, and its dependencies are beside it, not in it.
 * @param {string} root
 */
export function installed(root) {
  return resolve(root).split(sep).includes('node_modules');
}

/**
 * The site's list, checked: each entry has `to` and one of `from` and `dir`, and stays inside
 * node_modules and public/vendor.
 * @param {string} root
 * @returns {Entry[]}
 */
export function readList(root) {
  const file = join(root, LIST);
  let list;
  try {
    list = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`vendor: cannot read ${file}: ${/** @type {Error} */ (e).message}`);
  }
  if (!Array.isArray(list)) throw new Error(`vendor: ${LIST} is not a list`);
  for (const [i, f] of list.entries()) {
    const where = `vendor: ${LIST}, entry ${i + 1}`;
    if (!f || typeof f !== 'object') throw new Error(`${where} is not an object`);
    if (('from' in f) === ('dir' in f)) throw new Error(`${where} needs one of "from" and "dir"`);
    for (const k of ['from', 'dir', 'to', 'ext']) {
      if (k in f && (typeof f[k] !== 'string' || !f[k])) throw new Error(`${where}: "${k}" is not a name`);
    }
    if (!('to' in f)) throw new Error(`${where} needs "to"`);
    if ('optional' in f && typeof f.optional !== 'boolean') throw new Error(`${where}: "optional" is true or false`);
    for (const k of ['from', 'dir', 'to']) {
      if (k in f && !inside(f[k])) throw new Error(`${where}: "${f[k]}" leaves its folder`);
    }
  }
  return list;
}

/** @param {string} path a relative path that stays where it starts */
function inside(path) {
  const n = normalize(path);
  return !isAbsolute(n) && n !== '..' && !n.startsWith(`..${sep}`) && n !== '.';
}

/**
 * Copies the entries from root/node_modules into `out` (root/public/vendor), emptied first. Nothing
 * when the site is installed under someone's node_modules.
 * @param {string} [root] the site's root (where it runs)
 * @param {{ list?: Entry[], out?: string }} [o] the list (the site's vendor.json) and the folder
 * @returns {{ skipped: boolean, out: string, copied: string[] }} what was copied, relative to `out`
 */
export function vendor(root = process.cwd(), { list, out = join(root, 'public', 'vendor') } = {}) {
  if (installed(root)) return { skipped: true, out, copied: [] };
  const entries = list ?? readList(root);
  const modules = join(root, 'node_modules');
  /** @type {string[]} */
  const copied = [];
  /** @param {string} src @param {string} to */
  const copy = (src, to) => {
    const dest = join(out, to);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    copied.push(relative(out, dest).split(sep).join('/'));
  };
  // Every entry's source first, so that a missing one leaves the copies as they were.
  for (const f of entries) {
    const name = 'dir' in f ? f.dir : f.from;
    if (!f.optional && !existsSync(join(modules, name))) throw new Error(`vendor: ${name} is missing; run npm install`);
  }
  rmSync(out, { recursive: true, force: true });
  for (const f of entries) {
    if ('dir' in f) {
      const src = join(modules, f.dir);
      if (!existsSync(src)) continue;
      const exts = f.ext ? [f.ext] : ['.js', '.mjs'];
      for (const name of readdirSync(src).sort()) {
        if (exts.some((x) => name.endsWith(x)) && statSync(join(src, name)).isFile()) copy(join(src, name), join(f.to, name));
      }
    } else {
      const src = join(modules, f.from);
      if (existsSync(src)) copy(src, f.to);
    }
  }
  return { skipped: false, out, copied };
}

/** Whether this module is the script node was started with (also through a link to the package). */
function isMain() {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

/**
 * The command: vendor() for the site where it runs, saying what it copied; on an error, says it and
 * sets the exit code, which fails the install.
 * @param {string} [root]
 */
export function run(root = process.cwd()) {
  try {
    const { skipped, out, copied } = vendor(root);
    if (!skipped) console.log(`vendor: copied ${copied.length} files into ${out}`);
  } catch (e) {
    console.error(/** @type {Error} */ (e).message);
    process.exitCode = 1;
  }
}

if (isMain()) run();
