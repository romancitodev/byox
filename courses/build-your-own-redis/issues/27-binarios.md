## Objetivo

Una clave puede ser `\x00clave\r\n` y un valor puede tener cualquier byte. Si en algún lugar
convertiste a `String` o buscaste separadores, acá aparece el problema.

## Contrato

Lo que se guarda con `SET` vuelve idéntico con `GET`, byte por byte. Un valor vacío existe y no
es nil.

## Para descubrir

- ¿En qué partes de tu código hay un `String` o un `&str`? ¿Alguna toca claves o valores?

## Hecho cuando

- [ ] `sh .course/run.sh 27` pasa.
- [ ] `SET vacia ""` y `GET vacia` devuelve `$0\r\n\r\n`.

## Para leer

- [Claves en Redis: cualquier secuencia binaria](https://redis.io/docs/latest/develop/use/keyspace/)
