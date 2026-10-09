use crate::reduce::slice_size;

/// Fusiona `a` y `b` (ya ordenados) en `out`.
/// En empate va primero el de `a`.
pub fn merge(a: &[i64], b: &[i64], out: &mut [i64]) {
  assert_eq!(out.len(), a.len() + b.len(), "out tiene que medir a.len() + b.len()");
  let (mut i, mut j, mut k) = (0, 0, 0);
  while i < a.len() && j < b.len() {
    if a[i] <= b[j] {
      out[k] = a[i];
      i += 1;
    } else {
      out[k] = b[j];
      j += 1;
    }
    k += 1;
  }
  out[k..k + a.len() - i].copy_from_slice(&a[i..]);
  out[k + a.len() - i..].copy_from_slice(&b[j..]);
}

/// Una ronda del árbol: fusiona de a pares los pedazos de `src` delimitados
/// por `bounds` y los escribe en `dst`. Devuelve los nuevos límites y cuántos merges hizo.
fn round(src: &[i64], dst: &mut [i64], bounds: &[usize]) -> (Vec<usize>, usize) {
  let runs = bounds.len() - 1;
  let mut next = vec![bounds[0]];
  let mut merges = 0;
  std::thread::scope(|s| {
    let mut rest = dst;
    let mut r = 0;
    while r < runs {
      let lo = bounds[r];
      if r + 1 < runs {
        let (mid, hi) = (bounds[r + 1], bounds[r + 2]);
        let (head, tail) = std::mem::take(&mut rest).split_at_mut(hi - lo);
        rest = tail;
        let (x, y) = (&src[lo..mid], &src[mid..hi]);
        s.spawn(move || merge(x, y, head));
        next.push(hi);
        merges += 1;
        r += 2;
      } else {
        // el pedazo que sobra pasa directo
        let hi = bounds[r + 1];
        let (head, tail) = std::mem::take(&mut rest).split_at_mut(hi - lo);
        rest = tail;
        head.copy_from_slice(&src[lo..hi]);
        next.push(hi);
        r += 1;
      }
    }
  });
  (next, merges)
}

/// Ordena `a` con `p` hilos. Devuelve cuántos merges hubo en cada ronda,
/// como el `[2, 1]` de tu Python con P = 4.
pub fn parallel_merge_sort(a: &mut [i64], p: usize) -> Vec<usize> {
  assert!(p != 0, "p debe ser mayor que 0");
  let n = a.len();
  let size = slice_size(n, p);
  std::thread::scope(|s| {
    for chunk in a.chunks_mut(size) {
      s.spawn(move || chunk.sort_unstable());
    }
  });

  let mut bounds: Vec<usize> = (0..n).step_by(size).chain([n]).collect();
  let mut aux = vec![0; n];
  let mut in_a = true;
  let mut rounds = Vec::new();
  // ping-pong entre `a` y `aux`
  while bounds.len() > 2 {
    let (next, merges) = if in_a { round(a, &mut aux, &bounds) } else { round(&aux, a, &bounds) };
    bounds = next;
    rounds.push(merges);
    in_a = !in_a;
  }
  if !in_a {
    a.copy_from_slice(&aux);
  }
  rounds
}

/// Merge del 7a: cada elemento calcula su posición con búsqueda binaria.
pub fn merge_by_rank(a: &[i64], b: &[i64]) -> Vec<i64> {
  let mut out = vec![0; a.len() + b.len()];
  for (i, &x) in a.iter().enumerate() {
    out[i + b.partition_point(|&y| y < x)] = x;
  }
  for (j, &y) in b.iter().enumerate() {
    out[j + a.partition_point(|&x| x <= y)] = y;
  }
  out
}

/// Devuelve (i, j) con i + j == k tal que los primeros k elementos
/// del merge son a[..i] y b[..j]. En empate van primero los de `a`.
pub fn cut(a: &[i64], b: &[i64], k: usize) -> (usize, usize) {
  let (mut lo, mut hi) = (k.saturating_sub(b.len()), k.min(a.len()));
  loop {
    let i = lo + (hi - lo) / 2;
    let j = k - i;
    if i > 0 && j < b.len() && a[i - 1] > b[j] {
      hi = i - 1; // demasiados de `a`
    } else if j > 0 && i < a.len() && b[j - 1] >= a[i] {
      lo = i + 1; // muy pocos de `a`
    } else {
      return (i, j);
    }
  }
}

/// Merge de `a` y `b` en `out`, repartido entre `p` hilos.
pub fn parallel_merge(a: &[i64], b: &[i64], out: &mut [i64], p: usize) {
  assert!(p != 0, "p debe ser mayor que 0");
  assert_eq!(out.len(), a.len() + b.len(), "out tiene que medir a.len() + b.len()");
  let total = out.len();
  let cuts: Vec<(usize, usize)> = (0..=p).map(|t| cut(a, b, t * total / p)).collect();
  std::thread::scope(|s| {
    let mut rest = out;
    for w in cuts.windows(2) {
      let ((i0, j0), (i1, j1)) = (w[0], w[1]);
      let (head, tail) = std::mem::take(&mut rest).split_at_mut(i1 - i0 + j1 - j0);
      rest = tail;
      let (x, y) = (&a[i0..i1], &b[j0..j1]);
      s.spawn(move || merge(x, y, head));
    }
  });
}
