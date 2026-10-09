## Objetivo

Un carácter inválido tiene que dar un error que diga **qué** carácter y **dónde**,
como hacen los compiladores.

## Contrato

`tokens("2 $ 3")` lanza `ValueError` y el mensaje contiene `'$'` y `posición 2`.

## Reglas

- La posición es el índice dentro del string, empezando en 0.

## Para descubrir

- ¿Qué excepción de la librería estándar describe mejor "el valor que me pasaste está mal"?

## Hecho cuando

- [ ] `tests/test_03.py` pasa.

## Para leer

- [`ValueError`](https://docs.python.org/3/library/exceptions.html#ValueError)
