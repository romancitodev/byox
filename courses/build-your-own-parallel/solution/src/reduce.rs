/// Tamaño de cada pedazo para que salgan como mucho `p` pedazos.
pub fn slice_size(n: usize, p: usize) -> usize {
  if n == 0 {
    return 1;
  }
  n.div_ceil(p)
}

/// # Panics
///
/// Da error si `p` es 0.
pub fn slice<T>(a: &[T], p: usize) -> Vec<&[T]> {
  let mut slices = Vec::new();
  assert!(p != 0, "p debe ser mayor que 0");
  let size = slice_size(a.len(), p);
  for chunk in a.chunks(size) {
    if !chunk.is_empty() {
      slices.push(chunk);
    }
  }
  slices
}

/// # Panics
///
/// Da error si `p` es 0.
pub fn parallel_reduce(a: &[i64], p: usize) -> i64 {
  let results = std::thread::scope(|s| {
    let mut threads = Vec::new();
    let slices = slice(a, p);
    for slice in slices {
      let thread = s.spawn(|| slice.iter().sum::<i64>());
      threads.push(thread);
    }
    let mut results = Vec::new();
    for thread in threads {
      results.push(thread.join().expect("hilo debe completarse correctamente"));
    }
    results
  });
  results.iter().sum::<i64>()
}

#[allow(clippy::missing_panics_doc)]
pub fn reduce_with<T, F>(a: &[T], p: usize, neutro: T, op: F) -> T
where
  F: Sync + Fn(T, T) -> T,
  T: Send + Sync + Clone,
{
  let results = std::thread::scope(|s| {
    let mut threads = Vec::new();
    let slices = slice(a, p);
    for slice in slices {
      let thread = s.spawn(|| slice.iter().cloned().fold(neutro.clone(), &op));
      threads.push(thread);
    }
    let mut results = Vec::new();
    for thread in threads {
      results.push(thread.join().expect("hilo debe completarse correctamente"));
    }
    results
  });
  results.into_iter().fold(neutro, &op)
}
