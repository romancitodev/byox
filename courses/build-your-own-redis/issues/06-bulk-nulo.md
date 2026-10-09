## Objetivo

`GET` de una clave que no existe no responde un string vacío: responde *nil*. En RESP2 eso es un
bulk string de largo `-1`: `$-1\r\n`, sin contenido ni `\r\n` extra.

## Contrato

`$-1\r\n` → `Value::NullBulk`, 5 bytes.

## Para descubrir

- ¿Por qué hace falta distinguir "no existe" de "existe y está vacío"?

## Hecho cuando

- [ ] `sh .course/run.sh 6` pasa.
- [ ] `$-1` y `$0` dan valores distintos.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
