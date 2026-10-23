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
behind every door), and since 0.4.0 `access.js` (accessibility settings in `localStorage` under
`hallway.access`: less motion, a comfort vignette in VR, seated). `README.md` is the door contract
itself (moved from the Hallway's README), the API with the portal's uniforms, how a room picks its
sky's yaw, what each accessibility setting means and how a site wires it in, and how each site
loads the package.

The sites install it from GitHub at a tag (`github:AriaMoKr/common#v0.4.0`) and load it in three
ways: a vendor copy and an import map (hallway, outside: `tools/vendor.mjs`), `server/vendor.js`
(vrlbry, music), and Vite (breadboard, TypeScript). Every site takes the modules of 0.1.0 and
0.2.0 from here (vrlbry and music keep their own gamepad reader, on `stick` and the rest). Until
each switches over in its own change, each still paints its own sky: outside `public/js/sky.js`
(and `SUN_DIR` in `bake.js`), hallway `public/js/textures.js` `skyTexture` for its end window,
vrlbry and music `world/textures.js` `makeSkyCanvas` for the `sky` material in `world/room.js`. No
site has the accessibility settings yet. README, "Coming from a site's own copy", says what
changes for each.

No GitHub Pages: nothing here is a site.

## Commands

```bash
npm install     # devDependencies: TypeScript (the .d.ts files), three and @types/three (tests, types)
npm test        # node --test "test/*.test.js"
npm run types   # tsc -p tsconfig.json: src/*.d.ts from the JSDoc
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
- `src/*.d.ts`: generated by `npm run types` and committed.
- `test/`: `door.test.js` and `link.test.js` (the cases of the sites' copies, the Hallway's real
  link, round trips from `doorLink` to the reading side), `nav.test.js`, `portal.test.js` and
  `fade.test.js` (built in Node with three, no WebGL), `gamepad.test.js` (hallway's and vrlbry's
  cases, vrlbry's reader rebuilt on `stick`, `held` and `BUTTONS`), `sky.test.js` (outside's
  `SUN_DIR` and `skyColor` values, `SKY_UV` in JS against where the painter paints, and the
  painting's fingerprint, outside's, on `canvas.js`, a stand-in canvas that records every call; not
  a test file itself), `access.test.js` (the settings as `nav.js`'s are tested, reduced motion
  against a stand-in media query, the vignette's strength with speed and turning, off when disabled
  or outside VR, and `eyeLift`), `package.test.js` (exports,
  `files`, the peer dependency, what each module imports), `types.test.js` (the `.d.ts` files are
  current, and `test/types/site.ts` compiles as breadboard's tsconfig would).

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
  at whatever version it pins) compatible, or change every site with them. After a change: commit, tag a new version, push, then
  move each site's tag and run `npm install` there.
- **Imports: three only, by its bare name.** `door.js`, `nav.js` and `gamepad.js` import nothing
  and stay pure (but for `localStorage` in `nav.js`); `portal.js`, `fade.js`, `sky.js` and
  `access.js` import only `three`, which every site maps or bundles, so a vendored copy works in whatever folder it lands.
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
- Write escapes, not the characters, for invisible or direction-changing characters in source
  (as `cleanName` does).
