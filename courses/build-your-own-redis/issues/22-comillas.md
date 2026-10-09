## Objetivo

¿Y si un argumento inline tiene espacios? Redis usa las reglas de `sdssplitargs`: entre comillas
dobles se aceptan escapes (`\n`, `\x41`); entre simples, solo `\'`. Si las comillas no cierran, es
un error de protocolo: Redis responde y cierra la conexión.

## Contrato

`ECHO "hola mundo"` → `hola mundo`. `ECHO "\x41\x42"` → `AB`. `ECHO 'a\nb'` → `a\nb` literal.
`ECHO "abc` → `-ERR Protocol error: unbalanced quotes in request` y la conexión se cierra.

## Reglas

- Los mensajes de error son exactamente los de Redis: los tests comparan el texto.

## Para descubrir

- ¿Por qué después de una comilla de cierre tiene que venir un espacio o el final?
- ¿Por qué Redis cierra la conexión después de un error de protocolo en vez de seguir?

## Hecho cuando

- [ ] `sh .course/run.sh 22` pasa.
- [ ] `ECHO "abc"def` también es un error de comillas, como en Redis.

## Para leer

- [Redis, `sds.c`: `sdssplitargs`](https://github.com/redis/redis/blob/unstable/src/sds.c)
- [Redis, `networking.c`: `processMultibulkBuffer` y `processInlineBuffer`](https://github.com/redis/redis/blob/unstable/src/networking.c)
