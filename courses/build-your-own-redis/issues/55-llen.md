## Objetivo

`LLEN` devuelve el largo de la lista, o 0 si no existe. Con un `VecDeque` es O(1).

## Contrato

`LLEN nada` → `:0`. Con `a b c` → `:3`.

## Para descubrir

- ¿Cuánto cuesta saber el largo de una lista enlazada que no lo guarda aparte?

## Hecho cuando

- [ ] `sh .course/run.sh 55` pasa.
- [ ] No recorre la lista.

## Para leer

- [`LLEN` en la documentación de Redis](https://redis.io/docs/latest/commands/llen/)
