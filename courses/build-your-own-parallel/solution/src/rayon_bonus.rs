use rayon::prelude::*;

use crate::merge::merge;

/// Por debajo de esto, `sort_unstable` gana a seguir partiendo.
const CUTOFF: usize = 4096;

pub fn rayon_reduce(a: &[i64]) -> i64 {
  // El neutro es una closure: rayon decide cuántos acumuladores crea.
  a.par_iter().copied().reduce(|| 0, |x, y| x + y)
}

pub fn rayon_merge_sort(a: &mut [i64]) {
  let mut buf = vec![0; a.len()];
  sort(a, &mut buf);
}

fn sort(a: &mut [i64], buf: &mut [i64]) {
  if a.len() <= CUTOFF {
    a.sort_unstable();
    return;
  }
  let mid = a.len() / 2;
  {
    let (left, right) = a.split_at_mut(mid);
    let (bl, br) = buf.split_at_mut(mid);
    rayon::join(|| sort(left, bl), || sort(right, br));
  }
  merge(&a[..mid], &a[mid..], buf);
  a.copy_from_slice(buf);
}
