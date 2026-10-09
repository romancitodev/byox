## Objetivo

`KEYS`, `SCAN` y `PSUBSCRIBE` filtran con patrones glob: `*` (cualquier cosa), `?` (un
carácter), `[ae]`, `[^e]`, `[a-z]` y `\` para escapar. Vas a escribir el mismo algoritmo que
`stringmatchlen` en `util.c`. No depende de nada: podés hacerlo cuando quieras.

## Contrato

En `src/glob.rs`:

```rust
pub fn glob_match(pattern: &[u8], text: &[u8]) -> bool
```

`h?llo` coincide con `hello`; `h*llo` con `hllo` y `heeeello`; `h[^e]llo` con `hallo` pero no con
`hello`; `h\*llo` solo con `h*llo`. Un rango al revés (`[b-a]`) vale lo mismo que al derecho.

## Reglas

- Sin regex ni crates: es un ejercicio de recursión o backtracking.

## Para descubrir

- ¿Cómo probás todas las formas en que un `*` puede "comerse" parte del texto?
- Varios `*` seguidos, ¿cambian algo? ¿Qué hace `stringmatchlen` con ellos?
- Según `stringmatchlen`, ¿`*` coincide con el texto vacío? Leé el código: la respuesta sorprende.

## Hecho cuando

- [ ] `sh .course/run.sh 40` pasa.
- [ ] Los casos de la documentación de `KEYS` dan lo mismo que en Redis.

## Para leer

- [Redis, `util.c`: `stringmatchlen`](https://github.com/redis/redis/blob/unstable/src/util.c)
- [`KEYS` en la documentación de Redis](https://redis.io/docs/latest/commands/keys/)
- [Glob en Wikipedia](https://en.wikipedia.org/wiki/Glob_(programming))
