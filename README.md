# common

Code shared by the sites behind the [Hallway](https://ariamokr.github.io/hallway/), a WebXR
corridor whose doors lead to other environments: [hallway](https://github.com/AriaMoKr/hallway)
itself, [vrlbry](https://github.com/AriaMoKr/vrlbry), [music](https://github.com/AriaMoKr/music),
[breadboard](https://github.com/AriaMoKr/breadboard) and [outside](https://github.com/AriaMoKr/outside).

It holds the Hallway's door contract, which is how a door's link brings a visitor into an
environment and how the environment leads them back, and the three.js pieces the sites share:

- **[`door.js`](src/door.js)**: reading a visit and the way back, and the link a door opens.
- **[`nav.js`](src/nav.js)**: the VR movement choice that the sites share in `localStorage`.
- **[`portal.js`](src/portal.js)**: a room seen through an opening, drawn from one picture.
- **[`fade.js`](src/fade.js)**: the fade to and from black around the viewer's head.
- **[`gamepad.js`](src/gamepad.js)**: standard-layout gamepads on a desktop or a phone.
- **[`sky.js`](src/sky.js)**: outside's late afternoon, for every window behind every door.
- **[`access.js`](src/access.js)**: accessibility settings every site shares: less motion, a comfort
  vignette in VR, and a seated mode.
- **[`back-history.js`](src/back-history.js)**: the browser's Back for an open book, back along the
  links followed in it and then putting it away.
- **[`tv.js`](src/tv.js)**: the remote of the Hallway's Android TV app, and the page's answer to the
  app's Back and Menu.
- **[`controls.js`](src/controls.js)**: walking about a site with a mouse, a finger, a gamepad, a
  TV's remote or a headset, for each site's own controls to extend with its room.

These are plain ES modules with JSDoc, with no build step. They run in the browser and in Node,
for the sites' tests. `portal.js`, `fade.js`, `sky.js`, `access.js` and `controls.js` import three
by its bare name, from the site (a peer dependency, r154 or later). `controls.js` also imports
`gamepad.js` and `tv.js` from beside it, and the others import nothing. A `.d.ts` beside each
module gives TypeScript sites their types.

Beside them are the tools the sites' Node scripts run, never served to a page, and the workflow
that publishes them:

- **[`tools/chrome.mjs`](tools/chrome.mjs)**: Chrome over the DevTools protocol, headless or in a
  window, on a profile that never costs a failed Windows logon.
- **[`tools/serve.mjs`](tools/serve.mjs)**: the dev server for a site's `public/`, as GitHub Pages
  serves it.
- **[`tools/vendor.mjs`](tools/vendor.mjs)**: the copy of `node_modules` a site's pages import, into
  `public/vendor/`.
- **[`.github/workflows/pages.yml`](.github/workflows/pages.yml)**: the sites' GitHub Pages
  workflow, for each site's own to call.

Every site takes what v0.1.0 to v0.4.0 brought from here (breadboard has no sky). The modules,
tools and workflow of v0.5.0, the TV module of v0.6.0 and the walking controls of v0.7.0 come to
each site in a change of its own (see [Coming from a site's own copy](#coming-from-a-sites-own-copy)).
[The TV app](#the-tv-app) says what a site in the TV app does.

## Going in

A door opens its environment's `url` with the visit added to the query, so the environment can
carry the view on from the doorway. Walking through vrlbry's door a little right of centre,
turned slightly to the right and looking a little down, opens:

```
https://ariamokr.github.io/vrlbry/?place=%7Egutenberg_en_all_2025-11&from=hallway&back=https%3A%2F%2Fariamokr.github.io%2Fhallway%2F%3Ffrom%3Dvrlbry&dx=0.12&yaw=-8&pitch=-3&dw=1.1&dh=2.25&glow=d9b26a
```

| Parameter | Example | Meaning |
|---|---|---|
| `from` | `hallway` | Who sent the visitor. |
| `back` | `https://ariamokr.github.io/hallway/?from=vrlbry` | The way back: a link to it brings the visitor out in front of this door. |
| `dx` | `0.12` | Where the visitor went through: metres from the doorway's centre, + to their right as they face in. Always within the opening. |
| `yaw` | `-8` | Which way they faced: degrees from straight in, + to the left (as three.js's `rotation.y`), from -90 to 90. |
| `pitch` | `-3` | How far up they looked, in degrees, + up. Left out in VR, where the headset gives it. |
| `dw`, `dh` | `1.1`, `2.25` | The doorway's width and height in metres. |
| `glow` | `d9b26a` | The doorway's colour (the door's `color`), hex without the `#`. |
| `room` | `k3vd-q8hn` | The shared session the visitor is in (the Hallway's README, "Together"). `back` carries it too. Only in a session. |

`dx`, `yaw` and `pitch` are there only when the visitor goes in through the doorway in 3D, by
walking through it or by pointing at it. Pointing from across the hall gives the pose they
pointed from, with `dx` kept within the opening. The Hallway's doors list sends the rest without
them, and its `<noscript>` list links to the bare `url`. A door's own `url` must not use these
parameters (`LINK_PARAMS`). `doorLink` makes the link.

An environment can use them to:

- **Carry the view on.** The doorway shows the environment's preview as if it was taken from the
  threshold at eye height (1.6 m), facing straight in. Arriving the visitor where the preview was
  taken, moved `dx` sideways and turned by `yaw`, continues what they saw through the doorway.
  `readVisit` reads them, with each number kept in its range and nonsense left out.
- **Draw its own door back**, `dw` by `dh`, glowing in `glow`, leading to `back` (`wayBack`).
- **Read them once.** Take them off the address with `history.replaceState` after reading them
  (`withoutVisit`), so a reload, Back or a shared link doesn't repeat the arrival. Reading
  `location.search` takes no time, so it doesn't delay the VR hand-over (below). Leave `room` in
  the address: it names the session the page is in, and it is the invitation to it.
- **Stay in the session.** With `room`, join the same room through
  [layersharedsession](https://github.com/AriaMoKr/layersharedsession) (the same app id as the
  Hallway's, in its `together.js`), and keep `room` on every link back (`leaveUrl`).

An environment that ignores them loses nothing: they are ordinary query parameters. The VR
movement choices from the Hallway's control panel are not in the link. They are in `localStorage`
(see [Moving in VR](#moving-in-vr)).

## Linking back

An environment brings visitors back by linking to the Hallway with its own id, the URL a door's
link gives as `back` (`hallwayUrl(id)`):

```
https://ariamokr.github.io/hallway/?from=vrlbry
```

Without `?from=`, the Hallway also recognizes a referrer from inside an environment's URL, and
Back from an environment returns to the door the visitor left by. With `&room=`, as `back` has in
a shared session, the visitor rejoins that session in the Hallway.

**Which way back is the Hallway.** `wayBack` takes `back` only when it is an http(s) address. It
is the Hallway, kept as given (its `from` and the session's `room`), when the link says
`from=hallway` and `back` is the Hallway's own page: its origin and path,
`https://ariamokr.github.io/hallway/`. All the sites share that origin, so another path on it is
not the Hallway. While developing, a `back` on this machine is the Hallway too when the page
reading it is on this machine as well (the dev servers run on their own ports). Any other `back`
is another place: the way back names it by its host, or by the name it gives itself (below), so a
link cannot send visitors somewhere unsaid. Without a usable `back` the way back is the Hallway, in front of the environment's door.
An environment that can be visited without a door (breadboard's VR view) can ask for no way back
then, unless the link says `from=hallway`.

**Another hall.** A hall other than the Hallway can put an environment behind one of its doors and
name itself on the way back, with both values URL-encoded:

```
https://ariamokr.github.io/vrlbry/?back=<the hall's address>&backname=<its name>
```

The way back then says "← " and the name, shortened past 24 characters, and its tooltip gives the
name and the host. The name is put on one line, without control characters or characters that
change the text's direction. Without `backname` the host stands in.

`hallLink` makes that link (since v0.6.3): `back` is the hall's own address with `?from=` and the
door's id there, so the hall can bring the visitor back out in front of that door, and in a
shared session both the link and `back` carry its `room`. It never says `from=hallway`, so the
place doesn't take the way back for the Hallway's, even between two dev servers. art's door into
VARTISTE, for one:

```
https://ariamokr.github.io/vartiste/?back=https%3A%2F%2Fariamokr.github.io%2Fart%2F%3Ffrom%3Dstudio&backname=art
```

**Staying in VR across the trip.** When a page navigates during an immersive session, Quest
Browser can grant the next page a session without a click: it fires `sessiongranted` on
`navigator.xr`. The Hallway listens for it, so a visitor who walks back in from an environment's
VR stays in VR. For the same to work in the other direction, an environment listens too and
starts its session at once:

```js
navigator.xr?.addEventListener('sessiongranted', () => {
  // The same call the page's Enter VR button makes.
  navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })
    .then((session) => renderer.xr.setSession(session));
});
```

Without that listener, the visitor arrives at the environment's 2D page and presses its Enter VR
button. vrlbry, Breadboard 8-bit's VR view, music and Outside all listen.

The hand-over has two limits, measured on a Quest with Quest Browser 152 (vrlbry,
[`7eca62b`](https://github.com/AriaMoKr/vrlbry/commit/7eca62b)):

- **One origin only.** A navigation to another origin (another domain, or another port) gets no
  grant, so the visitor arrives at the 2D page. The Hallway and all four environments are on
  `ariamokr.github.io`, so the hand-over can work between them.
- **About 5 seconds.** The grant arrives about 0.1 s after the next page starts. A request made up
  to 4.7 s later starts the session, while one at 5.2 s is refused as needing a click. Ask for the
  session as soon as the page can draw a frame, not once everything else has loaded.

## The view from your door

An environment's way back to the Hallway can show the Hallway as seen from its own door. For every
open door the Hallway publishes that view, rendered from the doorway at eye height looking
straight across the hall:

```
https://ariamokr.github.io/hallway/views/views.json
https://ariamokr.github.io/hallway/views/<id>.jpg
```

`views.json` has, under `views`, each door id with its picture's file name and how to hang it
behind an opening of your own (2:1, 2048 × 1024):

```json
{
  "views": {
    "vrlbry": { "image": "vrlbry.jpg", "depth": 2.94, "pictureHeight": 6.5, "eye": 1.6, "horizon": 0.6154, "aspect": 2 }
  }
}
```

The picture is a flat wall `depth` metres behind the opening, `pictureHeight` tall and `aspect`
times as wide, centred on the opening, with its horizon `eye` metres above the sill and at
`horizon` of its height from its bottom. It is a perspective view projected onto the plane of the
opposite wall, so the floor and ceiling in front of that wall are in it too: hung that way (as the
Hallway's `public/js/portal.js` hangs a picture), the hall looks right through your doorway, with
some parallax. vrlbry shows its view through the door back in its library, and keeps a painted one
for when this file cannot be read.

`hallwayViews(way, id)` gives the address of `views.json` beside the Hallway the way back leads to,
and the door's id there: the way back's `from`, else the environment's own id. `viewParams` checks
an entry before it is used. The views change when the hall or its doors do, and the Hallway
renders them again then (its README says how).

## Moving in VR

The Hallway's control panel offers two choices for moving in VR:

- **Move:** `smooth` (the default), where the left stick walks the way you face, or `teleport`,
  where the left stick aims a jump.
- **Turn:** `snap` (the default), where the right stick turns 30° at a time, or `smooth`, where it
  turns you while held.

It keeps them in `localStorage` under `hallway.nav`, as `{"move":"smooth","turn":"snap"}`. Every
site on `ariamokr.github.io` can read and write that key, so a visitor's choice comes with them
through the doors, and a choice made in an environment is kept in the Hallway too. `nav.js` reads
and writes it.

## The TV app

[HallwayApp](https://github.com/AriaMoKr/HallwayApp) puts the Hallway on an Android TV: the
published site in a full-screen WebView, walked with the TV's remote. Links on
`ariamokr.github.io` stay in the app, so every site behind a door runs there too.

**Knowing it is the TV.** The WebView's user agent ends with ` HallwayTV/<version>`, the version
starting with a digit (`HallwayTV/1.0.0`, `HallwayTV/0.0.0-dev`). `isTV(navigator.userAgent)` looks
for it. `tvMode()` is that, or `?tv=emulate` in the page's address, which shows the TV's page in
any browser.

**The remote.** The D-pad reaches the page as the arrow keys and OK as Enter, with an empty `code`
(WebView's mapping; keys sent with `adb shell input keyevent` have none either), so a site's key
map reads `keyOf(e)` rather than `e.code`. On a TV, WebView moves the focus with any arrow the page
doesn't take (spatial navigation), and OK follows a focused link. With TalkBack on, TalkBack takes
the arrows before the page gets them. OK on the view, Menu and Back, the channel and media keys and
a gamepad still reach the page, and `keyOf` reads four of those keys as the arrows ([`tv.js`](#tvjs)).

**Back and Menu.** The app keeps these two keys and asks the page about each press. It calls
`window.hallwayTV.back()` on Back, and `window.hallwayTV.menu()` on Menu or a long press of Back.
Unless the call returns `true`, the app goes back a page, or leaves when there is none to go back to. `true`
means the page used the key: the focus came out of the card to walking, or the site took a step
of its own. A page without `window.hallwayTV` gets the plain Back. A `Remote` puts `{ menu, back }`
there with `answerApp()`, in TV mode only.

**Where Menu lands.** Menu goes back to the control last left in the card. When there is none, it
goes where the site's `first()` says: what the visitor is doing, such as outside's book buttons while
reading. Without `first()`, Menu goes to the card's first stop that isn't a text box: the doors, not
vrlbry's search box. Only a card of text boxes alone starts on one. When what the visitor is doing
changes, the control they left may no longer fit: in outside, Read the book is the control left once
it has opened the book, and anyone who has been in the card has left one. The site then calls
`forget()` (outside, as the book opens), and Menu goes to `first()` again.

**Text boxes and the TV's keyboard.** On the TV, a text box raises the on-screen keyboard as soon
as it has the focus, and the keyboard takes the arrows until Back hides it. So when the remote
steps onto a text box, by Menu or by ↑ and ↓ in the card, it keeps the keyboard down: the box
has `inputmode="none"` while the focus is on it. OK on the box brings the keyboard up: the box gets
its own `inputmode` back and the focus again. That OK isn't the form's Enter; the next one, from the
keyboard or the remote, is. A box the site focuses itself, such as a search opened by a key of its
own, is left as it is. In a browser at `?tv=emulate` the attribute shows this. On the TV, the
keyboard itself does.

**Back and the page's history.** The app's back a page is the WebView's, through the page's
history. So an entry the page pushed is a page to go back through first: BackHistory's book, and
each link followed in it, are put away and gone back through by the app's own Back, through
`popstate`, as by a browser's. A step of the site's own (`Remote`'s `step`) is for what has no
entry: standing up from a bench, closing a text view, a book without an entry. A book with its
entry is left to the app's back (`step()` returns false for it), or Back would take two steps: the
book put back by the step, then the page gone back from.

Chromium has one exception. It leaves out of Back's history the entries of a page nobody has pressed a key on or
clicked. A book taken out with the remote's OK has had a key press, so its entry is there. One
taken out with a gamepad alone, on a page nobody has pressed a key on, may have none:
`navigator.userActivation.hasBeenActive` is false when it comes out. Then the step puts it back
itself.

```js
let bookEntry = false;                      // the book's entry is one the app's Back will come to
function takeOut(book) {
  backHistory.bookOut();
  bookEntry = navigator.userActivation?.hasBeenActive ?? true;
  /* … */
}
const step = () => {
  if (textView.open) return textView.close(), true;
  if (book.open && !(bookEntry && backHistory.level > 0)) return putBack(book), true;
  if (seated) return standUp(), true;
  return false;                             // the app's: back a page, through the book's entries
};
```

### A site in the app

What a site does to work with the remote, from what the hallway does:

1. **The 10-foot view**: `html.tv` from `tvMode()`. The page is 960 × 540 at a pixel ratio of 2,
   seen from across a room. The hallway's numbers, as a guide: 18 px text; a 4 px focus ring on a
   9 px dark halo; a choice's label ringed rather than its small input; a larger aim dot.

   ```css
   html.tv, html.tv body { font-size: 18px; }
   html.tv :focus-visible { outline: 4px solid #ffd98a; outline-offset: 3px; box-shadow: 0 0 0 9px rgba(0, 0, 0, 0.65); }
   html.tv .settings label:has(input:focus-visible) { outline: 4px solid #ffd98a; outline-offset: 4px; border-radius: 4px; }
   html.tv .settings label input:focus-visible { outline-width: 2px; outline-offset: 1px; box-shadow: none; }
   html.tv .settings input { width: 20px; height: 20px; }
   html.tv .aim { width: 26px; height: 26px; margin: -13px 0 0 -13px; border-width: 3px; }
   ```
2. **No Enter VR or Fullscreen**: the TV has neither, so the buttons go, and the page doesn't ask
   for XR.
3. **A `Remote`** over the page's card (`root`) and its canvas (`view`), with `use` as the
   gamepad's A at the middle of the view. The aim dot shows while walking in TV mode
   (`!remote.inCard`), with or without a pad.
4. **Where Menu lands**: `first` for what the visitor is doing, when there is no control to come
   back to (the book's buttons while reading), and `forget()` when that changes (the book opened).
   Without `first`, Menu passes over the text boxes to the card's first other stop.
5. **Text boxes**: the remote keeps their keyboard down while stepping and brings it up on OK,
   so the site sets no `inputmode="none"` of its own on them. Check on the TV that the keyboard
   stays down while the remote steps onto a box and past it, and comes up on OK.
6. **`window.hallwayTV`** through the module (`remote.answerApp()`), with `step` for the site's
   own Back.
7. **Keys** read through `keyOf(e)`.
8. **Whatever needs a letter key, the mouse or the wheel** (a 3D panel, a shortcut such as T) is
   also a control in the card.
9. **In a shared session**, the invite link shows as text to type elsewhere, with no Copy.
10. **No controls that open a local file.**
11. **The frame rate**, measured on the TV with HallwayApp's `tools/tv-check.mjs --url` (a debug
    build). Lower the pixel ratio until the page holds 60 fps at 1080p; the hallway holds it at 2.
12. **Testing in a browser**: `?tv=emulate`, with `remote.menu()` standing in for Menu (or
    `hallwayTV.menu()` in the console). In the card, Escape stands in for Back, and a text box
    the remote is on shows `inputmode="none"` until OK.

## The modules

### `door.js`

```js
import { hallwayViews, leaveUrl, readVisit, viewParams, wayBack, withoutVisit } from 'common/door.js';

const visit = readVisit(location.search);      // { from, dx, yaw, pitch, dw, dh, glow }
const way = wayBack(location.search, 'outside', { origin: location.origin });
history.replaceState(history.state, '', withoutVisit(location.href));

doorBack.href = leaveUrl(way, room);           // room: the shared session's, or null
const views = hallwayViews(way, 'outside');    // { views, id }, or null
if (views) {
  const res = await fetch(views.views);
  const hang = res.ok ? viewParams((await res.json())?.views?.[views.id]) : null;
}
```

| Export | |
|---|---|
| `HALLWAY_ID` | `'hallway'`, the Hallway's `from`. |
| `HALLWAY_URL` | `'https://ariamokr.github.io/hallway/'`. |
| `hallwayUrl(id)` | The Hallway in front of the door `id`: `HALLWAY_URL` with `?from=<id>`. |
| `VISIT_PARAMS` | What `withoutVisit` takes off the address: `from`, `back`, `backname`, `dx`, `yaw`, `pitch`, `dw`, `dh`, `glow`. |
| `LINK_PARAMS` | What the Hallway's doors add, in order: `from`, `back`, `dx`, `yaw`, `pitch`, `dw`, `dh`, `glow`, `room`. |
| `readVisit(search)` | The visit: `from`, `dx` (m), `yaw` and `pitch` (radians), `dw` and `dh` (m), `glow` (`'#rrggbb'`), each null when missing or nonsense. |
| `wayBack(search, id, { origin, always })` | The way back: `{ url, label, title, name, host, hallway }`. `id` is this environment's door id, `origin` this page's (for the dev servers' rule). With `always: false` it is null for a visit through no door. |
| `keptWay(json)` | A way back kept in `sessionStorage` as JSON, checked, or null. |
| `withoutVisit(href)` | The address without `VISIT_PARAMS`: path, other parameters and hash as written, for `history.replaceState`. |
| `leaveUrl(way, room)` | The way back's address in the session `room`, or out of any when `room` is null. |
| `hallwayViews(way, id)` | `{ views, id }`: views.json's address and the door's id there, or null when the way back is not the Hallway. |
| `viewParams(entry)` | An entry of views.json, `{ image, depth, pictureHeight, eye, horizon, aspect }`, or null when it isn't sensible. |
| `doorLink(env, { here, hall, pose, xr, room })` | The Hallway's side: the link the door `env` (`{ id, url, color }`) opens, from the Hallway at `here`, with doorways `hall` (`{ doorWidth, doorHeight }`) and the visitor's `pose` (`{ across, yaw, pitch }`, the Hallway's `doorPose`). |
| `hallLink(env, { here, name, room })` | Another hall's side (since v0.6.3): the link its door `env` (`{ id, url }`) opens, from the hall at `here`, which calls itself `name` on the way back. |

The types `Visit`, `WayBack`, `ViewParams` and `DoorPose` are in `door.d.ts`.

### `nav.js`

```js
import { loadNav, saveNav } from 'common/nav.js';

const nav = loadNav();                          // { move: 'smooth' | 'teleport', turn: 'snap' | 'smooth' }
saveNav({ ...nav, move: 'teleport' });          // false when storage is blocked: it then lasts this visit
```

| Export | |
|---|---|
| `NAV_KEY` | `'hallway.nav'`. |
| `NAV_DEFAULTS` | `{ move: 'smooth', turn: 'snap' }`, frozen. |
| `normalizeNav(value, defaults?)` | A complete, valid choice from whatever was stored: anything unknown or missing is the default, value by value. |
| `loadNav(storage?, defaults?)` | The stored choice, else the defaults. `storage` is `localStorage` when left out, and null where there is none. A site can pass its own defaults for a visitor who has stored no choice yet (vrlbry's older setting decides how to move). |
| `saveNav(nav, storage?)` | Keeps the choice, complete and valid; false when it could not. |

### `portal.js`

A doorway's material: a flat quad in the opening that shows a room behind it, made from one
picture. The picture is the room's far wall, and its edges are stretched back to the opening as
the floor, ceiling and side walls ("interior mapping"). Each eye sees it from its own position, so
it has parallax and, in a headset, depth. In front of it drift a veil and a glow along the frame,
in the door's colour, brighter when pointed at. Without a colour there is no veil, for a plain
window (the Hallway's end window).

```js
import * as THREE from 'three';
import { openingGeometry, placePortal, portalMaterial, setView } from 'common/portal.js';

// Before the Hallway's view of the door has loaded: a picture of one's own, hung by hand.
const material = portalMaterial({ map: painted, width: 1.1, height: 2.25, depth: 2.4, pictureHeight: 3, eye: 1.6, horizon: 0.56, color: '#9fd07a' });
const portal = new THREE.Mesh(openingGeometry(1.1, 2.25), material);
doorway.add(portal);
placePortal(portal);                            // once placed, and again whenever it moves

setView(material, texture, view);               // view: viewParams(...) from door.js

// Each frame:
material.uniforms.uTime.value = time;
material.uniforms.uGlow.value = pointedAt ? 1 : 0;
```

| Export | |
|---|---|
| `portalMaterial({ map, width, height, depth, pictureHeight, eye, horizon, aspect = 2, color = null })` | The material for an opening `width` by `height` (m), showing the texture `map` hung as the other fields say, with a veil in `color` (none when null). The view fields are `viewParams`' from `door.js`, so a view can be spread straight in: `portalMaterial({ ...view, map, width, height, color })`; its `image` is ignored. |
| `openingGeometry(width, height)` | The quad for an opening, its origin at the middle of the sill, facing +z. |
| `placePortal(mesh)` | Call once the mesh is placed, and again whenever it moves: the shader works in the opening's own frame. |
| `setPicture(material, map, aspect)` | A new picture, keeping its height and taking the new one's aspect (the Hallway's door previews, once loaded). |
| `setView(material, map, view)` | A new picture in a new room: `view` is `{ depth, pictureHeight, eye, horizon, aspect }`, as from `viewParams`, `aspect` 2 when left out. |

The types `PortalMaterial` (a `THREE.ShaderMaterial` with the uniforms below), `PortalUniforms` and
`PortalView` are in `portal.d.ts`. The uniforms are part of the API:

| Uniform | Value | |
|---|---|---|
| `uTime` | number | Seconds, for the veil's drift. The site sets it each frame. |
| `uGlow` | number | 0 idle, 1 pointed at. The site sets it each frame. |
| `uMap` | `THREE.Texture` | The picture hung now. A site may read it (vrlbry keeps its painted one). |
| `uColor` | `THREE.Color` | The veil's and the glow's colour. |
| `uVeil` | number | 1 with a veil, 0 for a plain window. |
| `uBoxMin`, `uBoxMax` | `THREE.Vector3` | The room, in the opening's frame (origin at the middle of its sill, facing +z): the picture hangs at `z = uBoxMin.z`, from `y = eye - horizon * pictureHeight`, `pictureHeight * aspect` wide. |
| `uOpening` | `THREE.Vector2` | The opening's width and height. |
| `uInverseModel` | `THREE.Matrix4` | The mesh's world matrix, inverted (`placePortal`). |

The shader includes three's `tonemapping_fragment` and `colorspace_fragment`, the latter from three
r154 on.

### `fade.js`

A fade to and from black around the viewer's head: a small sphere on the camera, drawn over
everything, the same on a screen and in a headset. The sites fade out before going through a
door, fade in on arriving, and blink a teleport with it.

```js
import { Fade } from 'common/fade.js';

const fade = new Fade(camera);                  // black at first; new Fade(camera, 0) starts clear
fade.to(0, 0.8);                                // fade in on arriving
fade.to(1, 0.4, () => location.assign(url));    // fade out, then go
fade.update(dt);                                // each frame
```

| Member | |
|---|---|
| `new Fade(camera, value = 1)` | Puts the sphere on `camera` (any `THREE.Object3D`), at `value`: 1 black, 0 clear. |
| `to(target, seconds, done = null)` | Fades to `target` over `seconds`, then calls `done` once. A new `to` or `set` drops the fade under way, and its `done`. |
| `set(value)` | Puts it at `value` at once. |
| `update(dt)` | Moves the fade on by `dt` seconds; each frame. |
| `mesh`, `material` | The sphere (`name` `'fade'`, hidden while clear) and its material, for instance to hide it from a still render. |
| `value`, `target` | How black it is now, and where it is fading to. |

### `gamepad.js`

Standard-layout gamepads (Xbox, PlayStation, most Bluetooth pads) through the Gamepad API, on a
desktop or a phone; in VR the controllers come through the XR session instead. The sites handle
them alike, so a pad feels the same on both sides of a door: one dead zone, one stick scaling, the
same pad chosen.

```js
import { firstPad, readPad } from 'common/gamepad.js';

const state = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, use: false, back: false };
// Each frame:
const pad = firstPad(navigator.getGamepads());
if (pad) readPad(pad, state);                   // allocates nothing
```

| Export | |
|---|---|
| `readPad(pad, out?)` | What the pad asks for now, written into `out`: `{ moveX, moveY, lookX, lookY, run, use, back }`. The left stick walks and, clicked in, hurries (`run`); the right one looks; A uses; B or Back goes back. Sticks are -1 to 1, y down as gamepads give it. |
| `firstPad(pads)` | The first connected pad of `navigator.getGamepads()`, preferring one with the standard mapping, or null. |
| `stick(x, y, deadzone = DEADZONE, out?)` | A stick with a radial dead zone, rescaled to start smoothly at its edge and reach 1 at full tilt, diagonally too: `{ x, y }`, written into `out` when given. |
| `held(pad, i)` | Whether button `i` is held: pressed, or an analogue one more than half way. |
| `DEADZONE` | 0.18. |
| `BUTTON` | The buttons `readPad` reads, by index in the standard mapping: `{ a: 0, b: 1, back: 8, leftStick: 10 }`. |
| `BUTTONS` | Every button's name by index in the standard mapping: `a`, `b`, `x`, `y`, `lb`, `rb`, `lt`, `rt`, `back`, `start`, `ls`, `rs`, `up`, `down`, `left`, `right`, `home`. |

A site with a reader of its own (vrlbry's, which reports every button, the triggers and the
presses since the last frame) builds it on `stick`, `held` and `BUTTONS`.

### `sky.js`

The sky of a late afternoon, the one outside's garden is under, so a visitor sees one time of day
behind every door. It is painted once into a 360° picture (the gradient warming toward the low sun
in the west, haze, two ranges of far hills and a line of trees at the horizon, a few clouds lit gold
on their sunny sides, the sun, and the ground below), and shown by direction, so each eye sees it
at infinity: on a dome round a scene, or on any surface that looks out at the far distance, such as
a window's glass or a skylight. Water can reflect the same picture, looked up the same way.

```js
import { skyDome, skyMaterial, skyTexture } from 'common/sky.js';

const sky = skyTexture();                       // paint it once, and share it

scene.add(skyDome(sky));                        // outside: a dome round the garden

const glass = skyMaterial(sky, { yaw: 0 });     // a room: its windows' glass and its skylight
windows.material = glass;                       // merged geometry is fine
skylight.material = glass;
```

| Export | |
|---|---|
| `skyTexture({ canvas }?)` | The panorama: a `THREE.CanvasTexture`, 2048 × 1024, equirectangular, sRGB, repeating in u, without mipmaps. `canvas(width, height)` makes the canvases it paints on: the page's by default, or a stand-in in Node. It paints in 25 to 45 ms in Chrome on a desktop, the same picture every time (its clouds and trees come from a fixed seed). |
| `skyDome(map)` | outside's dome: a sphere of radius 90 round the scene, drawn first (`renderOrder` -1), not writing depth, showing `map` by the direction from each eye. Named `'sky'`. |
| `skyMaterial(map, { yaw = 0 }?)` | A material for glass or a skylight: it shows `map` by the direction from each eye to the surface, so the sky is at infinity and moves as the far distance does, with no frame per opening. It works on merged geometry, since it uses world positions. `yaw` turns the panorama (below). |
| `SUN_DIR` | Toward the sun, a unit vector, frozen: low in the west, 25.4° up and 52.6° round from straight down the garden toward -x. outside bakes its light from it. |
| `skyColor(el, toSun)` | The sky's colour before clouds, hills and the sun are painted over it, as `[r, g, b]` in sRGB 0 to 255 (not rounded), at elevation `el` (radians, + up) and `toSun`, the cosine of the angle from the sun. For light baked from the sky. |
| `SKY_UV` | GLSL, `vec2 skyUv(vec3 d)`: where a direction falls in the picture. u is 0.5 straight down the garden (-z), rising toward +x; v is 0.5 at the horizon, 1 straight up. For a site's own shader, such as outside's water reflecting the sky. |

`skyMaterial`'s uniforms are `uMap` (the panorama) and `uYaw` (radians); setting
`material.uniforms.uYaw.value` turns the sky later, for another room, with no new material. The
type `SkyMaterial` is in `sky.d.ts`. Both materials include three's `tonemapping_fragment` and
`colorspace_fragment`; with no tone mapping, as the sites have, the sky shows as painted.

**A room's yaw.** The panorama is laid out in the garden's frame: straight down the garden is -z,
and the sun stands low to the left of it. `yaw` turns it about the vertical as three.js's
`rotation.y` turns an object, so what the garden sees looking down -z, the room sees looking toward
`(-sin yaw, 0, -cos yaw)`, and every bearing turns with it. A room picks its yaw by what it wants
where:

- **Laid out as the garden is**, or not minding: `yaw: 0`. The Hallway's end window looks down -z,
  down the hall as one looks down the garden, so at 0 it shows the bearings its own picture shows
  now, with the sun just off to the left.
- **The garden's view down -z through a window that looks toward `w`** (a horizontal world
  direction): `yaw = Math.atan2(-w.x, -w.z)`.
- **The sun toward `w`**, through one particular window: `yaw = SUN_AZ - Math.atan2(w.x, -w.z)`,
  with `SUN_AZ = Math.atan2(SUN_DIR[0], -SUN_DIR[2])`. A low sun straight through a window can
  glare; a little to one side shows its glow.
- **Turning with the room**: a room built in a group turned by `rotation.y = r`, whose layout is the
  garden's, uses `yaw: r`.

Every window and skylight of one room shares one yaw: there is one sky.

### `access.js`

Accessibility settings, shared by every site on `ariamokr.github.io` as the movement choice is:
kept in `localStorage` under `hallway.access`, so a visitor sets them once, anywhere, and they
come with them through every door.

| Setting | Values | What the visitor gets |
|---|---|---|
| `motion` | `'system'` (the default), `'reduce'`, `'full'` | Less motion: going to a clicked spot jumps there instead of gliding, the fades are blinks, and nothing moves on its own (the doorways' drifting veil, the water, waving visitors' bob). `'system'` follows the device's own setting (`prefers-reduced-motion`), and follows it if it changes. |
| `vignette` | `true` (the default), `false` | In VR, while moving or turning smoothly with the sticks, the edge of the view darkens and closes in, and it opens again on stopping. It eases the motion sickness smooth movement gives some people. Snap turns and teleports need none: they blink already. |
| `seated` | `false` (the default), `true` | In VR, the view is raised 0.45 m, so a visitor sitting down sees from about standing height: over the hallway's panel, the library's shelves, the breadboard's table. |

```js
import { Vignette, eyeLift, loadAccess, motionQuery, reduceMotion, saveAccess, watchMotion } from 'common/access.js';

let access = loadAccess();                      // { motion, vignette, seated }
const query = motionQuery();                    // the system's setting; get it once
let reduce = reduceMotion(access, query);
watchMotion(() => { reduce = reduceMotion(access, query); }, query);

const vignette = new Vignette(camera, access.vignette);

// A setting changed, on the panel or in the overlay:
function setAccess(change) {
  access = { ...access, ...change };
  saveAccess(access);                           // false when storage is blocked: it lasts this visit
  reduce = reduceMotion(access, query);
  vignette.enabled = access.vignette;
  placeRig();                                   // seated may have changed
}

// Each frame, from the sticks' smooth movement (m/s) and smooth turning (rad/s):
vignette.update(dt, moveSpeed, turnRate, renderer.xr.isPresenting);

// The rig's height, on entering and leaving VR and when seated changes:
function placeRig() {
  rig.position.y = floor + (renderer.xr.isPresenting ? eyeLift(access) : 0);
}
```

| Export | |
|---|---|
| `ACCESS_KEY` | `'hallway.access'`. |
| `ACCESS_DEFAULTS` | `{ motion: 'system', vignette: true, seated: false }`, frozen. |
| `normalizeAccess(value, defaults?)` | Complete, valid settings from whatever was stored: anything unknown or missing is the default, value by value. |
| `loadAccess(storage?, defaults?)` | The stored settings, else the defaults. `storage` is `localStorage` when left out, and null where there is none. |
| `saveAccess(access, storage?)` | Keeps them, complete and valid; false when it could not. |
| `REDUCED_MOTION` | `'(prefers-reduced-motion: reduce)'`. |
| `motionQuery()` | `matchMedia(REDUCED_MOTION)`, or null where there is none (Node). Each call makes a new one: get it once. |
| `reduceMotion(access, query?)` | Whether to reduce motion: true for `'reduce'`, false for `'full'`, and the system's setting for `'system'`. |
| `watchMotion(onChange, query?)` | Calls `onChange(reduce)` when the system's setting changes; returns a function that stops it. |
| `new Vignette(camera, enabled = true)` | The comfort vignette, on `camera`. `update(dt, speed, turnRate, xr)` each frame closes it toward the larger of `speed / 1.8` and `turnRate / 1.6` (the sites' walking and turning at full stick), in 0.15 s, and opens it in 0.4 s; it allocates nothing. Outside VR, or with `enabled` false, it is open. `set(strength)` sets it at once, `strength` is how closed it is (0 to 1), and `mesh` and `material` are the ring. |
| `VIGNETTE` | Its tuning: `fullSpeed`, `fullTurn`, `open` (60°, the clear view's half-angle as it starts to close), `closed` (30°), `feather` (15°, the soft edge), `rise` and `fall` (per second). |
| `eyeLift(access)` | The metres to raise the rig in VR: `SEATED_LIFT` (0.45) when seated, else 0. |

The types `Access`, `VignetteMaterial` and `VignetteUniforms` are in `access.d.ts`.

**Wiring it in.** What a site does with each setting:

- **Less motion** (`reduce` true):
  - *Jump, don't glide*: a click or tap on the floor (`walkTo`) puts the visitor there at once, and
    a view that eases to a book or a bookcase cuts to it.
  - *Blink, don't fade slowly*: fades of a few tenths of a second become a blink (`fade.to(1, 0.08)`
    and back, as a teleport does), or `fade.set`.
  - *Stop what moves on its own*: hold the portals' `uTime` where it is, and outside's water and
    grass; skip the wave's bob (the toast still says who waved). Turn it back on when `reduce`
    goes false. Movement the visitor makes themselves, walking and turning, stays.
- **The vignette**: one `Vignette` on the camera, beside the `Fade`, drawn under it. Each frame pass
  the speed and turning the sticks ask for in VR, not the head's own motion (the headset moving is
  the visitor moving, and needs none): 0 for a snap turn and a teleport. Hide its `mesh` from still
  renders, as the fade's is (the Hallway's door views). It is drawn at infinity in each eye, so the
  ring never looks near.
- **Seated**: add `eyeLift(access)` to the rig's height in VR only, on entering VR, on leaving it
  (back to 0), and when the setting changes; a teleport keeps it. On a screen the site's own eye
  height stays.
- **Where to set them**: beside the movement choice, on the site's 3D control panel (rows such as
  *Motion: System / Less / Full*, *Vignette: On / Off*, *Seated: On / Off*), and in a DOM control
  in its overlay, so they can be reached with a keyboard and a screen reader: a labelled group of
  three radio buttons for motion and two checkboxes, applied and saved as soon as they change.
  Another site on the origin changing them shows up as a `storage` event for `ACCESS_KEY` in a page
  still open; reading them on `pageshow` is enough for one that comes back from the back/forward
  cache.

### `back-history.js`

The browser's Back for an open book: vrlbry's and music's books off their shelves, outside's on
the bench. Taking a book out adds a history entry at the same address, and so does each link
followed in it. So the browser's Back (its button, a phone's back gesture, a mouse's back button,
Quest Browser's) goes back one link at a time through those entries, as a toolbar's ↩ Back does,
and then puts the book away. A book put away otherwise (Put back, ✕, Esc, B) takes its entries back
out, so that Back then leaves the page as it would have. Forward brings back neither the links nor
the book. Entries left by an earlier load of the page (before a reload) are passed over, and the
entry the page is loaded on is the page's own again.

```js
import { BackHistory } from 'common/back-history.js';

const backHistory = new BackHistory({
  history,
  load: performance.timeOrigin,             // this load of the page: its entries' mark
  onBack: (depth) => book.backTo(depth),    // to where the trail was `depth` links deep; false if gone
  onAway: () => closeBook({ away: true }),  // Back past the book's own entry (its entries are gone)
});
addEventListener('popstate', (e) => backHistory.popstate(e.state));

backHistory.bookOut();                      // a book came out; one a link swaps in keeps the entries
backHistory.pushed(trail.length);           // a link was followed
if (!backHistory.back()) book.back();       // the toolbar's Back: through the history when it can
backHistory.cleared();                      // the book was put away, not by Back
```

| Export | |
|---|---|
| `new BackHistory({ history, load, onBack, onAway, prefix? })` | `onBack(depth)` returns whether there is such a place, or a promise of it; when there is none, Back goes on to the book's own entry. |
| `bookOut()`, `pushed(depth)`, `cleared()`, `popstate(state)` | As above. |
| `back()` | Goes back through the history and is true when a link's entry is there; false when the toolbar must go back itself. |
| `level` | How deep the current entry is: 0 the page, 1 a book out, 1 + n n links deep in it. |

Its fields in an entry's state sit beside whatever the page keeps there (the address's), named
from `prefix`: `backBook`, `backTrail` and `backLoad` by default. Each page has its own
`history.state`, so the default suits every site. `prefix: 'vrlbry'` (or `'outside'`) keeps the
names a site's own copy gave them, so the entries already in a visitor's history, in a tab left
open across the change, are still its own; with the default, such an entry is the page's, and the
first Back onto one may seem to do nothing. The type `BackHistoryOptions` is in `back-history.d.ts`.

### `tv.js`

The TV app's remote ([The TV app](#the-tv-app)): the hallway's, with a step of the site's own for
Back and what the other sites' controls need. Walking, the 3D view holds the focus and the arrows
are the site's. In the card, the remote moves the focus from control to control.

| Key | Walking | In the card |
|---|---|---|
| ↑ ↓ | the site's (walk) | from control to control; a radio group is one stop, at its checked option; a text box's keyboard kept down |
| ← → | the site's (turn) | through a choice (a radio group, a select), each option chosen as it is reached; elsewhere nothing |
| OK (Enter) | `use()` | ticks a checkbox or a radio, opens a select's list, brings up a text box's keyboard; a link or a button as its own |
| Menu (`menu()`) | into the card: to the control last left there (unless `forget()` since), else `first()`'s, else the first stop that isn't a text box | walking again |
| Back (`back()`) | `step()`: true when it took one, else the app's | walking again |
| Escape | the site's | walking again |

A control that uses the arrows itself keeps them, in the card, for its own listener (on the control
or inside the card; the site's walking listener on the window doesn't get them):

- **An open combobox** (`role="combobox"` with `aria-expanded="true"`, such as vrlbry's search)
  keeps ↑ and ↓, and Escape, which closes its list. Back sends it an Escape first, so the first
  Back closes the list and the next walks. A list that stays open after the Escape is walked away
  from.
- **A range** keeps ← and → for its steps; ↑ and ↓ still go on.
- **A text box's caret** keeps ← and → until it reaches that end, and then the focus stays.

When the focus falls from the card to nowhere (a control blurs itself, as vrlbry's search does on
Escape, or goes), the remote walks again, and Menu comes back to that control.

A text box the remote steps onto has `inputmode="none"` until OK on it, and its own `inputmode`
back then, or as soon as the focus leaves it ([The TV app](#the-tv-app), "Text boxes and the TV's
keyboard"). `first()` may give a stop, or a part of the card holding stops (its first), or an
option of a choice (the choice's stop). What isn't a stop (hidden, disabled, outside the card)
counts as none.

```js
import { Remote, keyOf, tvMode } from 'common/tv.js';

const tv = tvMode();
document.documentElement.classList.toggle('tv', tv);
let remote = null;
if (tv) {
  remote = new Remote({
    root: overlay.root,                     // the page's card (document.body for one spread out)
    view: renderer.domElement,              // the 3D view, which holds the focus while walking
    use: () => controls.useMiddle(),        // OK: the gamepad's A at the middle of the view
    step,                                   // the site's own Back ("Back and the page's history")
    first: () => (reading ? book.buttons : null),   // where Menu lands with nothing to come back to
  });
  remote.onMode = (inCard) => overlay.setHint(inCard ? 'tv-card' : 'tv');
  remote.answerApp(tv);                     // window.hallwayTV = { menu, back }
}
book.onOpen = () => remote?.forget();       // Menu to the book's buttons next, not to Read the book
addEventListener('keydown', (e) => {
  const action = KEYS[keyOf(e)];            // 'KeyW', or 'ArrowUp' from the remote and its spares
  /* … */
});
controls.onPadBack = () => remote?.padBack();
```

| Export | |
|---|---|
| `isTV(userAgent)` | The TV app's WebView: ` HallwayTV/<digit>…` in the user agent. |
| `tvMode({ userAgent?, search? })` | `isTV`, or `?tv=emulate`; `navigator.userAgent` and `location.search` by default. |
| `keyOf(e)` | `e.code \|\| e.key`, with the spare keys as the arrows: `ChannelUp` and `ChannelDown` as `ArrowUp` and `ArrowDown`, `MediaRewind` and `MediaFastForward` as `ArrowLeft` and `ArrowRight` (`SPARE_KEYS`). Play and pause, stop, next and the rest are as they are. |
| `keepsKey(el, key)` | Whether the focused control keeps the key, as above. |
| `focusStops(items)`, `nextStop(n, at, dir)` | The card's stops, a radio group one, and the next stop, staying at the ends. |
| `new Remote({ root, view, use, step?, first? })` | Takes the keys before the site's listeners (the window's capture). |
| `menu()`, `back()` | What the app calls. `menu()` is always true. `back()` is true in the card, else `step()`'s answer when it is `true`. |
| `padBack()` | A gamepad's B: as `back()`, else back a page when there is one (a page can't leave the app). |
| `walk()`, `toCard()`, `inCard`, `onMode(inCard)` | The focus to the view or into the card, which has it, and a callback as it moves. |
| `forget()` | The control last left in the card forgotten: Menu goes to `first()` next. In the card it changes nothing. |
| `answerApp(tv = tvMode())` | `window.hallwayTV = { menu, back }` in TV mode; true when it did. |

The spare keys are there for TalkBack, which keeps the arrows: the card reads them as their arrows
too, stepping a range or moving a caret itself and sending an open combobox the arrow. The type
`RemoteOptions` is in `tv.d.ts`. The hallway's own Join form (`roomFromInput`) stays in the
hallway: it needs layersharedsession's `isRoom`.

### `controls.js`

Walking about a site, on every device: the template's `public/js/controls.js`
([RoomTemplateEmpty](https://github.com/AriaMoKr/RoomTemplateEmpty) at `f3e1c91`), call for call,
with what is general in outside's. The visitor's body is the `rig` (yaw only), and the camera is
its head: pitch on a screen, the headset's pose in VR. A site's own `Controls` extends it with its
room.

| | |
|---|---|
| Desktop | A drag looks; WASD or the arrows walk and turn (Shift runs, Q and E turn); a click uses what it is on. |
| Phone | A finger drags the scene; a tap uses what it is on. Two fingers neither look nor tap: they are a pinch, for the site. |
| Gamepad | It takes over when used, and the mouse takes it back (`padActive`, `onPadActive`, `hasPad`). The left stick walks (pressed in, it runs), the right one looks, A is `useMiddle()`, and B or Back is `onPadBack`. |
| TV | The remote's arrows walk and turn, read through `keyOf` (its spare keys too). With `aimMiddle` the middle of the view is the pointer, and the site's `Remote` gives OK to `useMiddle()`. |
| VR | Two hands (`hands`), each with a laser and a reticle. A trigger uses what its hand points at, and a grip is `onSqueeze`. The right stick turns (`turn`: `snap`, 30° a push, or `smooth`), and the left one walks the way the head faces or aims a teleport (`move`; `setNav`). Entering lines the headset up with where the visitor stood and looked; leaving carries on from the head. |

What a click, a tap, A, OK or a trigger is on goes to `use(hit, how)`. Common's own takes the
doorway (`onDoor(how, hit)`) and ground one may stand on (`walkable`): a walk there on a screen,
a teleport in VR. A walk is only a screen's: in VR, `update` walks nowhere. It follows the site's
`route` there and turns to its `face` on the way (on the last leg, when it goes along more than one
point, looking where it goes before that). It calls `then` once there and turned. A wall, a key, a
drag or the gamepad ends it, and then `then` isn't called. With `reduceMotion` it jumps to the end.
The rig stands on the site's ground (`groundAt`), under the head in VR, `eyeLift` above it there
(`setEyeLift`).

A key is the page's, and neither the site's nor walking's, in these cases:

- Ctrl, Meta or Alt is held.
- A page control has used it already (`defaultPrevented`, such as the TV remote's OK).
- It is in a form control, a `contenteditable` or an element with `data-own-keys` (a text view).
- It is Space or Enter on a button or a link.

The arrows that walk are prevented, so the page doesn't scroll and the TV's spatial navigation
doesn't take them.

```js
import { Controls as Walking } from 'common/controls.js';
import { EYE, castRay, clampWalk, panelButtonAt, pieceFront } from './room.js';

/** The template's: its room, its control panel and the pictures on its walls. */
export class Controls extends Walking {
  constructor({ layout, ...options }) {
    super({ ...options, eye: EYE, hit: () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, piece: -1 }) });
    this.layout = layout; // after super(): common's constructor calls none of the methods below
    this.hoverPanel = null;
    this.hoverPiece = -1;
    this.onPanel = () => {};
    this.onPiece = () => {};
  }

  castRay(ox, oy, oz, dx, dy, dz, out) {
    return castRay(this.layout, ox, oy, oz, dx, dy, dz, out);
  }

  clampWalk(fx, fz, x, z, out) {
    return clampWalk(this.layout, fx, fz, x, z, out);
  }

  usable(hit) {
    if (hit?.kind === 'panel') return panelButtonAt(hit.u, hit.v);
    return hit?.kind === 'piece' ? 'piece' : super.usable(hit);
  }

  use(hit, how) {
    if (hit?.kind === 'panel') this._press(panelButtonAt(hit.u, hit.v));
    else if (hit?.kind === 'piece') this.onPiece(hit.piece, how);
    else super.use(hit, how);
  }

  _setHover(usable, hit) {
    super._setHover(usable, hit);
    this.hoverPanel = hit?.kind === 'panel' ? usable : null;
    this.hoverPiece = usable === 'piece' ? hit.piece : -1;
  }

  reticleScale(use, hit) {
    return use === 'piece' ? 1.3 : super.reticleScale(use, hit);
  }

  walkInto() { /* up to the doorway and through it: this._startWalk(points, Math.PI) */ }
  walkUpTo(i, done = null) { /* pieceFront: this._teleport(…) in VR, else this._startWalk(…, done) */ }

  _press(id) {
    if (id) this.onPanel(id);
  }
}
```

**What a site gives it** are methods its subclass overrides. The room's data stays in the
subclass, set after `super()`; common's constructor calls none of them.

| Method | Common's | The site's |
|---|---|---|
| `castRay(ox, oy, oz, dx, dy, dz, out)` | meets nothing: null | What the ray meets first, written into `out` and returned, or null. Common reads `t`, `kind`, the point (`x`, `y`, `z`), the normal (`nx`, `ny`, `nz`, any length) and `walkable`; the rest is the site's. Of the kinds, common knows `'door'` (the doorway) and `'ceiling'` (no reticle). |
| `clampWalk(fx, fz, x, z, out)` | no walls | The nearest place to (x, z) for one coming from (fx, fz), into `out`. |
| `usable(hit)` | `'door'` on the doorway | What could be used there (a string), or null: `hover`, the cursor and the reticle. |
| `use(hit, how)` | the doorway and `walkable` ground, above | Its own first, then `super.use(hit, how)`. A press that meets nothing comes as null. `how` is `'screen'` or `'xr'`. |
| `_setHover(usable, hit)` | `hover`, and `hoverDoor` when it is the doorway | What else it shows of what is pointed at, after `super`. |
| `walkInto()` | nothing | A walk up to its doorway and through it, with `_startWalk`. |
| `stand()` | `false` | Gets up before a move (a walk, the keys, the gamepad, the stick, a teleport), and says whether it did. |
| `groundAt(x, z)` | 0 | The ground's height there. |
| `route(fx, fz, x, z)` | `[[x, z]]` | The points a walk goes through, the last where it ends; none to stay. |
| `_riseXR()` | `eyeLift` | The rig's height above the ground in VR (video lowers it for a seat). |
| `reticleScale(use, hit)` | 1.8 on the doorway, 0.7 on what else could be used, else 1 | Its own sizes. |

Two options are the site's too: `eye`, the eye's height on a screen (1.6 m), and `hit`, a blank
hit of the site's own shape for `castRay` to write into (one for the screen and one per hand).

**Where a site's own comes first** are methods that take nothing in common. Each says whether the
site took what it was given:

| Method | When | Taken |
|---|---|---|
| `takeKey(e, name)` | A key (`keyOf`'s name), after the page's own, before walking's | Walking doesn't get it. |
| `takePad(pad, dt, press)` | Each frame a gamepad is connected, before walking and A and B | The pad was used, so it takes over. Clearing `press.use` or `press.back` takes that press. |
| `takeHand(hand, pad, ax, ay, dt)` | Each frame, for each hand with a stick in VR | The stick neither walks, turns nor aims a teleport this frame. |
| `takeSwipe(dx, dy, ms, touch)` | A drag let go | The view goes back where the drag began. |
| `takePinch(apart)` | Two fingers moved apart (or together) since the last one taken | The next is measured from here. |
| `takeWheel(dy)` | The wheel on the view, in pixels | The page doesn't scroll. |
| `takeGrip(hand, on)` | A grip squeezed or let go in VR | A squeeze isn't `onSqueeze`'s. |

| Export | |
|---|---|
| `new Controls({ renderer, camera, rig, scene, dom, eye?, hit?, window?, getGamepads? })` | `renderer` for its `xr`, the camera in the rig, `scene` for the reticles, `dom` the canvas. `window` and `getGamepads` are the page's unless given (a test's). |
| `update(dt)` | Each frame; nothing is allocated. |
| `setPose(x, z, yaw, pitch = restPitch)` | Standing there, on the ground. |
| `setNav({ move, turn })`, `setEyeLift(lift)` | VR's movement (`nav.js`), and the rig raised (`access.js` `eyeLift`), at once in VR and only there. |
| `walkTo(x, z, { face?, then? })` | A walk, as above. |
| `useMiddle()` | What the middle of the view is on, used as a click is: A, and the TV's OK. |
| `KEYS` | What each key does, by `keyOf`'s name; frozen. |
| `hover`, `hoverDoor`, `pointer` | What is pointed at that could be used, whether it is the doorway, and the mouse over the view in client pixels, or null. |
| `padActive`, `hasPad`, `aimMiddle` | The gamepad used last, one connected, and the middle of the view as the pointer. |
| `moveSpeed`, `turnRate` | The sticks' smooth walking and turning this frame in VR, for the vignette. |
| `reduceMotion`, `eyeLift`, `restPitch`, `move`, `turn` | The settings. `restPitch` is where the view comes back to after `setPose` or a walk with a `face` (outside's TV looks a little down). A walk without one leaves the view as it was, unless it looked where it went: then it ends a little down. |
| `hands` | `{ controller, laser, tip, reticle, source, hit, last, aiming }` each. |
| `onDoor(how, hit)`, `onTeleport(move)`, `onSqueeze(hand)`, `onActivity()`, `onPadActive(on)`, `onPadBack()` | The site's callbacks. `onTeleport` blinks the view around `move()`, which puts the visitor there. |

The members with an underscore that a subclass calls are `protected` in `controls.d.ts`, and as
much the contract as the rest:

- `_startWalk(points, face, done, turn)`: a walk of the site's own, such as a doorway's or a
  picture's. With `turn` (by default, when there is more than one point) it looks where it goes
  and faces on its last leg. `false` (since v0.7.1) faces from the first step, for a walk whose
  view is handed on before it ends, such as the hallway's through a door.
- `_move(x, z)`: the rig, walled in.
- `_moveHead(x, z)` and `_placeHead(x, z)`: the head, walled in or not.
- `_teleport(x, z)`, `_turnAboutHead(angle)` and `_headYaw()`.
- `_standOnGround(dt, x, z, lift)`.
- `_lineUp()`: a moment after entering VR.
- `_onSessionEnd()`.
- `_pickNdc(x, y)` and `_pickScreen(clientX, clientY)`.

The types `Hit`, `Hand`, `How`, `KeyAction`, `PadPress`, `Walk` and `ControlsOptions` are in
`controls.d.ts`. In TypeScript, `Controls<H extends Hit>` takes a site's own hit:
`class RoomControls extends Controls<RoomHit>`.

## Using it

Each site installs it from GitHub at a tag:

```json
"dependencies": {
  "common": "github:AriaMoKr/common#v0.7.1",
  "three": "0.186.1"
}
```

The package holds `src/` (the modules and their `.d.ts` files), `tools/`, the license and this
README. It has no dependencies of its own and runs nothing on install. three is a peer dependency
(`>=0.154.0`): `portal.js`, `fade.js`, `sky.js`, `access.js` and `controls.js` use the site's own,
so a page has one three. In Node the modules import as `common/door.js` and so on, for a site's
tests, and the tools as `common/tools/serve.mjs` and so on. To take a new version, move the tag in
package.json and run `npm install`. Each version so far only adds. v0.6.1 changes only the remote in
the card (its text boxes, and where Menu lands), v0.6.2 adds its `forget()`, and both leave the
modules of v0.1.0 to v0.5.0 as they were. v0.6.3 adds `hallLink` to `door.js`, for a hall other
than the Hallway. v0.7.0 adds `controls.js` and changes no other module, so a site can move to it
before it takes the controls. v0.7.1 adds `_startWalk`'s `turn`, and corrects the notes on moving
a site's own controls to it.

`src/` goes together: `controls.js` imports `./gamepad.js` and `./tv.js` from beside it, so each
way below copies or serves the whole folder, and a vendored copy works wherever it lands.

The sites load it in the browser in three ways, as they load layersharedsession.

### A vendor copy and an import map (hallway, outside)

The vendor copy ([`tools/vendor.mjs`](#toolsvendormjs)) copies the modules into `public/vendor/` on
`npm install`, with these entries in the site's `vendor.json` (in the `FILES` of its own
`tools/vendor.mjs`, until it switches over):

```json
{ "dir": "common/src", "to": "common", "ext": ".js" },
{ "from": "common/LICENSE", "to": "common/LICENSE" }
```

and the page's import map maps the name to the copy:

```json
{"imports":{
  "common/": "./vendor/common/"
}}
```

Then a module imports `common/door.js`, in the browser and in Node alike. The import map already
maps `three`, which `portal.js`, `fade.js`, `sky.js`, `access.js` and `controls.js` import.

### `server/vendor.js` (vrlbry, music)

Add the package's folder to `DEFAULT_VENDOR_DIRS`, so the server serves it at `/vendor/common/`:

```js
common: modules('common', 'src'),
```

The client names its modules by relative URL, as it does layersharedsession's:

```js
import { wayBack } from '../vendor/common/door.js';
```

`door.js`, `nav.js`, `gamepad.js`, `back-history.js` and `tv.js` import nothing. `portal.js`,
`fade.js`, `sky.js`, `access.js` and `controls.js` import `three` by its bare name, which the
page's import map maps, as it does for layersharedsession's `avatars.js`, and `controls.js` its
neighbours by relative URL. So `BARE` needs no entries, and they are for the page, not a worker,
which has no import map.
`tools/build-pages.mjs` copies them into the published site with the rest of what the client
imports. Tests in Node import `common/door.js` and so on.

### Vite (breadboard)

Import it by name. Vite resolves it through the package's `exports` and bundles it, with the
site's own three for `portal.js`, `fade.js`, `sky.js`, `access.js` and `controls.js`:

```ts
import { readVisit, wayBack, type WayBack } from 'common/door.js';
import { loadNav, saveNav, type Nav } from 'common/nav.js';
import { portalMaterial, setView, type PortalMaterial } from 'common/portal.js';
import { Fade } from 'common/fade.js';
import { Remote, keyOf, tvMode, type RemoteOptions } from 'common/tv.js';
```

TypeScript, with `moduleResolution: "bundler"`, reads the `.d.ts` beside each module, so no
declarations of the site's own are needed (`test/types/` compiles a file the way breadboard's
tsconfig does). `portal.d.ts`, `fade.d.ts`, `sky.d.ts` and `access.d.ts` refer to three's types, from the site's
`@types/three`.

## The tools

Node scripts the sites run, as `common/tools/…`. They import only Node's own modules, so a site
needs nothing else installed to run them, and they never reach a page: a site's vendor list names
`common/src`, not `common/tools`.

### `tools/chrome.mjs`

Chrome over the DevTools protocol, for the tools that need a real browser: headless for pictures
and checks (breadboard's `check-browser.mjs` and `make-icons.mjs`, outside's `preview.mjs` and
`hallway-view.mjs`, the hallway's `door-views.mjs`), or in a window for measuring performance on a
desktop (vrlbry's and music's `quest-perf.mjs`). Needs Node 22 or later (its built-in WebSocket)
and an installed Chrome, Edge or Chromium; `CHROME_PATH` chooses one.

```js
import { Page, launchChrome } from 'common/tools/chrome.mjs';

const chrome = await launchChrome();                  // headless
const page = await chrome.newPage();
await page.goto('http://127.0.0.1:8088/');
const title = await page.evaluate('document.title');
await chrome.close();                                 // ends Chrome and removes its profile

// A window, on the page to measure: its DevTools endpoint is what --cdp took.
const shown = await launchChrome({ headless: false, url: 'http://localhost:8080/?perf' });
const tabs = await (await fetch(`${shown.endpoint}/json/list`)).json();
const perf = await Page.connect(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
```

| Export | |
|---|---|
| `launchChrome({ headless = true, args = [], url = 'about:blank' })` | Starts Chrome on a new profile (below) with its DevTools port open. Resolves to `{ endpoint, profile, process, newPage(), close() }`: `endpoint` is `http://127.0.0.1:<port>`, as a browser started with `--remote-debugging-port` has; `newPage()` opens a tab; `close()` ends Chrome and removes the profile. `args` are more switches (`--window-size=1280,800`); `url` is what the first tab opens. |
| `Page` | One tab: `Page.connect(webSocketDebuggerUrl)`, `send(method, params)`, `on(event, fn)`, `evaluate(expression)` (promises awaited, the page's error thrown), `goto(url, settleMs = 1500)`, `close()`. What is waiting fails when the tab closes, as a window closed by hand does. |
| `findChrome()` | `CHROME_PATH`, else the first Chrome, Edge or Chromium installed. |
| `newProfile({ platform?, now? })` | The profile each Chrome starts on: a new folder in the temp folder, with its `Local State` written first on Windows. |
| `localState(now?)` | That `Local State`. |
| `sleep(ms)` | |

**The profile, and Windows logons.** Current Chrome opens its DevTools port only on a profile that
is not the default one, so a Chrome started by hand with `--remote-debugging-port` must be given a
new `--user-data-dir`. On Windows, Chrome on a new profile checks whether the account's password is
blank by logging on with an empty one: one failed logon each launch. Where a few failed logons lock
the account (on this machine ten in ten minutes, for ten minutes, whether anyone is at the PC or
not), a tool run a few times locks it. So `newProfile` writes the profile's `Local State` before
Chrome starts:

```json
{"password_manager":{"os_password_blank":false,"os_password_last_changed":"<now, in microseconds since 1601-01-01 UTC>"}}
```

Chrome takes that answer and doesn't test; it tests again only if the password changes after that
time. So start Chrome for a tool through `launchChrome`, not by hand on a new profile, and keep this
step: `test/chrome.test.js` checks the file it writes without starting Chrome.

### `tools/serve.mjs`

```bash
node node_modules/common/tools/serve.mjs [--root public] [--port 8080] [--host 0.0.0.0] [--name x]
```

serves the site's `public/` (from where it runs, the site's root) and prints
`<name>: http://localhost:<port>/`, the name being the one in the site's `package.json`. As GitHub
Pages does, a folder serves its `index.html` and every file comes with
`access-control-allow-origin: *`: the Hallway reads the sites' pictures, and they read the
Hallway's. WebXR needs a secure context, which `http://localhost` is; a headset reaches it over
`adb reverse tcp:<port> tcp:<port>`. A site's own `tools/serve.mjs` keeps its port in two lines, so
`npm start` stays as it is:

```js
// The dev server (common's) on the hallway's port: node tools/serve.mjs [--port 8088] [--host 0.0.0.0]
import { start } from 'common/tools/serve.mjs';
await start(process.argv.slice(2), { port: 8088 });
```

| Export | |
|---|---|
| `serve(root, { port = 0, host = '127.0.0.1' })` | Serves the folder; resolves to the listening `http.Server` (port 0: a free one, `server.address().port`). For the tools that render it in a browser. |
| `start(args?, defaults?)` | The command, over a site's defaults (`{ root, port, host, name }`); resolves to the server. |
| `options(args, defaults?, cwd?)` | The command's options. |
| `TYPES` | The content types it sends, by extension: the hallway's and outside's. |

### `tools/vendor.mjs`

Copies what the site's pages import from its `node_modules` into `public/vendor/`, so `public/` is
the whole site, served as it is and published as it is. It runs from the site's root after
`npm install`:

```json
"scripts": {
  "postinstall": "node node_modules/common/tools/vendor.mjs"
}
```

and copies what the site's `vendor.json`, beside its `package.json`, lists. Part of the hallway's:

```json
[
  { "from": "three/build/three.module.js", "to": "three/build/three.module.js" },
  { "from": "three/build/three.core.js", "to": "three/build/three.core.js" },
  { "from": "iwer/build/iwer.module.js", "to": "iwer/iwer.module.js", "optional": true },
  { "dir": "common/src", "to": "common", "ext": ".js" },
  { "dir": "@trystero-p2p/core/dist", "to": "trystero-core", "ext": ".mjs" }
]
```

Each entry is a file, `{ "from", "to", "optional"? }`, or every module of a folder,
`{ "dir", "to", "ext"? }`: not its subfolders, and with `ext` left out its `.js` and `.mjs` files,
so source maps and `.d.ts` files stay behind. `from` and `dir` are in `node_modules`, `to` in
`public/vendor/`. A required entry that is missing fails the install and leaves the copies as they
were; an optional one is passed over. Otherwise `public/vendor/` is emptied first, so nothing stale
stays. Only `common/src` goes to a page, never `common/tools`.

Installed under someone's `node_modules` (layersharedsession under the hallway's), a site is not
served there, so the tool copies nothing. But npm runs such a package's postinstall in its folder
there, `hallway/node_modules/layersharedsession`, where there is no `node_modules/common`: common,
a devDependency of its, isn't installed for it, and the hallway's own copy sits beside it. So
`node node_modules/common/tools/vendor.mjs` would fail the hallway's `npm install`. Such a package
keeps `"postinstall": "node tools/vendor.mjs"` (and that file in its `files`), which checks first:

```js
// common's tools/vendor.mjs, but not where this package is installed under someone's node_modules:
// common is not there, and nothing is served there.
import { sep } from 'node:path';
if (!process.cwd().split(sep).includes('node_modules')) (await import('common/tools/vendor.mjs')).run();
```

| Export | |
|---|---|
| `vendor(root?, { list?, out? })` | Copies the list (the site's `vendor.json`) into `out` (`public/vendor/`); returns `{ skipped, out, copied }`. `root` is where it runs. |
| `run(root?)` | The command: copies and says so; on an error, says it and sets the exit code, which fails the install. |
| `readList(root)` | The site's list, checked: each entry a file or a folder with a `to`, all inside `node_modules` and `public/vendor/`. |
| `installed(root)` | Whether the site is under someone's `node_modules`. |
| `LIST` | `'vendor.json'`. |

## The Pages workflow

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) is a reusable workflow
(`on: workflow_call`): the hallway's build and deploy jobs, with breadboard's `configure-pages` and
its checkout without persisted credentials. It checks the site out, sets up Node with npm's cache,
runs `npm ci` and `npm test`, then the site's build if it has one, and uploads the folder it
publishes and deploys it to the `github-pages` environment.

| Input | Default | |
|---|---|---|
| `node-version` | `'24'` | The current LTS. |
| `build` | none | A command run after the tests: breadboard's `npm run build`. |
| `path` | `public` | The folder published: breadboard's `dist`. |

A site's `.github/workflows/pages.yml` keeps its triggers, its permissions and its concurrency, and
has one job:

```yaml
name: Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# One deployment at a time; a newer push waits rather than cancelling one in progress.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  pages:
    uses: AriaMoKr/common/.github/workflows/pages.yml@v0.7.1
```

Breadboard's job adds its build and folder:

```yaml
  pages:
    uses: AriaMoKr/common/.github/workflows/pages.yml@v0.7.1
    with:
      build: npm run build
      path: dist
```

The called jobs get the permissions the caller grants: deploying needs `pages: write` and
`id-token: write`. Once per repository, Settings → Pages → Build and deployment → Source is GitHub
Actions, as now. To take a new version, move the tag after `@`, as in package.json. common itself
has no Pages: the workflow runs only when a site calls it.

## Coming from a site's own copy

Every site took `door.js` and `nav.js` at v0.1.0, the portal, the fade and the gamepad at v0.2.0
(vrlbry and music keep their own gamepad reader, on `stick` and the rest), the sky at v0.3.0
(breadboard has none) and the accessibility settings at v0.4.0.

**The sky (v0.3.0).** What changed for each when it took the sky in place of its own:

- **outside** (`public/js/sky.js`, and `SUN_DIR` in `bake.js`): both move here. `scene.js` takes
  `skyTexture` and `skyDome`, `water.js` `SKY_UV` and `SUN_DIR`, and `bake.js` imports `SUN_DIR`
  for its light. The garden looks the same: the painter is outside's, call for call.
- **hallway** (`public/js/textures.js` `skyTexture`, and the colours, sun and hills it copied from
  outside's by hand): they go. The end window's glass shows common's sky through
  `skyMaterial(skyTexture(), { yaw: 0 })` instead of a portal hung with a flat picture, so its view
  is at infinity. Below the horizon it shows outside's plain ground fading off, not the fields
  `textures.js` paints now. The window's baked daylight can come from `skyColor`.
- **vrlbry and music** (`public/js/world/room.js`): the shared `sky` material becomes
  `skyMaterial(skyTexture(), { yaw })`, for the windows' merged glass and the rotunda's skylight,
  and the evening of `makeSkyCanvas` (`world/textures.js`) goes. The glass no longer needs its UVs
  normalised for a picture. Each room picks its yaw (above).
- **breadboard** has no sky to change.

**Accessibility (v0.4.0).** No site had these settings, so each took them in new (see
[Wiring it in](#accessjs)):

- **hallway**: its 3D control panel (`panel.js`) gains rows for motion, the vignette and seated,
  under Move and Turn, and its overlay a DOM settings control. With less motion, clicking the floor
  (`controls.js` `walkTo`) jumps there, the arrival's and the doors' fades blink, the doorways'
  `uTime` is held (`hall.js`), and visitors don't bob when they wave. `main.js` puts a `Vignette`
  beside its `Fade` and drives it from the controls' smooth walking and turning; the rig takes
  `eyeLift` in VR. The door views and the link preview hide the vignette's mesh as they hide the
  fade's.
- **outside**: as the hallway: its panel (`panel.js`) and its overlay offer the settings; with less
  motion `walkTo` (and the walk over the bridge, and to the bench) jumps, the fades blink, and the
  water, the grass's sway and the doorway's `uTime` are held; a `Vignette` beside the `Fade`; the
  rig takes `eyeLift` in VR.
- **vrlbry and music**: the kiosk's settings (`interaction.js`, beside Snap turning) and the
  overlay offer them. With less motion the view's eased moves (`_tween`) cut, the room-switch fade
  blinks, the door's `uTime` is held, and visitors don't bob when they wave. `xr/controls.js`
  drives a `Vignette` from its smooth move and turn; the rig takes `eyeLift` in VR.
- **breadboard**: the VR view's panel (`src/vr/main.ts`, beside Move and Turn) and a DOM control on
  `vr.html` offer them. With less motion its eased flight (`fly`) cuts, the fades blink and the
  doorway's `uTime` is held. A `Vignette` beside the `Fade`, driven from `move.ts`'s walking and
  turning; the rig takes `eyeLift` in VR.

**The Back, the tools and the workflow (v0.5.0).** Each site's copies of these are alike already;
what changes for each when it takes common's in their place:

- **hallway**:
  - *serve*: `tools/serve.mjs` becomes the two lines above, on port 8088.
  - *vendor*: its `tools/vendor.mjs` goes. Its `FILES` become `vendor.json`, entry for entry, and
    its postinstall is `node node_modules/common/tools/vendor.mjs`.
  - *the workflow*: `.github/workflows/pages.yml` calls common's, so on Node 24 rather than 22.
  - *door views*: `tools/door-views.mjs` starts its own Chrome on the desktop instead of asking for
    one started by hand (`--cdp`): `launchChrome({ url: 'http://localhost:8088/' })`, then its
    `findPage` on `chrome.endpoint`, and `chrome.close()` when done. `headless: false` if the views
    must be drawn by the GPU rather than headless Chrome's own. The Quest over adb stays as it is.
- **outside**:
  - *serve*: `tools/serve.mjs` keeps its `PUBLIC` and its port 8090 and takes the rest from common's;
    `preview.mjs` and `hallway-view.mjs` import `serve` as now.
  - *vendor*: as the hallway: its list is the hallway's.
  - *Chrome*: `tools/lib/chrome.mjs` goes; `preview.mjs` and `hallway-view.mjs` import
    `common/tools/chrome.mjs`. Their calls stay as they are.
  - *the workflow*: as the hallway.
  - *Back*: `public/js/back-history.js` goes, for common's, with `prefix: 'outside'` to keep the
    names its entries have (or the default); `test/back-history.test.js` goes with it.
- **layersharedsession**:
  - *serve*: `tools/serve.mjs` becomes the two lines, on port 8092.
  - *vendor*: its list goes to `vendor.json`. It is installed under the hallway's `node_modules`, so
    its `tools/vendor.mjs` stays, as the guarded lines above (still in its `files`). common becomes
    a devDependency of its.
  - *the workflow*: as the hallway.
- **breadboard**:
  - *Chrome*: `scripts/lib/chrome.mjs` goes; `check-browser.mjs`, `check-input.mjs`, `make-icons.mjs`
    and `make-preview.mjs` import `common/tools/chrome.mjs`, with their calls as they are.
  - *the workflow*: one job, `with: { build: npm run build, path: dist }`. It is on Node 24 already.
- **vrlbry and music**:
  - *Back*: `public/js/back-history.js` goes, for common's, with `prefix: 'vrlbry'`, which keeps the
    names in visitors' history; `test/client-back-history.test.js` passes as it is against it, and
    can go.
  - *quest-perf*: `tools/quest-perf.mjs` starts a window on the desktop instead of `--cdp` on a
    browser started by hand: `launchChrome({ headless: false, url })`, its endpoint where the
    headset's forwarded one goes, and `close()` at the end.
  - *Node 24*: their own `pages.yml` stays (it builds the pages and the indexes), with
    `node-version: 24`.

**The TV app (v0.6.0 to v0.6.2).** Only the hallway has a TV view so far. The others take the module
and [the checklist](#a-site-in-the-app) in a change of their own:

- **hallway** (`public/js/tv.js`): it keeps `roomFromInput`, for its Join form, and takes `isTV`,
  `focusStops`, `nextStop` and `Remote` from common's. `main.js`'s `tv` becomes `tvMode()`, and
  its `window.hallwayTV = { … }` becomes `remote.answerApp(tv)`. Its card gains no step: walking,
  Back is the app's. `controls.js`'s `KEYS[e.code || e.key]` becomes `KEYS[keyOf(e)]`, which adds
  the spare keys. `test/tv.test.js` keeps the `roomFromInput` and style cases. Menu lands on the
  doors toggle as before; with v0.6.1 its name and Join boxes keep the keyboard down until OK.
- **vrlbry, music, outside and breadboard**: HallwayApp's README, "Behind the doors", lists what the
  remote can't reach on each today. Each one's `step` is its own: putting a book back where its
  entry isn't the app's, closing a text view, standing up from outside's bench. So is each one's
  `first`: outside's book buttons while reading, not "← Hallway", with `forget()` as the book opens
  (v0.6.2). vrlbry's Menu passes over its
  search box without one, and its search and ZIM address boxes keep the keyboard down until OK.

**The walking controls (v0.7.0).** Three copies of one `controls.js` walk visitors about the sites:
the template's (which art and video take by merge), the hallway's and outside's. Each becomes a
subclass of common's `Controls` ([`controls.js`](#controlsjs)) and keeps only its own, each in a
change of its own: the template and the hallway first, then art, video and outside.

- **The template** (`public/js/controls.js` at `f3e1c91`; art's is the same): it becomes the
  subclass above. It keeps these:
  - its room: `layout`, set after `super()`, and `castRay` and `clampWalk`, `room.js`'s on
    `this.layout`;
  - its hit's `u`, `v` and `piece`, through the `hit` option;
  - the panel and the pictures: `usable` and `use`, with `onPanel`, `onPiece` and `_press`;
    `hoverPanel` and `hoverPiece` (`_setHover`); a picture's reticle at 1.3 (`reticleScale`);
  - `walkInto` and `walkUpTo`.

  For its `tsconfig.json`, the subclass needs some JSDoc:
  - `@extends {Walking<RoomHit>}`, where `RoomHit` is common's `Hit` with `u`, `v` and `piece`;
  - a `@param` on the constructor's options: common's without `eye` and `hit`, plus `layout`.
    Without it, `super()` is checked against an empty object;
  - `[number, number][]` for the walk's points in `walkInto`.

  Under `strict` (`tsconfig.strict.json`), its overrides need their parameters' types too.

  The rest goes. What is new to it:
  - A key a page control has used, and one in a `data-own-keys` element, is the page's.
  - `walkTo` takes `{ face, then }`.
  - A walk through the doorway from beside it (two points) looks where it goes, then turns to face
    the doorway on its last leg. To face it from the first step, as before, `walkInto` passes
    `false` as `_startWalk`'s `turn` (v0.7.1).
  - With less motion, a walk jumps to where it ends, walled in there rather than on the way.
  - Two fingers neither look nor tap.
  - A teleport aims at ground that is `walkable` or faces up, rather than at `'floor'`, and the
    reticle's normal is made unit length.
  - `onDoor` gets the hit too, there is `restPitch`, and `pointer` replaces `_mouse`.
- **video**, by merge: as the template. It also keeps these:
  - `onThing`, with `hoverKind` and `hoverId` (its `use`, `usable` and `_setHover`);
  - its seats: `seat`, `sit` and `settle`;
  - `stand()`, which already says whether one sat;
  - `_riseXR()`, which now overrides common's;
  - `setPose` and `_onSessionEnd`, each calling `super`.

  Its `_placeHead` is common's now. A seat when the headset is lined up goes in `_lineUp()`
  (`_placeHead` to the seat in place of `_moveHead`). Its `castRay` and `clampWalk` are
  `modes.js`'s. `main.js`'s `controls._mouse` becomes `controls.pointer`.
- **hallway** (`public/js/controls.js`): it keeps these:
  - its hall: `layout.js`'s `castRay`, and its hit's `door` (the `hit` option);
  - its doors: `usable` (`'door'` for a door that leads somewhere), `use` and `walkInto(door)`,
    the door optional so that it still overrides `walkInto()`;
  - the control panel: `onPanel`, `hoverPanel` and `_press`.

  These are renamed as the template names them:
  - `setLift(lift)` is `setEyeLift(lift)`, and `lift` is `eyeLift`.
  - `xrSpeed` and `xrTurnRate` are `moveSpeed` and `turnRate`.
  - `onSelect(door, how)` is `onDoor(how, hit)`, with the door as `hit.door`.
  - `clampToHall(layout, x, z, out)` is its `clampWalk(fx, fz, x, z, out)`, which may pass over
    where the visitor comes from.
  - `hoverDoor` is common's: true on a doorway. The door pointed at, which `main.js` reads
    (`hoverDoor?.env`), goes in a field of the hallway's own.

  `KEYS` is common's now: `controls.js` can pass it on (`export { KEYS } from
  'common/controls.js'`) for `test/tv.test.js`. What is new to it:
  - These keys are the page's: one a page control has used (`defaultPrevented`), one in a
    `data-own-keys` element, and Space and Enter on a button or a link.
  - Its floor sets `walkable` in `castRay`. A click walks there and a trigger teleports there only
    when it is walkable, and the reticle is light only there.
  - A walk faces a yaw (`-door.side * Math.PI / 2` for a door) and turns before it is done. One
    along more than one point looks where it goes and faces only on its last leg, so `walkInto`
    passes `false` as `_startWalk`'s `turn` (v0.7.1), to face the door from the first step as it
    does now. `main.js`'s `go()` hands the view on as the head crosses the threshold, 0.8 m into
    the last leg; without `false`, the next site's view would be turned by up to 43°.
  - With less motion every walk jumps, a walk through a door too.
  - `walkTo` takes `{ face, then }`, and there are `restPitch` and `pointer`.
- **outside** (`public/js/controls.js` at `93b6eda`): it keeps these:
  - its garden: `garden.js`'s `castRay`, `clampWalk`, `groundAt` and `route`, its eye (the `eye`
    option) and its hit's own fields (the `hit` option);
  - on a screen, a walk to the water and to ground one can't stand on: its `use` calls `walkTo`
    for those (its `route` ends at the nearest place one can stand) before `super.use`, which
    walks only to `walkable` ground;
  - its `walkInto` and `resetTo`;
  - the bench: `sit`, `_seat`, `seated`, `onSeat` and `onBench`, and `stand()`, which now says
    whether one got up and, in VR, puts the book down first, as the stick and a teleport did;
  - the seat's height, by overriding `_standOnGround`, and two guards on it:
    - `setPose` clears `seated`, then calls `super`. Without that, a visitor who goes through the
      door from the bench with less motion, and comes back with Back, stands at the door at the
      bench's height, and their first step puts them back on the bench.
    - While seated, `setEyeLift` keeps the lift and leaves the rig. Common's sets the rig's height
      at once, past `_standOnGround`, so in VR the view would jump about 0.4 m and settle back at
      each change of a setting.
  - entering and leaving VR seated, in a `sessionstart` listener of its own, `_lineUp` and
    `_onSessionEnd`.

  The book goes through the places where a site's own comes first:
  - `castRay`: the open book's `pick` first, then the garden (its `_pick`).
  - `usable`, `use` and `_setHover`: the bench and the book, open or not. A press off the book,
    null too, puts it down.
  - `takeKey`: Home and the book's keys. While reading it takes the arrows, and Q and E, so that
    only WASD walks.
  - `takePad`: `PAD_BOOK` and the triggers, and B back in the book (`press.back`).
  - `takeHand`: while reading, the sticks, and B, Y and the thumbstick.
  - `takeSwipe`, `takePinch`, `takeWheel` and `takeGrip`: the book's, while it is open.

  What changes for it:
  - A drag now ends a walk that has a `then` (to the bench), as the template's does.
  - `aimMiddle` while reading is for `main.js` to clear.
  - With less motion, the jump is common's: to the walk's end, walled in there.

## Developing

```bash
npm install     # TypeScript, for the .d.ts files; three and @types/three, for the tests and the types
npm test        # node --test "test/*.test.js": the portal, the fade, the sky and the vignette are built in Node, no WebGL
npm run types   # src/*.d.ts from the JSDoc
CHROME_TEST=1 npm test   # and start a real Chrome, through launchChrome, on a served page
```

The `.d.ts` files are made from the JSDoc and committed. After changing a module's JSDoc, run
`npm run types` and commit them with it: a test fails while they are stale. It removes the old ones
first, since TypeScript would read `controls.js`'s imports from them, and then refuses to write
over what it reads. The tools have JSDoc but no `.d.ts`: the sites' scripts that run them are
JavaScript.

The tools are tested in temporary folders: the server on a free port, the vendor copy in a
stand-in site (and from this package itself, to check only `src/` goes), and Chrome's profile
without starting Chrome.

The remote is tested over a stand-in DOM (`test/tv.test.js`: an event's path, focus and the
selectors it uses), and with `CHROME_TEST=1` on a served page in a real Chrome too, its keys
pressed through DevTools, so a range's and a caret's own steps are the browser's.

The walking controls are tested in Node over stand-ins (`test/controls.test.js`). three's own
camera, rig and controllers need no WebGL. Beside them are a renderer whose `xr` gives the
controllers and the session's events, a view that takes pointer events, the window's keys, a
gamepad, and a box of a room as a site's subclass, counting each of its methods called.

The sky is outside's picture, call for call: `test/sky.test.js` paints it on a stand-in canvas
(`test/canvas.js`, which records every call) and checks its fingerprint against the one outside's
painter gives. A change to how the sky looks changes that fingerprint, on purpose.

The door contract is in links that are already out in the world, in the sites pinned to older
versions of this package, and in bookmarks, so a change to it must keep reading the links the
Hallway and the sites make today. The portal's uniforms are API too: the sites set `uTime` and
`uGlow` and read `uMap` by name. So are the keys in `localStorage` (`hallway.nav`,
`hallway.access`) and their values: every site on the origin reads them, at whatever version it
pins.

## License

[MIT](LICENSE).
