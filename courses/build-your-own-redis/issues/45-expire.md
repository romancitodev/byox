## Objetivo

`EXPIRE` y `PEXPIRE` ponen un vencimiento a una clave que ya existe. Responden `1` si la clave
existía y `0` si no.

## Contrato

`PEXPIRE k 200` → `:1` y la clave vence en 200 ms. `EXPIRE nada 10` → `:0`.
`EXPIRE k abc` → `-ERR value is not an integer or out of range`.

## Para descubrir

- ¿Qué pasa si hacés `EXPIRE` sobre una clave que ya venció pero nadie borró?

## Hecho cuando

- [ ] `sh .course/run.sh 45` pasa.
- [ ] `EXPIRE` es en segundos y `PEXPIRE` en milisegundos.

## Para leer

- [`EXPIRE` en la documentación de Redis](https://redis.io/docs/latest/commands/expire/)
- [`PEXPIRE` en la documentación de Redis](https://redis.io/docs/latest/commands/pexpire/)
- [Redis, `expire.c`: `activeExpireCycle` y los comandos de TTL](https://github.com/redis/redis/blob/unstable/src/expire.c)
