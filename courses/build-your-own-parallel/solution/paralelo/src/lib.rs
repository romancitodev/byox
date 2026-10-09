pub struct XorShift(u64);

impl XorShift {
  #[must_use]
  pub fn new(seed: u64) -> Self {
    // Con estado 0 los shifts dan siempre 0: cualquier constante distinta sirve.
    XorShift(if seed == 0 { 0x9E37_79B9_7F4A_7C15 } else { seed })
  }
  pub fn next_u64(&mut self) -> u64 {
    let XorShift(state) = self;
    *state ^= *state << 13;
    *state ^= *state >> 7;
    *state ^= *state << 17;
    *state
  }
  /// `n` números en el rango [0, max)
  pub fn vec_i64(&mut self, n: usize, max: i64) -> Vec<i64> {
    (0..n)
      .map(|_| (self.next_u64() % max.cast_unsigned()).cast_signed())
      .collect()
  }
}

/// Corre `f` `times` veces y devuelve el mejor tiempo.
pub fn measure<T>(times: usize, mut f: impl FnMut() -> T) -> std::time::Duration {
  let mut best = std::time::Duration::MAX;
  for _ in 0..times {
    let start = std::time::Instant::now();
    std::hint::black_box(f());
    let end = start.elapsed();
    if end < best {
      best = end;
    }
  }
  best
}
