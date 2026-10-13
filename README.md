# route-hold

While maintenance is on, send ordinary pages to the holding route, and let health, API, and static assets through without embedding the site map.

The useful part is the check order. API, caller admin prefixes, caller allow prefixes, and static assets are decided before the maintenance flag is read. A health check stays a health check during a hold. A stylesheet stays a stylesheet, so the holding page can load. An ordinary page goes to the holding route. When the hold is off, that holding route sends visitors home. Callers pass the path, the flag, the bypass key, and the prefixes. The library does not look up a record, read a cookie, or carry a list of product pages.

## Install

The package is an ES module. It needs Node.js 20 or newer. It has no runtime dependencies. The package name is `@aneron/route-hold`. It is not published to the npm registry.

Clone this repository and run the tests:

```bash
git clone https://github.com/ANERON-GAMES/route-hold.git
cd route-hold
npm install
npm test
```

`npm test` runs `node --test`. `npm run lint` runs ESLint. `npm run format:check` runs Prettier.

Install it as a dependency from the git repository:

```bash
npm install github:ANERON-GAMES/route-hold
```

```js
import { decideRoute, normalizePath } from "@aneron/route-hold";
```

Code in this repository imports the same entry point with `./src/index.js`.

## Usage

A caller extracts the pathname, reads the maintenance flag, and parses any bypass key before calling `decideRoute`. The return value is either `{ action: "next" }` or a redirect to the holding route or the home route.

```js
import { decideRoute } from "@aneron/route-hold";

const held = decideRoute({
  path: "/pricing/",
  maintenance: true,
  presentedKey: "",
  expectedKey: "example-key",
  allowPrefixes: ["/health", "/status"],
  adminPrefixes: []
});

const health = decideRoute({
  path: "/health/live",
  maintenance: true,
  presentedKey: "",
  expectedKey: "example-key",
  allowPrefixes: ["/health", "/status"],
  adminPrefixes: []
});

const openHold = decideRoute({
  path: "/maintenance",
  maintenance: false,
  presentedKey: "",
  expectedKey: "",
  allowPrefixes: ["/health", "/status"],
  adminPrefixes: []
});
```

`held` is `{ action: "redirect", location: "/maintenance", cacheControl: "no-store, no-cache, must-revalidate, max-age=0" }`. The trailing slash is normalized away before the decision, and `/pricing` is an ordinary page. `health` is `{ action: "next" }`. `/health/live` starts with the caller prefix `/health`, so the maintenance flag is never applied. `openHold` redirects to `/` with the same cache header. The site is open, and the holding route must not keep visitors.

A deployment that also wants other areas to stay up adds them to the same array. `/environment` and `/smart-home` are examples of those caller parameters. They are ordinary strings. Passing them makes those paths continue. Leaving them out sends those paths to the holding route while maintenance is on.

```js
decideRoute({
  path: "/environment",
  maintenance: true,
  presentedKey: "",
  expectedKey: "",
  allowPrefixes: ["/health", "/status", "/environment", "/smart-home"],
  adminPrefixes: []
});
```

That call returns `{ action: "next" }`. The same path with only `["/health", "/status"]` redirects to `/maintenance`.

`adminPrefixes` is caller config, and it has no default. An empty array adds no admin exemption. A caller that wants an area to stay up passes those prefixes in the same object. The match is the prefix itself, or the prefix plus `/`.

```js
decideRoute({
  path: "/panel/tools",
  maintenance: true,
  presentedKey: "",
  expectedKey: "",
  allowPrefixes: ["/health", "/status"],
  adminPrefixes: ["/panel"]
});
```

That call returns `{ action: "next" }`. `/panelist` with the same `adminPrefixes` redirects to `/maintenance`, because it is neither `/panel` nor a path under `/panel/`.

Apply the result at the edge. `next` means the downstream handler runs. `redirect` means respond with the `location` and set `Cache-Control` to `cacheControl`, so a shared cache does not store the redirect.

## API reference

All functions are pure. They do not read the clock, the network, the filesystem, cookies, or headers. They do not mutate their arguments.

### Constants

| Export                   | Value                                                                                 | Meaning                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `HOLD_PATH`              | `"/maintenance"`                                                                      | Holding route used when `holdPath` is omitted.                                        |
| `HOME_PATH`              | `"/"`                                                                                 | Route used when `homePath` is omitted and the holding page should send visitors home. |
| `API_ROOT`               | `"/api"`                                                                              | API root. `/api` and any path under `/api/` always continue.                          |
| `REDIRECT_CACHE_CONTROL` | `"no-store, no-cache, must-revalidate, max-age=0"`                                    | `Cache-Control` value on every redirect.                                              |
| `DEFAULT_ASSET_PATTERN`  | `/\.(css\|js\|png\|jpg\|jpeg\|gif\|svg\|ico\|woff\|woff2\|webmanifest\|json\|txt)$/i` | Asset test used when `assetPattern` is omitted.                                       |

### `RouteAction`

Frozen. The fields and the strings are the same values.

