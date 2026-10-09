use rustminario::merge::{merge, merge_by_rank};
use rustminario::util::XorShift;

#[test]
fn ejercicio_7() {
  let a = [2, 5, 8, 9, 14];
  let b = [1, 5, 7, 10, 12];
  assert_eq!(merge_by_rank(&a, &b), vec![1, 2, 5, 5, 7, 8, 9, 10, 12, 14]);
}

#[test]
fn muchos_repetidos() {
  assert_eq!(merge_by_rank(&[5, 5, 5], &[5, 5]), vec![5; 5]);
  assert_eq!(merge_by_rank(&[1, 1, 2], &[1, 2, 2]), vec![1, 1, 1, 2, 2, 2]);
}

#[test]
fn igual_que_merge() {
  let mut r = XorShift::new(4);
  for _ in 0..50 {
    let mut a = r.vec_i64(30, 10);
    let mut b = r.vec_i64(25, 10);
    a.sort();
    b.sort();
    let mut out = vec![0; 55];
    merge(&a, &b, &mut out);
    assert_eq!(merge_by_rank(&a, &b), out);
  }
}
