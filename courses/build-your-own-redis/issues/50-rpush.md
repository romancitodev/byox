## Objetivo

Hasta ahora cada clave guardaba un string. Redis tiene otros tipos, y el primero es la lista:
una secuencia ordenada de strings a la que se agrega y se saca por las puntas. `RPUSH` agrega al
final (a la derecha) y crea la lista si no existía. Lo importante de esta etapa es la estructura:
un valor ya no es siempre un string.

## Contrato

`RPUSH l a` → `:1` (el largo después de agregar). `RPUSH l b` → `:2`. `RPUSH l` → error de aridad
con `'rpush'`.

## Reglas

- Un solo diccionario de claves para todos los tipos: una clave es un string o una lista, nunca las dos.

## Para descubrir

- ¿Cómo representás en Rust "un valor que puede ser de varios tipos"?
- ¿Qué estructura de la biblioteca estándar permite agregar y sacar rápido por las dos puntas?

## Hecho cuando

- [ ] `sh .course/run.sh 50` pasa.
- [ ] Los comandos de strings siguen andando.

## Para leer

- [`RPUSH` en la documentación de Redis](https://redis.io/docs/latest/commands/rpush/)
- [Listas en la documentación de Redis](https://redis.io/docs/latest/develop/data-types/lists/)
- [Redis, `t_list.c`: los comandos de listas](https://github.com/redis/redis/blob/unstable/src/t_list.c)
- [`std::collections::VecDeque`](https://doc.rust-lang.org/std/collections/struct.VecDeque.html)
