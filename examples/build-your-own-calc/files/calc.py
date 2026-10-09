def tokens(expr: str) -> list[int | str]:
    """"12 + 3*(4-1)" -> [12, '+', 3, '*', '(', 4, '-', 1, ')']"""
    raise NotImplementedError


def evaluar(expr: str) -> float:
    """Evalúa la expresión respetando precedencia y paréntesis."""
    raise NotImplementedError
