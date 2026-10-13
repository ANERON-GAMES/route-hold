import assert from "node:assert/strict";
import test from "node:test";
import {
  API_ROOT,
  DEFAULT_ADMIN_PREFIXES,
  DEFAULT_ASSET_PATTERN,
  HOLD_PATH,
  HOME_PATH,
  REDIRECT_CACHE_CONTROL,
  RouteAction,
  decideRoute
} from "../src/index.js";

const ASSET_EXTENSIONS = [
  "css",
  "js",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "ico",
  "woff",
  "woff2",
  "webmanifest",
  "json",
  "txt"
];

function request(overrides) {
  return {
    path: "/pricing",
    maintenance: true,
    presentedKey: "",
    expectedKey: "",
    allowPrefixes: ["/health", "/status"],
    ...overrides
  };
}

test("the usage sample holds a page, passes health, and sends the hold page home when open", () => {
  const held = decideRoute({
    path: "/pricing/",
    maintenance: true,
    presentedKey: "",
    expectedKey: "example-key",
    allowPrefixes: ["/health", "/status"]
  });
  const health = decideRoute({
    path: "/health/live",
    maintenance: true,
    presentedKey: "",
    expectedKey: "example-key",
    allowPrefixes: ["/health", "/status"]
  });
  const openHold = decideRoute({
    path: "/maintenance",
    maintenance: false,
    presentedKey: "",
    expectedKey: "",
    allowPrefixes: ["/health", "/status"]
  });

  assert.deepEqual(held, {
    action: "redirect",
    location: "/maintenance",
    cacheControl: "no-store, no-cache, must-revalidate, max-age=0"
  });
  assert.deepEqual(health, { action: "next" });
  assert.deepEqual(openHold, {
    action: "redirect",
    location: "/",
    cacheControl: "no-store, no-cache, must-revalidate, max-age=0"
  });
});

test("api and admin routes pass during maintenance", () => {
  for (const path of ["/api", "/api/", "/api/health", "/_", "/_/", "/_/tools", "/_/tools/"]) {
    assert.deepEqual(decideRoute(request({ path })), { action: RouteAction.Next }, path);
  }
});

test("a path that only shares the admin or api letters is held", () => {
  assert.equal(decideRoute(request({ path: "/_tools" })).action, RouteAction.Redirect);
  assert.equal(decideRoute(request({ path: "/apiv2" })).action, RouteAction.Redirect);
  assert.equal(decideRoute(request({ path: "/apiary" })).location, HOLD_PATH);
});

test("allowlisted prefixes pass, including paths that merely start with the prefix", () => {
  assert.equal(decideRoute(request({ path: "/health" })).action, RouteAction.Next);
  assert.equal(decideRoute(request({ path: "/health/" })).action, RouteAction.Next);
  assert.equal(decideRoute(request({ path: "/health/live" })).action, RouteAction.Next);
  assert.equal(decideRoute(request({ path: "/status.html" })).action, RouteAction.Next);
  assert.equal(decideRoute(request({ path: "/healthcare" })).action, RouteAction.Next);
  assert.equal(decideRoute(request({ path: "/about" })).action, RouteAction.Redirect);
});

test("static assets pass during maintenance", () => {
  for (const extension of ASSET_EXTENSIONS) {
    const path = `/assets/app.${extension}`;
    assert.equal(decideRoute(request({ path })).action, RouteAction.Next, path);
  }
  assert.equal(decideRoute(request({ path: "/assets/app.CSS" })).action, RouteAction.Next);
  assert.equal(decideRoute(request({ path: "/assets/app.js/" })).action, RouteAction.Next);
  assert.equal(decideRoute(request({ path: "/notes.txt.bak" })).action, RouteAction.Redirect);
});

test("maintenance sends an ordinary page to the hold path", () => {
  assert.deepEqual(decideRoute(request({ path: "/pricing/" })), {
    action: RouteAction.Redirect,
    location: HOLD_PATH,
    cacheControl: REDIRECT_CACHE_CONTROL
  });
  assert.deepEqual(decideRoute(request({ path: "/pricing.html" })), {
    action: RouteAction.Redirect,
    location: HOLD_PATH,
    cacheControl: REDIRECT_CACHE_CONTROL
  });
});

