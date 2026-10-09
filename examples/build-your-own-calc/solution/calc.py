OPS = "+-*/()"


def tokens(expr: str) -> list[int | str]:
    """"12 + 3*(4-1)" -> [12, '+', 3, '*', '(', 4, '-', 1, ')']"""
    out: list[int | str] = []
    i = 0
    while i < len(expr):
        c = expr[i]
        if c.isspace():
            i += 1
        elif c.isdigit():
            j = i
            while j < len(expr) and expr[j].isdigit():
                j += 1
            out.append(int(expr[i:j]))
            i = j
        elif c in OPS:
            out.append(c)
            i += 1
        else:
            raise ValueError(f"carácter inesperado {c!r} en la posición {i}")
    return out


def evaluar(expr: str) -> float:
    """Evalúa la expresión respetando precedencia y paréntesis."""
    toks = tokens(expr)
    pos = 0

    def peek():
        return toks[pos] if pos < len(toks) else None

    def take():
        nonlocal pos
        pos += 1
        return toks[pos - 1]

    def suma():
        v = producto()
        while peek() in ("+", "-"):
            v = v + producto() if take() == "+" else v - producto()
        return v

    def producto():
        v = atomo()
        while peek() in ("*", "/"):
            v = v * atomo() if take() == "*" else v / atomo()
        return v

    def atomo():
        t = take()
        if t == "(":
            v = suma()
            take()
            return v
        return t

    return suma()
