use std::num::NonZero;
// examples/reduccion.rs  ->  cargo run --release --example reduccion
use std::thread::available_parallelism;
use std::time::Duration;

use rustminario::reduce::parallel_reduce;
use rustminario::util::{XorShift, measure};

fn main() {
  let hilos = available_parallelism().map_or(1, NonZero::get);
  println!("hilos disponibles: {hilos}\n");

  // p = 1, 2, 4, 8 y los hilos de la máquina (sin repetir)
  let mut ps = vec![1, 2, 4, 8];
  if !ps.contains(&hilos) {
    ps.push(hilos);
  }

  let mut rng = XorShift::new(42);

  // encabezado de la tabla
  print!("{:>12} {:>12}", "n", "iter().sum");
  for p in &ps {
    print!(" {:>20}", format!("p = {p}"));
  }
  println!();

  for n in [1_000, 1_000_000, 50_000_000] {
    // se genera adentro del loop: así nunca hay más de un arreglo grande en memoria
    let data = rng.vec_i64(n, 1_000_000);
    let veces = if n >= 10_000_000 { 10 } else { 100 };

    let base = measure(veces, || data.iter().sum::<i64>());
    print!("{n:>12} {:>12}", fmt(base));

    for &p in &ps {
      let t = measure(veces, || parallel_reduce(&data, p));
      let speedup = base.as_secs_f64() / t.as_secs_f64();
      print!(" {:>20}", format!("{} ({speedup:.2}x)", fmt(t)));
    }
    println!();
  }
}

fn fmt(d: Duration) -> String {
  let us = d.as_secs_f64() * 1e6;
  if us < 1000.0 {
    format!("{us:.1} µs")
  } else {
    format!("{:.2} ms", us / 1000.0)
  }
}
