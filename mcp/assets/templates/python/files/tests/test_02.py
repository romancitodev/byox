import unittest

from wc import word_frequencies


class WordFrequencies(unittest.TestCase):
    def test_cuenta_repetidas(self):
        self.assertEqual(word_frequencies("el gato y el perro"), {"el": 2, "gato": 1, "y": 1, "perro": 1})

    def test_sin_distinguir_mayusculas(self):
        self.assertEqual(word_frequencies("Hola hola HOLA"), {"hola": 3})

    def test_vacio(self):
        self.assertEqual(word_frequencies(""), {})


if __name__ == "__main__":
    unittest.main()
