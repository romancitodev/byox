## Objetivo

Las respuestas de Redis pueden tener arrays adentro de arrays: `XRANGE` devuelve entradas que son
pares `[id, [campo, valor, …]]`, y `EXEC` devuelve un array con la respuesta de cada comando.

## Contrato

`*0\r\n` → `Value::Array(vec![])`. `*2\r\n*2\r\n:1\r\n:2\r\n*1\r\n+x\r\n` → un array de dos arrays.

## Para descubrir

- Si tu lectura de arrays es recursiva, ¿hace falta algo nuevo para anidarlos?

## Hecho cuando

- [ ] `sh .course/run.sh 8` pasa.
- [ ] Un array vacío consume solo `*0\r\n`.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
