## Objetivo

`BLPOP` es un `LPOP` que espera si no hay nada: lo que hace posibles las colas de trabajo con
Redis. Recibe varias listas y un timeout. En esta etapa, el caso fácil: si alguna lista tiene algo,
se saca de la primera no vacía, **en el orden de los argumentos**, y se responde la clave y el
elemento.

## Contrato

Con `b = [1]` y `c = [2]`: `BLPOP a c b 0` → `[c, 2]`. Si alguna de las claves existe y no es una
lista → `-WRONGTYPE Operation against a key holding the wrong kind of value`.

## Para descubrir

- ¿Por qué la respuesta incluye el nombre de la clave?

## Hecho cuando

- [ ] `sh .course/run.sh 63` pasa.
- [ ] `BLPOP cola 0` con elementos responde enseguida.

## Para leer

- [`BLPOP` en la documentación de Redis](https://redis.io/docs/latest/commands/blpop/)
- [Redis, `t_list.c`: los comandos de listas](https://github.com/redis/redis/blob/unstable/src/t_list.c)
