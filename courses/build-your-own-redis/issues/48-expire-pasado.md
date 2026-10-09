## Objetivo

`EXPIRE k -1` o `PEXPIRE k 0` no dejan una clave que "vence ya": Redis la borra en el momento y
responde `1`.

## Contrato

`EXPIRE p -1` → `:1` y `EXISTS p` → `:0`. `PEXPIRE q 0` → igual.

## Para descubrir

- ¿Por qué borrar en el momento es mejor que guardar un vencimiento ya pasado?

## Hecho cuando

- [ ] `sh .course/run.sh 48` pasa.
- [ ] Ni siquiera `DBSIZE` cuenta la clave después.

## Para leer

- [`EXPIRE` en la documentación de Redis](https://redis.io/docs/latest/commands/expire/)
- [Redis, `expire.c`: `activeExpireCycle` y los comandos de TTL](https://github.com/redis/redis/blob/unstable/src/expire.c)
