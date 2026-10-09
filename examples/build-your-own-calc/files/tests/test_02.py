import unittest

from calc import evaluar


class TestEvaluar(unittest.TestCase):
    def test_precedencia(self):
        self.assertEqual(evaluar("2+3*4"), 14)
        self.assertEqual(evaluar("2*3+4"), 10)

    def test_parentesis(self):
        self.assertEqual(evaluar("(2+3)*4"), 20)
        self.assertEqual(evaluar("12 + 3*(4-1)"), 21)

    def test_asociatividad_izquierda(self):
        self.assertEqual(evaluar("8-3-2"), 3)
        self.assertEqual(evaluar("16/4/2"), 2)

    def test_division_real(self):
        self.assertEqual(evaluar("7/2"), 3.5)


if __name__ == "__main__":
    unittest.main()
