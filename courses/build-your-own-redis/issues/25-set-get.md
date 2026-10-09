## Objetivo

Redis es, ante todo, un diccionario: `SET clave valor` guarda y `GET clave` devuelve. Como cada
cliente tiene su hilo, el diccionario tiene que ser compartido entre todos y protegido para que dos
hilos no lo modifiquen a la vez. Redis no tiene este problema porque ejecuta los comandos en un solo
hilo; vos vas a conseguir lo mismo con un `Mutex`.

## Contrato

`SET nombre redis` → `+OK`. `GET nombre` → `$5\r\nredis\r\n`. Un `SET` posterior pisa el valor.
Lo que escribe un cliente lo lee cualquier otro.

## Reglas

- Las claves y los valores son bytes (`Vec<u8>`), no `String`: Redis es binary safe.

## Para descubrir

- ¿Dónde vive el diccionario para que todos los hilos lo vean? ¿Quién es su dueño?
- ¿Cuánto tiempo conviene tener tomado el lock? ¿Qué pasa si lo tomás mientras escribís al socket?

## Hecho cuando

- [ ] `sh .course/run.sh 25` pasa.
- [ ] Un cliente escribe y otro lee el mismo valor.

## Para leer

- [`SET` en la documentación de Redis](https://redis.io/docs/latest/commands/set/)
- [`GET` en la documentación de Redis](https://redis.io/docs/latest/commands/get/)
- [mini-redis, `db.rs`: estado compartido con `Arc<Mutex<…>>` y vencimientos](https://github.com/tokio-rs/mini-redis/blob/master/src/db.rs)
- [`std::sync::Mutex`](https://doc.rust-lang.org/std/sync/struct.Mutex.html)
- [`std::sync::Arc`](https://doc.rust-lang.org/std/sync/struct.Arc.html)
