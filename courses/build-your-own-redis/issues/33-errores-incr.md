## Objetivo

¿Qué pasa con `INCR` sobre `"hola"`, o sobre el `i64` más grande? Redis responde errores
precisos y no modifica nada. Detectar el desborde sin hacer panic es parte del ejercicio.

## Contrato

Valor no numérico o incremento inválido → `-ERR value is not an integer or out of range`.
Desborde → `-ERR increment or decrement would overflow`. En los dos casos el valor queda igual.

## Reglas

- Nada de `+` común: en modo debug, Rust hace panic al desbordar.

## Para descubrir

- ¿Qué métodos de `i64` te avisan del desborde en vez de hacer panic?
- ¿Acepta Redis `" 5"` o `"+5"` como entero? Probalo con un Redis real si tenés uno.

## Hecho cuando

- [ ] `sh .course/run.sh 33` pasa.
- [ ] `INCR` sobre `9223372036854775807` da el error de desborde.

## Para leer

- [`INCR` en la documentación de Redis](https://redis.io/docs/latest/commands/incr/)
- [Redis, `t_string.c`: SET, GET, INCR, APPEND…](https://github.com/redis/redis/blob/unstable/src/t_string.c)
