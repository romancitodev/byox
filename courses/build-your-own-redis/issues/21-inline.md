## Objetivo

Redis también entiende comandos sin RESP, escritos como una línea de texto: es lo que te permite
usarlo con `telnet` o `nc`. Si el primer byte no es `*`, el servidor lee hasta el fin de línea y
separa por espacios.

## Contrato

`PING\r\n` → `+PONG`. `ECHO   hola\r\n` → `hola` (varios espacios separan igual). El fin de línea
puede ser `\r\n` o solo `\n`. Se pueden mezclar comandos inline y RESP en la misma conexión.

## Para descubrir

- ¿Cómo sabés si lo que llega es RESP o inline antes de leerlo entero?

## Hecho cuando

- [ ] `sh .course/run.sh 21` pasa.
- [ ] `printf 'PING\r\n' | nc localhost 6379` responde `+PONG`.

## Para leer

- [Redis, `networking.c`: `processMultibulkBuffer` y `processInlineBuffer`](https://github.com/redis/redis/blob/unstable/src/networking.c)
- [`redis-cli` y el modo inline (Redis CLI)](https://redis.io/docs/latest/develop/tools/cli/)
