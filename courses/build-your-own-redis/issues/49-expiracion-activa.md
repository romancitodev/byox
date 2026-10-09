## Objetivo

Con la expiración pasiva, una clave vencida que nadie vuelve a leer ocupa memoria para siempre.
Redis la complementa con la *activa*: 10 veces por segundo toma 20 claves con vencimiento al azar,
borra las vencidas y, si más del 10% lo estaba, repite. Así no recorre todo el diccionario y la
memoria ocupada por claves vencidas queda acotada.

## Contrato

500 claves con `PX 50` que nadie vuelve a leer, más una sin vencimiento: después de 1,5 s `DBSIZE`
responde `:1`. Recordá que `DBSIZE` cuenta lo que hay guardado (#30): si bajó, es porque las borró
el servidor.

## Reglas

- No recorras todas las claves en cada vuelta: muestreá, como Redis.
- El hilo de expiración toma el mismo lock que los comandos, y lo suelta entre vueltas.

## Para descubrir

- ¿Por qué muestrear en vez de recorrer todo? ¿Qué pasa con un millón de claves?
- ¿Por qué el umbral para repetir es un porcentaje y no un número fijo?
- Un heap ordenado por vencimiento (como en build-your-own.org) también resuelve el problema. ¿Qué ventajas tiene cada enfoque?

## Hecho cuando

- [ ] `sh .course/run.sh 49` pasa.
- [ ] Las claves vencidas desaparecen aunque nadie las toque.

## Para leer

- [Redis, `expire.c`: `activeExpireCycle` y los comandos de TTL](https://github.com/redis/redis/blob/unstable/src/expire.c)
- [Cómo vence las claves Redis (documentación de EXPIRE)](https://redis.io/docs/latest/commands/expire/#how-redis-expires-keys)
- [Build Your Own Redis, cap. 13: vencimientos con un heap](https://build-your-own.org/redis/13_heap)
- [Build Your Own Redis, cap. 12: timers y timeouts](https://build-your-own.org/redis/12_timer)
