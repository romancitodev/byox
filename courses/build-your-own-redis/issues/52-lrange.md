## Objetivo

`LRANGE lista inicio fin` devuelve los elementos entre dos índices, **incluidos los dos**. Si el
final se pasa del largo, se recorta; si el inicio está después del final, el resultado es vacío.
Nunca es un error por estar fuera de rango.

## Contrato

Con `a b c d`: `LRANGE l 1 2` → `b c`, `LRANGE l 0 100` → todo, `LRANGE l 5 10` → `[]`,
`LRANGE l 2 1` → `[]`, `LRANGE nada 0 10` → `[]`. Índices no numéricos → `-ERR value is not an integer
or out of range`.

## Para descubrir

- Si el fin es inclusivo, ¿qué rango de Rust (`..` o `..=`) se parece más?
- ¿Por qué Redis prefiere recortar en vez de dar error con índices fuera de rango?

## Hecho cuando

- [ ] `sh .course/run.sh 52` pasa.
- [ ] Una clave inexistente da un array vacío, no nil.

## Para leer

- [`LRANGE` en la documentación de Redis](https://redis.io/docs/latest/commands/lrange/)
- [Redis, `t_list.c`: los comandos de listas](https://github.com/redis/redis/blob/unstable/src/t_list.c)
