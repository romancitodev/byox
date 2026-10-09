use rustminario::rayon_bonus::{rayon_merge_sort, rayon_reduce};
use rustminario::util::XorShift;

#[test]
fn reduccion() {
  let a = XorShift::new(1).vec_i64(100_000, 1000);
  assert_eq!(rayon_reduce(&a), a.iter().sum::<i64>());
}

#[test]
fn ordena() {
  let mut a = XorShift::new(2).vec_i64(100_000, 1_000_000);
  let mut b = a.clone();
  rayon_merge_sort(&mut a);
  b.sort_unstable();
  assert_eq!(a, b);
}
