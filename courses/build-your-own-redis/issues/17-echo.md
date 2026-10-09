## Objetivo

`ECHO mensaje` devuelve el mensaje como bulk string. Es el primer comando con un argumento, y
el primero que responde algo que mandó el cliente.

## Contrato

`ECHO hola` → `$4\r\nhola\r\n`. Cualquier byte, incluso `\r\n` o vacío, vuelve igual.

## Para descubrir

- ¿El argumento llega como texto o como bytes? ¿Importa?

## Hecho cuando

- [ ] `sh .course/run.sh 17` pasa.
- [ ] Un argumento binario vuelve sin cambios.

## Para leer

- [`ECHO` en la documentación de Redis](https://redis.io/docs/latest/commands/echo/)
