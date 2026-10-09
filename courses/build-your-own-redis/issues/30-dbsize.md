## Objetivo

`DBSIZE` responde cuántas claves hay. Parece trivial, pero vas a volver a él en la #49: en Redis
cuenta todas las claves guardadas, incluso las que ya vencieron y todavía no se borraron.

## Contrato

Con el servidor recién levantado → `:0`. Pisar una clave no suma. `DBSIZE extra` → error de aridad.

## Reglas

- Contá las claves que hay guardadas, sin filtrar.

## Para descubrir

- ¿Cuánto cuesta contar si el mapa ya sabe su tamaño?

## Hecho cuando

- [ ] `sh .course/run.sh 30` pasa.
- [ ] El valor baja después de un `DEL`.

## Para leer

- [`DBSIZE` en la documentación de Redis](https://redis.io/docs/latest/commands/dbsize/)
