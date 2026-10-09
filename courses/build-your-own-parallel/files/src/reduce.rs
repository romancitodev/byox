// #2: partir sin copiar

/// Tamaño de cada pedazo para que salgan como mucho `p` pedazos.
pub fn slice_size(n: usize, p: usize) -> usize {
  todo!()
}

pub fn slice(a: &[i64], p: usize) -> Vec<&[i64]> {
  todo!()
}

// #3: reducción con hilos

pub fn parallel_reduce(a: &[i64], p: usize) -> i64 {
  todo!()
}

// #4: cualquier operación asociativa

pub fn reduce_with<T, F>(a: &[T], p: usize, neutro: T, op: F) -> T
where
  F: Fn(T, T) -> T, // le falta algo para poder usarse desde varios hilos
  // ¿y T? Completalo vos.
{
  todo!()
}
