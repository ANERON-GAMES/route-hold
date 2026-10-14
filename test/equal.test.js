import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";
import test from "node:test";
import { constantTimeEqual } from "../src/index.js";

test("equal strings match, including the empty string", () => {
  assert.equal(constantTimeEqual("", ""), true);
  assert.equal(constantTimeEqual("example-key", "example-key"), true);
  assert.equal(constantTimeEqual("café", "café"), true);
});

test("a difference anywhere in the string returns false", () => {
  assert.equal(constantTimeEqual("example-key", "example-kez"), false);
  assert.equal(constantTimeEqual("example-key", "Example-key"), false);
  assert.equal(constantTimeEqual("a", ""), false);
  assert.equal(constantTimeEqual("", "a"), false);
  assert.equal(constantTimeEqual("example-key", "example-key-extra"), false);
});

test("utf-16 code units stay distinct when utf-8 would replace them", () => {
  assert.equal(constantTimeEqual("\uD800", "\uFFFD"), false);
  assert.equal(constantTimeEqual("\uD800", "\uD800"), true);
  assert.equal(constantTimeEqual("e\u0301", "é"), false);
});

test("equal strings agree with timingSafeEqual on their utf-16 bytes", () => {
  const key = "example-key";
  const bytes = Buffer.from(key, "utf16le");
  assert.equal(constantTimeEqual(key, key), timingSafeEqual(bytes, bytes));
});

test("constantTimeEqual rejects a value that is not a string", () => {
  assert.throws(() => constantTimeEqual(null, "example-key"), {
    name: "TypeError",
    message: "both arguments must be strings"
  });
  assert.throws(() => constantTimeEqual("example-key", undefined), TypeError);
  assert.throws(() => constantTimeEqual(1, 1), TypeError);
  assert.throws(() => constantTimeEqual(Buffer.from("a"), Buffer.from("a")), TypeError);
});
