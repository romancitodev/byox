# 🧱 build-your-own-redis

Un Redis en Rust, desde el socket hasta la replicación, que habla con el `redis-cli` de verdad.

```console
$ cargo run -- --port 6380
miredis escuchando en 127.0.0.1:6380

$ redis-cli -p 6380 set saludo "hola mundo"
OK
$ redis-cli -p 6380 incr visitas
1
$ redis-cli -p 6380 set sesion abc EX 60
OK
$ redis-cli -p 6380 ttl sesion
60
$ redis-cli -p 6380 rpush tareas lavar planchar barrer
3
$ redis-cli -p 6380 lrange tareas 0 -1
lavar
planchar
barrer
$ redis-cli -p 6380 incr tareas
WRONGTYPE Operation against a key holding the wrong kind of value
```

## Qué vas a aprender

- A leer y escribir RESP, el protocolo de Redis, con datos que llegan partidos o de a muchos.
- A atender muchos clientes a la vez y compartir estado entre hilos con `Arc<Mutex<…>>`.
- Cómo implementa Redis sus comandos, con los mismos mensajes de error, byte por byte.
- Dos formas de vencer claves: la pasiva al leer y la activa con muestreo, como `expire.c`.
- Listas con `LPUSH`, `LRANGE` y `LTRIM`, y `BLPOP`: clientes que esperan bloqueados y se
  despiertan en orden de llegada, como en `blocked.c`.
- En los tramos que siguen: el formato RDB, el AOF de varias partes de Redis 7, transacciones con
  `WATCH`, pub/sub, replicación maestro-réplica con `WAIT`, streams, bitmaps, comandos geoespaciales
  y autenticación.

## Antes de arrancar

- Rust 1.85 o más nuevo (el curso corre en `rust:1.99`) y saber usar `struct`, `enum`, `match` y `Vec`.
- Nada de crates: todo sale de la biblioteca estándar.
- Opcional: `redis-cli`, para hablarle a tu servidor como a un Redis más.
- Cada etapa lleva entre 10 minutos y 2 horas. Las de RESP son cortas; las de concurrencia y
  expiración activa, las más largas.

Los tests comparan contra lo que responde Redis 8 de verdad: cada mensaje de error, cada formato y
cada caso borde de este curso salió de correr el comando en un `redis-server` real.

## Créditos

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/) y la
  [documentación de comandos](https://redis.io/docs/latest/commands/) de Redis.
- El código de [Redis](https://github.com/redis/redis): `networking.c`, `t_string.c`, `expire.c`,
  `db.c`, `util.c`, `t_list.c` y `blocked.c`.
- [mini-redis](https://github.com/tokio-rs/mini-redis), la implementación de referencia de Tokio en Rust.
- [Build Your Own Redis with C/C++](https://build-your-own.org/redis/), de James Smith.