| Field      | Value        | Meaning                                          |
| ---------- | ------------ | ------------------------------------------------ |
| `Next`     | `"next"`     | The request continues to the downstream handler. |
| `Redirect` | `"redirect"` | The request is redirected to `location`.         |

### `normalizePath(path)`

Return the canonical path used by every later check.

| Argument | Type   | Role                             |
| -------- | ------ | -------------------------------- |
| `path`   | string | Pathname supplied by the caller. |

`path` must be a string. Any other value throws `TypeError`. The function does not resolve `.` or `..`, decode percent escapes, or split a query string. A caller that has a full URL passes the pathname only.

The steps run in this order. The first HTML step that matches wins, and the slash step always runs after it.

1. If `path` ends with `/.html`, remove the final `html` and keep the `/.`. `/docs/.html` becomes `/docs/.`. `/.html` becomes `/.`.
2. Otherwise, if `path` ends with `.html` and does not contain the two characters `/.`, remove that trailing `.html`. `/docs/index.html` becomes `/docs/index`. `/files/.draft.html` contains `/.`, so it stays `/files/.draft.html`.
3. While the length is greater than 1 and the value ends with `/`, remove one trailing slash. `/` stays `/`. `/docs/` becomes `/docs`. A result that ends in `/.`, such as `/docs/.` or `/.`, ends in a dot, so this step leaves it in place.

Step 3 does not start the HTML rules again. `/pricing.html/` loses the slash and stays `/pricing.html`. `/docs/.html/` loses the slash and stays `/docs/.html`. The suffix match is case-sensitive: `/Pricing.HTML` stays `/Pricing.HTML`.

One `.html` is removed. `/page.html.html` becomes `/page.html`.

### `constantTimeEqual(left, right)`

Return `true` when two strings are equal, comparing every code unit.

| Argument | Type   | Role           |
| -------- | ------ | -------------- |
| `left`   | string | First string.  |
| `right`  | string | Second string. |

Both arguments must be strings. A number, a `Buffer`, `null`, or `undefined` throws `TypeError`.

The strings are encoded as UTF-16LE and compared with `timingSafeEqual` when the byte lengths match. Equal JavaScript strings return `true`, including `""`. A difference at any index returns `false`. Different lengths return `false` before `timingSafeEqual`, because that function requires equal lengths. The compare does not trim, lowercase, or Unicode-normalize. `e\u0301` and `é` are different. A lone surrogate stays distinct from U+FFFD.

`decideRoute` calls this for the bypass key. Callers that compare the key themselves can use the same function.

### `decideRoute(input)`

Return the next step for one request.

`input` must be a non-array object. Any other value throws `TypeError`. Unknown fields are ignored.

| Field           | Type     | Required | Role                                                                                                                       |
| --------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `path`          | string   | yes      | Request pathname. Normalized before any route check.                                                                       |
| `maintenance`   | boolean  | yes      | `true` when the site is in maintenance. Any other value throws. `false` leaves the site open.                              |
| `presentedKey`  | string   | yes      | Bypass key the caller already parsed from a cookie or header. `""` when there is none.                                     |
| `expectedKey`   | string   | yes      | Expected bypass key. `""` means the deployment has no bypass.                                                              |
| `allowPrefixes` | string[] | yes      | Caller prefixes that always continue. An empty array is valid.                                                             |
| `adminPrefixes` | string[] | yes      | Caller config. Exact path or a path under the prefix. No default. An empty array exempts nothing.                          |
| `assetPattern`  | RegExp   | no       | Defaults to `DEFAULT_ASSET_PATTERN`. `null` and omission use that default. A provided pattern replaces the default.        |
| `holdPath`      | string   | no       | Defaults to `HOLD_PATH`. Normalized. This is the redirect target during maintenance.                                       |
| `homePath`      | string   | no       | Defaults to `HOME_PATH`. Normalized. This is the redirect target when the holding route is visited while the site is open. |

Prefix entries must be strings. `allowPrefixes` and `adminPrefixes` are required. Omitting either array, or passing `null`, throws `TypeError`. Each entry is passed through `normalizePath`. An entry that normalizes to `""` throws `TypeError`. `holdPath` and `homePath` must be strings when present, must normalize to a non-empty path, and must be different after normalization. `assetPattern` must be a `RegExp` when present.

The checks run in this order. The first match wins.

