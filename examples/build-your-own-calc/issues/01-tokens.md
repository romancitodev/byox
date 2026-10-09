## Objetivo

Antes de calcular nada hay que leer. Un tokenizer convierte `"12 + 3*(4-1)"` en
`[12, '+', 3, '*', '(', 4, '-', 1, ')']`: los números como `int` y los
operadores y paréntesis como `str`. Los espacios desaparecen.

## Contrato

```python
# calc.py
def tokens(expr: str) -> list[int | str]: ...
```

## Reglas

- Sin `re` ni `eval`.
- Sólo enteros no negativos: `-` siempre es un operador.

## Para descubrir

- ¿Por qué `expr.split()` no alcanza?
- ¿Cómo sabés dónde termina un número de varios dígitos?

## Hecho cuando

- [ ] `tests/test_01.py` pasa.

## Para leer

- [`str.isdigit`](https://docs.python.org/3/library/stdtypes.html#str.isdigit)
- [Análisis léxico](https://en.wikipedia.org/wiki/Lexical_analysis)
