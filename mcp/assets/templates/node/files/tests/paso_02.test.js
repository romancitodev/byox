import assert from "node:assert/strict";
import { test } from "node:test";

import { wordFrequencies } from "../src/wc.js";

test("cuenta las repetidas", () => {
  assert.deepEqual(wordFrequencies("el gato y el perro"), { el: 2, gato: 1, y: 1, perro: 1 });
});

test("sin distinguir mayúsculas", () => {
  assert.deepEqual(wordFrequencies("Hola hola HOLA"), { hola: 3 });
});

test("vacío", () => {
  assert.deepEqual(wordFrequencies(""), {});
});
