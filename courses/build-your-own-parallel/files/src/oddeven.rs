// #9: odd-even secuencial

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

// #10: una fase, un scope

pub fn parallel_brick_sort(a: &mut [i64], p: usize) -> Stats {
  todo!()
}

// #11: hilos que viven toda la ordenación

pub fn barrier_brick_sort(a: &mut [i64], p: usize) -> Stats {
  todo!()
}
