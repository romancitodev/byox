## Objetivo

`LPOP` saca el primer elemento y lo devuelve; `RPOP`, el último. Con `RPUSH` + `LPOP` tenés una
cola; con `RPUSH` + `RPOP`, una pila.

## Contrato

Con `a b c`: `LPOP l` → `a`, `RPOP l` → `c` y queda `b`. Sobre una clave inexistente → nil.

## Para descubrir

- ¿Qué combinación de comandos usarías para una cola de trabajos? ¿Y para un historial de lo último?

## Hecho cuando

- [ ] `sh .course/run.sh 57` pasa.
- [ ] Sacar de una lista inexistente no la crea.

## Para leer

- [`LPOP` en la documentación de Redis](https://redis.io/docs/latest/commands/lpop/)
- [`RPOP` en la documentación de Redis](https://redis.io/docs/latest/commands/rpop/)
- [Listas en la documentación de Redis](https://redis.io/docs/latest/develop/data-types/lists/)
