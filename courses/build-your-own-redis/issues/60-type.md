## Objetivo

Con dos tipos, hace falta saber de qué tipo es una clave. `TYPE` responde un simple string:
`string`, `list`, y más adelante `hash`, `set`, `zset` y `stream`. `none` si no existe.

## Contrato

`TYPE l` → `+list`. `TYPE s` → `+string`. `TYPE nada` → `+none`. `SET` sobre una lista la
reemplaza por un string sin error.

## Para descubrir

- ¿Por qué `SET` puede pisar cualquier tipo pero `RPUSH` no puede pisar un string?

## Hecho cuando

- [ ] `sh .course/run.sh 60` pasa.
- [ ] El nombre del tipo sale de un solo lugar, para agregar los que faltan después.

## Para leer

- [`TYPE` en la documentación de Redis](https://redis.io/docs/latest/commands/type/)
