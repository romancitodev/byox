## Objetivo

`MSET` escribe varios pares de una vez y `MGET` lee varias claves de una vez. Ahorran idas y
vueltas por la red. `MGET` responde un array con nil para las que no existen.

## Contrato

`MSET a 1 b 2` → `+OK`. `MGET a nada b` → `["1", nil, "2"]`. `MSET a` y `MSET a 1 b` (pares
incompletos) → `-ERR wrong number of arguments for 'mset' command`, sin escribir nada.

## Para descubrir

- La aridad de `MSET` es -3, pero `MSET a 1 b` tiene 4 argumentos y es inválido. ¿Qué chequeo falta?

## Hecho cuando

- [ ] `sh .course/run.sh 36` pasa.
- [ ] Un `MSET` inválido no deja ninguna clave escrita.

## Para leer

- [`MSET` en la documentación de Redis](https://redis.io/docs/latest/commands/mset/)
- [`MGET` en la documentación de Redis](https://redis.io/docs/latest/commands/mget/)
