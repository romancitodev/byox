use std::sync::Barrier;
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicUsize, Ordering::Relaxed};

#[derive(Debug, PartialEq, Eq)]
pub struct Stats {
  /// fase después de la cual quedó ordenado (0 si ya venía ordenado)
  pub sorted_at_phase: usize,
  pub phases_run: usize,
  pub swaps: usize,
}

fn is_sorted(a: &[i64]) -> bool {
  a.windows(2).all(|w| w[0] <= w[1])
}

pub fn inversions(a: &[i64]) -> usize {
  (0..a.len()).map(|i| a[i + 1..].iter().filter(|&&x| x < a[i]).count()).sum()
}

/// Lleva la cuenta de las fases. Corta tras una pasada completa
/// (una fase impar y una par seguidas) sin intercambios.
struct Tracker {
  stats: Stats,
  found: bool,
  quiet: usize,
}

impl Tracker {
  fn new(a: &[i64]) -> Self {
    Tracker { stats: Stats { sorted_at_phase: 0, phases_run: 0, swaps: 0 }, found: is_sorted(a), quiet: 0 }
  }
  fn done(&self) -> bool {
    self.quiet >= 2
  }
  /// La fase impar (1, 3, …) arranca en 0; la par, en 1.
  fn start(&self) -> usize {
    self.stats.phases_run % 2
  }
  fn record(&mut self, swaps: usize, sorted: impl FnOnce() -> bool) {
    self.stats.phases_run += 1;
    self.stats.swaps += swaps;
    self.quiet = if swaps == 0 { self.quiet + 1 } else { 0 };
    if !self.found && sorted() {
      self.found = true;
      self.stats.sorted_at_phase = self.stats.phases_run;
    }
  }
}

pub fn brick_sort(a: &mut [i64]) -> Stats {
  let mut t = Tracker::new(a);
  while !t.done() {
    let mut swaps = 0;
    let mut i = t.start();
    while i + 1 < a.len() {
      if a[i] > a[i + 1] {
        a.swap(i, i + 1);
        swaps += 1;
      }
      i += 2;
    }
    t.record(swaps, || is_sorted(a));
  }
  t.stats
}

pub fn parallel_brick_sort(a: &mut [i64], p: usize) -> Stats {
  assert!(p != 0, "p debe ser mayor que 0");
  let mut t = Tracker::new(a);
  while !t.done() {
    let start = t.start();
    let swaps = if start < a.len() {
      let tail = &mut a[start..];
      // bloques de 2k: ningún par queda cortado entre dos hilos
      let k = (tail.len() / 2).div_ceil(p).max(1);
      std::thread::scope(|s| {
        let threads: Vec<_> = tail
          .chunks_mut(2 * k)
          .map(|block| {
            s.spawn(move || {
              let mut c = 0;
              for pair in block.chunks_exact_mut(2) {
                if pair[0] > pair[1] {
                  pair.swap(0, 1);
                  c += 1;
                }
              }
              c
            })
          })
          .collect();
        threads.into_iter().map(|h| h.join().unwrap()).sum()
      })
    } else {
      0
    };
    t.record(swaps, || is_sorted(a));
  }
  t.stats
}

pub fn barrier_brick_sort(a: &mut [i64], p: usize) -> Stats {
  assert!(p != 0, "p debe ser mayor que 0");
  let n = a.len();
  let v: Vec<AtomicI64> = a.iter().map(|&x| AtomicI64::new(x)).collect();
  let barrier = Barrier::new(p);
  let swaps: Vec<AtomicUsize> = (0..p).map(|_| AtomicUsize::new(0)).collect();
  let done = AtomicBool::new(false);
  // Sin Mutex: el estado lo escribe sólo el líder, entre dos barreras.
  let phases = AtomicUsize::new(0);
  let total = AtomicUsize::new(0);
  let quiet = AtomicUsize::new(0);
  let sorted_at = AtomicUsize::new(0);
  let found = AtomicBool::new(is_sorted(a));

  std::thread::scope(|s| {
    for k in 0..p {
      let (v, barrier, swaps, done) = (&v, &barrier, &swaps, &done);
      let (phases, total, quiet, sorted_at, found) = (&phases, &total, &quiet, &sorted_at, &found);
      s.spawn(move || {
        let mut phase = 0;
        loop {
          // Cada hilo toca los pares k, k + p, k + 2p… de esta fase.
          let start = phase % 2;
          let mut c = 0;
          let mut j = k;
          while start + 2 * j + 1 < n {
            let i = start + 2 * j;
            let (x, y) = (v[i].load(Relaxed), v[i + 1].load(Relaxed));
            if x > y {
              v[i].store(y, Relaxed);
              v[i + 1].store(x, Relaxed);
              c += 1;
            }
            j += p;
          }
          swaps[k].store(c, Relaxed);

          // La barrera sincroniza la memoria: Relaxed alcanza.
          if barrier.wait().is_leader() {
            let c: usize = swaps.iter().map(|x| x.load(Relaxed)).sum();
            let phase_no = phases.fetch_add(1, Relaxed) + 1;
            total.fetch_add(c, Relaxed);
            let q = if c == 0 { quiet.load(Relaxed) + 1 } else { 0 };
            quiet.store(q, Relaxed);
            if !found.load(Relaxed) && v.windows(2).all(|w| w[0].load(Relaxed) <= w[1].load(Relaxed)) {
              found.store(true, Relaxed);
              sorted_at.store(phase_no, Relaxed);
            }
            done.store(q >= 2, Relaxed);
          }
          barrier.wait();
          if done.load(Relaxed) {
            break;
          }
          phase += 1;
        }
      });
    }
  });

  for (x, y) in a.iter_mut().zip(&v) {
    *x = y.load(Relaxed);
  }
  Stats {
    sorted_at_phase: sorted_at.into_inner(),
    phases_run: phases.into_inner(),
    swaps: total.into_inner(),
  }
}
