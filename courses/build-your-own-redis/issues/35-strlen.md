## Objetivo

`STRLEN` devuelve el largo del valor en bytes, o `0` si la clave no existe.

## Contrato

`STRLEN nada` → `:0`. Con `ñ = "ñandú"` → `:7`: bytes, no caracteres.

## Para descubrir

- ¿Cuántos bytes ocupa "ñ" en UTF-8?

## Hecho cuando

- [ ] `sh .course/run.sh 35` pasa.
- [ ] El largo coincide con lo que respondió el último `APPEND`.

## Para leer

- [`STRLEN` en la documentación de Redis](https://redis.io/docs/latest/commands/strlen/)
