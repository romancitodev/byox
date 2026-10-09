## Objetivo

`APPEND` agrega bytes al final del valor (o crea la clave) y responde el largo nuevo. Sirve
para logs simples o para armar un valor de a partes.

## Contrato

`APPEND log abc` → `:3`. `APPEND log xyz` → `:6`. `GET log` → `abcxyz`.

## Para descubrir

- ¿Podés modificar el valor en el lugar en vez de copiarlo entero?

## Hecho cuando

- [ ] `sh .course/run.sh 34` pasa.
- [ ] Funciona sobre una clave que no existía.

## Para leer

- [`APPEND` en la documentación de Redis](https://redis.io/docs/latest/commands/append/)
