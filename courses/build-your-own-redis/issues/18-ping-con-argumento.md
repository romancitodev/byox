## Objetivo

`PING` acepta un argumento opcional y, si lo recibe, lo devuelve como `ECHO`. Un detalle del
protocolo: sin argumento responde un simple string (`+PONG`); con argumento, un bulk string.

## Contrato

`PING hola` → `$4\r\nhola\r\n`.

## Para descubrir

- ¿Por qué un simple string no alcanza para devolver un mensaje arbitrario?

## Hecho cuando

- [ ] `sh .course/run.sh 18` pasa.
- [ ] `PING` sin argumentos sigue respondiendo `+PONG`.

## Para leer

- [`PING` en la documentación de Redis](https://redis.io/docs/latest/commands/ping/)
