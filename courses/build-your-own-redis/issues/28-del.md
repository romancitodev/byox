## Objetivo

`DEL` borra una o más claves y responde cuántas existían. Es el primer comando con una cantidad
variable de argumentos.

## Contrato

`DEL a b nada` → `:2` si existían `a` y `b`. Repetir una clave no la cuenta dos veces.

## Para descubrir

- ¿Qué te devuelve `HashMap::remove`? ¿Te sirve para contar?

## Hecho cuando

- [ ] `sh .course/run.sh 28` pasa.
- [ ] Después de `DEL`, `GET` de esa clave da nil.

## Para leer

- [`DEL` en la documentación de Redis](https://redis.io/docs/latest/commands/del/)
- [Redis, `db.c`: el espacio de claves, DEL, EXISTS, KEYS](https://github.com/redis/redis/blob/unstable/src/db.c)
