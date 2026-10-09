## Objetivo

Un cliente de verdad abre una conexión y la usa para muchos comandos. Después de responder
el primero, el servidor tiene que seguir escuchando a ese mismo cliente.

## Contrato

Diez `PING` seguidos en la misma conexión reciben diez `+PONG`.

## Para descubrir

- ¿Qué hace tu código después de responder? ¿Cierra, o vuelve a leer?
- ¿Cuándo sabés que el cliente se fue?

## Hecho cuando

- [ ] `sh .course/run.sh 15` pasa.
- [ ] Si el cliente cierra la conexión, el hilo que lo atendía termina sin panic.

## Para leer

- [`std::io::Read`](https://doc.rust-lang.org/std/io/trait.Read.html)
- [Build Your Own Redis, cap. 4: un protocolo de pedido y respuesta](https://build-your-own.org/redis/04_proto)
