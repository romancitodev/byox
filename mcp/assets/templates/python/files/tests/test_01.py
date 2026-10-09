import unittest

from wc import count_words


class CountWords(unittest.TestCase):
    def test_simple(self):
        self.assertEqual(count_words("hola mundo"), 2)

    def test_espacios_de_mas(self):
        self.assertEqual(count_words("  el   gato\ty\nel perro  "), 5)

    def test_vacio(self):
        self.assertEqual(count_words(""), 0)
        self.assertEqual(count_words("   \n"), 0)


if __name__ == "__main__":
    unittest.main()
