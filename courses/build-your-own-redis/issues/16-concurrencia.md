## Objetivo

Si atendés a un cliente por vez, uno que se conecta y no manda nada bloquea a todos los demás.
Redis resuelve esto con un event loop en un solo hilo; vos vas a usar un hilo por conexión, que en
Rust es simple y seguro. Más adelante vas a ver qué implica compartir datos entre esos hilos.

## Contrato

Un cliente quieto no frena a los otros, dos clientes pueden intercalar comandos y veinte hilos con
cincuenta `PING` cada uno terminan bien.

## Para descubrir

- ¿Dónde estás leyendo del socket: en el hilo que hace `accept` o en otro?
- ¿Qué ventajas tiene el event loop de Redis frente a un hilo por cliente? ¿Y qué desventajas?

## Hecho cuando

- [ ] `sh .course/run.sh 16` pasa.
- [ ] El test con 20 clientes en paralelo pasa.

## Para leer

- [`std::thread::spawn`](https://doc.rust-lang.org/std/thread/fn.spawn.html)
- [Build Your Own Redis, cap. 5: modelos de I/O concurrente](https://build-your-own.org/redis/05_event_loop_intro)
- [El libro de Rust, cap. 21: un servidor web multihilo](https://doc.rust-lang.org/book/ch21-00-final-project-a-web-server.html)
