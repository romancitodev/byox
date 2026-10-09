## Objetivo

`GET` de una clave que no existe responde nil (`$-1`), el bulk nulo de la #6. Y como `GET` y
`SET` ya están en tu tabla, la validación de aridad de la #24 también tiene que funcionar para
ellos.

## Contrato

`GET nada` → `$-1\r\n`. `GET` → `-ERR wrong number of arguments for 'get' command`.
`SET k` → lo mismo con `'set'`.

## Para descubrir

- ¿Qué devuelve `HashMap::get` cuando no está la clave? ¿Cómo se traduce a RESP?

## Hecho cuando

- [ ] `sh .course/run.sh 26` pasa.
- [ ] No hay un caso especial de aridad para `GET` ni para `SET`: sale de la tabla.

## Para leer

- [`GET` en la documentación de Redis](https://redis.io/docs/latest/commands/get/)
