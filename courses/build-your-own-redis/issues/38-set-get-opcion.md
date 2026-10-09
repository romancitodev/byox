## Objetivo

Con la opción `GET`, `SET` devuelve el valor anterior (o nil) en lugar de `+OK`. Reemplaza al
viejo comando `GETSET`. Se puede combinar con `NX`: si no escribe, igual devuelve lo que había.

## Contrato

`SET k v4 GET` con `k = "v3"` → `$2\r\nv3\r\n` y `k` pasa a `v4`. `SET nueva x GET` → nil.

## Para descubrir

- ¿En qué orden tenés que leer el valor viejo y escribir el nuevo?

## Hecho cuando

- [ ] `sh .course/run.sh 38` pasa.
- [ ] `SET k nuevo NX GET` sobre una clave existente devuelve el valor viejo y no escribe.

## Para leer

- [`SET` en la documentación de Redis](https://redis.io/docs/latest/commands/set/)
