## Objetivo

`:` anuncia un entero con signo de 64 bits en texto decimal. Lo usan `INCR`, `DEL`, `EXISTS` y
muchos más para responder un número.

## Contrato

`:-42\r\n` → `Value::Integer(-42)`. Tiene que soportar todo el rango de `i64`.

## Para descubrir

- ¿Qué pasa si el número no entra en un `i64`? (Lo vas a ver en la #11.)

## Hecho cuando

- [ ] `sh .course/run.sh 3` pasa.
- [ ] `i64::MAX` e `i64::MIN` se leen sin desbordar.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
