## Objetivo

Antes de paralelizar nada te hacen falta dos cosas que en Python venían de fábrica: números aleatorios y una forma de medir en la que puedas confiar. La std de Rust no trae `rand`, así que vas a escribir un generador chiquito (xorshift) y una función que se quede con el mejor de N tiempos.

El workspace ya está armado: `paralelo/` es el crate de utilidades y la raíz (`rustminario`) lo reexporta como `util`. Todo el curso vive acá.

## Contrato

En `paralelo/src/lib.rs`:

```rust
pub struct XorShift(u64);

impl XorShift {
  pub fn new(seed: u64) -> Self {
    todo!()
  }
  pub fn next_u64(&mut self) -> u64 {
    todo!()
  }
  /// `n` números en el rango [0, max)
  pub fn vec_i64(&mut self, n: usize, max: i64) -> Vec<i64> {
    todo!()
  }
}

/// Corre `f` `times` veces y devuelve el mejor tiempo.
pub fn measure<T>(times: usize, f: impl FnMut() -> T) -> std::time::Duration {
  todo!()
}
```

## Reglas

- Solo `std`, sin crates.
- Una semilla 0 no puede dejar el generador trabado.

## Para descubrir

- xorshift64 son tres shifts con xor. Buscá la variante de Marsaglia y fijate qué pasa si el estado arranca en 0.
- Si el resultado de `f` no se usa, en `--release` el compilador puede borrar el cálculo entero y vas a medir cero. ¿Qué hay en `std::hint` para evitarlo?
- ¿Por qué conviene quedarse con el mejor tiempo y no con el promedio?

## Hecho cuando

- [ ] `sh .course/run.sh 1` pasa.

## Para ir más allá (no bloquea)

- Armá un ejemplo que genere 10 millones de números y mida `iter().sum()` en `--release`.

**En la guía:** Ejercicios 5e y 8d

## Para leer

- [`std::hint::black_box`](https://doc.rust-lang.org/std/hint/fn.black_box.html)
- [`std::time::Instant`](https://doc.rust-lang.org/std/time/struct.Instant.html)
- [Marsaglia, *Xorshift RNGs* (2003)](https://www.jstatsoft.org/article/view/v008i14)
