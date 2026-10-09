use rustminario::oddeven::{brick_sort, parallel_brick_sort};
use rustminario::util::XorShift;

#[test]
fn mismas_stats_que_el_secuencial() {
  let mut r = XorShift::new(5);
  for n in [0, 1, 2, 3, 8, 31, 200] {
    for p in [1, 2, 3, 4, 8] {
      let mut a = r.vec_i64(n, 1000);
      let mut b = a.clone();
      let sp = parallel_brick_sort(&mut a, p);
      let ss = brick_sort(&mut b);
      assert_eq!(a, b);
      assert_eq!(sp, ss, "n={n} p={p}");
    }
  }
}
