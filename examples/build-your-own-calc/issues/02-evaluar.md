## Objetivo

Con los tokens listos, calculá el resultado respetando la precedencia (`*` y `/`
antes que `+` y `-`), los paréntesis y la asociatividad a izquierda.

## Contrato

```python
# calc.py
def evaluar(expr: str) -> float: ...
```

## Reglas

- Sin `eval`.
- `/` es división real: `7/2` da `3.5`.

## Para descubrir

- `2+3*4` da 14 y no 20. ¿Qué tiene que pasar para que el `*` "se adelante"?
- `8-3-2` da 3. Si lo resolvés con recursión a la derecha, ¿cuánto te da?

## Hecho cuando

- [ ] `tests/test_02.py` pasa.

## Para leer

- [Parser descendente recursivo](https://en.wikipedia.org/wiki/Recursive_descent_parser)
- [Precedencia de operadores en Python](https://docs.python.org/3/reference/expressions.html#operator-precedence)
