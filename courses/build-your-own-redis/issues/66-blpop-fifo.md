## Objetivo

Con varios clientes bloqueados en la misma lista, ¿quién recibe el elemento? Redis lo documenta
en `blocked.c`: los atiende en orden FIFO, el primero que se bloqueó es el primero que recibe. Con
`notify_all`, todos tus hilos se despiertan a la vez y el que gana el lock se lleva el elemento:
el orden queda librado al azar.

## Contrato

A se bloquea, después B; con un `RPUSH cola uno`, lo recibe A y B sigue esperando. Con dos
elementos de una, A recibe el primero y B el segundo. Diez clientes en fila reciben, en orden, los
diez elementos.

## Reglas

- El orden depende de cuándo se bloqueó cada cliente, no de cuál se despierta primero.

## Para descubrir

- ¿Qué información tiene que guardar el servidor para saber quién llegó primero?
- Si el primero de la fila espera en dos listas y lo atiende la otra, ¿qué pasa con su lugar en esta?

## Hecho cuando

- [ ] `sh .course/run.sh 66` pasa.
- [ ] El test de diez clientes pasa siempre, no algunas veces.

## Para leer

- [Redis, `blocked.c`: clientes bloqueados y `handleClientsBlockedOnKeys`](https://github.com/redis/redis/blob/unstable/src/blocked.c)
- [`BLPOP` en la documentación de Redis](https://redis.io/docs/latest/commands/blpop/)
