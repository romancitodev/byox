## Objetivo

`PERSIST` le saca el vencimiento a una clave. Responde `1` si tenía uno y `0` si no (o si la clave
no existe).

## Contrato

Después de `SET p v EX 50`: `PERSIST p` → `:1`, `TTL p` → `:-1`, `PERSIST p` otra vez → `:0`.

## Para descubrir

- ¿Cómo se representa "sin vencimiento" en tu estructura?

## Hecho cuando

- [ ] `sh .course/run.sh 47` pasa.
- [ ] `PERSIST nada` → `:0`.

## Para leer

- [`PERSIST` en la documentación de Redis](https://redis.io/docs/latest/commands/persist/)
