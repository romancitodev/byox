## Objetivo

Desde Redis 6.2, `LPOP` y `RPOP` aceptan una cantidad y devuelven un array. Los casos borde son
finos y los tests los comparan con lo que responde Redis.

## Contrato

Con `a b c d`: `LPOP l 2` → `[a, b]`; `RPOP l 5` → `[d, c]`. Sobre una lista que existe,
`RPOP l 0` → `[]`; sobre una clave inexistente, con cualquier cantidad, → array nulo (`*-1`).
Cantidad negativa o no numérica → `-ERR value is out of range, must be positive`.

## Para descubrir

- ¿Por qué una clave inexistente da `*-1` y una lista existente con 0 da `*0`?

## Hecho cuando

- [ ] `sh .course/run.sh 58` pasa.
- [ ] Sin cantidad, el comportamiento de la #57 no cambia.

## Para leer

- [`LPOP` en la documentación de Redis](https://redis.io/docs/latest/commands/lpop/)
- [Redis, `t_list.c`: los comandos de listas](https://github.com/redis/redis/blob/unstable/src/t_list.c)
