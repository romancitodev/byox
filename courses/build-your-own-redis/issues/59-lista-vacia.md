## Objetivo

En Redis no hay listas vacías: cuando se saca el último elemento, la clave desaparece. Esto
simplifica todo el resto, porque "la clave existe" siempre implica "tiene algo adentro".

## Contrato

Después de sacar todos los elementos, por la punta que sea o con `COUNT`, `EXISTS l` → `:0`.

## Reglas

- Revisá todos los comandos que sacan elementos: los de ahora y los que vengan.

## Para descubrir

- ¿Dónde conviene chequear si quedó vacía: en cada comando o en un solo lugar?

## Hecho cuando

- [ ] `sh .course/run.sh 59` pasa.
- [ ] `EXISTS` da 0 justo después de sacar el último elemento.

## Para leer

- [Creación y borrado automático de claves](https://redis.io/docs/latest/develop/data-types/lists/#automatic-creation-and-removal-of-keys)
