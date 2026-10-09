## Objetivo

Redis es *binary safe*: una clave o un valor puede tener cualquier byte, incluso `\r\n` o `\0`.
Es lo que permite guardar imágenes o datos serializados. Si tu parser busca `\r\n` para saber dónde
termina el contenido, acá se rompe.

## Contrato

`$6\r\na\r\nb\x00c\r\n` → `Value::Bulk(b"a\r\nb\x00c")`, 12 bytes.

## Reglas

- El contenido no se convierte a `String`: es `Vec<u8>`.

## Para descubrir

- Si el contenido puede tener `\r\n`, ¿qué es lo único confiable para saber dónde termina?

## Hecho cuando

- [ ] `sh .course/run.sh 5` pasa.
- [ ] Bytes que no son UTF-8 válido (`\xff`) llegan intactos.

## Para leer

- [La especificación de RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/)
