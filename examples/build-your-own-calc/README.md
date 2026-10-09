# 🧮 build-your-own-calc

Una calculadora de expresiones en Python, del texto crudo al resultado. Sin `eval`.

```pycon
>>> from calc import evaluar, tokens
>>> evaluar("12 + 3*(4-1)")
21
>>> evaluar("7/2")
3.5
>>> tokens("2 $ 3")
ValueError: carácter inesperado '$' en la posición 2
```

## Qué vas a aprender

- Cómo un tokenizer convierte texto en piezas con significado.
- Por qué un parser descendente recursivo resuelve la precedencia sin esfuerzo extra.
- A reportar errores con posición, como un compilador.

## Antes de arrancar

- Python 3.13 y saber escribir funciones y loops.
- Unos 30 minutos para *Tokens* y una hora para *Evaluar*.

## Créditos

La estructura sigue los capítulos 4 y 6 de [Crafting Interpreters](https://craftinginterpreters.com/), de Robert Nystrom.
