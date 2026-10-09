// node demo.js "el gato y el perro"
import { countWords, wordFrequencies } from "./src/wc.js";

const text = process.argv[2] ?? "";
console.log(`${countWords(text)} palabras`);
const freq = Object.entries(wordFrequencies(text)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
for (const [word, n] of freq) console.log(`${String(n).padStart(3)} ${word}`);
