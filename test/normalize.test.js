import assert from "node:assert/strict";
import test from "node:test";
import { normalizePath } from "../src/index.js";

test("a trailing slash collapses while the root stays the root", () => {
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("/pricing/"), "/pricing");
  assert.equal(normalizePath("/pricing//"), "/pricing");
  assert.equal(normalizePath("//"), "/");
  assert.equal(normalizePath("///"), "/");
});

test("an ordinary html suffix is removed", () => {
  assert.equal(normalizePath("/pricing.html"), "/pricing");
  assert.equal(normalizePath("/docs/index.html"), "/docs/index");
  assert.equal(normalizePath("index.html"), "index");
  assert.equal(normalizePath("/page.html.html"), "/page.html");
});

test("a directory html suffix keeps the slash-dot", () => {
  assert.equal(normalizePath("/docs/.html"), "/docs/.");
  assert.equal(normalizePath("/.html"), "/.");
  assert.equal(normalizePath("/.html/"), "/.html");
});

test("an html suffix that contains a slash-dot stays in place", () => {
  assert.equal(normalizePath("/files/.draft.html"), "/files/.draft.html");
  assert.equal(normalizePath("/foo/./bar.html"), "/foo/./bar.html");
  assert.equal(normalizePath("/files/.draft.html/"), "/files/.draft.html");
});

test("html removal runs before trailing slashes, and does not run again", () => {
  assert.equal(normalizePath("/pricing.html/"), "/pricing.html");
  assert.equal(normalizePath("/docs/.html/"), "/docs/.html");
  assert.equal(normalizePath("/pricing/"), "/pricing");
});

test("the html suffix match is lowercase", () => {
  assert.equal(normalizePath("/Pricing.HTML"), "/Pricing.HTML");
  assert.equal(normalizePath("/PRICING"), "/PRICING");
});

test("normalizePath rejects a path that is not a string", () => {
  assert.throws(() => normalizePath(undefined), {
    name: "TypeError",
    message: "path must be a string"
  });
  assert.throws(() => normalizePath(null), TypeError);
  assert.throws(() => normalizePath(1), TypeError);
  assert.throws(() => normalizePath(["/pricing"]), TypeError);
});
