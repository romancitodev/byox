## Objetivo

Redis vence claves de dos formas. La *pasiva*: cuando alguien toca una clave vencida, la borra en
ese momento. Para que funcione, todos los comandos tienen que ver el mismo estado: si `GET` ya no la
ve, `EXISTS` tampoco, y `SET NX` tiene que poder crearla.

## Contrato

Una clave vencida no existe para `EXISTS`, y `SET k nueva NX` sobre ella responde `+OK`.

## Reglas

- Un solo lugar del código decide si una clave está viva.

## Para descubrir

- ¿Cuántos comandos acceden al mapa directamente? ¿Todos chequean el vencimiento?

## Hecho cuando

- [ ] `sh .course/run.sh 43` pasa.
- [ ] Ningún comando ve una clave vencida.

## Para leer

- [`EXPIRE` en la documentación de Redis](https://redis.io/docs/latest/commands/expire/)
- [Redis, `db.c`: el espacio de claves, DEL, EXISTS, KEYS](https://github.com/redis/redis/blob/unstable/src/db.c)
