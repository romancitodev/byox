## Objetivo

El método del pivote del 7d, generalizado: partís la salida en `p` tramos iguales y para cada borde buscás cuántos elementos aporta `a` y cuántos `b`. Después cada hilo hace un merge común de su tramo. Con esto, la última ronda del #13 deja de ser de un solo hilo.

## Contrato

En `src/merge.rs`:

```rust
/// Devuelve (i, j) con i + j == k tal que los primeros k elementos
/// del merge son a[..i] y b[..j]. En empate van primero los de `a`.
pub fn cut(a: &[i64], b: &[i64], k: usize) -> (usize, usize) {
  todo!()
}

/// Merge de `a` y `b` en `out`, repartido entre `p` hilos.
pub fn parallel_merge(a: &[i64], b: &[i64], out: &mut [i64], p: usize) {
  todo!()
}
```

## Reglas

- `cut` tiene que ser O(log n).
- Cada hilo usa tu `merge` del #12.

## Para descubrir

- En el 7d probaste valores de x hasta que quedaron 5 de cada lado. ¿Podés buscar directamente cuántos elementos de `a` van en los primeros k, en vez de buscar x?
- Si fijás `i`, entonces `j = k - i`. ¿Qué dos comparaciones te dicen si te pasaste o te quedaste corto?
- ¿Entre qué valores puede estar `i`? Ojo cuando `k` es más grande que el largo de `b`.

## Hecho cuando

- [ ] `sh .course/run.sh 15` pasa.

## Para ir más allá (no bloquea)

- Usá `parallel_merge` en las rondas del #13 y volvé a medir. ¿Cuánto mejoró la última ronda?

**En la guía:** Ejercicios 7d y 8c

## Para leer

- [Merge algorithm: parallel merge](https://en.wikipedia.org/wiki/Merge_algorithm#Parallel_merge)
