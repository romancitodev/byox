## Objetivo

Contar las palabras de un texto, como hace `wc -w`. Es la base de todo lo que sigue.

## Contrato

En `wc.py`:

```python
def count_words(text: str) -> int: ...
```

## Para descubrir

- ¿Qué pasa con dos espacios seguidos? ¿Y con un texto vacío?
- ¿Un tab o un salto de línea separan palabras?

## Hecho cuando

- [ ] `python -m unittest -v tests/test_01.py` pasa.

## Para leer

- [`str.split`](https://docs.python.org/3/library/stdtypes.html#str.split)
