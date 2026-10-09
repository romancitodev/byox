## Objetivo

`LINDEX lista i` devuelve un elemento por posición, con las mismas reglas de índices negativos.
Fuera de rango responde nil, no un error.

## Contrato

Con `a b c`: `LINDEX l 0` → `a`, `LINDEX l -1` → `c`, `LINDEX l 100` y `LINDEX l -100` → nil.
`LINDEX l abc` → error de entero.

## Para descubrir

- ¿En qué se diferencia de un `LRANGE l i i`?

## Hecho cuando

- [ ] `sh .course/run.sh 56` pasa.
- [ ] Una clave inexistente da nil.

## Para leer

- [`LINDEX` en la documentación de Redis](https://redis.io/docs/latest/commands/lindex/)
