## Objetivo

Redis no tiene un tipo número: los guarda como strings y `INCR` los interpreta como enteros de
64 bits, suma uno y vuelve a guardar el string. Si la clave no existe, cuenta desde 0. Es la base de
los contadores, los rate limiters y los IDs únicos.

## Contrato

`INCR visitas` → `:1` la primera vez. Con `n = "10"`: `INCR n` → `:11`, `DECR n` → `:10`, y `GET n`
devuelve el string `"10"`.

## Reglas

- El valor guardado sigue siendo un string.

## Para descubrir

- ¿Por qué `INCR` es más seguro que hacer `GET`, sumar en el cliente y `SET`?

## Hecho cuando

- [ ] `sh .course/run.sh 31` pasa.
- [ ] `DECR` sobre una clave nueva da `:-1`.

## Para leer

- [`INCR` en la documentación de Redis](https://redis.io/docs/latest/commands/incr/)
- [Redis, `t_string.c`: SET, GET, INCR, APPEND…](https://github.com/redis/redis/blob/unstable/src/t_string.c)
