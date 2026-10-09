## Objetivo

El 7a en código: la posición final de `A[i]` es `i` más cuántos de `B` son menores, y la de `B[j]` es `j` más cuántos de `A` son menores o iguales. Cada elemento calcula la suya sin mirar a los demás.

## Contrato

En `src/merge.rs`:

```rust
/// Merge del 7a: cada elemento calcula su posición con búsqueda binaria.
pub fn merge_by_rank(a: &[i64], b: &[i64]) -> Vec<i64> {
  todo!()
}
```

## Reglas

- Usá búsqueda binaria, no un recorrido lineal.

## Para descubrir

- `partition_point` hace la búsqueda binaria por vos. ¿Qué predicado le pasás para "menores que x"? ¿Y para "menores o iguales"?
- Rompelo a propósito: usá el mismo predicado en los dos lados y corré el test de repetidos. Es el 7b en vivo.
- Para pensar: cada posición se puede calcular en paralelo, pero escribir el resultado no es tan fácil. ¿Por qué acá no podés repartir `out` con `chunks_mut` como en los otros pasos?

## Hecho cuando

- [ ] `sh .course/run.sh 14` pasa.

## Para ir más allá (no bloquea)

- Rompé la asimetría a propósito y mirá cómo falla el test de repetidos.

**En la guía:** Ejercicios 7a, 7b y 7c

## Para leer

- [`slice::partition_point`](https://doc.rust-lang.org/std/primitive.slice.html#method.partition_point)