1. Normalize `path`.
2. Continue when the path is the API root or stands under it: `path === "/api"` or `path.startsWith("/api/")`. Normalization has already turned `/api/` into `/api`, so the API root still continues. `/apiv2` does not.
3. Continue when the path equals a normalized admin prefix or starts with that prefix plus `/`. The caller supplies `adminPrefixes`. There is no default list. `/panel/` normalizes to `/panel`, so a caller that passes `/panel` continues `/panel` and `/panel/tools`, and holds `/panelist`. The API rule in step 2 still runs.
4. Continue when the normalized path starts with any normalized `allowPrefixes` entry. `startsWith` covers the equal path. `/health` matches `/health`, `/health/live`, and `/healthcare`. The library does not insert a segment boundary. A short prefix is as broad as the string the caller passed.
5. Continue when `assetPattern` matches the normalized path. The library copies the pattern without the global or sticky flag, so a caller's `lastIndex` stays put and a second call sees the same path the same way. The match is the whole pattern. The default pattern matches a final extension in the set `css`, `js`, `png`, `jpg`, `jpeg`, `gif`, `svg`, `ico`, `woff`, `woff2`, `webmanifest`, `json`, `txt`, in either case.
6. Decide whether maintenance is in force. It is in force only when `maintenance === true` and the bypass fails. The bypass fails when `expectedKey` is `""`, or when `expectedKey` is non-empty and `constantTimeEqual(presentedKey, expectedKey)` is `false`. An empty expected key does not compare, so two empty strings do not open the site. A matching key makes maintenance not in force for this request. `maintenance: false` makes it not in force even when the keys differ.
7. When maintenance is in force and the normalized path is different from the normalized hold path, return a redirect to the hold path.
8. When maintenance is not in force and the normalized path is the hold path, return a redirect to the home path.
9. Otherwise continue. This includes the hold path while maintenance is in force, which keeps the browser from looping on the holding route.

A continue result is `{ action: "next" }`. It has no `location` and no `cacheControl`.

A redirect result is:

| Field          | Value                                                  |
| -------------- | ------------------------------------------------------ |
| `action`       | `"redirect"`                                           |
| `location`     | The normalized hold path, or the normalized home path. |
| `cacheControl` | `REDIRECT_CACHE_CONTROL`                               |

Each call returns a new object.

`/pricing.html` and `/pricing/` both normalize to `/pricing` before the table runs. During maintenance, with no bypass, both redirect to `/maintenance`. `/maintenance.html` normalizes to `/maintenance`, so it is the holding page: it continues while maintenance is in force, and it redirects home when maintenance is not.

## Design notes

The order is the product. A maintenance switch that runs first would turn `/api/health` into an HTML redirect and would turn `/app.css` into an HTML redirect. The holding page would then be unable to load the assets it needs, and a probe would look like a failure. Those exemptions are therefore decided before the flag.

The exemptions are the API root, static assets, and the prefixes the caller supplies. Admin prefixes are caller config, and the library does not ship a built-in list. Product pages are not exempt on their own. A path such as `/environment` or `/smart-home` continues only when the caller puts that string in `allowPrefixes`. The same function serves any site. The site map stays at the call site.

Allow prefixes use string `startsWith` after normalization. That is a prefix test, not a route table. `/health` also matches `/healthcare`. Callers that want a tighter gate pass a longer prefix, such as `/health/`. That entry normalizes to `/health`, so the slash does not become a boundary. Admin prefixes use a boundary instead: the path must equal the prefix or start with the prefix plus `/`. A caller that passes `/panel` continues `/panel` and `/panel/tools`, and holds `/panelist`. API uses that same boundary: `/api` and `/api/health` continue, `/apiary` does not.

Assets are tested after the allow list and before the flag. `/maintenance.css` continues even while maintenance is in force, because it is an asset. The holding page continues for a different reason: it is the redirect target, and redirecting it to itself would loop. When the site is open, the holding page is the one path that redirects, and it redirects home. An allow prefix that covers the hold path is an earlier continue, so that prefix keeps the holding page in place even while the site is open. The order makes that outcome visible.

Maintenance is a boolean the caller computed. The library does not fetch it. If the maintenance record is missing, the caller passes `false`. That is the fail-open rule. A missing record leaves the site open. Treating a missing record as `true` would hold every ordinary page whenever the read failed. `decideRoute` still requires a real boolean, so a forgotten field throws instead of silently picking a side. The fail-open choice sits with the caller, in the value `false`.

The bypass is the second half of that flag. `expectedKey: ""` means this deployment has no bypass, and a presented key of `""` does not count as a match. A non-empty expected key is compared with `constantTimeEqual`, so a mismatch does not stop at the first different code unit when the lengths match. A match clears maintenance for this request only. Ordinary pages continue, and a visit to the holding route redirects home, because the site is open for the caller who presented the key. A wrong key, or a key of a different length, leaves maintenance in force.

The cache header is on redirects only. A continue result lets the downstream response choose its own caching. A redirect back and forth between home and the holding page must not be stored.

Normalization comes first so the later rules see one spelling of a path. `/api/` becomes `/api` and still matches the API rule. `/maintenance/` is the holding page. The `/.html` case is the careful one: a path that ends with `/.html` does contain `/.`, and the general HTML rule would leave the suffix in place. The first HTML step still removes the final `html` and keeps the `/.`, so `/docs/.html` becomes `/docs/.` and `/.html` becomes `/.`. Paths that contain `/.` for any other reason, such as `/files/.draft.html` or `/foo/./bar.html`, keep a trailing `.html`. That split is deliberate. Hidden files and dot segments are left alone. Only the exact `/.html` ending drops `html`.

This module does not open sockets, set cookies, store the flag, or choose the holding page for a deployment. `holdPath` and `homePath` are arguments. The default holding route is `/maintenance` and the default home route is `/`.

## License

Released under the MIT License. The full text is in [LICENSE](LICENSE).
