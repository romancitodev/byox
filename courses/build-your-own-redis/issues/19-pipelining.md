## Objetivo

Los clientes pueden mandar muchos comandos sin esperar las respuestas (*pipelining*): es una de
las razones por las que Redis es tan rápido. Del lado del servidor, un solo `read` puede traer
varios comandos juntos.

## Contrato

Dos comandos en un mismo paquete reciben dos respuestas, en orden. Cien `ECHO` mandados de una
vez reciben cien respuestas en el mismo orden.

## Para descubrir

- Después de procesar un comando, ¿qué hacés con los bytes que sobran en el buffer?
- ¿Para qué te sirve que `parse` devuelva cuántos bytes consumió?

## Hecho cuando

- [ ] `sh .course/run.sh 19` pasa.
- [ ] Las respuestas salen en el mismo orden en que llegaron los comandos.

## Para leer

- [Pipelining en la documentación de Redis](https://redis.io/docs/latest/develop/use/pipelining/)
- [mini-redis, `connection.rs`: leer frames de un socket](https://github.com/tokio-rs/mini-redis/blob/master/src/connection.rs)
