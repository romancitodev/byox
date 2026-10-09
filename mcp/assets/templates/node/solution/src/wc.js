const words = (text) => text.split(/\s+/).filter(Boolean);

/** Cuántas palabras tiene `text`. Ver issue #1. */
export function countWords(text) {
  return words(text).length;
}

/** Cuántas veces aparece cada palabra, sin distinguir mayúsculas, como objeto `{ palabra: n }`. Ver issue #2. */
export function wordFrequencies(text) {
  const out = {};
  for (const w of words(text)) {
    const key = w.toLowerCase();
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}
