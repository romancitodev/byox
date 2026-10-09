## Objetivo

Ahora el caso interesante: no hay nada y el cliente queda bloqueado hasta que otro cliente
agregue un elemento. Redis lo hace sin hilos: anota al cliente en una lista de bloqueados y lo
atiende cuando la clave cambia. Vos tenés un hilo por cliente, así que el tuyo puede dormir de
verdad, pero tiene que despertarse enseguida cuando llega algo, sin quedarse preguntando en un loop.

## Contrato

Un cliente hace `BLPOP cola 5` y no recibe nada. Otro hace `RPUSH cola x y`: el primero recibe
`[cola, x]` en menos de 500 ms, y `y` queda en la lista. Funciona con `LPUSH`, con varias listas, y
mientras uno espera los demás clientes siguen trabajando.

## Reglas

- Nada de `sleep` en un loop para preguntar si llegó algo.
- El cliente bloqueado no puede tener tomado el lock mientras espera.

## Para descubrir

- ¿Cómo duerme un hilo esperando que otro le avise? ¿Qué tiene que ver con el `Mutex` que ya tenés?
- Si te despertás, ¿podés estar seguro de que hay algo en la lista? (Leé sobre *spurious wakeups*.)

## Hecho cuando

- [ ] `sh .course/run.sh 64` pasa.
- [ ] El tiempo entre el `RPUSH` y la respuesta es de milisegundos.

## Para leer

- [`std::sync::Condvar`](https://doc.rust-lang.org/std/sync/struct.Condvar.html)
- [Redis, `blocked.c`: clientes bloqueados y `handleClientsBlockedOnKeys`](https://github.com/redis/redis/blob/unstable/src/blocked.c)
- [`BLPOP` en la documentación de Redis](https://redis.io/docs/latest/commands/blpop/)
