## Objetivo

El primer comando: `PING` → `+PONG`. Es lo primero que manda `redis-cli` para saber si hay
alguien. Juntás lo de las dos partes: leer un comando con tu parser y responder con tu encoder.

## Contrato

Un cliente manda `*1\r\n$4\r\nPING\r\n` y recibe exactamente `+PONG\r\n`. El nombre del
comando no distingue mayúsculas: `ping` y `PiNg` valen lo mismo.

## Para descubrir

- ¿Qué forma tiene un comando una vez parseado? ¿Cuál de sus elementos es el nombre?

## Hecho cuando

- [ ] `sh .course/run.sh 14` pasa.
- [ ] `cargo run` y `redis-cli -p 6379 ping` responden `PONG` (si tenés redis-cli).

## Para leer

- [`PING` en la documentación de Redis](https://redis.io/docs/latest/commands/ping/)
- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