test("the hold page itself stays during maintenance", () => {
  assert.deepEqual(decideRoute(request({ path: "/maintenance" })), { action: RouteAction.Next });
  assert.deepEqual(decideRoute(request({ path: "/maintenance/" })), { action: RouteAction.Next });
  assert.deepEqual(decideRoute(request({ path: "/maintenance.html" })), {
    action: RouteAction.Next
  });
});

test("a matching bypass key opens the site, compared in constant time", () => {
  const open = request({
    maintenance: true,
    presentedKey: "example-key",
    expectedKey: "example-key"
  });
  assert.deepEqual(decideRoute(open), { action: RouteAction.Next });
  assert.deepEqual(decideRoute({ ...open, path: "/maintenance" }), {
    action: RouteAction.Redirect,
    location: HOME_PATH,
    cacheControl: REDIRECT_CACHE_CONTROL
  });
});

test("a mismatched bypass key leaves maintenance in force", () => {
  assert.equal(
    decideRoute(
      request({
        presentedKey: "example-kez",
        expectedKey: "example-key"
      })
    ).action,
    RouteAction.Redirect
  );
  assert.equal(
    decideRoute(
      request({
        presentedKey: "example-key-extra",
        expectedKey: "example-key"
      })
    ).location,
    HOLD_PATH
  );
});

test("an empty expected key means there is no bypass", () => {
  assert.equal(
    decideRoute(request({ presentedKey: "", expectedKey: "" })).action,
    RouteAction.Redirect
  );
  assert.equal(
    decideRoute(request({ presentedKey: "example-key", expectedKey: "" })).action,
    RouteAction.Redirect
  );
});

test("a false maintenance flag fails open", () => {
  const open = request({ maintenance: false, presentedKey: "nope", expectedKey: "example-key" });
  assert.deepEqual(decideRoute(open), { action: RouteAction.Next });
  assert.deepEqual(decideRoute({ ...open, path: "/maintenance" }), {
    action: RouteAction.Redirect,
    location: HOME_PATH,
    cacheControl: REDIRECT_CACHE_CONTROL
  });
  assert.deepEqual(decideRoute({ ...open, path: "/api/health" }), { action: RouteAction.Next });
});

test("the hold page redirects home while the site is open", () => {
  assert.deepEqual(decideRoute(request({ path: "/maintenance", maintenance: false })), {
    action: RouteAction.Redirect,
    location: HOME_PATH,
    cacheControl: REDIRECT_CACHE_CONTROL
  });
  assert.deepEqual(
    decideRoute(request({ path: "/maintenance.html", maintenance: false })).location,
    HOME_PATH
  );
  assert.equal(
    decideRoute(request({ path: "/pricing", maintenance: false })).action,
    RouteAction.Next
  );
});

test("exemptions run before the maintenance decision", () => {
  const asset = decideRoute(request({ path: "/maintenance.css" }));
  assert.deepEqual(asset, { action: RouteAction.Next });

  const allowedHold = decideRoute(
    request({
      path: "/maintenance",
      maintenance: false,
      allowPrefixes: ["/maintenance"]
    })
  );
  assert.deepEqual(allowedHold, { action: RouteAction.Next });
});

test("caller paths stay closed unless the caller passes them", () => {
  assert.equal(decideRoute(request({ path: "/reports" })).action, RouteAction.Redirect);
  assert.equal(
    decideRoute(request({ path: "/reports", allowPrefixes: ["/health", "/reports"] })).action,
    RouteAction.Next
  );
});

test("custom admin prefixes replace the default and the api root still passes", () => {
  const custom = request({ adminPrefixes: ["/panel"] });
  assert.equal(decideRoute({ ...custom, path: "/panel" }).action, RouteAction.Next);
  assert.equal(decideRoute({ ...custom, path: "/panel/users" }).action, RouteAction.Next);
  assert.equal(decideRoute({ ...custom, path: "/panelist" }).action, RouteAction.Redirect);
  assert.equal(decideRoute({ ...custom, path: "/_" }).action, RouteAction.Redirect);
  assert.equal(decideRoute({ ...custom, path: "/api/health" }).action, RouteAction.Next);
  assert.equal(
    decideRoute(request({ path: "/_", adminPrefixes: [] })).action,
    RouteAction.Redirect
  );
});

test("a custom asset pattern replaces the default", () => {
  const pattern = /^\/static\//;
  assert.equal(
    decideRoute(request({ path: "/static/app", assetPattern: pattern })).action,
    RouteAction.Next
  );
  assert.equal(
    decideRoute(request({ path: "/app.css", assetPattern: pattern })).action,
    RouteAction.Redirect
  );
});

