# common

Code shared by the sites behind the [Hallway](https://ariamokr.github.io/hallway/), a WebXR
corridor whose doors lead to other environments: [hallway](https://github.com/AriaMoKr/hallway)
itself, [vrlbry](https://github.com/AriaMoKr/vrlbry), [music](https://github.com/AriaMoKr/music),
[breadboard](https://github.com/AriaMoKr/breadboard) and [outside](https://github.com/AriaMoKr/outside).

So far it holds the Hallway's door contract, which is how a door's link brings a visitor into an
environment and how the environment leads them back:

- **[`door.js`](src/door.js)**: reading a visit and the way back, and the link a door opens.
- **[`nav.js`](src/nav.js)**: the VR movement choice that the sites share in `localStorage`.

These are plain ES modules with JSDoc, with no build step and no dependencies. They run in the
browser and in Node, for the sites' tests. A `.d.ts` beside each module gives TypeScript sites
their types. Each site still has its
own copy of this code (see [Coming from a site's own copy](#coming-from-a-sites-own-copy)) and
switches over in a change of its own.

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

## Using it

Each site installs it from GitHub at a tag:

```json
"dependencies": {
  "common": "github:AriaMoKr/common#v0.1.0"
}
```

The package holds `src/` (the modules and their `.d.ts` files), the license and this README. It
has no dependencies and runs nothing on install. In Node the modules import as `common/door.js`
and `common/nav.js`, for a site's tests. To take a new version, move the tag in package.json and
run `npm install`.

The sites load it in the browser in three ways, as they load layersharedsession.

### A vendor copy and an import map (hallway, outside)

`tools/vendor.mjs` copies the modules into `public/vendor/` on `npm install`, with these entries in
its `FILES`:

```js
{ dir: 'common/src', to: 'common', ext: '.js' },
{ from: 'common/LICENSE', to: 'common/LICENSE' },
```

and the page's import map maps the name to the copy:

```json
{"imports":{
  "common/": "./vendor/common/"
}}
```

Then a module imports `common/door.js`, in the browser and in Node alike.

### `server/vendor.js` (vrlbry, music)

Add the package's folder to `DEFAULT_VENDOR_DIRS`, so the server serves it at `/vendor/common/`:

```js
common: modules('common', 'src'),
```

The client names its modules by relative URL, as it does layersharedsession's:

```js
import { wayBack } from '../vendor/common/door.js';
```

The modules import nothing, so `BARE` needs no entries, and `tools/build-pages.mjs` copies them
into the published site with the rest of what the client imports. Tests in Node import
`common/door.js`.

### Vite (breadboard)

Import it by name. Vite resolves it through the package's `exports` and bundles it:

```ts
import { readVisit, wayBack, type WayBack } from 'common/door.js';
import { loadNav, saveNav, type Nav } from 'common/nav.js';
```

TypeScript, with `moduleResolution: "bundler"`, reads the `.d.ts` beside each module, so no
declarations of the site's own are needed (`test/types/` compiles a file the way breadboard's
tsconfig does).

## Coming from a site's own copy

What changes for each site when it switches over:

- **Every environment** passes its door id where the copy had it built in: `wayBack(search, id, …)`
  and `hallwayViews(way, id)`, and `hallwayUrl(id)` for the copy's `HALLWAY_URL` with `?from=`.
  The way back to the Hallway has one title, "Back to the Hallway, whose doors lead to other
  places". A `back` on the Hallway's origin but another path is no longer the Hallway: only the
  Hallway's own page is (vrlbry's
  [`ea430a8`](https://github.com/AriaMoKr/vrlbry/commit/ea430a8)). `withoutVisit` takes off
  `backname` too.
- **breadboard** (`src/vr/hallway.ts`): `wayBack(location.search, 'breadboard', { origin:
  location.origin, always: false })`. The way back gains `host`. `doorOf`, `keptDoor`, `DOOR` and
  `DEFAULT_GLOW` stay in breadboard; `keptDoor` can check its way with `keptWay`.
  `layersharedsession.d.ts` stays until layersharedsession has types of its own.
- **outside** (`public/js/way.js`): `wayBack(location.search, 'outside', { origin:
  location.origin })`. `OUTSIDE_ID`, `DEFAULT_GLOW` and `HALLWAY_DOOR` stay in outside. Its nav
  copy (`settings.js`) is the Hallway's, so `loadNav()` and `saveNav(nav)` read the same.
- **vrlbry and music** (`public/js/hallway.js`): `wayOut(search)` is `wayBack(search, 'vrlbry')`
  (or `'music'`), and the way's `custom` is `!hallway`. `doorOf` stays, with `views` and `viewId`
  from `hallwayViews`. In `nav.js`, `loadNav(storage, settings)` is `loadNav(storage, { ...NAV_DEFAULTS,
  move: settings.smoothMove === false ? 'teleport' : 'smooth' })`, and `saveNav(storage, nav)` is
  `saveNav(nav, storage)`.
- **hallway** (`public/js/link.js`, `settings.js`): `doorLink`, `HALLWAY_ID` and `LINK_PARAMS` come
  from here; `doorPose` stays, since it measures the Hallway's own layout. `loadNav()` and
  `saveNav(nav)` read and write `localStorage` as before. These README sections move here from
  the Hallway's.

## Developing

```bash
npm install     # TypeScript, for the .d.ts files
npm test        # node --test "test/*.test.js"
npm run types   # src/*.d.ts from the JSDoc
```

The `.d.ts` files are made from the JSDoc and committed. After changing a module's JSDoc, run
`npm run types` and commit them with it: a test fails while they are stale.

The door contract is in links that are already out in the world, in the sites pinned to older
versions of this package, and in bookmarks, so a change to it must keep reading the links the
Hallway and the sites make today.

## License

[MIT](LICENSE).
