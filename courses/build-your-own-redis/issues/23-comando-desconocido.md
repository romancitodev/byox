## Objetivo

Un cliente que manda un comando que no existe recibe un error, y la conexión sigue abierta.
El mensaje de Redis es muy específico y los clientes y las herramientas lo reconocen, así que el tuyo
tiene que ser igual.

## Contrato

`FOO` → `-ERR unknown command 'FOO'`.
`FOO a b` → `-ERR unknown command 'FOO', with args beginning with: 'a' 'b' ` (con un espacio al final).
El nombre aparece como lo mandó el cliente, sin cambiar mayúsculas.

## Para descubrir

- Fijate el espacio después de cada argumento: viene de cómo `server.c` arma el mensaje.

## Hecho cuando

- [ ] `sh .course/run.sh 23` pasa.
- [ ] Después del error, `PING` sigue funcionando en la misma conexión.

## Para leer

- [Redis, `server.c`: `processCommand` y los mensajes de error](https://github.com/redis/redis/blob/unstable/src/server.c)
