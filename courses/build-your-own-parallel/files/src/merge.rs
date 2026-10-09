// #12: merge sin alocar

/// Fusiona `a` y `b` (ya ordenados) en `out`.
/// En empate va primero el de `a`.
pub fn merge(a: &[i64], b: &[i64], out: &mut [i64]) {
  todo!()
}

// #13: merge sort paralelo

/// Ordena `a` con `p` hilos. Devuelve cuántos merges hubo en cada ronda,
/// como el `[2, 1]` de tu Python con P = 4.
pub fn parallel_merge_sort(a: &mut [i64], p: usize) -> Vec<usize> {
  todo!()
}

// #14: merge por rango

/// Merge del 7a: cada elemento calcula su posición con búsqueda binaria.
pub fn merge_by_rank(a: &[i64], b: &[i64]) -> Vec<i64> {
  todo!()
}

// #15: merge paralelo con pivote

/// Devuelve (i, j) con i + j == k tal que los primeros k elementos
/// del merge son a[..i] y b[..j]. En empate van primero los de `a`.
pub fn cut(a: &[i64], b: &[i64], k: usize) -> (usize, usize) {
  todo!()
}

/// Merge de `a` y `b` en `out`, repartido entre `p` hilos.
pub fn parallel_merge(a: &[i64], b: &[i64], out: &mut [i64], p: usize) {
  todo!()
}
