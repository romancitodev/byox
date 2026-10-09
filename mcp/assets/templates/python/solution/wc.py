from collections import Counter


def count_words(text: str) -> int:
    """Cuántas palabras tiene `text`. Ver issue #1."""
    return len(text.split())


def word_frequencies(text: str) -> dict[str, int]:
    """Cuántas veces aparece cada palabra, sin distinguir mayúsculas. Ver issue #2."""
    return dict(Counter(w.lower() for w in text.split()))
