## Objetivo

TCP entrega un flujo de bytes, no mensajes: un comando puede llegar partido en varios `read` o
varios comandos juntos en uno. Por eso `parse` tiene que distinguir "esto está mal" de "todavía no
llegó todo". mini-redis lo resuelve en dos pasadas (`check` y `parse`); vos podés hacerlo en una.

## Contrato

Para **cualquier** prefijo de un valor válido, `parse` devuelve `Ok(None)`: no es un error, falta
información. Con el valor completo devuelve `Ok(Some(...))`.

## Reglas

- Un prefijo nunca puede dar `Err` ni hacer panic (cuidado con los índices fuera de rango).

## Para descubrir

- ¿Cuáles son todos los lugares de tu parser donde podrías quedarte sin bytes?
- Si un elemento de un array está incompleto, ¿qué tiene que devolver el array entero?

## Hecho cuando

- [ ] `sh .course/run.sh 10` pasa.
- [ ] Todos los prefijos de `+OK`, `:-42`, `$5 hello` y `*2 ECHO hola` dan `Ok(None)`.

## Para leer

- [mini-redis, `frame.rs`: el parser de RESP de Tokio en Rust](https://github.com/tokio-rs/mini-redis/blob/master/src/frame.rs)
- [mini-redis, `connection.rs`: leer frames de un socket](https://github.com/tokio-rs/mini-redis/blob/master/src/connection.rs)
- [Build Your Own Redis, cap. 4: un protocolo de pedido y respuesta](https://build-your-own.org/redis/04_proto)
