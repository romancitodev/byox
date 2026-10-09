## Objetivo

`EX 0`, `EX -1` o `PX abc` no tienen sentido. Redis distingue entre un número inválido y un
tiempo inválido, y entre eso y una opción mal escrita.

## Contrato

`EX 0`, `EX -1`, `PX 0` → `-ERR invalid expire time in 'set' command`. `EX abc` → `-ERR value is not
an integer or out of range`. `SET k v EX` (sin número) y `EX 10 PX 100` → `-ERR syntax error`.

## Reglas

- En ningún caso se escribe la clave.

## Para descubrir

- ¿En qué orden chequea Redis la sintaxis, el número y el valor?

## Hecho cuando

- [ ] `sh .course/run.sh 44` pasa.
- [ ] Después de un error, `GET k` sigue en nil.

## Para leer

- [Redis, `t_string.c`: SET, GET, INCR, APPEND…](https://github.com/redis/redis/blob/unstable/src/t_string.c)
