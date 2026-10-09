## Objetivo

`LTRIM` recorta la lista para dejar solo un rango, con las mismas reglas que `LRANGE`. Junto con
`LPUSH` sirve para guardar "los últimos N": `LPUSH log x` seguido de `LTRIM log 0 99`. Si el rango
queda vacío, la lista se borra.

## Contrato

Con `z y x a b`: `LTRIM l 1 3` → `+OK` y queda `y x a`. `LTRIM l 0 -1` no cambia nada.
`LTRIM l 5 10` deja la lista vacía y la borra. Sobre una clave inexistente → `+OK`.

## Para descubrir

- Si ya tenés la normalización de índices de la #53, ¿qué parte de `LTRIM` es nueva?

## Hecho cuando

- [ ] `sh .course/run.sh 62` pasa.
- [ ] Un rango vacío borra la clave.

## Para leer

- [`LTRIM` en la documentación de Redis](https://redis.io/docs/latest/commands/ltrim/)
- [Redis, `t_list.c`: los comandos de listas](https://github.com/redis/redis/blob/unstable/src/t_list.c)
