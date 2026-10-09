## Objetivo

`LPUSH` agrega al principio. Con varios elementos, cada uno se agrega adelante del anterior, así
que quedan en el orden inverso al que se mandaron.

## Contrato

Con `a b`: `LPUSH l x y z` → `:5` y `LRANGE l 0 -1` → `z y x a b`.

## Para descubrir

- ¿Por qué quedan al revés? ¿Es un bug o tiene sentido?

## Hecho cuando

- [ ] `sh .course/run.sh 54` pasa.
- [ ] `LPUSH` y `RPUSH` comparten casi todo el código.

## Para leer

- [`LPUSH` en la documentación de Redis](https://redis.io/docs/latest/commands/lpush/)
