/**
 * Whether a site at `root` is installed under some project's node_modules, rather than being the
 * project: its pages are not served there, and its dependencies are beside it, not in it.
 * @param {string} root
 */
export function installed(root: string): boolean;
/**
 * The site's list, checked: each entry has `to` and one of `from` and `dir`, and stays inside
 * node_modules and public/vendor.
 * @param {string} root
 * @returns {Entry[]}
 */
export function readList(root: string): Entry[];
/**
 * Copies the entries from root/node_modules into `out` (root/public/vendor), emptied first. Nothing
 * when the site is installed under someone's node_modules.
 * @param {string} [root] the site's root (where it runs)
 * @param {{ list?: Entry[], out?: string }} [o] the list (the site's vendor.json) and the folder
 * @returns {{ skipped: boolean, out: string, copied: string[] }} what was copied, relative to `out`
 */
export function vendor(root?: string, { list, out }?: {
    list?: Entry[];
    out?: string;
}): {
    skipped: boolean;
    out: string;
    copied: string[];
};
/**
 * The command: vendor() for the site where it runs, saying what it copied; on an error, says it and
 * sets the exit code, which fails the install.
 * @param {string} [root]
 */
export function run(root?: string): void;
/**
 * One entry of vendor.json: a file (`from`), or every module of a folder (`dir`), copied to `to`.
 * @typedef {{ from: string, to: string, optional?: boolean } | { dir: string, to: string, ext?: string, optional?: boolean }} Entry
 */
/** Where the list is, in the site's root. */
export const LIST: "vendor.json";
/**
 * One entry of vendor.json: a file (`from`), or every module of a folder (`dir`), copied to `to`.
 */
export type Entry = {
    from: string;
    to: string;
    optional?: boolean;
} | {
    dir: string;
    to: string;
    ext?: string;
    optional?: boolean;
};
