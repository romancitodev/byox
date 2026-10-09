pub struct XorShift(u64);

impl XorShift {
  pub fn new(seed: u64) -> Self {
    todo!()
  }
  pub fn next_u64(&mut self) -> u64 {
    todo!()
  }
  /// `n` números en el rango [0, max)
  pub fn vec_i64(&mut self, n: usize, max: i64) -> Vec<i64> {
    todo!()
  }
}

/// Corre `f` `times` veces y devuelve el mejor tiempo.
pub fn measure<T>(times: usize, f: impl FnMut() -> T) -> std::time::Duration {
  todo!()
}
