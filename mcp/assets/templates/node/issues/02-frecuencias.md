## Objetivo

Saber cuántas veces aparece cada palabra. Es el primer paso de cualquier índice o buscador.

## Contrato

En `src/wc.js`:

```js
export function wordFrequencies(text) // -> { palabra: cantidad }
```

## Reglas

- `Hola` y `hola` son la misma palabra.

## Hecho cuando

- [ ] `node --test tests/paso_02.test.js` pasa.

## Para leer

- [`String.prototype.toLowerCase`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/toLowerCase)
- [Operador `??`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing)