test("a global asset pattern does not change the next call", () => {
  const pattern = /\.css$/gi;
  assert.equal(
    decideRoute(request({ path: "/a.css", assetPattern: pattern })).action,
    RouteAction.Next
  );
  assert.equal(
    decideRoute(request({ path: "/b.css", assetPattern: pattern })).action,
    RouteAction.Next
  );
  assert.equal(pattern.lastIndex, 0);
});

test("custom hold and home paths are normalized", () => {
  const custom = request({ holdPath: "/hold/", homePath: "/start.html" });
  assert.deepEqual(decideRoute(custom), {
    action: RouteAction.Redirect,
    location: "/hold",
    cacheControl: REDIRECT_CACHE_CONTROL
  });
  assert.deepEqual(decideRoute({ ...custom, path: "/hold.html", maintenance: false }), {
    action: RouteAction.Redirect,
    location: "/start",
    cacheControl: REDIRECT_CACHE_CONTROL
  });
});

test("decideRoute ignores extra fields and does not mutate the input", () => {
  const input = request({ path: "/pricing/", note: "ignored", allowPrefixes: ["/health"] });
  const snapshot = structuredClone(input);
  const first = decideRoute(input);
  const second = decideRoute(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), ["action", "cacheControl", "location"]);
  assert.deepEqual(Object.keys(decideRoute(request({ maintenance: false }))).sort(), ["action"]);
});

test("defaults and action names stay stable", () => {
  assert.equal(HOLD_PATH, "/maintenance");
  assert.equal(HOME_PATH, "/");
  assert.equal(API_ROOT, "/api");
  assert.equal(REDIRECT_CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0");
  assert.deepEqual(DEFAULT_ADMIN_PREFIXES, ["/_/", "/_"]);
  assert.equal(Object.isFrozen(DEFAULT_ADMIN_PREFIXES), true);
  assert.equal(RouteAction.Next, "next");
  assert.equal(RouteAction.Redirect, "redirect");
  assert.equal(Object.isFrozen(RouteAction), true);
  assert.equal(
    DEFAULT_ASSET_PATTERN.source,
    "\\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|webmanifest|json|txt)$"
  );
  assert.equal(DEFAULT_ASSET_PATTERN.flags, "i");
});

test("decideRoute rejects a malformed input", () => {
  assert.throws(() => decideRoute(null), {
    name: "TypeError",
    message: "input must be an object"
  });
  assert.throws(() => decideRoute([]), TypeError);
  assert.throws(() => decideRoute(request({ path: 1 })), {
    name: "TypeError",
    message: "path must be a string"
  });
  assert.throws(() => decideRoute(request({ maintenance: "true" })), {
    name: "TypeError",
    message: "maintenance must be a boolean"
  });
  assert.throws(() => decideRoute(request({ presentedKey: null })), {
    name: "TypeError",
    message: "presentedKey must be a string"
  });
  assert.throws(() => decideRoute(request({ expectedKey: undefined })), {
    name: "TypeError",
    message: "expectedKey must be a string"
  });
  assert.throws(() => decideRoute(request({ allowPrefixes: "/health" })), {
    name: "TypeError",
    message: "allowPrefixes must be an array of strings"
  });
  assert.throws(() => decideRoute(request({ allowPrefixes: [1] })), TypeError);
  assert.throws(() => decideRoute(request({ allowPrefixes: [""] })), {
    name: "TypeError",
    message: "allowPrefixes entries must not normalize to an empty path"
  });
  assert.throws(() => decideRoute(request({ allowPrefixes: [".html"] })), TypeError);
  assert.throws(() => decideRoute(request({ adminPrefixes: "nope" })), {
    name: "TypeError",
    message: "adminPrefixes must be an array of strings"
  });
  assert.throws(() => decideRoute(request({ assetPattern: "\\.css$" })), {
    name: "TypeError",
    message: "assetPattern must be a regular expression"
  });
  assert.throws(() => decideRoute(request({ holdPath: 1 })), {
    name: "TypeError",
    message: "holdPath must be a string"
  });
  assert.throws(() => decideRoute(request({ homePath: "" })), {
    name: "TypeError",
    message: "homePath must not normalize to an empty path"
  });
  assert.throws(() => decideRoute(request({ holdPath: "/", homePath: "/" })), {
    name: "TypeError",
    message: "holdPath and homePath must be different"
  });
});
