## Objetivo

¿Qué pasa con `LPUSH` sobre un string o `GET` sobre una lista? Redis no convierte nada: responde
el error `WRONGTYPE` y no modifica la clave. Es el mismo error para todos los comandos y todos los
tipos.

## Contrato

Comandos de lista sobre un string y comandos de string sobre una lista → `-WRONGTYPE Operation against a key holding the wrong kind of value`.
Incluye `SET l x GET` sobre una lista: el `GET` de `SET` también exige un string.

## Reglas

- Ningún comando que falla con `WRONGTYPE` modifica la clave.

## Para descubrir

- ¿Cuántos comandos tenés que revisar? ¿Podés escribir el chequeo una sola vez?

## Hecho cuando

- [ ] `sh .course/run.sh 61` pasa.
- [ ] Después del error, la clave sigue igual.

## Para leer

- [Redis, `t_list.c`: los comandos de listas](https://github.com/redis/redis/blob/unstable/src/t_list.c)
- [Redis, `server.h`: los mensajes de error compartidos](https://github.com/redis/redis/blob/unstable/src/server.h)
