import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

test("package metadata names a public module", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.name, "@aneron/route-hold");
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.engines.node, ">=20");
  assert.equal(pkg.repository.url, "git+https://github.com/ANERON-GAMES/route-hold.git");
  assert.equal(pkg.main, "./src/index.js");
  assert.equal(pkg.exports, "./src/index.js");
  assert.equal(pkg.sideEffects, false);
});

test("source files import only sibling modules and node:crypto", () => {
  for (const name of readdirSync(new URL("../src/", import.meta.url))) {
    const source = readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
    assert.equal(source.includes("//"), false, name);
    assert.equal(source.includes("/*"), false, name);
    const lines = source.split("\n").filter((line) => line.startsWith("import "));
    for (const line of lines) {
      assert.match(line, /from "(?:\.\/[a-z]+\.js|node:crypto)";$/, line);
    }
  }
});
