## Objetivo

Así como hay un bulk nulo hay un array nulo: `*-1\r\n`. Es lo que responde `BLPOP` cuando se
vence el tiempo de espera o `EXEC` cuando una transacción se aborta por `WATCH`.

## Contrato

`*-1\r\n` → `Value::NullArray`. Un array también puede tener bulks nulos adentro (así responde `MGET`).

## Para descubrir

- ¿En qué se parece a la #6?

## Hecho cuando

- [ ] `sh .course/run.sh 9` pasa.
- [ ] `*3\r\n$1\r\n1\r\n$-1\r\n$1\r\n2\r\n` da `[Bulk(1), NullBulk, Bulk(2)]`.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
