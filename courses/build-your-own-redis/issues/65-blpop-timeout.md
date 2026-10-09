## Objetivo

El último argumento de `BLPOP` es un timeout en segundos, con decimales. Si se cumple sin que
llegue nada, responde el array nulo. `0` significa esperar para siempre. Y un detalle del modelo de
Redis: los comandos que el cliente mande mientras está bloqueado esperan su turno.

## Contrato

`BLPOP vacia 0.3` → `*-1` después de unos 300 ms. `BLPOP cola 0` espera lo que haga falta.
`-1` → `-ERR timeout is negative`; `abc` → `-ERR timeout is not a float or out of range`.
Un `PING` mandado durante la espera se responde después del `*-1`.

## Para descubrir

- Si el hilo se despierta antes del timeout pero no hay nada para él, ¿cuánto le queda por esperar?

## Hecho cuando

- [ ] `sh .course/run.sh 65` pasa.
- [ ] El timeout se cumple aunque haya despertares intermedios.

## Para leer

- [`BLPOP` en la documentación de Redis](https://redis.io/docs/latest/commands/blpop/)
- [`std::sync::Condvar`](https://doc.rust-lang.org/std/sync/struct.Condvar.html)
- [`std::time::Instant`](https://doc.rust-lang.org/std/time/struct.Instant.html)
