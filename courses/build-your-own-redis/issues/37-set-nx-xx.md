## Objetivo

`SET` tiene opciones. `NX` escribe solo si la clave no existe (la base de los locks
distribuidos); `XX`, solo si existe. Cuando no escribe, responde nil. Las opciones no distinguen
mayúsculas.

## Contrato

`SET k v1 NX` → `+OK`; otra vez → nil y `k` sigue en `v1`. `SET z v XX` con `z` inexistente → nil.

## Para descubrir

- ¿Cómo vas a leer las opciones para que agregar más (en la #38 y la #42) sea fácil?

## Hecho cuando

- [ ] `sh .course/run.sh 37` pasa.
- [ ] `xx` en minúsculas funciona igual.

## Para leer

- [`SET` en la documentación de Redis](https://redis.io/docs/latest/commands/set/)
- [Redis, `t_string.c`: SET, GET, INCR, APPEND…](https://github.com/redis/redis/blob/unstable/src/t_string.c)
