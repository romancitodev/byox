## Objetivo

Contar las palabras de un texto, como hace `wc -w`. Es la base de todo lo que sigue.

## Contrato

En `src/wc.js`:

```js
export function countWords(text) // -> number
```

## Para descubrir

- ¿Qué pasa con dos espacios seguidos? ¿Y con un texto vacío?
- ¿Un tab o un salto de línea separan palabras?

## Hecho cuando

- [ ] `node --test tests/paso_01.test.js` pasa.

## Para leer

- [`String.prototype.split`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/split)
- [`node:test`](https://nodejs.org/api/test.html)
