## Objetivo

`EXISTS` cuenta cuántas de las claves dadas existen. A diferencia de `DEL`, una clave repetida
cuenta cada vez: la documentación lo aclara explícitamente.

## Contrato

`EXISTS k k nada` → `:2` si `k` existe.

## Para descubrir

- ¿Por qué tiene sentido que `DEL` y `EXISTS` cuenten distinto las repetidas?

## Hecho cuando

- [ ] `sh .course/run.sh 29` pasa.
- [ ] `EXISTS nada` → `:0`.

## Para leer

- [`EXISTS` en la documentación de Redis](https://redis.io/docs/latest/commands/exists/)
