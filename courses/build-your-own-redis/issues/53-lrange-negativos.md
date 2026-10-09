## Objetivo

Los índices negativos cuentan desde el final: `-1` es el último, `-2` el anteúltimo. Así,
`LRANGE l 0 -1` devuelve la lista entera sin saber cuánto mide. La normalización exacta está en
`lrangeCommand` de `t_list.c`, y el orden de los pasos importa.

## Contrato

Con `a b c d e`: `0 -1` → todo, `-3 -1` → `c d e`, `-1 -1` → `e`, `1 -2` → `b c d`.
`-100 100` → todo y `-100 -50` → `[]`.

## Para descubrir

- Si sumás el largo a un índice negativo y sigue negativo, ¿qué hace Redis con el inicio? ¿Y con el fin?

## Hecho cuando

- [ ] `sh .course/run.sh 53` pasa.
- [ ] Los casos de la documentación de `LRANGE` dan lo mismo que en Redis.

## Para leer

- [`LRANGE` en la documentación de Redis](https://redis.io/docs/latest/commands/lrange/)
- [Redis, `t_list.c`: los comandos de listas](https://github.com/redis/redis/blob/unstable/src/t_list.c)
