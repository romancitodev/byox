## Objetivo

Opciones incompatibles o desconocidas son un error de sintaxis, y en ese caso no se escribe
nada. `NX` y `XX` juntos no tienen sentido.

## Contrato

`SET k v NX XX` y `SET k v FOO` → `-ERR syntax error`. El valor de `k` no cambia.

## Para descubrir

- ¿Validás todas las opciones antes de escribir o escribís y después te das cuenta?

## Hecho cuando

- [ ] `sh .course/run.sh 39` pasa.
- [ ] Un error de sintaxis nunca deja la clave modificada.

## Para leer

- [Redis, `t_string.c`: SET, GET, INCR, APPEND…](https://github.com/redis/redis/blob/unstable/src/t_string.c)
