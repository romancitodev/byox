## Objetivo

El ejercicio 6 completo, en Rust. Misma convención del enunciado: la fase impar compara (0,1), (2,3)…, la par compara (1,2), (3,4)…, y el algoritmo corta con una pasada completa sin intercambios.

## Contrato

En `src/oddeven.rs`:

```rust
#[derive(Debug, PartialEq, Eq)]
pub struct Stats {
  /// fase después de la cual quedó ordenado (0 si ya venía ordenado)
  pub sorted_at_phase: usize,
  pub phases_run: usize,
  pub swaps: usize,
}

pub fn inversions(a: &[i64]) -> usize {
  todo!()
}

pub fn brick_sort(a: &mut [i64]) -> Stats {
  todo!()
}
```

## Reglas

- Tiene que funcionar con el arreglo vacío.

## Para descubrir

- ¿Cuántas fases ejecuta con un arreglo que ya viene ordenado?
- `a.swap(i, i + 1)` existe. ¿Por qué Rust te lo da como método en vez de dejarte hacer `(a[i], a[i+1]) = (a[i+1], a[i])` con dos préstamos?

## Hecho cuando

- [ ] `sh .course/run.sh 9` pasa.

## Para ir más allá (no bloquea)

- Chequeá que los números coincidan con los de tu entrega.

**En la guía:** Ejercicio 6

## Para leer

- [Odd–even sort](https://en.wikipedia.org/wiki/Odd%E2%80%93even_sort)
- [`slice::swap`](https://doc.rust-lang.org/std/primitive.slice.html#method.swap)
- [`slice::windows`](https://doc.rust-lang.org/std/primitive.slice.html#method.windows)
