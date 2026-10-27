# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

A small library shared by the sites behind the Hallway (https://ariamokr.github.io/hallway/,
AriaMoKr/hallway): hallway itself, vrlbry, music, breadboard and outside. Plain ES modules in
`src/` with JSDoc, no build step, no dependencies of its own; three is a peer dependency. It holds
the Hallway's door contract, `door.js` (a door's link, the way back, the view from the door, and
`doorLink`, the Hallway's side) and `nav.js` (the VR movement choice in `localStorage` under
`hallway.nav`), and since 0.2.0 the three.js pieces the sites share: `portal.js` (a room seen
through an opening, "interior mapping"), `fade.js` (the fade to and from black) and `gamepad.js`
(standard-layout gamepads), since 0.3.0 `sky.js` (outside's late afternoon, for every window
behind every door), since 0.4.0 `access.js` (accessibility settings in `localStorage` under
`hallway.access`: less motion, a comfort vignette in VR, seated), since 0.5.0
`back-history.js` (the browser's Back for an open book), and since 0.6.0 `tv.js` (the remote of
the Android TV app, AriaMoKr/HallwayApp, and the page's answer to its Back and Menu), the tools the sites' Node scripts run
(`tools/chrome.mjs`, `tools/serve.mjs`, `tools/vendor.mjs`; never served to a page) and the sites'
reusable Pages workflow (`.github/workflows/pages.yml`). `README.md` is the door contract itself
(moved from the Hallway's README), the API with the portal's uniforms, how a room picks its sky's
yaw, what each accessibility setting means and how a site wires it in, "The TV app" (the user
agent, `window.hallwayTV`, Back and the page's history, and the checklist for a site in the app),
how each site loads the package, the tools (with why Chrome's profile gets its Local State) and the workflow's caller.

The sites install it from GitHub at a tag (`github:AriaMoKr/common#v0.6.1`) and load it in three
ways: a vendor copy and an import map (hallway, outside: `tools/vendor.mjs`), `server/vendor.js`
(vrlbry, music), and Vite (breadboard, TypeScript). Every site takes the modules of 0.1.0 to 0.4.0
from here (vrlbry and music keep their own gamepad reader, on `stick` and the rest; breadboard has
no sky). Until each switches over in its own change, each keeps its own copies of what 0.5.0
brings: `back-history.js` (vrlbry, music, outside), `chrome.mjs` (breadboard `scripts/lib/`,
outside `tools/lib/`), `tools/serve.mjs` and `tools/vendor.mjs` (hallway, outside,
layersharedsession) and its own `pages.yml`. Only the hallway has a TV view, with its own
`public/js/tv.js` (whose `roomFromInput` stays there: it needs layersharedsession's `isRoom`); the
others take 0.6.0's in a change of their own. README, "Coming from a site's own copy", says what
changes for each.

No GitHub Pages: nothing here is a site. `.github/workflows/pages.yml` is only for callers (`on:
workflow_call` and nothing else; `test/package.test.js` checks it): the sites' own workflows call
it at a tag, and it never runs for common itself. Don't give it other triggers, or add workflows.

## Commands

```bash
npm install     # devDependencies: TypeScript (the .d.ts files), three and @types/three (tests, types)
npm test        # node --test "test/*.test.js"
npm run types   # tsc -p tsconfig.json: src/*.d.ts from the JSDoc
CHROME_TEST=1 npm test   # and start a real Chrome through launchChrome (read the bad-password count first)
```

## Layout

- `src/door.js`: pure. `readVisit` (the visit, each value in range or null), `wayBack` (where the
  way back leads and what it is called: `{ url, label, title, name, host, hallway }`), `keptWay`,
  `withoutVisit`, `leaveUrl`, `hallwayViews`, `viewParams`, and `doorLink`. Constants:
  `HALLWAY_ID`, `HALLWAY_URL` (no `from`: `hallwayUrl(id)` adds it), `VISIT_PARAMS` (taken off the
  address; includes `backname`), `LINK_PARAMS` (what the Hallway's doors add, in order).
- `src/nav.js`: `NAV_KEY`, `NAV_DEFAULTS` (frozen), `normalizeNav`, `loadNav(storage?, defaults?)`,
  `saveNav(nav, storage?)`. The storage defaults to `localStorage`, looked up inside a try, since
  reading it throws where the browser blocks storage.
- `src/portal.js`: outside's portal (the Hallway's, with `setView`). `portalMaterial({ map, width,
  height, depth, pictureHeight, eye, horizon, aspect = 2, color = null })` takes the view fields of
  `viewParams`, so a view spreads straight in; `openingGeometry`, `placePortal`, `setPicture`
  (keeps the height, takes an aspect) and `setView` (a new room). No colour: `uVeil` 0, a plain
  window. `PortalMaterial` in the `.d.ts` is a `ShaderMaterial` with its uniforms.
- `src/fade.js`: the Hallway's `Fade` (`to`, `set`, `update`; `mesh`, `material`).
- `src/gamepad.js`: the Hallway's `readPad(pad, out)`, `BUTTON` and `firstPad`, on vrlbry's
  pieces: `DEADZONE`, `stick(x, y, deadzone, out)`, `held(pad, i)`, `BUTTONS`.
- `src/sky.js`: outside's sky. `SUN_DIR` (from its `bake.js`), `skyColor(el, toSun)`, `SKY_UV`
  (GLSL: u 0.5 down -z, v 0.5 at the horizon), `skyTexture({ canvas })` (the 2048 × 1024
  panorama, its own `canvas` and seeded `rng`; `canvas` is a factory, a stand-in in Node),
  `skyDome(map)`, and `skyMaterial(map, { yaw })` for glass and skylights: the panorama by the
  direction from each eye, from world positions, so merged geometry works; `uYaw` turns it as
  `rotation.y` turns an object (done per vertex: the turn is linear).
- `src/access.js`: `ACCESS_KEY`, `ACCESS_DEFAULTS` (frozen: motion 'system', vignette on, not
  seated), `normalizeAccess`, `loadAccess(storage?, defaults?)` and `saveAccess(access, storage?)`,
  shaped as `nav.js`'s; `REDUCED_MOTION`, `motionQuery()`, `reduceMotion(access, query)` and
  `watchMotion(onChange, query)`; `Vignette` (shaped like `Fade`: `update(dt, speed, turnRate, xr)`
  per frame, allocating nothing, open outside VR or when not `enabled`; `VIGNETTE` its tuning, at
  the sites' 1.8 m/s and 1.6 rad/s); `SEATED_LIFT` and `eyeLift(access)`. The vignette's shader
  measures each fragment's angle from the eye being drawn (`cameraPosition`) against the head's
  ahead (`-modelMatrix[2]`), so the ring is at infinity in both eyes, not on its 0.3 m sphere.
- `src/back-history.js`: vrlbry's `BackHistory` (`777138d`; music's and outside's are the same
  code), its fields in an entry's state named from `prefix` (`'back'`: `backBook`, `backTrail`,
  `backLoad`; `'vrlbry'` and `'outside'` give the sites' own copies' names). Pure: given the page's
  history.
- `src/tv.js`: the hallway's `public/js/tv.js` (`26f6d40`) without `roomFromInput`. `isTV`,
  `tvMode({ userAgent, search })` (or `?tv=emulate`), `SPARE_KEYS` (frozen: the channel and
  rewind/fast-forward keys, which reach the page with TalkBack on, as the arrows), `keyOf(e)`
  (`e.code || e.key`, the spares as arrows), `keepsKey(el, key)` (an open combobox ↑/↓/Escape, a
  range ←/→, a caret ←/→ short of its end), `focusStops`, `nextStop`, and `Remote({ root, view,
  use, step, first })`: `menu()`, `back()` (in the card: an open list closed by a sent Escape, else
  walking; walking: `step() === true`), `padBack()`, `walk()`, `toCard()`, `inCard`, `onMode`,
  `answerApp(tv)` (`window.hallwayTV = { menu, back }`). Its keydown listener is the window's
  capture; a kept key goes to the control and is stopped at `root` on the way up. A select is a
  choice (←/→, OK `showPicker`). The focus falling from the card to nowhere walks. Since 0.6.1: a
  text box the remote steps onto (`_focus`) is held with `inputmode="none"`, so the TV's keyboard
  stays down, until OK on it (its own `inputmode` back, blur and focus, the form's Enter prevented)
  or the focus leaves it (`focusout`); Menu with no control to come back to goes to `first()`'s
  stop (itself, the first inside it, or its choice's), else the first stop that isn't a text box.
- `src/*.d.ts`: generated by `npm run types` and committed.
- `tools/chrome.mjs`: breadboard's `scripts/lib/chrome.mjs` (outside's `tools/lib/` is the same):
  `findChrome`, `launchChrome({ headless, args, url })` (resolves to `{ endpoint, profile, process,
  newPage, close }`), `Page` (rejects what is waiting when the tab closes), `newProfile` and
  `localState` (the profile's Local State, written before Chrome starts), `sleep`.
- `tools/serve.mjs`: outside's dev server with the hallway's types. `serve(root, { port, host })`,
  `start(args, defaults)` (the command, over a site's port), `options`, `TYPES`; as a command
  `--root public --port 8080 --host localhost --name <package.json's>`, printing `<name>: http://…/`.
- `tools/vendor.mjs`: the hallway's vendor copy, its list read from the site's `vendor.json`, with
  layersharedsession's skip under `node_modules`. `vendor(root, { list, out })`, `run(root)` (the
  command), `readList` (checks each entry), `installed`, `LIST`. Runs from the site's root.
- `.github/workflows/pages.yml`: the hallway's build and deploy jobs, with breadboard's
  `configure-pages` and checkout without credentials; inputs `node-version` ('24'), `build` (none)
  and `path` (public).
- `test/`: `door.test.js` and `link.test.js` (the cases of the sites' copies, the Hallway's real
  link, round trips from `doorLink` to the reading side), `nav.test.js`, `portal.test.js` and
  `fade.test.js` (built in Node with three, no WebGL), `gamepad.test.js` (hallway's and vrlbry's
  cases, vrlbry's reader rebuilt on `stick`, `held` and `BUTTONS`), `sky.test.js` (outside's
  `SUN_DIR` and `skyColor` values, `SKY_UV` in JS against where the painter paints, and the
  painting's fingerprint, outside's, on `canvas.js`, a stand-in canvas that records every call; not
  a test file itself), `access.test.js` (the settings as `nav.js`'s are tested, reduced motion
  against a stand-in media query, the vignette's strength with speed and turning, off when disabled
  or outside VR, and `eyeLift`), `back-history.test.js` (vrlbry's cases over a stand-in history,
  its fields neutral, and the prefix), `tv.test.js` (the hallway's cases, `tvMode`, `keyOf`,
  `keepsKey`, and the `Remote` over a stand-in DOM in the file, text boxes held and `first()` among them: an event's path from the window's
  capture down and back up, focus and focusout, the few selectors it asks for; a real Chrome on a
  served page with `CHROME_TEST=1`, its keys through `Input.dispatchKeyEvent`), `chrome.test.js` (the profile's Local State checked without
  starting Chrome, `Page` over a stand-in WebSocket; a real Chrome with `CHROME_TEST=1`),
  `serve.test.js` (a temporary site on a free port, and the command), `vendor.test.js` (a temporary
  site: files, folders by extension, optional and required entries, the list's checks, the skip
  under `node_modules`, and this package's own `src/` alone), `package.test.js` (exports, `files`,
  the peer dependency, what each module and tool imports, the workflow only called, the README at
  this version), `types.test.js` (the `.d.ts` files are current, and `test/types/site.ts` compiles
  as breadboard's tsconfig would).

## Conventions

- **Nothing site-specific.** Each site passes its own door id (`wayBack(search, id, …)`,
  `hallwayViews(way, id)`, `hallwayUrl(id)`) and its origin for the dev servers' rule. A site's
  own door colour, door entry or kept-door shape stays in the site.
- **The way back is the Hallway only on the Hallway's own page**: `from=hallway` and a `back` on
  its origin and path (`/hallway/` or `/hallway/index.html`), as vrlbry's `ea430a8` fixed. Every
  site shares the origin `ariamokr.github.io`, so the page's own origin proves nothing. The one
  exception is two dev servers on this machine, and only when the caller passes `origin`. Any
  other `back` is named by `backname` (cleaned: one line, no control or bidi characters) or its
  host, so a link cannot send visitors somewhere unsaid.
- **The contract is in links already out there.** Sites pin older versions and links get
  bookmarked, so keep reading what the Hallway and the sites send today. Keep export names, option
  names, the portal's uniform names (the sites set `uTime` and `uGlow` and read `uMap`) and the
  `localStorage` keys and values (`hallway.nav`, `hallway.access`, read by every site on the origin
  at whatever version it pins) compatible, or change every site with them. `BackHistory`'s field
  names in `history.state` likewise, for the entries already in visitors' tabs. After a change:
  commit, tag a new version, push, then move each site's tag and run `npm install` there (and the
  `@v…` of its workflow's `uses:`; `test/package.test.js` checks the README names this version).
- **Imports: three only, by its bare name.** `door.js`, `nav.js` and `gamepad.js` import nothing
  and stay pure (but for `localStorage` in `nav.js`); `portal.js`, `fade.js`, `sky.js` and
  `access.js` import only `three`, which every site maps or bundles, so a vendored copy works in whatever folder it lands.
  `back-history.js` and `tv.js` import nothing. The tools import only `node:` modules, so a site runs them
  with nothing else installed, and they never reach a page: a site's vendor list names
  `common/src`, whose `ext` keeps the `.d.ts` files out.
  `test/package.test.js` checks each module's imports. three stays a peer dependency (the site's
  own, so a page has one), `>=0.154.0`: the portal's shader includes `colorspace_fragment`, which
  three has from r154 (`test/portal.test.js` checks the chunks exist).
- **Types come from the JSDoc.** `tsconfig.json` checks the JS (`checkJs`, `strict`). After
  changing JSDoc, run `npm run types` and commit the `.d.ts` files with it; `test/types.test.js`
  fails while they are stale. A site's TypeScript (breadboard) must need no declarations of its
  own: extend `test/types/site.ts` when the API grows.
- **One sky.** `sky.js` is outside's painting, call for call; `test/sky.test.js` holds its
  fingerprint. Change how the sky looks only on purpose, and then for every site at once, since
  every window behind every door shows it. The shaders have no Node test beyond their text: check
  a change on a GPU (a page drawing the dome and the glass, the glass at yaw a matching the dome
  seen turned back by a). The vignette's shader likewise: drawn over white, its half-dark angle is
  `open + (closed - open) * strength + feather / 2`, the same with the eye 3.2 cm to either side.
- **Chrome never costs a Windows logon.** On Windows, Chrome on a new profile tests whether the
  password is blank by logging on with an empty one, and ten failed logons in ten minutes lock the
  account. Every Chrome a tool starts goes through `launchChrome`, whose `newProfile` writes the
  profile's Local State first (`os_password_blank: false`, `os_password_last_changed` now in
  microseconds since 1601). Keep that step; `test/chrome.test.js` checks it. Before running
  anything new that starts Chrome, read the bad-password count (`NetUserGetInfo` level 2,
  `usri2_bad_pw_count`) and compare it after.
- **The vendor copy runs where npm puts it.** As a site's postinstall it runs from the site's root.
  A package installed under another's `node_modules` (layersharedsession) has no
  `node_modules/common` of its own there, so it calls `run()` from a guarded script of its own
  (README, `tools/vendor.mjs`).
- Write escapes, not the characters, for invisible or direction-changing characters in source
  (as `cleanName` does).
