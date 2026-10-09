use rustminario::merge::{cut, merge, parallel_merge};
use rustminario::util::XorShift;

#[test]
fn corte_del_7d() {
  let a = [2, 5, 8, 9, 14];
  let b = [1, 5, 7, 10, 12];
  assert_eq!(cut(&a, &b, 5), (2, 3));
  assert_eq!(cut(&a, &b, 0), (0, 0));
  assert_eq!(cut(&a, &b, 10), (5, 5));
}

#[test]
fn igual_que_merge() {
  let mut r = XorShift::new(8);
  for p in [1, 2, 3, 4, 8] {
    for _ in 0..20 {
      let mut a = r.vec_i64(40, 6);
      let mut b = r.vec_i64(33, 6);
      a.sort();
      b.sort();
      let mut esperado = vec![0; 73];
      merge(&a, &b, &mut esperado);
      let mut out = vec![0; 73];
      parallel_merge(&a, &b, &mut out, p);
      assert_eq!(out, esperado, "p={p}");
    }
  }
}
