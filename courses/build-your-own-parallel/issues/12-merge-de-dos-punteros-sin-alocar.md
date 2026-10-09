## Objetivo

El merge de las slides, pero escribiendo en un slice que te pasan. Así no se aloca un `Vec` nuevo en cada merge, que en el merge sort serían miles de alocaciones.

## Contrato

En `src/merge.rs`:

```rust
/// Fusiona `a` y `b` (ya ordenados) en `out`.
/// En empate va primero el de `a`.
pub fn merge(a: &[i64], b: &[i64], out: &mut [i64]) {
  todo!()
}
```

## Reglas

- Si `out` no tiene el largo justo, pánico.

## Para descubrir

- ¿Qué hacés si `out.len()` no es `a.len() + b.len()`?
- Cuando un lado se vacía, ¿hay algo mejor que copiar el resto elemento por elemento?

## Hecho cuando

- [ ] `sh .course/run.sh 12` pasa.

**En la guía:** Ejercicio 8 (merge de la teoría)

## Para leer

- [`slice::copy_from_slice`](https://doc.rust-lang.org/std/primitive.slice.html#method.copy_from_slice)
- [Merge algorithm](https://en.wikipedia.org/wiki/Merge_algorithm)
