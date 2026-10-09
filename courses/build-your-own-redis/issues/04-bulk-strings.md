## Objetivo

Los argumentos de los comandos y la mayoría de las respuestas viajan como *bulk strings*:
`$` + el largo en bytes + `\r\n` + el contenido + `\r\n`. A diferencia del simple string, primero
dice cuánto mide.

## Contrato

`$5\r\nhello\r\n` → `Value::Bulk(b"hello")` y 11 bytes consumidos. `$0\r\n\r\n` es un bulk vacío.

## Para descubrir

- ¿Cuántos bytes ocupa en total un bulk string de largo `n` cuyo encabezado tiene `k` dígitos?
- ¿Por qué Redis prefiere decir el largo primero en vez de terminar en `\r\n`?

## Hecho cuando

- [ ] `sh .course/run.sh 4` pasa.
- [ ] Un bulk vacío (`$0`) se lee como `Bulk(vec![])`.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
- [Build Your Own Redis, cap. 4: un protocolo de pedido y respuesta](https://build-your-own.org/redis/04_proto)
