use rustminario::scan::{inclusive_scan, parallel_scan};
use rustminario::util::XorShift;

#[test]
fn ejercicio_3() {
  let mut a = [4, 1, 3, 2, 6, 0, 5, 2];
  parallel_scan(&mut a, 2);
  assert_eq!(a, [4, 5, 8, 10, 16, 16, 21, 23]);
}

#[test]
fn coincide_con_secuencial() {
  let mut r = XorShift::new(3);
  for n in [0, 1, 2, 7, 100, 1001] {
    for p in [1, 2, 3, 4, 8] {
      let mut a = r.vec_i64(n, 50);
      let mut b = a.clone();
      parallel_scan(&mut a, p);
      inclusive_scan(&mut b);
      assert_eq!(a, b, "n={n} p={p}");
    }
  }
}
