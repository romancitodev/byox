## Objetivo

Empieza el servidor. `Server::start` abre un puerto, devuelve enseguida y deja un hilo aceptando
conexiones. Los tests piden el puerto `0`, que le dice al sistema operativo "dame uno libre": así
pueden correr muchos servidores a la vez sin chocar.

## Contrato

En `src/server.rs`:

```rust
pub fn start(addr: &str, config: Config) -> io::Result<Server>
pub fn addr(&self) -> SocketAddr   // el puerto real, no el 0
```

Si el puerto ya está ocupado, `start` devuelve `Err`.

## Reglas

- `start` no puede bloquear: el bucle de `accept` va en otro hilo.

## Para descubrir

- Si pedís el puerto 0, ¿cómo sabés cuál te tocó?
- ¿Qué pasa con las conexiones que llegan mientras todavía no llamaste a `accept`?

## Hecho cuando

- [ ] `sh .course/run.sh 13` pasa.
- [ ] Dos servidores levantados en el mismo test quedan en puertos distintos.

## Para leer

- [`std::net::TcpListener`](https://doc.rust-lang.org/std/net/struct.TcpListener.html)
- [Build Your Own Redis, cap. 3: servidor y cliente TCP](https://build-your-own.org/redis/03_hello_cs)
- [El libro de Rust, cap. 21: un servidor web multihilo](https://doc.rust-lang.org/book/ch21-00-final-project-a-web-server.html)
