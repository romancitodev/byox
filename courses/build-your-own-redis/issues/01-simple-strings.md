## Objetivo

Redis y sus clientes se hablan con RESP, un protocolo de texto donde el primer byte dice el tipo
y cada línea termina en `\r\n`. Antes de tener un servidor vas a escribir el parser, sin red,
probado con bytes sueltos. Empezás por el tipo más simple: `+OK\r\n`.

## Contrato

En `src/resp.rs`:

```rust
pub fn parse(buf: &[u8]) -> Result<Option<(Value, usize)>, ParseError>
```

Devuelve el valor que empieza en `buf[0]` y cuántos bytes ocupó (`n`), para que quien llama
pueda descartar esos `n` bytes y seguir con el próximo valor.

Para esta etapa alcanza con `+`:

| Entrada | Resultado |
|---|---|
| `+OK\r\n` | `Ok(Some((Value::Simple("OK"), 5)))` |
| `+\r\n` | `Ok(Some((Value::Simple(""), 3)))` |
| `+OK\r\n+PONG\r\n` | `Ok(Some((Value::Simple("OK"), 5)))`: solo el primero |

## Reglas

- Sin crates: solo la biblioteca estándar.
- No asumas que el buffer termina donde termina el valor.

## Para descubrir

- ¿Dónde termina un simple string? ¿Puede tener un `\r` o un `\n` adentro?
- Si `parse` devuelve cuántos bytes usó, ¿quién se encarga de lo que sobra?

## Hecho cuando

- [ ] `sh .course/run.sh 1` pasa.
- [ ] Un simple string vacío es válido y distinto de un error.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
- [mini-redis, `frame.rs`: el parser de RESP de Tokio en Rust](https://github.com/tokio-rs/mini-redis/blob/master/src/frame.rs)
