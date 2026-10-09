## Objetivo

`KEYS patrón` devuelve las claves que coinciden. En producción está desaconsejado porque recorre
todas las claves de una vez y bloquea al servidor (para eso existe `SCAN`), pero es la forma directa
de usar tu glob.

## Contrato

Con `hola hallo hxllo hllo heeeello h*llo`: `KEYS h?llo` → `hallo hxllo h*llo` (en cualquier orden).
`KEYS *` devuelve todas, incluida la clave vacía si existe. `KEYS **`, en cambio, no la incluye.

## Reglas

- No hace falta ningún orden: Redis tampoco lo garantiza.

## Para descubrir

- ¿Por qué `KEYS *` y `KEYS **` dan resultados distintos con una clave vacía? Buscá `allkeys` en `db.c`.

## Hecho cuando

- [ ] `sh .course/run.sh 41` pasa.
- [ ] Un patrón sin coincidencias devuelve un array vacío, no nil.

## Para leer

- [`KEYS` en la documentación de Redis](https://redis.io/docs/latest/commands/keys/)
- [Redis, `db.c`: el espacio de claves, DEL, EXISTS, KEYS](https://github.com/redis/redis/blob/unstable/src/db.c)
