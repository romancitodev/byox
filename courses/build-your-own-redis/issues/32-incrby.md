## Objetivo

Lo mismo que la #31, pero con el incremento como argumento. Si escribiste `incr_by` en la etapa
anterior, son dos líneas.

## Contrato

Con `n = "11"`: `INCRBY n -3` → `:8`, `DECRBY n 2` → `:6`. `INCRBY nueva 100` → `:100`.

## Para descubrir

- `DECRBY n x` es `INCRBY n -x`... ¿siempre? Pensá en el `i64` más chico.

## Hecho cuando

- [ ] `sh .course/run.sh 32` pasa.
- [ ] Los cuatro comandos usan la misma función.

## Para leer

- [`INCRBY` en la documentación de Redis](https://redis.io/docs/latest/commands/incrby/)
- [`DECRBY` en la documentación de Redis](https://redis.io/docs/latest/commands/decrby/)
