import unittest

from calc import tokens


class TestErrores(unittest.TestCase):
    def test_caracter_invalido(self):
        with self.assertRaises(ValueError) as ctx:
            tokens("2 $ 3")
        self.assertIn("'$'", str(ctx.exception))
        self.assertIn("posición 2", str(ctx.exception))

    def test_al_final(self):
        with self.assertRaises(ValueError) as ctx:
            tokens("1+1x")
        self.assertIn("posición 3", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
