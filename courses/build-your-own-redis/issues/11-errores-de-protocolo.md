## Objetivo

Del otro lado puede haber cualquier cosa: un cliente con bugs o alguien escribiendo a mano.
Un servidor robusto reconoce los bytes inválidos y los rechaza en vez de quedarse esperando para
siempre o hacer panic.

## Contrato

`Err(ParseError(_))` para: un primer byte que no es `+ - : $ *` (sin esperar el fin de línea),
números inválidos (`$abc`, `:12a`), largos negativos que no son `-1` y bulks que no terminan en `\r\n`.

## Para descubrir

- Si el primer byte es `!`, ¿hace falta esperar más datos para saber que está mal?
- ¿Qué diferencia hay entre `$-1` y `$-5`?

## Hecho cuando

- [ ] `sh .course/run.sh 11` pasa.
- [ ] Un error adentro de un array hace fallar el array entero.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
- [Redis, `networking.c`: `processMultibulkBuffer` y `processInlineBuffer`](https://github.com/redis/redis/blob/unstable/src/networking.c)
