## Objetivo

El servidor también tiene que hablar RESP para responder. Escribir es más fácil que leer, y no
depende de nada de lo anterior: podés hacer esta etapa cuando quieras.

## Contrato

En `src/resp.rs`:

```rust
pub fn encode(value: &Value) -> Vec<u8>
```

`encode(&Value::Bulk(b"hola".to_vec()))` → `$4\r\nhola\r\n`. `NullBulk` → `$-1\r\n`. Los arrays, recursivos.

## Para descubrir

- El largo de un bulk, ¿es en bytes o en caracteres?

## Hecho cuando

- [ ] `sh .course/run.sh 12` pasa.
- [ ] Arrays anidados y nulos se escriben igual que como los manda Redis.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
