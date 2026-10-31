/**
 * Serves the folder `root` on host:port (port 0: a free one); resolves to the listening server.
 * @param {string} root
 * @param {{ port?: number, host?: string }} [o] port 0 and host 127.0.0.1 by default
 * @returns {Promise<import('node:http').Server>}
 */
export function serve(root: string, { port, host }?: {
    port?: number;
    host?: string;
}): Promise<import("node:http").Server>;
/**
 * The command's options, from its arguments over a site's defaults: --root (public), --port (8080),
 * --host (localhost), --name (the name in the package.json where it runs, else that folder's).
 * @param {string[]} args
 * @param {{ root?: string, port?: number, host?: string, name?: string }} [defaults]
 * @param {string} [cwd]
 */
export function options(args: string[], defaults?: {
    root?: string;
    port?: number;
    host?: string;
    name?: string;
}, cwd?: string): {
    root: string;
    port: number;
    host: string;
    name: string;
};
/**
 * The command: serves as its arguments say over the site's defaults, and prints where. A site's own
 * tools/serve.mjs gives its port: `await start(process.argv.slice(2), { port: 8088 })`.
 * @param {string[]} [args]
 * @param {{ root?: string, port?: number, host?: string, name?: string }} [defaults]
 * @returns {Promise<import('node:http').Server>}
 */
export function start(args?: string[], defaults?: {
    root?: string;
    port?: number;
    host?: string;
    name?: string;
}): Promise<import("node:http").Server>;
/** @type {Record<string, string>} */
export const TYPES: Record<string, string>;
