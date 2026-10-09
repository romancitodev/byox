## Objetivo

Un comando viaja como un array de bulk strings: `SET clave valor` es
`*3\r\n$3\r\nSET\r\n$5\r\nclave\r\n$5\r\nvalor\r\n`. El array dice cuántos elementos tiene y cada
elemento es otro valor RESP, de cualquier tipo.

## Contrato

`*2\r\n$4\r\nECHO\r\n$4\r\nhola\r\n` → `Value::Array(vec![Bulk(b"ECHO"), Bulk(b"hola")])` y el largo total.

## Para descubrir

- Cada elemento es un valor RESP completo. ¿Qué función ya sabe leer uno?
- ¿Cómo sabés desde dónde leer el segundo elemento?

## Hecho cuando

- [ ] `sh .course/run.sh 7` pasa.
- [ ] Un array con elementos de tipos distintos (`:1`, `+dos`, `$4 tres`) se lee bien.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
- [mini-redis, `frame.rs`: el parser de RESP de Tokio en Rust](https://github.com/tokio-rs/mini-redis/blob/master/src/frame.rs)
