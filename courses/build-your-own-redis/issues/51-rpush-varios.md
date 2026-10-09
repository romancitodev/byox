## Objetivo

`RPUSH` acepta muchos elementos en un solo comando y los agrega en orden. Es una sola ida y vuelta
por la red en vez de una por elemento.

## Contrato

Después de `RPUSH l a`: `RPUSH l b c d` → `:4`.

## Para descubrir

- ¿Cambia algo de la #50 o es un loop sobre los argumentos?

## Hecho cuando

- [ ] `sh .course/run.sh 51` pasa.
- [ ] El largo que responde es el total de la lista, no la cantidad agregada.

## Para leer

- [`RPUSH` en la documentación de Redis](https://redis.io/docs/latest/commands/rpush/)
