use crate::reduce::slice_size;

pub fn inclusive_scan(a: &mut [i64]) {
  for i in 1..a.len() {
    a[i] += a[i - 1];
  }
}

pub fn exclusive_scan(a: &mut [i64]) {
  let mut acc = 0;
  (0..a.len()).for_each(|i| {
    let og = std::mem::replace(&mut a[i], acc);
    acc += og;
  });
}

pub fn parallel_scan(a: &mut [i64], p: usize) {
  assert!(p != 0, "p debe ser mayor que 0");
  if a.is_empty() {
    return;
  }
  let size = slice_size(a.len(), p);

  // Fase 1: cada hilo hace el scan de su pedazo y devuelve el total.
  let mut offsets: Vec<i64> = std::thread::scope(|s| {
    let threads: Vec<_> = a
      .chunks_mut(size)
      .map(|chunk| {
        s.spawn(move || {
          inclusive_scan(chunk);
          chunk[chunk.len() - 1]
        })
      })
      .collect();
    threads.into_iter().map(|t| t.join().unwrap()).collect()
  });

  // Fase 2: los offsets son el scan exclusivo de los totales.
  exclusive_scan(&mut offsets);

  // Fase 3: cada hilo le suma su offset. El fin del scope anterior fue la barrera.
  std::thread::scope(|s| {
    for (chunk, &off) in a.chunks_mut(size).zip(&offsets) {
      s.spawn(move || chunk.iter_mut().for_each(|x| *x += off));
    }
  });
}

/// Scan inclusivo con Hillis-Steele, con `p` hilos por paso.
/// Devuelve cuántas sumas hizo, contadas como en el 3c.
pub fn hillis_steele(a: &mut [i64], p: usize) -> usize {
  assert!(p != 0, "p debe ser mayor que 0");
  let n = a.len();
  let size = slice_size(n, p);
  let mut prev = a.to_vec();
  let mut next = vec![0; n];
  let mut sums = 0;
  let mut stride = 1;
  while stride < n {
    let read = &prev;
    std::thread::scope(|s| {
      for (k, chunk) in next.chunks_mut(size).enumerate() {
        s.spawn(move || {
          for (o, x) in chunk.iter_mut().enumerate() {
            let i = k * size + o;
            *x = if i >= stride { read[i] + read[i - stride] } else { read[i] };
          }
        });
      }
    });
    sums += n - stride;
    std::mem::swap(&mut prev, &mut next);
    stride *= 2;
  }
  a.copy_from_slice(&prev);
  sums
}
