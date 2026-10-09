use rustminario::oddeven::{barrier_brick_sort, brick_sort};
use rustminario::util::XorShift;

#[test]
fn mismas_stats_que_el_secuencial() {
  let mut r = XorShift::new(11);
  for n in [0, 1, 2, 8, 50] {
    for p in [1, 2, 4] {
      let mut a = r.vec_i64(n, 100);
      let mut b = a.clone();
      assert_eq!(barrier_brick_sort(&mut a, p), brick_sort(&mut b), "n={n} p={p}");
      assert_eq!(a, b);
    }
  }
}
