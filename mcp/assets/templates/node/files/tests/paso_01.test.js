import assert from "node:assert/strict";
import { test } from "node:test";

import { countWords } from "../src/wc.js";

test("simple", () => {
  assert.equal(countWords("hola mundo"), 2);
});

test("espacios de más", () => {
  assert.equal(countWords("  el   gato\ty\nel perro  "), 5);
});

test("vacío", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   \n"), 0);
});
