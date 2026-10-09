## Objetivo

Cada comando de Redis tiene una *aridad*: cuántos argumentos acepta, contando el nombre. `ECHO`
tiene aridad 2 (exacta); `PING`, -1 (al menos uno). El servidor la valida antes de ejecutar y
responde un error estándar.

## Contrato

`ECHO` y `ECHO a b` → `-ERR wrong number of arguments for 'echo' command`. `PING a b` → el mismo
error con `'ping'`. El nombre va siempre en minúsculas.

## Para descubrir

- ¿Qué significa una aridad negativa? Mirá `ping.json` en el repo de Redis.
- ¿Conviene validar la aridad en cada comando o en un solo lugar?

## Hecho cuando

- [ ] `sh .course/run.sh 24` pasa.
- [ ] La validación está en un solo lugar y sirve para todos los comandos que vengan.

## Para leer

- [Redis, `src/commands/*.json`: la aridad de cada comando](https://github.com/redis/redis/tree/unstable/src/commands)
- [Redis, `server.c`: `processCommand` y los mensajes de error](https://github.com/redis/redis/blob/unstable/src/server.c)
