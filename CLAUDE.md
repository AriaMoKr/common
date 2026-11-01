# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

A small library shared by the sites behind the Hallway (https://ariamokr.github.io/hallway/,
AriaMoKr/hallway): hallway itself, vrlbry, music, breadboard and outside. Plain ES modules in
`src/` with JSDoc, no build step, no dependencies of its own; three is a peer dependency. It holds
the Hallway's door contract, `door.js` (a door's link, the way back, the view from the door,
`doorLink`, the Hallway's side, and since 0.6.3 `hallLink`, another hall's) and `nav.js` (the VR
movement choice in `localStorage` under `hallway.nav`), and since 0.2.0 the three.js pieces the sites share: `portal.js` (a room seen
through an opening, "interior mapping"), `fade.js` (the fade to and from black) and `gamepad.js`
(standard-layout gamepads), since 0.3.0 `sky.js` (outside's late afternoon, for every window
behind every door), since 0.4.0 `access.js` (accessibility settings in `localStorage` under
`hallway.access`: less motion, a comfort vignette in VR, seated), since 0.5.0
`back-history.js` (the browser's Back for an open book), since 0.6.0 `tv.js` (the remote of
the Android TV app, AriaMoKr/HallwayApp, and the page's answer to its Back and Menu), since
0.7.0 `controls.js` (the walking controls: a screen, a gamepad, a TV and VR, a `Controls` class
for each site's own to extend), and since 0.8.0 `panel.js` (the 3D panels, drawn on a canvas and
hit by a ray's uv) and `text-view.js` (an open book's text as a page on a screen, its place shared
with the 3D book: a `TextView` class for each site's own view to extend), the tools the sites' Node scripts run
(`tools/chrome.mjs`, `tools/serve.mjs`, `tools/vendor.mjs`; never served to a page) and the sites'
reusable Pages workflow (`.github/workflows/pages.yml`). `README.md` is the door contract itself
(moved from the Hallway's README), the API with the portal's uniforms, how a room picks its sky's
yaw, what each accessibility setting means and how a site wires it in, "The TV app" (the user
agent, `window.hallwayTV`, Back and the page's history, and the checklist for a site in the app),
what a site's `Controls` gives the walking controls, the panels' elements, what a site's
`TextView` gives the text view, how each site loads the package, the tools (with why Chrome's profile gets its Local State) and the workflow's caller.

The sites install it from GitHub at a tag (`github:AriaMoKr/common#v0.8.1`) and load it in three
ways: a vendor copy and an import map (hallway, outside: `tools/vendor.mjs`), `server/vendor.js`
(vrlbry, music), and Vite (breadboard, TypeScript). Every site takes the modules of 0.1.0 to 0.4.0
from here (vrlbry and music keep their own gamepad reader, on `stick` and the rest; breadboard has
no sky). Until each switches over in its own change, each keeps its own copies of what 0.5.0
brings: `back-history.js` (vrlbry, music, outside), `chrome.mjs` (breadboard `scripts/lib/`,
outside `tools/lib/`), `tools/serve.mjs` and `tools/vendor.mjs` (hallway, outside,
layersharedsession) and its own `pages.yml`. Only the hallway has a TV view, with its own
`public/js/tv.js` (whose `roomFromInput` stays there: it needs layersharedsession's `isRoom`); the
others take 0.6.0's in a change of their own. Three copies of one `controls.js` walk the visitor
(the hallway's, outside's and the template's, AriaMoKr/RoomTemplateEmpty, which art and video
take by merge); each moves to 0.7.0's `Controls` in a message of its own, the template and the
hallway first, keeping only its room's: what a ray meets, where one may walk, what can be used.
vrlbry's text view and 3D panel have two more copies each (music's by merge; outside's, cut down
on 2026-10-24, and its `canvas-panel.js`); each moves to 0.8.0's `TextView` and `Panel` in a change
of its own, vrlbry and outside first, then music by merge, keeping only its book's: its places, its
parts and how they are built, what its toolbar does. README, "Coming from a site's own copy", says
what changes for each.

No GitHub Pages: nothing here is a site. `.github/workflows/pages.yml` is only for callers (`on:
workflow_call` and nothing else; `test/package.test.js` checks it): the sites' own workflows call
it at a tag, and it never runs for common itself. Don't give it other triggers, or add workflows.

## Commands

```bash
npm install     # devDependencies: TypeScript (the .d.ts files), three, @types/three and @types/node (tests, types)
npm test        # node --test "test/*.test.js"
npm run types   # src/*.d.ts and tools/*.d.mts from the JSDoc (the old ones deleted first, as tsc reads them as inputs)
CHROME_TEST=1 npm test   # and start a real Chrome through launchChrome (read the bad-password count first)
```

## Layout

- `src/door.js`: pure. `readVisit` (the visit, each value in range or null), `wayBack` (where the
  way back leads and what it is called: `{ url, label, title, name, host, hallway }`), `keptWay`,
  `withoutVisit`, `leaveUrl`, `hallwayViews`, `viewParams`, `doorLink`, and `hallLink` (another hall's link: `back` with `?from=` the door, `backname`, `room`; never `from=hallway`). Constants:
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
  walking; walking: `step() === true`), `padBack()`, `walk()`, `toCard()`, `forget()`, `inCard`, `onMode`,
  `answerApp(tv)` (`window.hallwayTV = { menu, back }`). Its keydown listener is the window's
  capture; a kept key goes to the control and is stopped at `root` on the way up. A select is a
  choice (←/→, OK `showPicker`). The focus falling from the card to nowhere walks. Since 0.6.1: a
  text box the remote steps onto (`_focus`) is held with `inputmode="none"`, so the TV's keyboard
  stays down, until OK on it (its own `inputmode` back, blur and focus, the form's Enter prevented)
  or the focus leaves it (`focusout`); Menu with no control to come back to goes to `first()`'s
  stop (itself, the first inside it, or its choice's), else the first stop that isn't a text box.
  Since 0.6.2: `forget()` drops the control last left (`_last`), so Menu goes to `first()` next,
  for a site whose visitor's doing has changed (outside's book opened); in the card it changes
  nothing, since leaving remembers the control left then.
- `src/controls.js`: the template's `public/js/controls.js` (RoomTemplateEmpty `f3e1c91`) call for
  call, with what is general in outside's (`93b6eda`). `KEYS` (frozen, read through `keyOf`) and
  `Controls<H extends Hit>({ renderer, camera, rig, scene, dom, eye = 1.6, hit, window,
  getGamepads })`; `rig` is the body (yaw), the camera the head. Public: `setPose`, `setNav`,
  `setEyeLift`, `walkTo(x, z, { face, then })`, `update(dt)`, `useMiddle()`, `hover`, `hoverDoor`,
  `pointer`, `hands`, `padActive`, `hasPad`, `aimMiddle`, `reduceMotion`, `restPitch`,
  `moveSpeed`, `turnRate`, and the callbacks `onDoor(how, hit)`, `onSqueeze`, `onTeleport(move)`,
  `onActivity`, `onPadActive`, `onPadBack`. What the site gives are methods it overrides:
  `castRay` and `clampWalk` (writing into `out`), `usable`, `use(hit, how)` (common's takes the
  doorway and `walkable` ground), `walkInto`, `stand`, `groundAt`, `route`, `reticleScale`,
  `_setHover`, `_riseXR`, and the places a site's own comes first (`takeKey`, `takePad` with its
  `PadPress`, `takeHand`, `takeSwipe`, `takePinch`, `takeWheel`, `takeGrip`), each doing nothing
  or returning false here. The constructor calls none of them: a subclass's fields are set only
  after `super()`. The underscore members a subclass calls (`_move`, `_moveHead`, `_startWalk`,
  `_teleport`, …) are `@protected` and part of the contract. Nothing is allocated per frame.
  Walks (`walkTo`, `_startWalk`) are a screen's: in VR `update` walks nowhere. Since 0.7.1:
  `_startWalk(points, face, done, turn)`, where `turn` (by default more than one point) looks
  where it goes and faces on the last leg, and `false` faces from the first step: the hallway's
  door walk, whose view `go()` hands on at the threshold, 0.8 m into the last leg. README, "Coming
  from a site's own copy", also has outside's water walks and bench guards since 0.7.1.
- `src/panel.js`: vrlbry's `public/js/ui/panel.js` (`eb0dfab`) with outside's `canvas-panel.js`
  (`fadc2e1`) and music's (`e665a2e`) where general. `Panel({ width, height, pxPerMeter = 1200, px,
  background, radius, anisotropy, ring = 0, canvas })`: the canvas by `pxPerMeter` (at most 2048 a
  side, vrlbry's) or `px` wide (outside's); `ring` the outline's width round the row pointed at (0
  vrlbry's, 2 outside's, 4 music's on a TV). Elements `text`, `button`, `slider`, `list` (vrlbry's
  drawing, its scroll bar's ▲, ▼, track and dragged thumb), `image`, `rect` and `custom`
  (`el.draw(g, el)`); a pointer's methods take numbers (`elementAt`, `pointerMove`, `click`,
  `pressAt`, `dragTo`: `(u, v)`), one point reused so a ray allocates nothing; `set` redraws only
  on a change; `pointerLeave` clears a slider's `hoverValue`. `Label`, `wrapText`, `UI`. Since
  0.8.1 a list row's `right` keeps only what it needs, measured in its own font (0.8 of the size):
  its width, the 18 px it is drawn in from the row's end, and a fifth of the size before it, where
  vrlbry kept 140 px; the label and `sub` have the rest.
- `src/text-view.js`: vrlbry's `public/js/ui/text-view.js` (`eb0dfab`) without its book, with
  outside's (`fadc2e1`: the place again a frame after opening, each theme's `color-scheme`,
  `turn(side)`, `scrollStep(dir)`) and music's (`e665a2e`: A− and A+ named "A− smaller text" and
  "A+ larger text"). `TEXT_VIEW_CSS` (the shell's rules; a `<style id="tv-view-style">` first in
  `<head>`, once a document; `.tv-body`'s rules stay in the sites) and `TextView<P>({ root, tv,
  step, returnFocus, onOpen, onClose })`. A place `P` is the site's, kept and handed back, never
  read. Public: `open`, `close({ keepPlace })`, `toggle`, `follow`, `aim(place)`, `turn`,
  `scrollStep`, `isOpen`, `part`, and for a TV `tocOpen`, `closeToc`, `layer`, `cardStart`,
  `linkHere`, `inBar`, `onScreen`. The site's methods, overridden: `bookOpen`, `presenting`,
  `bookKey`, `partCount`, `partOf`, `partStart`, `renderPart(body, part, { onLink })` (may be
  async), `placeShown`, `showsPlace`, `placeAimed`, `placeTop`, `placeAt`, `jumpTo(place, {
  inPlace })` (whether it moved), `turnPage` (not `turn`: that is the public one, which syncs
  first), `jumpToProgress`, `changeFont`, `setTheme`, `goBack`, `putBack`, `followLink`,
  `contents`, `useContents`, `label`, `progress`, `hasTrail`, `partWord`, `theme`, `fontScale`,
  `reduced`; each may answer with a promise, which the view waits for. The constructor calls none
  of them. The place is shared (`_sync`, `jumpTo` in place) once the reader's scrolling rests 250
  ms, and first before a size, Back, Put back, a turn and a link; the view's own scrolls
  (`_self`, `_selfTop`) aren't reading. A short screen (`max-height: 420px`) slides the toolbar
  away (`_headroom`), back on Tab (`focusin`). A part shown waits for the one before (`_showing`).
  Since 0.8.1 the reader's place is taken as they scroll (`_read`), and when the text's width or
  the toolbar's height changes (`_layout`, seen by ResizeObservers on `.tv-body` and the toolbar:
  `_reflowed`) the view scrolls back to it, its own scroll, the 3D book left where it is. `_laid`
  is the layout the place is right for; until the observers see a new one (`_reflowing`), the top
  isn't read, and a scroll (the browser's anchoring, a shorter text's end) is neither reading nor
  a cue for the toolbar to slide away.
- `src/*.d.ts`: generated by `npm run types` and committed.
- `tools/*.d.mts`: likewise, by `tsconfig.tools.json` (strict, `types: ["node"]`, lib ES2022 without
  the DOM: Node's `fetch` gives `json()` as `unknown`, so a cast where a tool reads one), so a
  site's `tools/` checked by TypeScript (outside's `tsconfig.node.json`) needs no declarations of
  its own; outside's `types/node/common-tools.d.ts` goes when it takes 0.8.0.
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
  `keepsKey`, and the `Remote` over a stand-in DOM in the file, text boxes held, `first()` and `forget()` among them: an event's path from the window's
  capture down and back up, focus and focusout, the few selectors it asks for; a real Chrome on a
  served page with `CHROME_TEST=1`, its keys through `Input.dispatchKeyEvent`), `controls.test.js`
  (the walking controls over stand-ins: a renderer whose `xr` gives two controllers and session
  events, pointer events on a view, the window's keys, a gamepad, and a box of a room with a
  doorway and a button, as a subclass counting each site method: the keys and those left to the
  page, a drag and a tap, the pad taking over and handing back, walks to a point, through the
  doorway, along a route, facing from the first step, with less motion and into a wall, the
  sticks, entering and leaving VR,
  `setEyeLift`), `panel.test.js` (on `canvas.js`: each kind of element drawn, a pointer over a
  list's row, its scroll bar and a drag, a slider's value, a right column as wide as its text,
  nothing redrawn without a change and `hoverValue` cleared, the ring, a custom element, both
  sizes, the `Label`), `text-view.test.js` (over `dom.js`, a stand-in DOM grown from outside's
  `test/helpers/fake-dom.js`: boxes in a scrolling view and their widths, a sticky toolbar slid
  away, scroll events a microtask later, focus, frames and a ResizeObserver; not a test file
  itself. A subclass over a book of two parts, run once answering at once and once a microtask
  later, counting each site method: opening and closing at the place, the keys, a rest sharing
  it, a size, Back and Put back synced first, a theme, a change of width (the place taken before
  the text reflows, the toolbar wrapped again, the book not asked to jump), a link
  aimed, `placeAimed`, the parts, the contents and its focus, another book, parts built in turn,
  the headroom, the TV's methods, the CSS put in once and first), `chrome.test.js` (the profile's Local State checked without
  starting Chrome, `Page` over a stand-in WebSocket; a real Chrome with `CHROME_TEST=1`),
  `serve.test.js` (a temporary site on a free port, and the command), `vendor.test.js` (a temporary
  site: files, folders by extension, optional and required entries, the list's checks, the skip
  under `node_modules`, and this package's own `src/` alone), `package.test.js` (exports, `files`,
  the peer dependency, what each module and tool imports, a module's own imports naming modules
  beside it, the workflow only called, the README at this version), `types.test.js` (the `.d.ts` and `.d.mts` files are current, `test/types/site.ts` compiles
  as breadboard's tsconfig would, and `test/types/tools.mjs`, a site's tools in JavaScript, as
  outside's `tsconfig.node.json` would, reading only the `.d.mts` files of common's tools).

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
- **Imports: three only, by its bare name, and src/'s own.** `door.js`, `nav.js` and `gamepad.js` import nothing
  and stay pure (but for `localStorage` in `nav.js`); `portal.js`, `fade.js`, `sky.js`,
  `access.js` and `panel.js` import only `three`, which every site maps or bundles, so a vendored copy works in whatever folder it lands.
  `back-history.js`, `tv.js` and `text-view.js` import nothing (the text view's CSS is a string in
  it, not a `.css` file a site's vendor list or build would have to name). `controls.js` imports `three`, `./gamepad.js` and
  `./tv.js`: `src/` goes together (a vendor list names the folder, `server/vendor.js` copies it,
  Vite resolves it in the package), so a module's own beside it is always there. Keep it to
  that: a new module imports `three` and, if it must, its neighbours by `./`, nothing else.
  The tools import only `node:` modules, so a site runs them
  with nothing else installed, and they never reach a page: a site's vendor list names
  `common/src`, whose `ext` keeps the `.d.ts` files out.
  `test/package.test.js` checks each module's imports. three stays a peer dependency (the site's
  own, so a page has one), `>=0.154.0`: the portal's shader includes `colorspace_fragment`, which
  three has from r154 (`test/portal.test.js` checks the chunks exist).
- **Types come from the JSDoc.** `tsconfig.json` checks the JS (`checkJs`, `strict`). After
  changing JSDoc, run `npm run types` and commit the `.d.ts` files with it; `test/types.test.js`
  fails while they are stale. A site's TypeScript (breadboard) must need no declarations of its
  own: extend `test/types/site.ts` when the API grows, and `test/types/tools.mjs` when a tool's
  does. The tools' `.d.mts` files come from their JSDoc the same way (`tsconfig.tools.json`).
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
