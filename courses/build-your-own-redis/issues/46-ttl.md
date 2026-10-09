## Objetivo

`TTL` dice cuántos segundos le quedan a una clave y `PTTL`, cuántos milisegundos. Los valores
negativos son códigos: `-2` si no existe, `-1` si no vence. `TTL` redondea al entero más cercano, y
la fórmula exacta está en `expire.c`.

## Contrato

`TTL nada` → `:-2`. Sin vencimiento → `:-1`. Recién después de `SET k v EX 100` → `:100`, y `PTTL`
entre 99000 y 100000. Con 1600 ms por delante, `TTL` da `2`; con 1400, `1`.

## Para descubrir

- Si quedan 1600 ms, ¿por qué `TTL` da 2 y no 1? Buscá `ttlGenericCommand` en `expire.c`.

## Hecho cuando

- [ ] `sh .course/run.sh 46` pasa.
- [ ] El redondeo coincide con el de Redis.

## Para leer

- [`TTL` en la documentación de Redis](https://redis.io/docs/latest/commands/ttl/)
- [`PTTL` en la documentación de Redis](https://redis.io/docs/latest/commands/pttl/)
- [Redis, `expire.c`: `activeExpireCycle` y los comandos de TTL](https://github.com/redis/redis/blob/unstable/src/expire.c)
