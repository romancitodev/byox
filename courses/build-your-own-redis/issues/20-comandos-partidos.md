## Objetivo

Lo contrario del pipelining: un comando que llega en varios pedazos, incluso de a un byte. Tu
servidor tiene que esperar a tener el comando completo sin responder antes de tiempo ni
descartar lo que ya llegó.

## Contrato

Medio comando no recibe respuesta; cuando llega el resto, sí. Un comando mandado byte por byte
se responde una vez, al final.

## Para descubrir

- Si `parse` devuelve `Ok(None)`, ¿qué tiene que pasar con los bytes que ya leíste?

## Hecho cuando

- [ ] `sh .course/run.sh 20` pasa.
- [ ] El buffer acumula entre lecturas.

## Para leer

- [mini-redis, `connection.rs`: leer frames de un socket](https://github.com/tokio-rs/mini-redis/blob/master/src/connection.rs)
- [Redis, `networking.c`: `processMultibulkBuffer` y `processInlineBuffer`](https://github.com/redis/redis/blob/unstable/src/networking.c)
