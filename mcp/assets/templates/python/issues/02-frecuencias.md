## Objetivo

Saber cuántas veces aparece cada palabra. Es el primer paso de cualquier índice o buscador.

## Contrato

En `wc.py`:

```python
def word_frequencies(text: str) -> dict[str, int]: ...
```

## Reglas

- `Hola` y `hola` son la misma palabra.

## Hecho cuando

- [ ] `python -m unittest -v tests/test_02.py` pasa.

## Para leer

- [`collections.Counter`](https://docs.python.org/3/library/collections.html#collections.Counter)
