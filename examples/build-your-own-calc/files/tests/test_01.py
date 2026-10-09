import unittest

from calc import tokens


class TestTokens(unittest.TestCase):
    def test_ejemplo(self):
        self.assertEqual(tokens("12 + 3*(4-1)"), [12, "+", 3, "*", "(", 4, "-", 1, ")"])

    def test_sin_espacios_y_con_muchos(self):
        self.assertEqual(tokens("7/2"), [7, "/", 2])
        self.assertEqual(tokens("   42   "), [42])

    def test_vacio(self):
        self.assertEqual(tokens(""), [])

    def test_numeros_son_int(self):
        self.assertIsInstance(tokens("100")[0], int)


if __name__ == "__main__":
    unittest.main()
