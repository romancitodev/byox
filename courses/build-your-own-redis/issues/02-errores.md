## Objetivo

Los errores de Redis son simple strings que empiezan con `-` en lugar de `+`. Por convención,
la primera palabra es el tipo de error: `ERR`, `WRONGTYPE`, `EXECABORT`… Los clientes la usan para
decidir qué hacer.

## Contrato

`-ERR unknown command 'FOO'\r\n` → `Value::Error("ERR unknown command 'FOO'")`, con el largo consumido.

## Para descubrir

- ¿Qué cambia entre leer `+` y leer `-`? ¿Podés reusar lo que hiciste en la #1?

## Hecho cuando

- [ ] `sh .course/run.sh 2` pasa.
- [ ] Los mensajes reales de Redis, con espacios y comillas, se leen enteros.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
