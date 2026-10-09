## Objetivo

Una clave puede vencer: `SET k v EX 10` la borra en 10 segundos y `PX`, en milisegundos. Es lo que
convierte a Redis en un cache. Vas a guardar el vencimiento como un instante absoluto y, al leer una
clave vencida, hacer como si no existiera.

## Contrato

`SET k v PX 200` → `+OK`; `GET k` devuelve `v` y, 300 ms después, nil. `EX` es en segundos.
Un `SET` sin `EX` ni `PX` deja la clave sin vencimiento, aunque antes tuviera uno.

## Reglas

- Guardá el vencimiento como tiempo absoluto (milisegundos desde 1970), no como "cuánto falta".

## Para descubrir

- ¿Por qué un instante absoluto es mejor que guardar los milisegundos que faltan?
- ¿Qué estructura tiene ahora cada entrada del mapa?

## Hecho cuando

- [ ] `sh .course/run.sh 42` pasa.
- [ ] El vencimiento se respeta sin ningún hilo extra: se chequea al leer.

## Para leer

- [`SET` en la documentación de Redis](https://redis.io/docs/latest/commands/set/)
- [Redis, `t_string.c`: SET, GET, INCR, APPEND…](https://github.com/redis/redis/blob/unstable/src/t_string.c)
- [`std::time::SystemTime`](https://doc.rust-lang.org/std/time/struct.SystemTime.html)
- [mini-redis, `db.rs`: estado compartido con `Arc<Mutex<…>>` y vencimientos](https://github.com/tokio-rs/mini-redis/blob/master/src/db.rs)
